export function generateHandActionPythonScript(options: {
  scenarioName: string;
  pinchThresholdMm: number;
  nipHazardDistanceMm: number;
  cameraRtspUrl?: string;
  plcIp?: string;
}): string {
  const {
    scenarioName,
    pinchThresholdMm = 15.0,
    nipHazardDistanceMm = 30.0,
    cameraRtspUrl = 'rtsp://192.168.1.104:554/live/stream1',
    plcIp = '192.168.1.200',
  } = options;

  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
工业视觉：手部 21 关键点骨骼拓扑与细微动作识别边缘服务
(Industrial Hand 21-Keypoint & Fine-grained Action Detection Gateway)
算法模型: MediaPipe Hands / Ultralytics YOLOv11-Hand + Bi-LSTM Action Classifier
场景: ${scenarioName}
生成时间: ${new Date().toISOString()}
================================================================================
"""

import time
import math
import cv2
import numpy as np
import mediapipe as mp
from pymodbus.client import ModbusTcpClient

# -------------------------------------------------------------
# 1. 现场工控与工业相机配置
# -------------------------------------------------------------
CAMERA_RTSP_URL = "${cameraRtspUrl}"
PLC_HOST = "${plcIp}"
PLC_PORT = 502

# 像素到真实毫米空间比例尺 (需通过现场地坪/工装标定标尺获得)
MM_PER_PIXEL = 1.28

# 细致动作判定阈值 (毫米)
PINCH_THRESHOLD_MM = ${pinchThresholdMm}  # 双指捏取判定阈值
NIP_HAZARD_THRESHOLD_MM = ${nipHazardDistanceMm}  # 防夹手危险间距阈值

# 危险夹伤行程区坐标 [X1, Y1, X2, Y2]
NIP_HAZARD_BBOX = [420, 70, 540, 130]

# -------------------------------------------------------------
# 2. 细微动作判别器
# -------------------------------------------------------------
class IndustrialHandActionDetector:
    def __init__(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.75,
            min_tracking_confidence=0.75,
        )
        self.mp_draw = mp.solutions.drawing_utils

    def calculate_distance_mm(self, p1, p2, width, height):
        dx = (p1.x - p2.x) * width
        dy = (p1.y - p2.y) * height
        px_dist = math.hypot(dx, dy)
        return px_dist * MM_PER_PIXEL

    def classify_micro_action(self, landmarks, width, height):
        """
        基于 21 关键点相对拓扑距离与关节角度判别工业细致动作
        """
        thumb_tip = landmarks[4]
        index_tip = landmarks[8]
        middle_tip = landmarks[12]
        wrist = landmarks[0]

        # 1. 计算食指与拇指捏取距离 (Pinch Distance)
        pinch_dist = self.calculate_distance_mm(thumb_tip, index_tip, width, height)

        # 2. 检查手指指尖与危险冲压/飞达切入区的最小物理间距
        min_hazard_dist = 999.0
        for tip in [thumb_tip, index_tip, middle_tip]:
            tx = tip.x * width
            ty = tip.y * height
            # 距离矩形最近距离
            dx = max(NIP_HAZARD_BBOX[0] - tx, 0, tx - NIP_HAZARD_BBOX[2])
            dy = max(NIP_HAZARD_BBOX[1] - ty, 0, ty - NIP_HAZARD_BBOX[3])
            d_mm = math.hypot(dx, dy) * MM_PER_PIXEL
            if d_mm < min_hazard_dist:
                min_hazard_dist = d_mm

        # 3. 动作分类决策树
        if min_hazard_dist < NIP_HAZARD_THRESHOLD_MM:
            return "HAZARD_REACH_ALERT (危险探入)", min_hazard_dist, pinch_dist

        if pinch_dist < PINCH_THRESHOLD_MM:
            return "PINCH_PICKUP (双指精密捏取)", min_hazard_dist, pinch_dist

        # 食指伸直、其他手指卷曲 -> 单指垂直下压
        index_ext = landmarks[8].y < landmarks[6].y
        middle_curled = landmarks[12].y > landmarks[10].y
        if index_ext and middle_curled:
            return "PRECISION_PRESS (单指微动下压)", min_hazard_dist, pinch_dist

        # 所有手指蜷缩 -> 工具稳固握持
        if landmarks[8].y > landmarks[6].y and landmarks[12].y > landmarks[10].y:
            return "TOOL_GRASP (工具稳固握持)", min_hazard_dist, pinch_dist

        return "HAND_STEADY (平稳待机)", min_hazard_dist, pinch_dist

# -------------------------------------------------------------
# 3. 主监控流
# -------------------------------------------------------------
def run_hand_monitoring_gateway():
    print("[INIT] 启动工业手部 21 关键点与细微动作识别引擎...")
    detector = IndustrialHandActionDetector()
    
    cap = cv2.VideoCapture(CAMERA_RTSP_URL)
    if not cap.isOpened():
        print("[WARN] RTSP 流无法连接，切换至本地摄像头 0")
        cap = cv2.VideoCapture(0)

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            h, w, _ = frame.shape
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = detector.hands.process(rgb)

            # 绘制危险夹伤防区
            cv2.rectangle(
                frame,
                (NIP_HAZARD_BBOX[0], NIP_HAZARD_BBOX[1]),
                (NIP_HAZARD_BBOX[2], NIP_HAZARD_BBOX[3]),
                (0, 0, 255),
                2,
            )
            cv2.putText(
                frame,
                "NIP HAZARD ZONE",
                (NIP_HAZARD_BBOX[0], NIP_HAZARD_BBOX[1] - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 0, 255),
                1,
            )

            if results.multi_hand_landmarks:
                for hand_lms in results.multi_hand_landmarks:
                    # 绘制骨骼连线
                    detector.mp_draw.draw_landmarks(
                        frame, hand_lms, detector.mp_hands.HAND_CONNECTIONS
                    )

                    # 分析细致动作
                    action, hazard_d, pinch_d = detector.classify_micro_action(
                        hand_lms.landmark, w, h
                    )

                    # 现场 HUD 遥测信息渲染
                    color = (0, 0, 255) if "HAZARD" in action else (0, 255, 0)
                    cv2.putText(
                        frame,
                        f"Action: {action} | Pinch: {pinch_d:.1f}mm | HazardDist: {hazard_d:.1f}mm",
                        (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.65,
                        color,
                        2,
                    )

            cv2.imshow("Hand Micro-Action Inspection", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    run_hand_monitoring_gateway()
`;
}
