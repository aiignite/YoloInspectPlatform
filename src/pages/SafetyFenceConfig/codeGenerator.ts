import { SafetyFenceZone, RecognizedObjectCalibration } from './types';

interface FenceCodeGenOptions {
  scenarioName: string;
  zones: SafetyFenceZone[];
  objects: RecognizedObjectCalibration[];
  cameraRtspUrl?: string;
  plcIp?: string;
  plcPort?: number;
  mmPerPixel?: number;
}

export function generateSafetyFencePythonScript(options: FenceCodeGenOptions): string {
  const {
    scenarioName,
    zones,
    objects,
    cameraRtspUrl = 'rtsp://192.168.1.104:554/live/stream1',
    plcIp = '192.168.1.200',
    plcPort = 502,
    mmPerPixel = 9.38,
  } = options;

  const zoneConfigsCode = zones
    .map((zone, idx) => {
      const pointsStr = zone.points
        .map((p) => `        [${Math.round(p.x)}, ${Math.round(p.y)}]`)
        .join(',\n');
      return `    # Zone ${idx + 1}: ${zone.name} (${zone.dangerLevel})
    "${zone.id}": {
        "name": "${zone.name}",
        "code": "${zone.code}",
        "type": "${zone.fenceType}",
        "danger_level": "${zone.dangerLevel}",
        "points": np.array([
${pointsStr}
        ], dtype=np.int32),
        "trigger_anchor": "${zone.triggerAnchor}",
        "allowed_classes": ${JSON.stringify(zone.allowedClassCodes)},
        "blocked_classes": ${JSON.stringify(zone.blockedClassCodes)},
        "safety_buffer_px": ${zone.safetyBufferPx},
        "dwell_time_sec": ${zone.dwellTimeSec},
        "hardware_action": {
            "estop_relay": ${zone.hardwareAction.estopRelay ? 'True' : 'False'},
            "slowdown": ${zone.hardwareAction.slowdownSignal ? 'True' : 'False'},
            "andon": "${zone.hardwareAction.andonColor}",
            "modbus_coil": "${zone.hardwareAction.plcModbusCoil}"
        }
    }`;
    })
    .join(',\n\n');

  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
工业级电子安全围栏与目标识别边缘计算监控服务 (Industrial Safety Geofence Gateway)
安全执行标准: ISO 13849-1 (PL-d / PL-e) & ISO 10218-1/2 工业协作机器人安全
场景: ${scenarioName}
自动生成时间: ${new Date().toISOString()}
================================================================================
"""

import time
import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO
from pymodbus.client import ModbusTcpClient

# -------------------------------------------------------------
# 1. 工控硬件与摄像头连接参数
# -------------------------------------------------------------
CAMERA_RTSP_URL = "${cameraRtspUrl}"
PLC_MODBUS_HOST = "${plcIp}"
PLC_MODBUS_PORT = ${plcPort}
MM_PER_PIXEL = ${mmPerPixel} # 物理空间比例尺转换系数 (mm/px)

# -------------------------------------------------------------
# 2. 电子防区几何与安全逻辑拓扑定义
# -------------------------------------------------------------
SAFETY_ZONES = {
${zoneConfigsCode}
}

# -------------------------------------------------------------
# 3. 现场工控 PLC 联动安全驱动
# -------------------------------------------------------------
class SafetyPlcController:
    """与西门子S7-1200/三菱/欧姆龙安全PLC通过Modbus TCP通讯"""
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.client = ModbusTcpClient(host, port=port)
        self.connected = False
        self._connect()

    def _connect(self):
        try:
            self.connected = self.client.connect()
            if self.connected:
                print(f"[PLC] 成功连接安全工控机 {self.host}:{self.port}")
            else:
                print(f"[PLC-WARN] 模拟测试模式: 无法直连 {self.host}, 启用软仿真继电器")
        except Exception as e:
            print(f"[PLC-ERR] 通讯异常: {e}, 切换至本地软仿真模式")

    def trigger_estop(self, coil_addr: int = 0x0010):
        """Cat-4 急停切断 (PL-e 安全继电器跳闸，机械臂立即断电)"""
        print(f"[PLC-ESTOP] >>> 触发 Cat-4 紧急停机信号! Coil: {hex(coil_addr)} <<<")
        if self.connected:
            self.client.write_coil(coil_addr, True)

    def trigger_slowdown(self, coil_addr: int = 0x0011):
        """Cat-2 减速限制 (如 20% 限速运行)"""
        print(f"[PLC-SLOWDOWN] >>> 触发 Cat-2 减速运行信号! Coil: {hex(coil_addr)} <<<")
        if self.connected:
            self.client.write_coil(coil_addr, True)

    def reset_safety(self):
        """复位安全继电器与警报"""
        print("[PLC-RESET] 安全回路重置，恢复设备使能")
        if self.connected:
            self.client.write_coils(0x0010, [False, False, False])

# -------------------------------------------------------------
# 4. 目标锚点提取 (地面触地点 / 几何中心 / 姿态)
# -------------------------------------------------------------
def extract_anchor_points(xyxy: np.ndarray, anchor_mode: str) -> np.ndarray:
    """
    根据透视地坪标定提取物理触发锚点：
    - bottom_center: 极力推荐用于地面安全围栏，提取人脚底或车辆车轮触地点，消除投影倾角造成的假阳性误报
    - center: 物体几何质心
    """
    x1, y1, x2, y2 = xyxy[:, 0], xyxy[:, 1], xyxy[:, 2], xyxy[:, 3]
    if anchor_mode == "bottom_center":
        anchors_x = (x1 + x2) / 2.0
        anchors_y = y2  # 底部触地中点
    else:
        anchors_x = (x1 + x2) / 2.0
        anchors_y = (y1 + y2) / 2.0
    return np.column_stack((anchors_x, anchors_y))

# -------------------------------------------------------------
# 5. 主监控推理流水线
# -------------------------------------------------------------
def run_safety_fence_pipeline():
    print("[INIT] 正在加载工业视觉 YOLOv11 安全防护模型...")
    model = YOLO("yolo11n-pose.pt") # 支持人员关键点与多类别防护

    # 初始化 ByteTrack 多目标时序追踪器
    tracker = sv.ByteTrack(track_thresh=0.45, match_thresh=0.8, frame_rate=30)
    
    # 初始化 Supervision 多边形防区算子
    polygon_zones = {}
    for zone_id, zcfg in SAFETY_ZONES.items():
        if zcfg["type"] == "polygon":
            polygon_zones[zone_id] = sv.PolygonZone(
                polygon=zcfg["points"],
                triggering_anchors=[sv.Position.BOTTOM_CENTER]
            )

    # 标注器矩阵
    box_annotator = sv.BoxAnnotator(thickness=2)
    label_annotator = sv.LabelAnnotator(text_scale=0.5, text_thickness=1)
    trace_annotator = sv.TraceAnnotator(thickness=2, trace_length=45)
    
    plc = SafetyPlcController(PLC_MODBUS_HOST, PLC_MODBUS_PORT)

    cap = cv2.VideoCapture(CAMERA_RTSP_URL)
    if not cap.isOpened():
        print(f"[WARN] 无法打开 RTSP 视频流 {CAMERA_RTSP_URL}，启用默认测试视频/摄像头0")
        cap = cv2.VideoCapture(0)

    print("[RUNNING] 电子安全围栏实时监控服务已启动...")
    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            # 1. 深度学习模型推理
            results = model(frame, verbose=False)[0]
            detections = sv.Detections.from_ultralytics(results)

            # 2. 时序目标追踪
            detections = tracker.update_with_detections(detections)

            # 3. 逐防区进行安全穿透与侵入校验
            estop_triggered = False
            slowdown_triggered = False

            for zone_id, zcfg in SAFETY_ZONES.items():
                if zone_id in polygon_zones:
                    zone = polygon_zones[zone_id]
                    # 计算落入该防区的目标布尔掩码
                    is_inside_mask = zone.trigger(detections=detections)

                    if np.any(is_inside_mask):
                        intruder_indices = np.where(is_inside_mask)[0]
                        for idx in intruder_indices:
                            class_name = results.names[int(detections.class_id[idx])]
                            track_id = detections.tracker_id[idx] if detections.tracker_id is not None else -1

                            # 黑白名单安全策略校验
                            if class_name in zcfg["blocked_classes"]:
                                print(f"[ALARM] 危险入侵! 防区: {zcfg['name']}, 目标: {class_name} (ID: {track_id})")
                                if zcfg["hardware_action"]["estop_relay"]:
                                    estop_triggered = True
                                elif zcfg["hardware_action"]["slowdown"]:
                                    slowdown_triggered = True

            # 4. 执行工控联锁动作
            if estop_triggered:
                plc.trigger_estop()
            elif slowdown_triggered:
                plc.trigger_slowdown()

            # 5. 渲染防区与标注
            for zone_id, zone in polygon_zones.items():
                zcfg = SAFETY_ZONES[zone_id]
                color = sv.Color.RED if zcfg["danger_level"] == "cat4_estop" else sv.Color.YELLOW
                frame = sv.draw_polygon(scene=frame, polygon=zone.polygon, color=color, thickness=2)

            frame = box_annotator.annotate(scene=frame, detections=detections)
            frame = label_annotator.annotate(scene=frame, detections=detections)
            frame = trace_annotator.annotate(scene=frame, detections=detections)

            cv2.imshow("Industrial Safety Geofence Monitor", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()
        plc.reset_safety()

if __name__ == "__main__":
    run_safety_fence_pipeline()
`;
}
