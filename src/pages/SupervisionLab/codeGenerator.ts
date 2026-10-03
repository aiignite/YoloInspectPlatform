import { PolygonZoneConfig, LineZoneConfig, AnnotatorStyle } from './types';

interface CodeGenOptions {
  sceneName: string;
  polygon: PolygonZoneConfig;
  lineZone: LineZoneConfig;
  annotatorStyle: AnnotatorStyle;
  enableByteTrack: boolean;
  enableTraceAnnotator: boolean;
  enableHeatmap: boolean;
  enableMaskAnnotator: boolean;
  modelWeights: string;
  cameraSource: string;
}

export function generatePythonSupervisionScript(opts: CodeGenOptions): string {
  const polyPointsStr = opts.polygon.points
    .map((p) => `        [${Math.round(p.x)}, ${Math.round(p.y)}]`)
    .join(',\n');

  const lineStartStr = `sv.Point(x=${Math.round(opts.lineZone.start.x)}, y=${Math.round(opts.lineZone.start.y)})`;
  const lineEndStr = `sv.Point(x=${Math.round(opts.lineZone.end.x)}, y=${Math.round(opts.lineZone.end.y)})`;

  return `"""
================================================================================
Roboflow Supervision 工业现场边缘质检推理生产脚本 (Production Edge Pipeline)
应用场景: ${opts.sceneName}
生成时间: 自动与现场视觉画布几何标定同步
硬件适配: NVIDIA Jetson Orin / x86 IPC 工控机 (Linux / Ubuntu 22.04)
================================================================================
"""

import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO

# 1. 工业现场模型与输入流配置 (RTSP工业相机 / GigE Vision / 本地测试视频)
CAMERA_SOURCE = "${opts.cameraSource}"
MODEL_WEIGHTS = "${opts.modelWeights}"

def main():
    print("[INFO] 正在初始化工业视觉检测流水线...")
    
    # 加载已针对当前工件微调的 YOLOv8 / YOLOv11 TensorRT 优化模型
    model = YOLO(MODEL_WEIGHTS)
    
    # 2. 初始化 Roboflow Supervision 核心几何算子
    # 2.1 电子围栏 / 危险防区 PolygonZone (现场标定顶点)
    polygon_points = np.array([
${polyPointsStr}
    ])
    
    polygon_zone = sv.PolygonZone(
        polygon=polygon_points,
        triggering_anchors=[sv.Position.CENTER]
    )
    
    # 2.2 流水线虚拟光电计件线 LineZone (带正反穿越检测)
    line_zone = sv.LineZone(
        start=${lineStartStr},
        end=${lineEndStr}
    )
    
    # 3. 初始化多目标跟踪器 ByteTrack 与 标注器矩阵 (Annotators)
    tracker = sv.ByteTrack(
        track_activation_threshold=0.35,
        lost_track_buffer=30,
        minimum_matching_threshold=0.8
    )
    
    # 标注器矩阵配置
    corner_annotator = sv.CornerAnnotator(
        color=sv.ColorPalette.from_hex(['#00f2fe', '#ff4d4f', '#faad14']),
        thickness=2,
        length=12
    )
    box_annotator = sv.BoxAnnotator(thickness=2)
    trace_annotator = sv.TraceAnnotator(trace_length=30, thickness=2)
    polygon_annotator = sv.PolygonZoneAnnotator(
        zone=polygon_zone,
        color=sv.Color.from_hex('${opts.polygon.color}'),
        thickness=2,
        text_thickness=1,
        text_scale=0.6
    )
    line_annotator = sv.LineZoneAnnotator(
        thickness=2,
        text_thickness=1,
        text_scale=0.6
    )
    label_annotator = sv.LabelAnnotator(
        text_position=sv.Position.TOP_LEFT,
        text_scale=0.5,
        text_thickness=1
    )
${opts.enableHeatmap ? `    heatmap_annotator = sv.HeatmapAnnotator(radius=25, opacity=0.4)\n` : ''}
    # 4. 打开现场相机视频捕获
    cap = cv2.VideoCapture(CAMERA_SOURCE)
    if not cap.isOpened():
        raise RuntimeError(f"无法打开工业相机输入源: {CAMERA_SOURCE}")

    print("[SUCCESS] Supervision 算子与相机流就绪，进入实时推理主循环...")

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        # A. 执行 YOLO 边缘推理
        results = model(frame, verbose=False, conf=0.45)[0]
        detections = sv.Detections.from_ultralytics(results)

        # B. 过滤置信度与特定工业类别
        # detections = detections[detections.confidence > 0.5]

        # C. 连续多目标时序追踪 (ByteTrack)
        detections = tracker.update_with_detections(detections)

        # D. 触发电子围栏与计件规则判定
        is_in_zone = polygon_zone.trigger(detections=detections)
        line_zone.trigger(detections=detections)

        # E. 工业现场 PLC 信号联动判定
        if np.any(is_in_zone):
            trigger_plc_alarm(reason="PolygonZone Intrusion / Defect Alert")

        # F. 绘制 Supervision 标注图层
        annotated_frame = frame.copy()
        
        # 绘制围栏与虚拟线
        annotated_frame = polygon_annotator.annotate(scene=annotated_frame)
        annotated_frame = line_annotator.annotate(scene=annotated_frame, line_counter=line_zone)

        # 绘制运动轨迹流
        annotated_frame = trace_annotator.annotate(scene=annotated_frame, detections=detections)

        # 绘制检测框与智能工控标签
        labels = [
            f"#{tracker_id} {class_name} {confidence:.2f}"
            for tracker_id, class_name, confidence in zip(
                detections.tracker_id, detections.data['class_name'], detections.confidence
            )
        ]
        annotated_frame = corner_annotator.annotate(scene=annotated_frame, detections=detections)
        annotated_frame = label_annotator.annotate(
            scene=annotated_frame, detections=detections, labels=labels
        )

        # G. 显示或推流至现场监视器
        cv2.imshow("Supervision Industrial Inspection", annotated_frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

def trigger_plc_alarm(reason: str):
    """
    模拟工控现场联动: 向 PLC 发送 Modbus TCP / GPIO 24V 高电平信号
    触发气动剔除阀或三色报警灯鸣响
    """
    # 示例: modbus_client.write_coil(address=0x0010, value=True)
    pass

if __name__ == "__main__":
    main()
`;
}
