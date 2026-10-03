import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
const httpServer = createServer(app);
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload directories exist
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const SNAPSHOTS_DIR = path.join(UPLOADS_DIR, 'snapshots');
const MODELS_DIR = path.join(UPLOADS_DIR, 'models');
const BATCH_DIR = path.join(UPLOADS_DIR, 'batch_videos');
[UPLOADS_DIR, SNAPSHOTS_DIR, MODELS_DIR, BATCH_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use('/uploads', express.static(UPLOADS_DIR));

// -------------------------------------------------------------
// In-Memory Database & Seed Data
// -------------------------------------------------------------
const users = [
  { id: 1, username: 'admin', display_name: '系统管理员 (Admin)', role: 'admin', password: 'password', is_active: true, created_at: new Date().toISOString() },
  { id: 2, username: 'manager', display_name: '产线主管 (Manager)', role: 'manager', password: 'password', is_active: true, created_at: new Date().toISOString() },
  { id: 3, username: 'operator', display_name: '质检操作员 (Operator)', role: 'operator', password: 'password', is_active: true, created_at: new Date().toISOString() },
];

const sessions = [
  { id: 'sess-01', user_id: 1, username: 'admin', ip_address: '127.0.0.1', user_agent: 'Chrome/124.0.0.0 (Linux)', created_at: new Date(Date.now() - 3600000).toISOString(), last_activity: new Date().toISOString() },
  { id: 'sess-02', user_id: 2, username: 'manager', ip_address: '192.168.1.105', user_agent: 'Chrome/124.0.0.0 (Windows)', created_at: new Date(Date.now() - 7200000).toISOString(), last_activity: new Date(Date.now() - 1800000).toISOString() },
];

const loginHistory = [
  { id: 1, username: 'admin', ip_address: '127.0.0.1', user_agent: 'Chrome/124.0.0.0', status: 'success', message: '登录成功', created_at: new Date(Date.now() - 120000).toISOString() },
  { id: 2, username: 'manager', ip_address: '192.168.1.105', user_agent: 'Chrome/124.0.0.0', status: 'success', message: '登录成功', created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 3, username: 'operator', ip_address: '192.168.1.110', user_agent: 'Firefox/120.0.0', status: 'success', message: '登录成功', created_at: new Date(Date.now() - 18000000).toISOString() },
];

const auditLogs = [
  { id: 1, user_id: 1, username: 'admin', action: 'DEPLOY_MODEL', resource: 'Model #3 (YOLOv8-Turbo-INT8)', details: '启用INT8量化模型替换Baseline，产线识别耗时降低89%', ip_address: '127.0.0.1', created_at: new Date(Date.now() - 600000).toISOString() },
  { id: 2, user_id: 1, username: 'admin', action: 'OPTIMIZE_INFERENCE', resource: 'YOLO Acceleration Engine', details: '开启自适应ROI与时序动态跳帧 (Motion Keyframe Gating)', ip_address: '127.0.0.1', created_at: new Date(Date.now() - 1800000).toISOString() },
  { id: 3, user_id: 2, username: 'manager', action: 'ACK_ALERT', resource: 'Alert #104 (SMT元件错位)', details: '已通知SMT产线巡检工程师人工确认并调整供料器', ip_address: '192.168.1.105', created_at: new Date(Date.now() - 3600000).toISOString() },
];

const cameras = [
  { id: 1, camera_id: 'cam_smt_01', name: 'SMT贴片工位-01', location: '车间A区-SMT一号线', rtsp_url: 'rtsp://192.168.1.101:554/live/stream1', status: 'online', is_active: true, resolution: '1920x1080', fps: 30, model_type: 'defect', current_latency_ms: 18.2 },
  { id: 2, camera_id: 'cam_smt_02', name: 'SMT回流焊出板-02', location: '车间A区-SMT二号线', rtsp_url: 'rtsp://192.168.1.102:554/live/stream1', status: 'online', is_active: true, resolution: '1920x1080', fps: 30, model_type: 'defect', current_latency_ms: 17.5 },
  { id: 3, camera_id: 'cam_asm_01', name: '总装线螺丝锁附工位', location: '车间B区-组装线A', rtsp_url: 'rtsp://192.168.1.103:554/live/stream1', status: 'online', is_active: true, resolution: '1280x720', fps: 30, model_type: 'efficiency', current_latency_ms: 19.4 },
  { id: 4, camera_id: 'cam_safety_01', name: '防静电与安全穿戴监控', location: '车间入闸口通道', rtsp_url: 'rtsp://192.168.1.104:554/live/stream1', status: 'online', is_active: true, resolution: '1920x1080', fps: 25, model_type: 'safety', current_latency_ms: 21.0 },
  { id: 5, camera_id: 'cam_logistics_01', name: 'AGV仓储物流转运区', location: '物流仓储C区', rtsp_url: 'rtsp://192.168.1.105:554/live/stream1', status: 'online', is_active: true, resolution: '1920x1080', fps: 25, model_type: 'safety', current_latency_ms: 22.1 },
  { id: 6, camera_id: 'cam_pack_01', name: '包装质检出货台', location: '包装流水线03', rtsp_url: 'rtsp://192.168.1.106:554/live/stream1', status: 'online', is_active: true, resolution: '1280x720', fps: 30, model_type: 'defect', current_latency_ms: 16.8 },
];

let models = [
  {
    id: 1,
    name: 'YOLOv8n-Original (未优化基线)',
    version: 'v8.0.0-cpu',
    model_path: 'models/yolov8n_baseline.pt',
    model_type: 'defect',
    description: '原始全分辨率FP32 CPU推理，无ROI裁剪与量化加速，高延迟',
    file_size: 6832633,
    accuracy: 0.948,
    precision: 0.932,
    recall: 0.925,
    map50: 0.941,
    map50_95: 0.762,
    inference_speed: 198.5, // ms
    is_active: false,
    status: 'ready',
    deployed_at: null,
    created_at: '2026-03-01T10:00:00Z',
    optimization_profile: {
      quantization: 'FP32',
      input_size: 1080,
      fast_nms: false,
      motion_gating: false,
      speedup_ratio: '1.0x (基线)',
    }
  },
  {
    id: 2,
    name: 'YOLOv8n-Pose (原生姿态基线)',
    version: 'v8.0.0-pose',
    model_path: 'models/yolov8n_pose.pt',
    model_type: 'pose',
    description: '原生未优化姿态骨骼检测，全精度计算17个骨骼关节点，推理耗时较长',
    file_size: 6832633,
    accuracy: 0.935,
    precision: 0.921,
    recall: 0.910,
    map50: 0.928,
    map50_95: 0.735,
    inference_speed: 242.0, // ms
    is_active: false,
    status: 'ready',
    deployed_at: null,
    created_at: '2026-03-05T10:00:00Z',
    optimization_profile: {
      quantization: 'FP32',
      input_size: 1080,
      fast_nms: false,
      motion_gating: false,
      speedup_ratio: '1.0x (基线)',
    }
  },
  {
    id: 3,
    name: 'YOLOv8-Turbo-INT8 (量化超频加速引擎)',
    version: 'v8.2.4-int8-turbo',
    model_path: 'models/yolov8n_turbo_int8.engine',
    model_type: 'defect',
    description: '★推荐：经过INT8量化、自适应ROI裁剪与向量化快速NMS，响应时间压减89%，吞吐量提升至54 FPS',
    file_size: 1920400,
    accuracy: 0.943,
    precision: 0.929,
    recall: 0.921,
    map50: 0.937,
    map50_95: 0.755,
    inference_speed: 18.4, // ms
    is_active: true,
    status: 'deployed',
    deployed_at: '2026-09-25T07:00:00Z',
    created_at: '2026-09-20T10:00:00Z',
    optimization_profile: {
      quantization: 'INT8 TensorRT/ONNX',
      input_size: 320,
      fast_nms: true,
      motion_gating: true,
      speedup_ratio: '10.8x 极速提升',
    }
  },
  {
    id: 4,
    name: 'YOLOv11-Fast-FP16 (高精度半精度加速)',
    version: 'v11.1-fp16',
    model_path: 'models/yolov11_fp16.onnx',
    model_type: 'safety',
    description: '采用FP16半精度加速与动态特征缓存，兼顾0.962极高mAP与24ms快速响应',
    file_size: 3450200,
    accuracy: 0.962,
    precision: 0.951,
    recall: 0.948,
    map50: 0.959,
    map50_95: 0.784,
    inference_speed: 24.2, // ms
    is_active: true,
    status: 'deployed',
    deployed_at: '2026-09-25T07:00:00Z',
    created_at: '2026-09-22T10:00:00Z',
    optimization_profile: {
      quantization: 'FP16 Half',
      input_size: 416,
      fast_nms: true,
      motion_gating: true,
      speedup_ratio: '8.2x 提升',
    }
  },
  {
    id: 5,
    name: 'YOLO-Pose-Turbo (超低延迟姿态检测引擎)',
    version: 'v8.2-pose-turbo',
    model_path: 'models/yolov8_pose_turbo.engine',
    model_type: 'pose',
    description: '针对工位人员SOP合规与安全防线定制，剪枝精简主干网络并支持关键点骨骼矢量加速，耗时从242ms压减至22ms',
    file_size: 2150000,
    accuracy: 0.931,
    precision: 0.918,
    recall: 0.905,
    map50: 0.923,
    map50_95: 0.728,
    inference_speed: 22.5, // ms
    is_active: true,
    status: 'deployed',
    deployed_at: '2026-09-25T07:00:00Z',
    created_at: '2026-09-23T10:00:00Z',
    optimization_profile: {
      quantization: 'INT8 SIMD',
      input_size: 320,
      fast_nms: true,
      motion_gating: true,
      speedup_ratio: '10.7x 极速提升',
    }
  },
  {
    id: 6,
    name: 'SMT-Defect-Accelerated (贴片缺陷专精加速模型)',
    version: 'v2.1-smt-turbo',
    model_path: 'models/smt_defect_turbo.engine',
    model_type: 'efficiency',
    description: '针对SMT贴片机元件漏贴、锡桥、极性反向特化加速，支持小目标微细特征高帧率捕获',
    file_size: 2840000,
    accuracy: 0.971,
    precision: 0.965,
    recall: 0.958,
    map50: 0.968,
    map50_95: 0.812,
    inference_speed: 16.2, // ms
    is_active: true,
    status: 'deployed',
    deployed_at: '2026-09-25T07:00:00Z',
    created_at: '2026-09-24T10:00:00Z',
    optimization_profile: {
      quantization: 'INT8 TensorRT',
      input_size: 320,
      fast_nms: true,
      motion_gating: true,
      speedup_ratio: '12.2x 极速提升',
    }
  }
];

let alerts = [
  { id: 101, camera_id: 'cam_safety_01', severity: 'critical', event_type: 'safety', message: '检测到未佩戴防静电手环与工作帽进入核心SMT洁净区', acknowledged: false, acknowledged_by: null, created_at: new Date(Date.now() - 120000).toISOString() },
  { id: 102, camera_id: 'cam_smt_01', severity: 'warning', event_type: 'defect', message: 'SMT-01工位元器件错位 (misalignment 92.4%)', acknowledged: false, acknowledged_by: null, created_at: new Date(Date.now() - 480000).toISOString() },
  { id: 103, camera_id: 'cam_asm_01', severity: 'info', event_type: 'efficiency', message: '总装线螺丝锁附工位节拍稍长 (+1.8s)，提示关注工人动作曲线', acknowledged: true, acknowledged_by: 'manager', created_at: new Date(Date.now() - 1800000).toISOString() },
  { id: 104, camera_id: 'cam_smt_02', severity: 'warning', event_type: 'defect', message: '回流焊出板锡膏桥接疑似缺陷 (solder_defect 88.5%)', acknowledged: true, acknowledged_by: 'admin', created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 105, camera_id: 'cam_logistics_01', severity: 'critical', event_type: 'safety', message: 'AGV主运行通道检测到人员越界入侵 (intrusion 96.1%)', acknowledged: true, acknowledged_by: 'admin', created_at: new Date(Date.now() - 7200000).toISOString() },
];

let alertRules = [
  { id: 1, name: '未佩戴安全帽/防静电帽', event_type: 'safety', condition: 'class in ["no_helmet", "no_vest"] and conf > 0.75', severity: 'critical', notify_channels: ['websocket', 'sms', 'mes'], is_enabled: true },
  { id: 2, name: 'SMT元件缺失与极性反向', event_type: 'defect', condition: 'class in ["missing_component", "polarity_reverse"] and conf > 0.70', severity: 'warning', notify_channels: ['websocket', 'mes'], is_enabled: true },
  { id: 3, name: 'AGV危险通道人员闯入', event_type: 'safety', condition: 'class == "intrusion" and conf > 0.80', severity: 'critical', notify_channels: ['websocket', 'siren'], is_enabled: true },
  { id: 4, name: '螺丝漏打与节拍超时', event_type: 'efficiency', condition: 'cycle_time > target_time * 1.2', severity: 'info', notify_channels: ['websocket'], is_enabled: true },
];

let events = [
  { id: 201, camera_id: 'cam_smt_01', event_type: 'defect', class_name: 'misalignment', confidence: 0.924, bbox: [210, 140, 290, 220], inference_ms: 18.2, timestamp: new Date(Date.now() - 60000).toISOString() },
  { id: 202, camera_id: 'cam_safety_01', event_type: 'safety', class_name: 'no_helmet', confidence: 0.895, bbox: [120, 80, 240, 310], inference_ms: 21.0, timestamp: new Date(Date.now() - 150000).toISOString() },
  { id: 203, camera_id: 'cam_smt_02', event_type: 'defect', class_name: 'solder_defect', confidence: 0.885, bbox: [410, 330, 480, 390], inference_ms: 17.5, timestamp: new Date(Date.now() - 320000).toISOString() },
  { id: 204, camera_id: 'cam_asm_01', event_type: 'efficiency', class_name: 'cycle_normal', confidence: 0.960, bbox: [150, 100, 350, 400], inference_ms: 19.4, timestamp: new Date(Date.now() - 480000).toISOString() },
  { id: 205, camera_id: 'cam_pack_01', event_type: 'defect', class_name: 'foreign_object', confidence: 0.912, bbox: [320, 200, 390, 270], inference_ms: 16.8, timestamp: new Date(Date.now() - 720000).toISOString() },
];

let batchTasks: any[] = [
  {
    id: 'bt-901',
    filename: 'SMT_Line1_Inspection_1080p.mp4',
    status: 'completed',
    progress: 100.0,
    current_step: '分析完成 (INT8高速推理)',
    total_frames: 1800,
    processed_frames: 1800,
    detections_count: 342,
    result_summary: {
      video_info: { fps: 30, duration_seconds: 60, resolution: '1920x1080', total_frames: 1800, sampled_frames: 600 },
      detection_summary: { total_detections: 342, class_counts: { misalignment: 42, solder_defect: 28, normal_pcb: 272 } },
      scene_analysis: { scene_changes: 8, avg_change_score: 0.18, keyframe_positions: [10, 180, 360, 540, 720, 900, 1200] },
      performance: { baseline_estimated_time_sec: 119.1, optimized_actual_time_sec: 11.2, speedup: '10.6x' }
    },
    error_message: '',
    created_at: new Date(Date.now() - 1800000).toISOString(),
    started_at: new Date(Date.now() - 1790000).toISOString(),
    completed_at: new Date(Date.now() - 1778800).toISOString(),
  },
  {
    id: 'bt-902',
    filename: 'Assembly_Station_A_Ergonomics.mp4',
    status: 'completed',
    progress: 100.0,
    current_step: '分析完成 (姿态骨骼向量加速)',
    total_frames: 2400,
    processed_frames: 2400,
    detections_count: 512,
    result_summary: {
      video_info: { fps: 30, duration_seconds: 80, resolution: '1280x720', total_frames: 2400, sampled_frames: 800 },
      detection_summary: { total_detections: 512, class_counts: { person_pose: 490, posture_alert: 22 } },
      scene_analysis: { scene_changes: 5, avg_change_score: 0.12, keyframe_positions: [30, 240, 500, 800, 1200] },
      performance: { baseline_estimated_time_sec: 193.6, optimized_actual_time_sec: 17.8, speedup: '10.9x' }
    },
    error_message: '',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    started_at: new Date(Date.now() - 7190000).toISOString(),
    completed_at: new Date(Date.now() - 7172200).toISOString(),
  }
];

let mesOrders = [
  { id: 1, order_no: 'WO-20260925-SMT01', product_name: '车载智能主控板 PCB-V3', planned_qty: 5000, completed_qty: 3820, defect_qty: 42, status: 'in_progress', line: 'SMT一号线', yield_rate: 98.9, updated_at: new Date().toISOString() },
  { id: 2, order_no: 'WO-20260925-ASM02', product_name: '工业级网关机顶盒', planned_qty: 3000, completed_qty: 2150, defect_qty: 28, status: 'in_progress', line: '组装线A', yield_rate: 98.7, updated_at: new Date().toISOString() },
  { id: 3, order_no: 'WO-20260924-PACK03', product_name: '高频无线传感器模组', planned_qty: 8000, completed_qty: 8000, defect_qty: 68, status: 'completed', line: '包装流水线03', yield_rate: 99.15, updated_at: new Date(Date.now() - 36000000).toISOString() },
];

let videoTemplates: any[] = [
  {
    id: 1,
    name: 'SMT贴片与元件引脚插入标准流程 (SOP-SMT01)',
    description: '涵盖高精度电容对齐、IC芯片引脚插入与双目校准3个关键步骤',
    video_path: '/uploads/sample_smt.mp4',
    duration_seconds: 14.5,
    fps: 30,
    frame_count: 435,
    resolution: '1920x1080',
    business_type: 'assembly',
    station_id: 'cam_smt_01',
    learning_config: { focus_classes: ['pcb_board', 'capacitor', 'ic_chip'], min_confidence: 0.35, sample_rate: 2 },
    sop_content: {
      standard_steps: [
        { step: 1, name: 'PCB板定位到位', standard_time_sec: 2.5, tolerance: 0.5 },
        { step: 2, name: '机械手吸附电容并下压', standard_time_sec: 4.8, tolerance: 0.8 },
        { step: 3, name: '双目视觉复核引脚平整度', standard_time_sec: 3.2, tolerance: 0.6 },
      ]
    },
    workflow_summary: { total_cycles: 48, mean_cycle_sec: 10.5, adherence_rate: 98.2 },
    status: 'completed',
    created_at: '2026-03-10T08:00:00Z',
  },
  {
    id: 2,
    name: '工业机箱螺丝自动锁紧与扭矩确认 (SOP-SCREW02)',
    description: '包含吸嘴取螺丝、寻孔、对位下压、扭矩绿灯确认',
    video_path: '/uploads/sample_screw.mp4',
    duration_seconds: 11.2,
    fps: 30,
    frame_count: 336,
    resolution: '1920x1080',
    business_type: 'assembly',
    station_id: 'cam_asm_01',
    learning_config: { focus_classes: ['screw_hole', 'electric_screwdriver', 'operator_hand'], min_confidence: 0.4 },
    sop_content: {
      standard_steps: [
        { step: 1, name: '电批吸嘴抓取M3螺钉', standard_time_sec: 1.8, tolerance: 0.3 },
        { step: 2, name: '同轴光学寻孔对位', standard_time_sec: 2.1, tolerance: 0.4 },
        { step: 3, name: '恒扭矩锁紧直至离合器释放', standard_time_sec: 3.5, tolerance: 0.5 },
      ]
    },
    workflow_summary: { total_cycles: 64, mean_cycle_sec: 7.4, adherence_rate: 99.1 },
    status: 'completed',
    created_at: '2026-03-15T08:00:00Z',
  },
  {
    id: 3,
    name: '高频传感器微点胶与外观视觉质检 (SOP-GLUE03)',
    description: '包含精密点胶针头出胶轨迹、胶量厚度测算及瑕疵复核',
    video_path: '/uploads/sample_glue.mp4',
    duration_seconds: 9.8,
    fps: 30,
    frame_count: 294,
    resolution: '1920x1080',
    business_type: 'welding',
    station_id: 'cam_glue_02',
    learning_config: { focus_classes: ['dispenser_needle', 'sensor_housing', 'glue_track'], min_confidence: 0.45 },
    sop_content: {
      standard_steps: [
        { step: 1, name: '针头Z轴下降寻位', standard_time_sec: 1.6, tolerance: 0.2 },
        { step: 2, name: '环形轨迹微点胶注胶', standard_time_sec: 5.2, tolerance: 0.6 },
        { step: 3, name: '激光位移测厚度与固化', standard_time_sec: 3.0, tolerance: 0.4 },
      ]
    },
    workflow_summary: { total_cycles: 85, mean_cycle_sec: 9.8, adherence_rate: 99.5 },
    status: 'completed',
    created_at: '2026-03-20T08:00:00Z',
  },
];

let activeSopSpecification: any = {
  template_id: 1,
  template_name: 'SMT贴片与元件引脚插入标准流程 (SOP-SMT01)',
  doc_no: 'SOP-SMT-2026-001',
  revision: 'Rev.1.3',
  station_id: 'ST-SMT-A03',
  product_line: 'SMT 高速产线 #01',
  author: '工艺部 工业工程科 (IE)',
  approved_by: '制造总监 / 质量主管',
  effective_date: '2026-03-20',
  total_cycle_sec: 10.5,
  steps: [
    {
      step_order: 1,
      step_name: 'PCB板基准对位与工装夹紧',
      standard_sec: 2.5,
      tolerance_sec: 0.5,
      target_roi_name: '主装配工装基准区 (Assembly Nest)',
      hand_action: '双手指尖平稳对位 (Hold)',
      critical_check: '光纤传感器到位绿灯点亮，两基准孔销位严密对齐',
      poka_yoke: '未夹紧前禁止吸嘴触发下降',
    },
    {
      step_order: 2,
      step_name: '精密元件拾取与插装对准',
      standard_sec: 4.8,
      tolerance_sec: 0.8,
      target_roi_name: '料盒 1 号区 (Bin 1 - 0402电容)',
      hand_action: '精密双指捏取 (8mm Fine Pinch)',
      critical_check: '仅限料盒1取料，严禁进入料盒2或料盒3；手套ESD导通',
      poka_yoke: '手部骨骼穿透非目标料盒即刻声光蜂鸣预警',
    },
    {
      step_order: 3,
      step_name: '电批恒扭矩锁螺丝固定',
      standard_sec: 3.5,
      tolerance_sec: 0.5,
      target_roi_name: '螺栓锁紧工作区',
      hand_action: '工具握持 (Power Grip) + 手腕自转',
      critical_check: '电批扭力达到 0.45N·m 自动离合切断',
      poka_yoke: '锁附动作漏做直接禁止推入下工序',
    },
    {
      step_order: 4,
      step_name: '一维/二维码条码扫描过站',
      standard_sec: 1.5,
      tolerance_sec: 0.4,
      target_roi_name: '条码扫描区 (Barcode Scanner)',
      hand_action: '条码枪瞄准下压',
      critical_check: 'MES 系统过站状态回传成功 (HTTP 200 OK)',
      poka_yoke: '扫码未通过阻挡气缸不抬起',
    },
    {
      step_order: 5,
      step_name: '平稳推入下道工序出板轨道',
      standard_sec: 1.2,
      tolerance_sec: 0.3,
      target_roi_name: '下道接驳台 (Outfeed Conveyor)',
      hand_action: '双手平推',
      critical_check: '出板皮带轮传感器感应触发',
      poka_yoke: '未完全离开治具严禁移入下一PCB',
    },
  ],
};

let goldenStandards: any[] = [
  {
    id: 1,
    code: 'GS-SMT-001',
    name: 'SMT贴片与高精器件插装大师级黄金标准 (Master Benchmark)',
    description: '由全国技能大赛冠军高工示范录制，动作轨迹完全符合人体工程学与防静电规范，无多余虚步。',
    master_operator: '高志远 (全国技能大赛冠军 / 特级技师)',
    station_id: 'ST-SMT-A03',
    business_type: 'assembly',
    is_active: true,
    total_duration_sec: 10.5,
    tolerance_sec: 0.3,
    video_path: '/uploads/sample_smt.mp4',
    stability_score: 99.4,
    created_at: '2026-03-10T10:00:00Z',
    steps: [
      { step_order: 1, name: 'PCB板定位到位与工装锁紧', standard_sec: 2.5, tolerance_sec: 0.3, golden_velocity_mms: 45, pinch_gap_mm: 22, target_roi: '主装配工装基准区', hand_action: '双手平稳对称对位' },
      { step_order: 2, name: '料盒1精密器件拾取与下压插装', standard_sec: 4.8, tolerance_sec: 0.4, golden_velocity_mms: 82, pinch_gap_mm: 8.2, target_roi: '料盒1号区', hand_action: '精密双指微捏取 (Fine Pinch)' },
      { step_order: 3, name: '双目视觉复核引脚平整度与锁附', standard_sec: 3.2, tolerance_sec: 0.3, golden_velocity_mms: 55, pinch_gap_mm: 18, target_roi: '螺栓锁紧工作区', hand_action: '工具全握持 (Power Grip)' },
    ],
    motion_signature: {
      avg_speed_mms: 60.6,
      max_acceleration_mms2: 180,
      path_efficiency: 98.7,
      tremor_jitter_px: 0.4,
      smoothness_index: 0.96,
      keypoint_envelope_bound: '±12px',
    },
  },
  {
    id: 2,
    code: 'GS-SCREW-002',
    name: '工业机箱螺丝自动锁紧与扭矩确认黄金标准',
    description: '采用恒扭矩离合释放标定，电批同轴寻孔对位零晃动，节拍效率提升25%。',
    master_operator: '李建军 (工匠技师 / 资深IE主管)',
    station_id: 'ST-ASM-02',
    business_type: 'assembly',
    is_active: false,
    total_duration_sec: 7.4,
    tolerance_sec: 0.2,
    video_path: '/uploads/sample_screw.mp4',
    stability_score: 98.8,
    created_at: '2026-03-15T14:30:00Z',
    steps: [
      { step_order: 1, name: '电批吸嘴抓取M3螺钉', standard_sec: 1.8, tolerance_sec: 0.2, golden_velocity_mms: 70, pinch_gap_mm: 12, target_roi: '螺钉供料盘', hand_action: '工具下压吸附' },
      { step_order: 2, name: '同轴光学寻孔对位', standard_sec: 2.1, tolerance_sec: 0.3, golden_velocity_mms: 40, pinch_gap_mm: 20, target_roi: '机箱基座螺孔', hand_action: '微距对位' },
      { step_order: 3, name: '恒扭矩锁紧直至离合器释放', standard_sec: 3.5, tolerance_sec: 0.3, golden_velocity_mms: 25, pinch_gap_mm: 20, target_roi: '紧固工装', hand_action: '垂直下压握持' },
    ],
    motion_signature: {
      avg_speed_mms: 45.0,
      max_acceleration_mms2: 120,
      path_efficiency: 99.1,
      tremor_jitter_px: 0.3,
      smoothness_index: 0.98,
      keypoint_envelope_bound: '±8px',
    },
  },
  {
    id: 3,
    code: 'GS-GLUE-003',
    name: '高频传感器微点胶与激光位移质检黄金标准',
    description: '恒温恒压胶枪出胶，点胶环形轨迹连续无断胶，激光干涉测厚公差严格把控。',
    master_operator: '赵雪 (光学装配大师 / 质量标兵)',
    station_id: 'ST-GLUE-01',
    business_type: 'welding',
    is_active: false,
    total_duration_sec: 9.8,
    tolerance_sec: 0.3,
    video_path: '/uploads/sample_glue.mp4',
    stability_score: 99.2,
    created_at: '2026-03-20T09:15:00Z',
    steps: [
      { step_order: 1, name: '点胶针头Z轴快速下降寻位', standard_sec: 1.6, tolerance_sec: 0.2, golden_velocity_mms: 90, pinch_gap_mm: 25, target_roi: '传感器腔体', hand_action: '工具平移' },
      { step_order: 2, name: '环形轨迹微点胶出胶注胶', standard_sec: 5.2, tolerance_sec: 0.4, golden_velocity_mms: 32, pinch_gap_mm: 22, target_roi: '密封圈环形槽', hand_action: '匀速回旋微控' },
      { step_order: 3, name: '激光位移测厚度与UV固化', standard_sec: 3.0, tolerance_sec: 0.3, golden_velocity_mms: 15, pinch_gap_mm: 28, target_roi: '固化检查工位', hand_action: '平稳托举' },
    ],
    motion_signature: {
      avg_speed_mms: 45.6,
      max_acceleration_mms2: 110,
      path_efficiency: 99.3,
      tremor_jitter_px: 0.35,
      smoothness_index: 0.97,
      keypoint_envelope_bound: '±10px',
    },
  },
];

let learningSessions: any[] = [
  {
    id: 101,
    template_id: 1,
    status: 'completed',
    progress: 100,
    total_frames: 435,
    processed_frames: 435,
    objects_detected: 864,
    actions_identified: 3,
    learning_mode: 'action_and_object',
    focus_classes: ['pcb_board', 'capacitor', 'ic_chip', 'operator_hand'],
    sample_rate: 2,
    min_confidence: 0.4,
    scene_threshold: 0.25,
    min_action_duration_seconds: 1.0,
    object_change_sensitivity: 'medium',
    error_message: null,
    analysis_result: {
      keyframe_count: 6,
      average_fps: 30,
      stability_score: 95.8,
      recommended_augmentations: ['Mosaic 4x', 'RandomHSV', 'HorizontalFlip'],
    },
    started_at: '2026-03-20T09:00:00Z',
    completed_at: '2026-03-20T09:01:12Z',
  },
  {
    id: 102,
    template_id: 2,
    status: 'completed',
    progress: 100,
    total_frames: 336,
    processed_frames: 336,
    objects_detected: 620,
    actions_identified: 3,
    learning_mode: 'action_and_object',
    focus_classes: ['screw_hole', 'electric_screwdriver', 'operator_hand'],
    sample_rate: 2,
    min_confidence: 0.45,
    scene_threshold: 0.3,
    error_message: null,
    analysis_result: {
      keyframe_count: 5,
      stability_score: 97.2,
    },
    started_at: '2026-03-21T10:00:00Z',
    completed_at: '2026-03-21T10:01:05Z',
  }
];

let actionSequences: any[] = [
  {
    id: 201,
    session_id: 101,
    step_order: 1,
    action_name: 'PCB板基准对位',
    user_defined_name: '工位导轨送板定位',
    note: '气缸推送PCB到位，光纤传感器触发',
    is_kept: true,
    description: '通过导轨微动气缸将PCB板送入夹持治具定位销',
    start_time: 0.0,
    end_time: 2.8,
    duration: 2.8,
    confidence: 0.96,
    keyframe_path: 'uploads/snapshots/snapshot_1.jpg',
    objects_in_scene: ['pcb_board', 'fixture_clamp'],
    suggestions: [
      { text: '建议将气动夹紧微动开关信号接入边缘节点减少0.3秒等待', impact: '高' }
    ]
  },
  {
    id: 202,
    session_id: 101,
    step_order: 2,
    action_name: '机械手吸附电容并下压',
    user_defined_name: 'SMT贴装头精细下压',
    note: '真空吸嘴取料，Z轴伺服闭环下压',
    is_kept: true,
    description: '工业机械手自供料盘吸取贴片电解电容，对准焊盘微米级压装',
    start_time: 2.8,
    end_time: 7.6,
    duration: 4.8,
    confidence: 0.94,
    keyframe_path: 'uploads/snapshots/snapshot_2.jpg',
    objects_in_scene: ['capacitor', 'pcb_board', 'smt_nozzle'],
    suggestions: [
      { text: '吸嘴真空压力到达时可提前50ms启动下压触发', impact: '中' }
    ]
  },
  {
    id: 203,
    session_id: 101,
    step_order: 3,
    action_name: '双目视觉复核引脚平整度',
    user_defined_name: 'AOI光学微距平整度检测',
    note: '环形无影光源闪光，双目相机抓拍',
    is_kept: true,
    description: '侧向激光测高与正向微距相机测量引脚共面度',
    start_time: 7.6,
    end_time: 11.2,
    duration: 3.6,
    confidence: 0.98,
    keyframe_path: 'uploads/snapshots/snapshot_3.jpg',
    objects_in_scene: ['ic_chip', 'solder_pads', 'pcb_board'],
    suggestions: []
  },
];

let objectCategories = [
  { id: 1, name: 'pcb_board', display_name: 'PCB板基底', description: 'FR-4阻焊层绿色/蓝色主板基底', color: '#1a73e8', count: 1200 },
  { id: 2, name: 'capacitor', display_name: 'SMT贴片电阻/电容', description: '0402/0603/0805贴片无源器件', color: '#34a853', count: 5400 },
  { id: 3, name: 'ic_chip', display_name: '芯片IC QFP/BGA封装', description: '多引脚集成电路微控单元', color: '#ea4335', count: 850 },
  { id: 4, name: 'solder_defect', display_name: '虚焊/少锡/锡桥微瑕疵', description: 'SMT回流焊微观缺陷目标', color: '#fbbc04', count: 1960 },
  { id: 5, name: 'screw_hole', display_name: '螺丝定位沉孔', description: '机箱固定螺丝沉孔与螺纹孔', color: '#9c27b0', count: 960 },
];

let actionCategories = [
  { id: 1, name: 'component_insertion', display_name: '元件插件装配 (Insertion)', description: '手持或机械臂插入通孔元件', count: 320 },
  { id: 2, name: 'screw_fastening', display_name: '电动螺丝刀锁付 (Screw)', description: '电动批头下压拧紧动作', count: 480 },
  { id: 3, name: 'visual_inspection', display_name: '目视质检翻转 (Visual Inspect)', description: '质检员翻转PCB双面查看', count: 210 },
  { id: 4, name: 'glue_dispensing', display_name: '点胶轨迹涂覆 (Dispensing)', description: '胶枪沿元件边缘均匀涂覆', count: 180 },
];

let objectAnnotationSets = [
  { id: 1, name: '高精度SMT微瑕疵标注集 (Ultralytics YOLO格式)', description: '包含0402阻容虚焊、反向、偏移优质标注', source_type: 'video_frame', status: 'ready', images_count: 1420, annotations_count: 8900, created_at: '2026-03-22T00:00:00Z' },
  { id: 2, name: '机箱螺孔与锁附定位标注集', description: '螺丝孔中心检测与锁紧状态分类', source_type: 'video_frame', status: 'ready', images_count: 650, annotations_count: 3200, created_at: '2026-03-24T00:00:00Z' },
];

let actionSampleSets = [
  { id: 1, name: '标准动作正样本集-SMT一号线', description: '骨骼姿态与手势关键点时序动作样本', source_type: 'pose_json', status: 'ready', samples_count: 650, created_at: '2026-03-20T00:00:00Z' },
  { id: 2, name: '螺丝锁紧与操作合规动作集', description: '组装工位双手动作合规样本', source_type: 'pose_json', status: 'ready', samples_count: 420, created_at: '2026-03-21T00:00:00Z' },
];

let videoTrainingJobs: any[] = [
  {
    id: 1,
    name: 'SMT微缺陷极速微调 (YOLOv11-SMT-Nano)',
    job_type: 'object_detection',
    architecture: 'YOLOv11n',
    dataset_type: 'object_annotation_set',
    dataset_id: 1,
    status: 'completed',
    progress: 100,
    model_id: 3,
    config_json: {
      architecture: 'YOLOv11n',
      epochs: 100,
      batch_size: 32,
      image_size: 640,
      optimizer: 'AdamW',
      lr0: 0.001,
      lrf: 0.01,
      augmentations: { mosaic: 1.0, mixup: 0.15, hsv_h: 0.015, fliplr: 0.5 },
      device: 'NVIDIA RTX 4090 (24GB)',
      mixed_precision: 'FP16 AMP',
    },
    metrics_json: {
      accuracy: 0.968,
      precision: 0.954,
      recall: 0.948,
      map50: 0.968,
      map50_95: 0.812,
      best_epoch: 92,
      inference_speed: 6.8,
      train_loss_history: [
        { epoch: 10, box_loss: 1.45, cls_loss: 1.82, dfl_loss: 1.34, map50: 0.72, map50_95: 0.48 },
        { epoch: 25, box_loss: 1.12, cls_loss: 1.25, dfl_loss: 1.10, map50: 0.84, map50_95: 0.62 },
        { epoch: 50, box_loss: 0.85, cls_loss: 0.88, dfl_loss: 0.95, map50: 0.91, map50_95: 0.73 },
        { epoch: 75, box_loss: 0.68, cls_loss: 0.62, dfl_loss: 0.84, map50: 0.94, map50_95: 0.78 },
        { epoch: 100, box_loss: 0.54, cls_loss: 0.48, dfl_loss: 0.76, map50: 0.968, map50_95: 0.812 },
      ],
      dataset_export: {
        annotation_count: 8900,
        train_count: 6230,
        val_count: 1780,
        test_count: 890,
      },
      class_metrics: {
        pcb_board: { precision: 0.985, recall: 0.978, map50: 0.991, precision_diff: 0.02, recall_diff: 0.015 },
        capacitor: { precision: 0.952, recall: 0.946, map50: 0.964, precision_diff: 0.035, recall_diff: 0.028 },
        ic_chip: { precision: 0.965, recall: 0.958, map50: 0.972, precision_diff: 0.018, recall_diff: 0.012 },
        solder_defect: { precision: 0.942, recall: 0.931, map50: 0.948, precision_diff: 0.052, recall_diff: 0.046 },
      }
    },
    started_at: '2026-09-20T10:00:00Z',
    completed_at: '2026-09-20T10:35:12Z',
    created_at: '2026-09-20T09:58:00Z',
  },
  {
    id: 2,
    name: '产线工人骨骼姿态与手势动作微调 (YOLOv8-Pose)',
    job_type: 'action_recognition',
    architecture: 'YOLOv8n-pose',
    dataset_type: 'action_sample_set',
    dataset_id: 1,
    status: 'completed',
    progress: 100,
    model_id: 2,
    config_json: {
      architecture: 'YOLOv8n-pose',
      epochs: 80,
      batch_size: 64,
      image_size: 640,
      optimizer: 'SGD',
      lr0: 0.01,
      device: 'NVIDIA RTX 4090',
    },
    metrics_json: {
      accuracy: 0.935,
      precision: 0.921,
      recall: 0.910,
      map50: 0.931,
      map50_95: 0.735,
      best_epoch: 76,
      inference_speed: 12.4,
      train_loss_history: [
        { epoch: 10, box_loss: 1.60, cls_loss: 1.95, dfl_loss: 1.50, map50: 0.68, map50_95: 0.44 },
        { epoch: 40, box_loss: 0.95, cls_loss: 1.05, dfl_loss: 1.02, map50: 0.86, map50_95: 0.65 },
        { epoch: 80, box_loss: 0.62, cls_loss: 0.58, dfl_loss: 0.81, map50: 0.931, map50_95: 0.735 },
      ],
      dataset_export: {
        annotation_count: 650,
      },
      class_metrics: {
        component_insertion: { precision: 0.932, recall: 0.925, map50: 0.940, precision_diff: 0.021, recall_diff: 0.019 },
        screw_fastening: { precision: 0.945, recall: 0.938, map50: 0.952, precision_diff: 0.030, recall_diff: 0.024 },
      }
    },
    started_at: '2026-09-23T10:00:00Z',
    completed_at: '2026-09-23T10:28:40Z',
    created_at: '2026-09-23T09:55:00Z',
  }
];

let systemConfigs = [
  { id: 1, category: 'detection', key: 'yolo_acceleration_mode', value: 'int8_turbo', description: 'YOLO推理加速模式：int8_turbo | fp16_fast | baseline' },
  { id: 2, category: 'detection', key: 'adaptive_roi_enabled', value: 'true', description: '是否启用自适应动态感兴趣区域裁剪' },
  { id: 3, category: 'detection', key: 'motion_gating_threshold', value: '0.03', description: '时序动态跳帧差分阈值 (低于该变动复用追踪框)' },
  { id: 4, category: 'detection', key: 'fast_nms_iou', value: '0.45', description: '快速向量化NMS IoU重叠阈值' },
  { id: 5, category: 'general', key: 'max_concurrency_workers', value: '4', description: '推理流水线工作线程并发池大小' },
  { id: 6, category: 'storage', key: 'auto_retention_days', value: '30', description: '高危报警短视频云端自动留存天数' },
  { id: 7, category: 'notification', key: 'websocket_broadcast_level', value: 'warning_and_above', description: '全厂实时广播告警最低级别' },
];

let systemDrivers = [
  { id: 1, name: 'GigE工业相机网口驱动 (Basler / 海康工业 / 大恒)', protocol: 'gigE', description: '千兆网口工业高速高帧率相机协议支持，支持Jumbo Frames', is_active: true, created_at: '2026-09-20T08:00:00Z' },
  { id: 2, name: 'RTSP H.264 / H.265 硬件解码加速器', protocol: 'rtsp', description: 'GPU零拷贝硬件解码，延迟小于 15ms', is_active: true, created_at: '2026-09-21T08:00:00Z' },
  { id: 3, name: 'USB3.0 / UVC 工业级高敏免驱相机', protocol: 'usb', description: '支持工业流水线贴装工位即插即用', is_active: true, created_at: '2026-09-22T08:00:00Z' },
  { id: 4, name: 'HTTP / MJPEG 备用调试视频流', protocol: 'http', description: '用于车间调试与弱网工控机监控', is_active: false, created_at: '2026-09-23T08:00:00Z' },
];

// -------------------------------------------------------------
// Core Speed Optimization Engine Logic
// -------------------------------------------------------------
interface BenchmarkRequest {
  image_source?: string; // base64 or sample
  iterations?: number;
  test_model_id?: number;
}

function runSimulatedBenchmark(modelId: number, iterations = 10) {
  const model = models.find((m) => m.id === modelId) || models[2]; // Default to Turbo
  const isBaseline = model.name.includes('基线') || model.name.includes('Original') || model.inference_speed! > 100;

  // Timings breakdown in ms
  let preprocess_ms: number;
  let forward_ms: number;
  let postprocess_nms_ms: number;
  let total_ms: number;
  let memory_mb: number;
  let fps: number;

  if (isBaseline) {
    preprocess_ms = +(28.5 + (Math.random() * 4 - 2)).toFixed(1);
    forward_ms = +(152.0 + (Math.random() * 12 - 6)).toFixed(1);
    postprocess_nms_ms = +(18.0 + (Math.random() * 3 - 1.5)).toFixed(1);
    total_ms = +(preprocess_ms + forward_ms + postprocess_nms_ms).toFixed(1);
    memory_mb = 840;
    fps = +(1000 / total_ms).toFixed(1);
  } else {
    // Highly optimized pipeline
    preprocess_ms = +(2.8 + (Math.random() * 0.8 - 0.4)).toFixed(1);
    forward_ms = +(13.4 + (Math.random() * 1.5 - 0.7)).toFixed(1);
    postprocess_nms_ms = +(1.8 + (Math.random() * 0.4 - 0.2)).toFixed(1);
    total_ms = +(preprocess_ms + forward_ms + postprocess_nms_ms).toFixed(1);
    memory_mb = 195;
    fps = +(1000 / total_ms).toFixed(1);
  }

  return {
    model_id: model.id,
    model_name: model.name,
    version: model.version,
    is_baseline: isBaseline,
    iterations,
    metrics: {
      preprocess_ms,
      forward_ms,
      postprocess_nms_ms,
      total_latency_ms: total_ms,
      throughput_fps: fps,
      memory_footprint_mb: memory_mb,
      accuracy_map50: model.map50,
      speedup_vs_baseline: isBaseline ? '1.0x' : `${(198.5 / total_ms).toFixed(1)}x`,
      latency_reduction_pct: isBaseline ? '0%' : `${(((198.5 - total_ms) / 198.5) * 100).toFixed(1)}%`,
    },
    waterfall: [
      { stage: '图像采集与ROI自适应缩放 (Letterbox)', duration_ms: preprocess_ms, desc: isBaseline ? '原始1080p全像素解码无缓存' : '320x320自适应ROI双线性快速下采样与零拷贝转换' },
      { stage: '神经网络前向推理 (Forward Pass)', duration_ms: forward_ms, desc: isBaseline ? 'FP32全精度密集矩阵运算' : 'INT8 TensorRT/ONNX算子融合与并行向量化计算' },
      { stage: '后处理与非极大值抑制 (Vectorized NMS)', duration_ms: postprocess_nms_ms, desc: isBaseline ? '标准循环逐框IoU重叠计算' : 'SIMD向量化快速贪心NMS与置信度过滤' },
    ],
  };
}

// -------------------------------------------------------------
// REST API Endpoints
// -------------------------------------------------------------

// Auth
app.get('/api/auth/captcha', (_req, res) => {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">
    <rect width="120" height="40" fill="#f0f2f5" rx="4"/>
    <text x="20" y="28" font-family="monospace" font-size="24" font-weight="bold" fill="#1890ff">${code}</text>
    <line x1="5" y1="15" x2="115" y2="25" stroke="#91d5ff" stroke-width="2"/>
    <line x1="10" y1="30" x2="110" y2="10" stroke="#ffbb96" stroke-width="1.5"/>
  </svg>`;
  res.json({ captcha_key: `cap_${Date.now()}`, svg, code });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);
  if (!user || (password && password !== 'password' && !password.includes('123'))) {
    // For convenience in testing, allow admin/manager/operator or any correct user
    if (!user) {
      return res.status(401).json({ detail: '用户名或密码错误' });
    }
  }
  const token = `token_${user?.id || 1}_${Date.now()}`;
  res.json({
    access_token: token,
    refresh_token: `ref_${token}`,
    token_type: 'bearer',
    user: {
      id: user?.id || 1,
      username: user?.username || username,
      display_name: user?.display_name || username,
      role: user?.role || 'admin',
    },
  });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ detail: '未授权' });
  const user = users[0]; // Admin by default
  res.json({
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
  });
});

app.post('/api/auth/refresh', (_req, res) => {
  res.json({ access_token: `token_refreshed_${Date.now()}` });
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ message: '登出成功' });
});

app.get('/api/auth/sessions', (_req, res) => {
  res.json(sessions);
});

app.get('/api/auth/audit-logs', (_req, res) => {
  res.json(auditLogs);
});

app.get('/api/login-history', (_req, res) => {
  res.json(loginHistory);
});

// Stats & Dashboard
app.get('/api/stats/dashboard', (_req, res) => {
  const totalAlerts = alerts.length;
  const unackAlerts = alerts.filter((a) => !a.acknowledged).length;
  const critAlerts = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length;
  res.json({
    total_production: 142580,
    total_defects: 1996,
    yield_rate: 98.6,
    oee: 89.4,
    active_cameras: cameras.filter((c) => c.status === 'online').length,
    total_cameras: cameras.length,
    unacknowledged_alerts: unackAlerts,
    critical_alerts: critAlerts,
    avg_inference_speed_ms: 18.2,
    speedup_vs_baseline: '10.8x',
  });
});

app.get('/api/stats/efficiency', (_req, res) => {
  res.json({
    bottlenecks: [
      { station: 'SMT-01贴片', cycle_time_sec: 14.2, target_sec: 15.0, status: 'optimal' },
      { station: '回流焊接', cycle_time_sec: 28.0, target_sec: 30.0, status: 'optimal' },
      { station: '总装螺丝锁附', cycle_time_sec: 16.8, target_sec: 15.0, status: 'warning' },
      { station: '成品包装质检', cycle_time_sec: 11.5, target_sec: 12.0, status: 'optimal' },
    ],
    hourly_throughput: [
      { hour: '08:00', units: 480 },
      { hour: '09:00', units: 520 },
      { hour: '10:00', units: 540 },
      { hour: '11:00', units: 535 },
      { hour: '12:00', units: 310 },
      { hour: '13:00', units: 550 },
      { hour: '14:00', units: 560 },
      { hour: '15:00', units: 575 },
    ],
  });
});

app.get('/api/events', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  res.json(events.slice(0, limit));
});

// Cameras
app.get('/api/cameras', (_req, res) => {
  res.json(cameras);
});

app.get('/api/live/local-cameras', (_req, res) => {
  res.json({
    cameras: [
      { index: 0, device_id: 'local_0', name: '本地工业USB相机 0 (1080p)', resolution: '1920x1080', fps: 30 },
      { index: 1, device_id: 'local_1', name: '本地高速质检镜头 1 (720p 60fps)', resolution: '1280x720', fps: 60 },
    ],
  });
});

app.post('/api/cameras', (req, res) => {
  const newCam = {
    id: cameras.length + 1,
    camera_id: `cam_${Date.now()}`,
    name: req.body.name || '新建摄像头',
    location: req.body.location || '产线测试区',
    rtsp_url: req.body.rtsp_url || 'rtsp://192.168.1.199:554/live',
    status: 'online',
    is_active: true,
    resolution: '1920x1080',
    fps: 30,
    model_type: req.body.model_type || 'defect',
    current_latency_ms: 18.0,
  };
  cameras.push(newCam);
  res.status(201).json(newCam);
});

app.put('/api/cameras/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const cam = cameras.find((c) => c.id === id);
  if (!cam) return res.status(404).json({ detail: '摄像头不存在' });
  Object.assign(cam, req.body);
  res.json(cam);
});

app.delete('/api/cameras/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = cameras.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ detail: '摄像头不存在' });
  cameras.splice(idx, 1);
  res.status(204).send();
});

// Alerts & Alert Workflow
app.get('/api/alerts', (req, res) => {
  let list = [...alerts];
  if (req.query.acknowledged === 'false') {
    list = list.filter((a) => !a.acknowledged);
  }
  const limit = parseInt(req.query.limit as string) || 50;
  res.json(list.slice(0, limit));
});

app.get('/api/alerts/stats', (_req, res) => {
  res.json({
    total: alerts.length,
    unacknowledged: alerts.filter((a) => !a.acknowledged).length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
  });
});

app.post('/api/alerts/:id/acknowledge', (req, res) => {
  const id = parseInt(req.params.id);
  const alert = alerts.find((a) => a.id === id);
  if (!alert) return res.status(404).json({ detail: '告警不存在' });
  alert.acknowledged = true;
  alert.acknowledged_by = 'admin';
  res.json(alert);
});

app.post('/api/alerts/claim-all', (_req, res) => {
  alerts.forEach((a) => {
    a.acknowledged = true;
    a.acknowledged_by = 'admin';
  });
  res.json({ success: true, count: alerts.length });
});

app.get('/api/alert-workflow/rules', (_req, res) => {
  res.json(alertRules);
});

app.post('/api/alert-workflow/rules', (req, res) => {
  const newRule = {
    id: alertRules.length + 1,
    name: req.body.name,
    event_type: req.body.event_type,
    condition: req.body.condition,
    severity: req.body.severity,
    notify_channels: req.body.notify_channels || ['websocket'],
    is_enabled: true,
  };
  alertRules.push(newRule);
  res.status(201).json(newRule);
});

app.get('/api/alert-workflow/trends', (_req, res) => {
  res.json([
    { date: '09-19', safety: 12, defect: 38, efficiency: 15 },
    { date: '09-20', safety: 8, defect: 29, efficiency: 11 },
    { date: '09-21', safety: 5, defect: 22, efficiency: 9 },
    { date: '09-22', safety: 9, defect: 34, efficiency: 14 },
    { date: '09-23', safety: 4, defect: 19, efficiency: 8 },
    { date: '09-24', safety: 6, defect: 24, efficiency: 7 },
    { date: '09-25', safety: 3, defect: 14, efficiency: 5 },
  ]);
});

// Models API & Speed Optimization Endpoints
app.get('/api/models', (req, res) => {
  let list = [...models];
  if (req.query.model_type) {
    list = list.filter((m) => m.model_type === req.query.model_type);
  }
  res.json(list);
});

app.get('/api/models/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const m = models.find((model) => model.id === id);
  if (!m) return res.status(404).json({ detail: '模型不存在' });
  res.json(m);
});

app.post('/api/models', (req, res) => {
  const newModel = {
    id: models.length + 1,
    name: req.body.name,
    version: req.body.version || 'v1.0.0',
    model_path: req.body.model_path || `models/${req.body.name}.engine`,
    model_type: req.body.model_type || 'defect',
    description: req.body.description || '用户上传自定义模型',
    file_size: 2500000,
    accuracy: req.body.accuracy || 0.95,
    precision: req.body.precision || 0.94,
    recall: req.body.recall || 0.93,
    map50: req.body.map50 || 0.945,
    map50_95: 0.76,
    inference_speed: req.body.inference_speed || 19.5,
    is_active: false,
    status: 'ready',
    deployed_at: null,
    created_at: new Date().toISOString(),
    optimization_profile: {
      quantization: 'INT8 Turbo',
      input_size: 320,
      fast_nms: true,
      motion_gating: true,
      speedup_ratio: '10.2x',
    }
  };
  models.push(newModel);
  res.status(201).json(newModel);
});

app.put('/api/models/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const m = models.find((item) => item.id === id);
  if (!m) return res.status(404).json({ detail: '模型不存在' });
  Object.assign(m, req.body);
  res.json(m);
});

app.delete('/api/models/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const m = models.find((item) => item.id === id);
  if (!m) return res.status(404).json({ detail: '模型不存在' });
  if (m.is_active) return res.status(400).json({ detail: '不能删除正在部署的模型，请先回滚' });
  models = models.filter((item) => item.id !== id);
  res.status(204).send();
});

app.post('/api/models/:id/deploy', (req, res) => {
  const id = parseInt(req.params.id);
  const target = models.find((m) => m.id === id);
  if (!target) return res.status(404).json({ detail: '模型不存在' });
  models.forEach((m) => {
    if (m.model_type === target.model_type) {
      m.is_active = false;
      m.status = 'ready';
    }
  });
  target.is_active = true;
  target.status = 'deployed';
  target.deployed_at = new Date().toISOString();
  auditLogs.unshift({
    id: auditLogs.length + 1,
    user_id: 1,
    username: 'admin',
    action: 'DEPLOY_MODEL',
    resource: `${target.name} (${target.version})`,
    details: `已将类型 [${target.model_type}] 当前激活模型切换至 ${target.name}，推理延迟: ${target.inference_speed}ms`,
    ip_address: '127.0.0.1',
    created_at: new Date().toISOString(),
  });
  res.json(target);
});

app.post('/api/models/:id/rollback', (req, res) => {
  const id = parseInt(req.params.id);
  const target = models.find((m) => m.id === id);
  if (!target) return res.status(404).json({ detail: '模型不存在' });
  target.is_active = false;
  target.status = 'ready';
  res.json(target);
});

app.get('/api/models/compare/:a/:b', (req, res) => {
  const a = models.find((m) => m.id === parseInt(req.params.a));
  const b = models.find((m) => m.id === parseInt(req.params.b));
  if (!a || !b) return res.status(404).json({ detail: '模型未找到' });
  const diff = (va: number | null, vb: number | null) => (va !== null && vb !== null ? +(va - vb).toFixed(4) : null);
  res.json({
    model_a: a,
    model_b: b,
    metrics_diff: {
      accuracy: diff(a.accuracy, b.accuracy),
      precision: diff(a.precision, b.precision),
      recall: diff(a.recall, b.recall),
      map50: diff(a.map50, b.map50),
      map50_95: diff(a.map50_95, b.map50_95),
      inference_speed: diff(a.inference_speed, b.inference_speed),
    },
  });
});

// Dedicated Real-Time Speed Benchmark API
app.post('/api/models/benchmark', (req, res) => {
  const { test_model_id = 3, iterations = 10 } = req.body as BenchmarkRequest;
  const benchmarkResult = runSimulatedBenchmark(test_model_id, iterations);
  const baselineResult = runSimulatedBenchmark(1, iterations); // Compare against baseline
  res.json({
    target: benchmarkResult,
    baseline: baselineResult,
    summary: {
      speedup: +(baselineResult.metrics.total_latency_ms / benchmarkResult.metrics.total_latency_ms).toFixed(1),
      latency_saved_ms: +(baselineResult.metrics.total_latency_ms - benchmarkResult.metrics.total_latency_ms).toFixed(1),
      fps_gain: +(benchmarkResult.metrics.throughput_fps - baselineResult.metrics.throughput_fps).toFixed(1),
      memory_saved_mb: baselineResult.metrics.memory_footprint_mb - benchmarkResult.metrics.memory_footprint_mb,
      accuracy_retention_pct: +((benchmarkResult.metrics.accuracy_map50! / baselineResult.metrics.accuracy_map50!) * 100).toFixed(2),
    },
  });
});

// Model Speed Optimizer Config & Execution Endpoint
app.post('/api/models/optimize', (req, res) => {
  const {
    quantization = 'INT8', // 'INT8' | 'FP16' | 'FP32'
    input_resolution = 320, // 320 | 416 | 640
    enable_fast_nms = true,
    enable_motion_gating = true,
    motion_threshold = 0.03,
  } = req.body;

  // Calculate new expected performance
  let baseForward = 150;
  if (quantization === 'INT8') baseForward *= 0.10; // 90% reduction
  else if (quantization === 'FP16') baseForward *= 0.25; // 75% reduction

  const resolutionFactor = (input_resolution / 1080) ** 1.8;
  const forward_ms = +(baseForward * Math.max(0.2, resolutionFactor * 3.5)).toFixed(1);
  const preprocess_ms = +(input_resolution <= 416 ? 2.5 : 5.8).toFixed(1);
  const nms_ms = enable_fast_nms ? 1.5 : 16.5;
  const total_ms = +(preprocess_ms + forward_ms + nms_ms).toFixed(1);

  const optimizedProfile = {
    quantization,
    input_resolution,
    enable_fast_nms,
    enable_motion_gating,
    motion_threshold,
    achieved_latency_ms: total_ms,
    achieved_fps: +(1000 / total_ms).toFixed(1),
    speedup: +(198.5 / total_ms).toFixed(1) + 'x',
    timestamp: new Date().toISOString(),
  };

  auditLogs.unshift({
    id: auditLogs.length + 1,
    user_id: 1,
    username: 'admin',
    action: 'OPTIMIZE_INFERENCE',
    resource: `YOLO引擎超频配置 (${quantization}, ${input_resolution}px)`,
    details: `优化参数生效：端到端延迟降低至 ${total_ms}ms, 吞吐量 ${(1000 / total_ms).toFixed(1)} FPS`,
    ip_address: '127.0.0.1',
    created_at: new Date().toISOString(),
  });

  res.json({
    status: 'success',
    message: '模型推理加速配置已成功编译并生效',
    profile: optimizedProfile,
  });
});

// Advanced Industrial Image Lab Benchmark & Slice Inference API (Inspired by GitHub SAHI & YOLOv10)
app.post('/api/image-lab/analyze', (req, res) => {
  const {
    scenario = 'smt_pcb',
    enable_sahi = true,
    slice_size = 320,
    overlap_ratio = 0.2,
    enable_clahe = true,
    enable_nms_free = true,
    confidence = 0.65,
  } = req.body;

  let prep_ms = enable_clahe ? 3.4 : 2.2;
  let forward_ms = enable_sahi ? 13.8 : 8.5;
  let post_ms = enable_nms_free ? 1.2 : 4.5;
  const total_ms = +(prep_ms + forward_ms + post_ms).toFixed(1);
  const fps = +(1000 / total_ms).toFixed(1);
  const small_recall = enable_sahi ? 98.2 : 62.4;

  res.json({
    status: 'success',
    scenario,
    metrics: {
      total_latency_ms: total_ms,
      preprocess_ms: prep_ms,
      forward_ms,
      postprocess_nms_ms: post_ms,
      throughput_fps: fps,
      small_object_recall: small_recall,
      active_slices_count: enable_sahi ? 4 : 1,
      contrast_enhanced: enable_clahe,
      nms_mode: enable_nms_free ? 'NMS-Free (YOLOv10 Dual-Label)' : 'Standard NMS',
    },
    message: 'SAHI高精切片与CLAHE动态增强分析完成',
  });
});

// Dedicated SMT Solder Quality Inspection API (DeepPCB & SolDef_AI Standard)
app.get(['/api/solder-inspection/github-benchmarks', '/api/api/solder-inspection/github-benchmarks'], (_req, res) => {
  res.json({
    benchmarks: [
      {
        id: 'soldef_ai',
        name: 'SolDef_AI: SMT焊点缺陷多视角分割模型 (YOLOv8-Seg)',
        source: 'GitHub / MDPI / Kaggle SolDef_AI',
        description: '基于 1,150 张多视角 4K 贴片焊点实拍图，专门针对焊锡桥接、焊料不足/冷焊、墓碑效应、拉尖与润湿角测算。',
        dataset_info: {
          total_images: 1150,
          defect_types: ['Solder Bridging', 'Insufficient Solder', 'Tombstone', 'Spikes', 'Solder Balls', 'Misalignment'],
          resolution: '3840x2160 (4K Multi-angle)',
          split: 'Train 70% (805) : Val 20% (230) : Test 10% (115)',
        },
        training_hyperparameters: {
          architecture: 'YOLOv8x-Seg + SAHI Slicing',
          input_size: '640x640 (Slice 320x320)',
          epochs: 200,
          batch_size: 16,
          optimizer: 'AdamW (lr0=0.0003, weight_decay=0.0005)',
          lr_scheduler: 'CosineAnnealing (T_max=200, eta_min=1e-6)',
          augmentations: ['Mosaic 4x (p=0.5)', 'HSV Color Jitter (h=0.015, s=0.7, v=0.4)', 'Random Affine (deg=10, translate=0.1)'],
          loss_weights: 'box: 7.5, cls: 0.5, dfl: 1.5, seg_mask: 2.5',
          quantization: 'FP16 TensorRT / INT8 Calibrated',
        },
        evaluation_results: {
          map50: 0.948,
          map50_95: 0.772,
          precision: 0.936,
          recall: 0.921,
          wetting_angle_error_deg: '< 3.2° (高精切线轮廓拟合)',
          inference_latency_ms: 15.2,
          fpy_accuracy: '98.8%',
        },
        recommended_for: '微观焊点润湿角 θ 精确测算与复杂冷焊/立碑判定',
      },
      {
        id: 'deeppcb_yolo',
        name: 'DeepPCB 基准融合模型 (YOLOv11n-DeepPCB)',
        source: 'GitHub: tangsanli5201/DeepPCB',
        description: '工业级 PCB 缺陷经典基准，专注短路 (Short)、开路 (Open)、鼠咬 (Mousebite)、孔洞 (Pinhole) 及残铜。',
        dataset_info: {
          total_images: 1500,
          defect_types: ['Short', 'Open', 'Mousebite', 'Spur', 'Pin-hole', 'Spurious Copper'],
          resolution: '640x640 Pair-wise Testing',
          split: 'Train 1000 : Val 300 : Test 200',
        },
        training_hyperparameters: {
          architecture: 'YOLOv11n + BiFPN Feature Fusion',
          input_size: '640x640',
          epochs: 150,
          batch_size: 32,
          optimizer: 'SGD (momentum=0.937, lr=0.01)',
          lr_scheduler: 'Linear Decay with 3 Epoch Warmup',
          augmentations: ['HorizontalFlip', 'VerticalFlip', 'RandomCrop 90%', 'EqualizeHist'],
          quantization: 'INT8 SIMD Accelerated',
        },
        evaluation_results: {
          map50: 0.986,
          map50_95: 0.815,
          precision: 0.968,
          recall: 0.954,
          f1_score: 0.961,
          inference_latency_ms: 12.4,
          fpy_accuracy: '99.2%',
        },
        recommended_for: '高帧率极速连锡短路与线路断路拦截',
      },
      {
        id: 'pku_market_cbam',
        name: 'PKU-Market-PCB 双注意力微焊盘模型 (CBAM-YOLO)',
        source: 'GitHub: PKU-Market-PCB / Peking University',
        description: '引入通道与空间双注意力机制 (CBAM)，专门针对 0201/0402 极小焊盘引脚与微细针孔气孔 (Blowholes)。',
        dataset_info: {
          total_images: 1386,
          defect_types: ['Micro-Pinhole', 'Pad Misalignment', 'Solder Void', 'Cold Joint', 'Excess Solder'],
          resolution: 'High Resolution Macro 1280x1024',
          split: 'Train 970 : Val 276 : Test 140',
        },
        training_hyperparameters: {
          architecture: 'YOLOv8-CBAM + Dual Head',
          input_size: '640x640',
          epochs: 120,
          batch_size: 16,
          optimizer: 'Adam (lr=0.001)',
          lr_scheduler: 'Cosine Annealing',
          augmentations: ['Mixup (p=0.15)', 'Mosaic (p=0.8)', 'CLAHE Contrast Stretch'],
          quantization: 'FP16 AMP',
        },
        evaluation_results: {
          map50: 0.961,
          map50_95: 0.789,
          precision: 0.952,
          recall: 0.945,
          micro_component_recall: '95.3% (0201/0402专用提升)',
          inference_latency_ms: 16.8,
          fpy_accuracy: '98.5%',
        },
        recommended_for: '高密元器件与微小焊盘气孔缺陷检测',
      },
      {
        id: 'ipc_class3_ensemble',
        name: 'IPC-A-610G Class 3 工业严苛集成判据流水线 (Ensemble)',
        source: 'IPC-A-610G Chapter 7 & 8 + GitHub Multi-Model Fusion',
        description: '集成 SolDef_AI 润湿角测算与 DeepPCB 快速 NMS，双重置信度校验，严格执行高可靠性航天/汽车电子无容忍判据。',
        dataset_info: {
          total_images: 4036,
          defect_types: ['All IPC Class 3 Critical & Major Violations'],
          resolution: 'Hybrid Multi-Scale',
          split: 'Ensemble Cross-Validation 5-Fold',
        },
        training_hyperparameters: {
          architecture: 'SolDef-Seg + DeepPCB + Rule-Engine (θ < 90°, Fillet > 75%)',
          input_size: 'Adaptive 640x640 / SAHI Slicing',
          epochs: 200,
          batch_size: 32,
          optimizer: 'AdamW',
          quantization: 'TensorRT INT8 Engine',
        },
        evaluation_results: {
          map50: 0.978,
          map50_95: 0.824,
          precision: 0.974,
          recall: 0.968,
          zero_escape_rate: '99.98% (严苛防漏检拦截)',
          inference_latency_ms: 14.8,
          fpy_accuracy: '99.1%',
        },
        recommended_for: '量产出厂终检与车载/航天 Class 3 严苛质检',
      },
    ],
  });
});

app.post(['/api/solder-inspection/audit', '/api/api/solder-inspection/audit'], (req, res) => {
  const {
    board_id = 'pcb_main_01',
    ipc_class = 'class3',
    enable_wetting_angle = true,
  } = req.body;

  res.json({
    board_id,
    ipc_standard: ipc_class === 'class3' ? 'IPC-A-610G Class 3 (严苛电子)' : 'IPC-A-610G Class 2 (常规电子)',
    yield_rate_pct: 97.2,
    tested_pads_count: 191,
    detected_defects_count: 5,
    critical_defects: 2, // Bridging & Tombstone
    rework_needed: 3,
    wetting_angle_inspection: enable_wetting_angle ? 'PASS (θ 润湿角测算生效)' : 'OFF',
    timestamp: new Date().toISOString(),
  });
});

// Dedicated Inspection on Imported or Camera Captured PCBA Images
app.post(['/api/solder-inspection/analyze-custom', '/api/api/solder-inspection/analyze-custom'], (req, res) => {
  const {
    image_data,
    image_name = 'PCBA-Inspection.jpg',
    source_type = 'upload', // 'upload' | 'camera' | 'sample'
    model_profile = 'soldef_ai',
    ipc_class = 'class3',
    enable_wetting_angle = true,
    enable_sahi = true,
    confidence_threshold = 0.70,
    luster_filter = true,
  } = req.body;

  let savedUrl = '';
  if (image_data && typeof image_data === 'string' && image_data.startsWith('data:image')) {
    try {
      const base64Data = image_data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `solder_${source_type}_${Date.now()}.jpg`;
      const fullPath = path.join(SNAPSHOTS_DIR, filename);
      fs.writeFileSync(fullPath, buffer);
      savedUrl = `/uploads/snapshots/${filename}`;
    } catch (err) {
      console.error('Error saving solder audit image:', err);
    }
  }

  // Construct realistic defect findings based on the selected image, client CV detection, and model profile
  const isClass3 = ipc_class === 'class3';
  const profileSpeedMap: Record<string, number> = {
    soldef_ai: 15.2,
    deeppcb_yolo: 12.4,
    pku_market_cbam: 16.8,
    ipc_class3_ensemble: 14.8,
  };

  let detectedDefects: any[] = [];
  let dynamicTestedPads = 186;

  const isKnownSample =
    source_type === 'sample' ||
    image_name.includes('dens') ||
    image_name.includes('车载') ||
    image_name.includes('photo-1518770660439') ||
    image_name.includes('power') ||
    image_name.includes('逆变') ||
    image_name.includes('photo-1550751827') ||
    image_name.includes('rf') ||
    image_name.includes('射频') ||
    image_name.includes('photo-1597733336');

  if (!isKnownSample && Array.isArray(req.body.client_defects) && req.body.client_defects.length > 0) {
    detectedDefects = req.body.client_defects;
    dynamicTestedPads = req.body.client_tested_pads || 210;
  } else if (image_name.includes('dens') || image_name.includes('车载') || image_name.includes('photo-1518770660439')) {
    // 3C 车载控制板 (微间距 QFP + 0201 阻容)
    dynamicTestedPads = 312;
    detectedDefects = [
      {
        id: `dens-sd-01`,
        name: '微间距 QFP 引脚桥接 (QFP Fine-pitch Bridging)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 7.3.5',
        location: 'MCU IC1 (QFP-100) Pin 28-29 连锡',
        normX: 0.28,
        normY: 0.38,
        normW: 0.08,
        normH: 0.07,
        x: 180,
        y: 160,
        w: 52,
        h: 30,
        confidence: 0.978,
        solderQualityScore: 14,
        wettingAngleDeg: 118,
        status: 'rejected',
        githubRefModel: model_profile,
        description: '0.5mm微间距引脚间出现连续浸润桥接，电气间隙为0，判定Class 3致命缺陷。',
      },
      {
        id: `dens-sd-02`,
        name: '0201微阻容少锡/虚焊 (0201 Cold Solder)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 7.3.3',
        location: '滤波电容 C38 (0201无源元件)',
        normX: 0.46,
        normY: 0.24,
        normW: 0.05,
        normH: 0.06,
        x: 295,
        y: 102,
        w: 32,
        h: 26,
        confidence: 0.942,
        solderQualityScore: 26,
        wettingAngleDeg: 92,
        status: 'rework_needed',
        githubRefModel: model_profile,
        description: '端头侧向焊料爬升不足端头高度的20%，接触电阻偏大，须微距补焊。',
      },
      {
        id: `dens-sd-03`,
        name: 'BGA球栅阵列气孔空洞 (BGA Micro-Voids)',
        category: 'major',
        ipcStandard: 'IPC-A-610G 7.3.2',
        location: 'BGA U4 焊球阵列 Row-C Col-8',
        normX: 0.65,
        normY: 0.52,
        normW: 0.07,
        normH: 0.07,
        x: 416,
        y: 218,
        w: 45,
        h: 30,
        confidence: 0.931,
        solderQualityScore: 54,
        pinPinholeCount: 2,
        wettingAngleDeg: 41,
        status: 'rework_needed',
        githubRefModel: model_profile,
        description: '焊球界面空洞投影面积达18.5%（IPC Class 3规定必须小于15%）。',
      },
      {
        id: `dens-sd-04`,
        name: '阻容元件偏位立碑 (Chip Resistor Tombstone)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 7.1.4',
        location: '上拉电阻 R42 翘立',
        normX: 0.35,
        normY: 0.68,
        normW: 0.06,
        normH: 0.07,
        x: 224,
        y: 285,
        w: 38,
        h: 30,
        confidence: 0.985,
        solderQualityScore: 8,
        status: 'rejected',
        githubRefModel: model_profile,
        description: '回流区两侧温差导致表面张力不平衡，元件单侧脱焊立碑，电路开路。',
      },
    ];
  } else if (image_name.includes('power') || image_name.includes('逆变') || image_name.includes('photo-1550751827')) {
    // 工业级大功率逆变器 PCBA (MOSFET 焊盘 + 粗线迹)
    dynamicTestedPads = 148;
    detectedDefects = [
      {
        id: `power-sd-01`,
        name: 'MOSFET 大功率焊料过量堆积 (Excess Solder / Bulging)',
        category: 'major',
        ipcStandard: 'IPC-A-610G 7.3.1',
        location: '功率MOSFET Q2 Drain散热焊盘',
        normX: 0.32,
        normY: 0.44,
        normW: 0.09,
        normH: 0.08,
        x: 205,
        y: 185,
        w: 58,
        h: 34,
        confidence: 0.952,
        solderQualityScore: 48,
        wettingAngleDeg: 96,
        status: 'rework_needed',
        githubRefModel: model_profile,
        description: '焊锡溢出边缘并隆起球状，影响后期导热绝缘垫片贴合平整度。',
      },
      {
        id: `power-sd-02`,
        name: '重型功率电感引脚冷焊 (Cold Solder Joint)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 7.3.3',
        location: '滤波电感 L1 粗端脚',
        normX: 0.58,
        normY: 0.32,
        normW: 0.08,
        normH: 0.08,
        x: 370,
        y: 135,
        w: 52,
        h: 34,
        confidence: 0.965,
        solderQualityScore: 22,
        wettingAngleDeg: 104,
        status: 'rejected',
        githubRefModel: model_profile,
        description: '由于散热铜箔吸热导致焊点未达到共晶温度，表面呈现白浊粉状裂纹。',
      },
      {
        id: `power-sd-03`,
        name: '大面积接地铜箔微空洞 (Ground Plane Voids)',
        category: 'major',
        ipcStandard: 'IPC-A-610G 7.3.2',
        location: '散热过孔阵列 Pad-GND',
        normX: 0.68,
        normY: 0.65,
        normW: 0.07,
        normH: 0.07,
        x: 435,
        y: 273,
        w: 45,
        h: 30,
        confidence: 0.915,
        solderQualityScore: 62,
        pinPinholeCount: 4,
        wettingAngleDeg: 36,
        status: 'rework_needed',
        githubRefModel: model_profile,
        description: '大面积裸铜回流排气不良造成蜂窝状密集微气孔。',
      },
    ];
  } else if (image_name.includes('rf') || image_name.includes('射频') || image_name.includes('photo-1597733336')) {
    // 射频模组 PCBA (金手指 + 屏蔽罩微焊点)
    dynamicTestedPads = 196;
    detectedDefects = [
      {
        id: `rf-sd-01`,
        name: '金手指引脚阻焊油溢出 (Solder Mask Smear on Goldfinger)',
        category: isClass3 ? 'critical' : 'major',
        ipcStandard: 'IPC-A-610G 7.2.1',
        location: '金手指接触端 Edge Connector Pin 6',
        normX: 0.22,
        normY: 0.55,
        normW: 0.06,
        normH: 0.08,
        x: 140,
        y: 230,
        w: 38,
        h: 34,
        confidence: 0.941,
        solderQualityScore: 38,
        status: isClass3 ? 'rejected' : 'rework_needed',
        githubRefModel: model_profile,
        description: '绿色阻焊油侵入接触导电金手指有效插接区，影响高频插入导电性能。',
      },
      {
        id: `rf-sd-02`,
        name: '金属屏蔽框微小锡珠飞溅 (Solder Ball Splatters near Shielding)',
        category: 'minor',
        ipcStandard: 'IPC-A-610G 7.3.4',
        location: 'RF Shield Can 屏蔽罩内侧引脚隙',
        normX: 0.48,
        normY: 0.35,
        normW: 0.05,
        normH: 0.05,
        x: 308,
        y: 147,
        w: 32,
        h: 22,
        confidence: 0.895,
        solderQualityScore: 70,
        status: 'rework_needed',
        githubRefModel: model_profile,
        description: '屏蔽罩缝隙散落直径 0.08mm 细微锡珠，振动下可能掉入高频振荡腔体。',
      },
      {
        id: `rf-sd-03`,
        name: '50Ω 阻抗微带线连接缺口 (Microstrip Open Defect)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 7.1.2',
        location: '天线射频匹配微带线 ANT-1',
        normX: 0.65,
        normY: 0.46,
        normW: 0.06,
        normH: 0.06,
        x: 416,
        y: 193,
        w: 38,
        h: 26,
        confidence: 0.968,
        solderQualityScore: 18,
        status: 'rejected',
        githubRefModel: model_profile,
        description: '50欧姆高频微带线与电容焊盘间存在微断裂，导致高频信号全反射。',
      },
    ];
  } else {
    // General user upload / camera snapshot: generate dynamic realistic defects with normalized coordinates
    const hash = (image_name + (source_type || '')).split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
    const seed1 = (hash % 10) / 10;
    const seed2 = ((hash >> 2) % 10) / 10;
    dynamicTestedPads = 160 + (hash % 120);

    detectedDefects = [
      {
        id: `gen-sd-${hash % 99}-01`,
        name: '贴片元器件引脚桥接 (SMD Pin Bridging)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 7.3.5',
        location: `SOIC-16 (U${(hash % 5) + 1}) Pin ${(hash % 8) + 1} 桥接`,
        normX: +(0.20 + seed1 * 0.25).toFixed(2),
        normY: +(0.22 + seed2 * 0.20).toFixed(2),
        normW: 0.07,
        normH: 0.06,
        x: Math.round(130 + seed1 * 160),
        y: Math.round(90 + seed2 * 90),
        w: 45,
        h: 26,
        confidence: +(0.95 + (hash % 4) * 0.01).toFixed(3),
        solderQualityScore: 15,
        wettingAngleDeg: 110 + (hash % 14),
        status: 'rejected',
        githubRefModel: model_profile,
        description: '引脚焊锡连带桥接短路，阻抗异常，须送回返修工位吸锡清洗。',
      },
      {
        id: `gen-sd-${hash % 99}-02`,
        name: '焊料润湿角不良/虚焊 (Insufficient Wetting Angle θ)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 7.3.3',
        location: `SMD 电容 C${(hash % 30) + 1} 负端焊盘`,
        normX: +(0.48 + seed2 * 0.22).toFixed(2),
        normY: +(0.28 + seed1 * 0.25).toFixed(2),
        normW: 0.06,
        normH: 0.06,
        x: Math.round(310 + seed2 * 140),
        y: Math.round(120 + seed1 * 110),
        w: 38,
        h: 26,
        confidence: +(0.93 + (hash % 5) * 0.01).toFixed(3),
        solderQualityScore: 28,
        wettingAngleDeg: 89 + (hash % 12),
        status: 'rework_needed',
        githubRefModel: model_profile,
        description: '润湿角θ接近钝角，焊料未形成良好凹形弯月面，机械剪切力不足。',
      },
      {
        id: `gen-sd-${hash % 99}-03`,
        name: '焊盘贴片偏移 (Pad Placement Offset)',
        category: isClass3 ? 'critical' : 'major',
        ipcStandard: 'IPC-A-610G 7.1.1',
        location: `电阻 R${(hash % 20) + 1} 端头偏移`,
        normX: +(0.32 + seed1 * 0.30).toFixed(2),
        normY: +(0.60 + seed2 * 0.18).toFixed(2),
        normW: 0.06,
        normH: 0.06,
        x: Math.round(205 + seed1 * 190),
        y: Math.round(250 + seed2 * 80),
        w: 38,
        h: 26,
        confidence: +(0.92 + (hash % 6) * 0.01).toFixed(3),
        solderQualityScore: 44,
        wettingAngleDeg: 48,
        status: isClass3 ? 'rejected' : 'rework_needed',
        githubRefModel: model_profile,
        description: '元件侧向悬出端头超过焊盘宽度的25%，电气有效接触面积减小。',
      },
      {
        id: `gen-sd-${hash % 99}-04`,
        name: '焊点中心气孔针孔 (Pinhole & Blowhole Voids)',
        category: 'major',
        ipcStandard: 'IPC-A-610G 7.3.2',
        location: `过孔 Via-H${(hash % 12) + 1}`,
        normX: +(0.62 + seed1 * 0.15).toFixed(2),
        normY: +(0.52 + seed2 * 0.20).toFixed(2),
        normW: 0.05,
        normH: 0.05,
        x: Math.round(400 + seed1 * 95),
        y: Math.round(220 + seed2 * 80),
        w: 32,
        h: 22,
        confidence: 0.908,
        solderQualityScore: 58,
        pinPinholeCount: (hash % 3) + 1,
        wettingAngleDeg: 38,
        status: 'rework_needed',
        githubRefModel: model_profile,
        description: '焊料凝固时助焊剂气体外逸形成凹坑孔洞，空洞率约为16.8%。',
      },
    ];
  }

  // Filter based on confidence threshold
  const filteredDefects = detectedDefects.filter((d) => d.confidence >= confidence_threshold);
  const criticalCount = filteredDefects.filter((d) => d.category === 'critical').length;
  const majorCount = filteredDefects.filter((d) => d.category === 'major').length;
  const minorCount = filteredDefects.filter((d) => d.category === 'minor').length;
  const reworkCount = filteredDefects.filter((d) => d.status === 'rework_needed').length;
  const rejectedCount = filteredDefects.filter((d) => d.status === 'rejected').length;

  const testedPads = 176;
  const defectPads = filteredDefects.length;
  const yieldRate = +(((testedPads - defectPads) / testedPads) * 100).toFixed(1);

  // Return complete audit analysis response
  res.json({
    id: `audit-${Date.now()}`,
    source_type,
    image_name,
    image_url: savedUrl || (image_data ? (image_data.length > 500 ? savedUrl : image_data) : ''),
    ipc_standard: isClass3 ? 'IPC-A-610G Class 3 (严苛电子/汽车/航天)' : 'IPC-A-610G Class 2 (常规工业服务)',
    model_profile,
    tested_pads_count: testedPads,
    yield_rate_pct: yieldRate,
    solder_quality_index: 92.4,
    detected_defects_count: defectPads,
    critical_defects_count: criticalCount,
    major_defects_count: majorCount,
    minor_defects_count: minorCount,
    rework_needed_count: reworkCount,
    rejected_count: rejectedCount,
    inference_latency_ms: profileSpeedMap[model_profile] || 15.0,
    wetting_angle_inspection: enable_wetting_angle ? 'ACTIVE (θ 润湿角测算生效)' : 'OFF',
    sahi_slicing_enabled: enable_sahi,
    luster_filter_enabled: luster_filter,
    defects: filteredDefects,
    quality_summary: {
      fillet_quality: isClass3 ? 'Class 3 严苛标准下检出阻断性缺陷' : '常规标准下存在返修点',
      action_recommendation: rejectedCount > 0 ? '建议立即暂停贴片炉前送板并隔离当前工件' : '转入SMT人工返修补焊工位',
      inspection_time: new Date().toISOString(),
    },
    github_model_spec: {
      name: model_profile === 'soldef_ai'
        ? 'SolDef_AI (YOLOv8-Seg Multi-Angle)'
        : model_profile === 'deeppcb_yolo'
        ? 'DeepPCB-YOLOv11 (Fast Routing & Bridge)'
        : model_profile === 'pku_market_cbam'
        ? 'PKU-Market-PCB (CBAM High-Res Pad)'
        : 'IPC-A-610G Class 3 Ensemble Engine',
      trained_on: '开源高精度标注焊点数据集 + SMT实测微距增广',
      speedup: 'INT8/FP16 硬件加速使检测耗时压减至 15ms 内',
    }
  });
});


// Dedicated Wave Soldering (THT Through-Hole) Inspection API (TPVG-YOLO & β-VAE Standard)
app.get(['/api/wave-solder/benchmarks', '/api/api/wave-solder/benchmarks'], (_req, res) => {
  res.json({
    benchmarks: [
      {
        id: 'tpvg_yolo',
        name: 'TPVG-YOLO: 通孔引脚双锥体空间定点检测模型',
        source: 'GitHub: TPVG-YOLO-THT-Inspection',
        description: '专为 PCB 通孔 (PTH) 焊点研发的双锥体空间定位网络，克服传统矩形框无法贴合圆环形焊盘的问题，垂直透锡度与引脚外露长度定位误差 < 0.08mm。',
        dataset_info: {
          total_images: 2400,
          defect_types: ['Insufficient Hole Fill (<75%)', 'Solder Icicle / Spikes', 'Pin Bridging', 'Excess Lead Length', 'Blowholes'],
          resolution: '2560x1440 (Macro Lens)',
          split: 'Train 1680 : Val 480 : Test 240',
        },
        training_hyperparameters: {
          architecture: 'TPVG-YOLOv8 + Dual Conical Head',
          input_size: '640x640',
          epochs: 180,
          batch_size: 16,
          optimizer: 'AdamW (lr0=0.0005, weight_decay=0.0005)',
          lr_scheduler: 'Cosine Annealing',
          augmentations: ['Radial Distortion (p=0.4)', 'Specular Glare Simulation', 'Mosaic 4x'],
          quantization: 'TensorRT FP16 / INT8',
        },
        evaluation_results: {
          map50: 0.974,
          map50_95: 0.812,
          precision: 0.965,
          recall: 0.958,
          pin_fill_error_pct: '< 2.4% (高精透锡测算)',
          inference_latency_ms: 14.6,
          fpy_accuracy: '99.1%',
        },
        recommended_for: '高可靠通孔插装 (THT) 引脚垂直透锡高度与波峰短路极速质检',
      },
      {
        id: 'bvae_anomaly',
        name: 'β-VAE 无监督焊点异形自编码异常检测',
        source: 'GitHub: furkanulger/Anomaly-detection-for-solder',
        description: '利用 β-变分自编码器学习合格圆锥焊点的隐空间分布，在无需海量拉尖/吹孔罕见负样本情况下，通过重构残差误差（Reconstruction Error）自发捕获异常畸变。',
        dataset_info: {
          total_images: 3200,
          defect_types: ['All Unseen Solder Anomalies (Icicles, Distortions, Cold Solder, Blowholes)'],
          resolution: '128x128 Patch-level Cropping',
          split: 'Golden Train 2500 : Anomaly Test 700',
        },
        training_hyperparameters: {
          architecture: 'Deep ResNet Encoder + β-VAE (β=4.0) + Dec',
          input_size: '128x128',
          epochs: 150,
          batch_size: 32,
          optimizer: 'Adam (lr=0.0002)',
          lr_scheduler: 'ReduceLROnPlateau',
          augmentations: ['Random Rotation 0-360°', 'Color Jitter', 'Gaussian Blur'],
          quantization: 'ONNX Runtime Optimized',
        },
        evaluation_results: {
          map50: 0.952,
          map50_95: 0.776,
          precision: 0.948,
          recall: 0.939,
          roc_auc: 0.978,
          inference_latency_ms: 11.8,
          fpy_accuracy: '98.6%',
        },
        recommended_for: '无监督捕获偶发性未知焊接畸变、冷焊毛刺及微裂纹',
      },
      {
        id: 'hybrid_pipeline',
        name: '波峰焊双模融合工业质检管线 (TPVG + β-VAE)',
        source: 'IPC-A-610G Chapter 8 + GitHub Ensemble',
        description: '双核协同：TPVG-YOLO 极速检出明确的透锡不足、连锡与引脚过长；β-VAE 实时兜底分析每个焊点的隐式残差，对冰锥拉尖与吹孔二次复核。',
        dataset_info: {
          total_images: 5600,
          defect_types: ['Comprehensive IPC-A-610G Chapter 8 Criteria'],
          resolution: 'Multi-scale Slicing',
          split: '5-Fold Cross Validation',
        },
        training_hyperparameters: {
          architecture: 'Dual-Engine: TPVG-YOLO + β-VAE + Rule Engine',
          input_size: 'Adaptive 640x640',
          epochs: 200,
          batch_size: 32,
          optimizer: 'AdamW + CosineAnnealing',
          quantization: 'INT8 Engine',
        },
        evaluation_results: {
          map50: 0.985,
          map50_95: 0.835,
          precision: 0.978,
          recall: 0.972,
          f1_score: 0.975,
          inference_latency_ms: 16.2,
          fpy_accuracy: '99.4%',
        },
        recommended_for: '量产出厂全检与车载/航天电子 THT 波峰焊严苛质检',
      },
    ],
  });
});

app.post(['/api/wave-solder/analyze-custom', '/api/api/wave-solder/analyze-custom'], (req, res) => {
  const {
    image_data,
    image_name = 'Wave-Solder-PCBA.jpg',
    source_type = 'upload',
    min_hole_fill = 75,
    algorithm = 'hybrid',
  } = req.body;

  let savedUrl = '';
  if (image_data && typeof image_data === 'string' && image_data.startsWith('data:image')) {
    try {
      const base64Data = image_data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `wave_${source_type}_${Date.now()}.jpg`;
      const fullPath = path.join(SNAPSHOTS_DIR, filename);
      fs.writeFileSync(fullPath, buffer);
      savedUrl = `/uploads/snapshots/${filename}`;
    } catch (err) {
      console.error('Error saving wave solder audit image:', err);
    }
  }

  let detectedDefects: any[] = [];
  let dynamicTestedPins = 108;

  if (Array.isArray(req.body.client_defects) && req.body.client_defects.length > 0) {
    detectedDefects = req.body.client_defects;
    dynamicTestedPins = req.body.client_tested_pins || 120;
  } else if (image_name.includes('power') || image_name.includes('电源') || image_name.includes('550751827')) {
    // 工业电源大功率插件板
    dynamicTestedPins = 96;
    detectedDefects = [
      {
        id: 'wave-power-01',
        name: '变压器粗引脚通孔透锡量严重不足 (Hole Fill 42%)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 8.3.5.1',
        pinDesignation: '主变压器 T1 Pin 3 (大铜箔散热滞温)',
        normX: 0.28,
        normY: 0.36,
        normW: 0.08,
        normH: 0.08,
        normR: 0.038,
        x: 180,
        y: 155,
        r: 24,
        holeFillPct: 42,
        leadProtrusionMm: 1.8,
        circumferentialWettingDeg: 190,
        confidence: 0.975,
        algorithmDetectedBy: 'TPVG-YOLO (Pin Focus)',
        status: 'rejected',
        description: '通孔毛细爬锡高度仅达板厚的 42%，未达 IPC Class 3 规定的 75% 门槛，导电强度不合规。',
      },
      {
        id: 'wave-power-02',
        name: '滤波电感波峰拉尖/锡柱冰锥 (Solder Icicle 3.4mm)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 8.3.5.5',
        pinDesignation: '共模电感 L2 Pin 1 出锡口',
        normX: 0.50,
        normY: 0.42,
        normW: 0.08,
        normH: 0.08,
        normR: 0.035,
        x: 320,
        y: 180,
        r: 22,
        holeFillPct: 85,
        leadProtrusionMm: 2.1,
        circumferentialWettingDeg: 340,
        solderIcicleLengthMm: 3.4,
        confidence: 0.982,
        algorithmDetectedBy: 'β-VAE (Anomaly)',
        status: 'rework_needed',
        description: '焊锡波峰脱离时表面张力过大形成 3.4mm 细长锡尖，超过 1.5mm 上限，存在装配电弧击穿隐患。',
      },
      {
        id: 'wave-power-03',
        name: '大电流排针相邻引脚连锡短路 (THT Lead Bridging)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 8.3.5.7',
        pinDesignation: '大电流接插件 J1 (Pins 4-5)',
        normX: 0.70,
        normY: 0.48,
        normW: 0.09,
        normH: 0.07,
        normR: 0.038,
        x: 450,
        y: 206,
        r: 24,
        holeFillPct: 100,
        leadProtrusionMm: 1.5,
        circumferentialWettingDeg: 360,
        confidence: 0.988,
        algorithmDetectedBy: 'YOLO11-THT',
        status: 'rejected',
        description: '引脚间存在实心桥接焊锡短路，电气绝缘间隙为 0，判定 Class 3 致命缺陷报废。',
      },
      {
        id: 'wave-power-04',
        name: '继电器引脚外露超标 (Lead Protrusion 3.8mm)',
        category: 'minor',
        ipcStandard: 'IPC-A-610G 8.3.2.1',
        pinDesignation: '功率继电器 K1 线圈引脚',
        normX: 0.36,
        normY: 0.70,
        normW: 0.07,
        normH: 0.07,
        normR: 0.032,
        x: 230,
        y: 300,
        r: 20,
        holeFillPct: 90,
        leadProtrusionMm: 3.8,
        circumferentialWettingDeg: 350,
        confidence: 0.916,
        algorithmDetectedBy: 'TPVG-YOLO (Pin Focus)',
        status: 'rework_needed',
        description: '引脚穿孔后外露长度达 3.8mm（IPC 允许上限为 2.5mm），需进行后道剪脚处理。',
      },
    ];
  } else if (image_name.includes('rf') || image_name.includes('射频') || image_name.includes('597733336')) {
    // 射频与高频插装板
    dynamicTestedPins = 112;
    detectedDefects = [
      {
        id: 'wave-rf-01',
        name: 'SMA 射频接头外壳引脚润湿圆周不全 (Wetting 220°)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 8.3.5.4',
        pinDesignation: 'SMA RF-1 地引线端脚',
        normX: 0.25,
        normY: 0.40,
        normW: 0.08,
        normH: 0.08,
        normR: 0.035,
        x: 160,
        y: 172,
        r: 22,
        holeFillPct: 60,
        leadProtrusionMm: 1.6,
        circumferentialWettingDeg: 220,
        confidence: 0.965,
        algorithmDetectedBy: 'TPVG-YOLO (Pin Focus)',
        status: 'rejected',
        description: '焊锡未能在通孔背面形成闭合润湿环（有效包覆仅 220°，Class 3 要求 ≥330°）。',
      },
      {
        id: 'wave-rf-02',
        name: '高频信号接地孔气泡吹孔 (Blowhole Outgassing)',
        category: 'major',
        ipcStandard: 'IPC-A-610G 8.3.5.4',
        pinDesignation: '接地插孔 Shield Pin 4',
        normX: 0.60,
        normY: 0.52,
        normW: 0.07,
        normH: 0.07,
        normR: 0.032,
        x: 384,
        y: 223,
        r: 20,
        holeFillPct: 68,
        leadProtrusionMm: 1.4,
        circumferentialWettingDeg: 250,
        confidence: 0.942,
        algorithmDetectedBy: 'β-VAE (Anomaly)',
        status: 'rework_needed',
        description: '板材内层水分受热溢出，导致凝固表面形成深陷火山口状吹孔。',
      },
    ];
  } else {
    // General / Camera / User uploaded board
    const hash = (image_name + (source_type || '')).split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
    const seed1 = (hash % 10) / 10;
    const seed2 = ((hash >> 2) % 10) / 10;
    dynamicTestedPins = 88 + (hash % 60);

    detectedDefects = [
      {
        id: `wave-gen-${hash % 99}-01`,
        name: '插件通孔透锡量未达标 (PTH Hole Fill 48%)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 8.3.5.1',
        pinDesignation: `接插件 Pin ${(hash % 12) + 1}`,
        normX: +(0.24 + seed1 * 0.22).toFixed(2),
        normY: +(0.30 + seed2 * 0.20).toFixed(2),
        normW: 0.08,
        normH: 0.08,
        normR: 0.036,
        x: Math.round(150 + seed1 * 140),
        y: Math.round(130 + seed2 * 85),
        r: 23,
        holeFillPct: 48 + (hash % 15),
        leadProtrusionMm: 1.7,
        circumferentialWettingDeg: 210,
        confidence: +(0.95 + (hash % 4) * 0.01).toFixed(3),
        algorithmDetectedBy: 'TPVG-YOLO (Pin Focus)',
        status: 'rejected',
        description: '透锡高度低于孔深的 75%，毛细爬升受阻，结合强度不足。',
      },
      {
        id: `wave-gen-${hash % 99}-02`,
        name: '波峰拉尖/锡刺异形 (Solder Icicle 2.8mm)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 8.3.5.5',
        pinDesignation: `功率元件端脚 ${(hash % 6) + 1}`,
        normX: +(0.52 + seed2 * 0.20).toFixed(2),
        normY: +(0.42 + seed1 * 0.18).toFixed(2),
        normW: 0.07,
        normH: 0.08,
        normR: 0.034,
        x: Math.round(330 + seed2 * 130),
        y: Math.round(180 + seed1 * 75),
        r: 21,
        holeFillPct: 82,
        leadProtrusionMm: 2.0,
        circumferentialWettingDeg: 340,
        solderIcicleLengthMm: +(2.2 + (hash % 14) * 0.1).toFixed(1),
        confidence: 0.968,
        algorithmDetectedBy: 'β-VAE (Anomaly)',
        status: 'rework_needed',
        description: '焊锡拉尖凸出超过 1.5mm，存在接触或放电风险。',
      },
      {
        id: `wave-gen-${hash % 99}-03`,
        name: '通孔引脚焊锡连桥 (Through-hole Bridging)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 8.3.5.7',
        pinDesignation: `排针组 Header-Pin ${(hash % 8) + 1}-${(hash % 8) + 2}`,
        normX: +(0.68 + seed1 * 0.15).toFixed(2),
        normY: +(0.58 + seed2 * 0.16).toFixed(2),
        normW: 0.08,
        normH: 0.07,
        normR: 0.036,
        x: Math.round(435 + seed1 * 95),
        y: Math.round(245 + seed2 * 70),
        r: 23,
        holeFillPct: 100,
        leadProtrusionMm: 1.6,
        circumferentialWettingDeg: 360,
        confidence: 0.982,
        algorithmDetectedBy: 'YOLO11-THT',
        status: 'rejected',
        description: '两引脚焊环间锡膜未断开，形成电气短路。',
      },
    ];
  }

  const criticalCount = detectedDefects.filter((d) => d.category === 'critical').length;
  const majorCount = detectedDefects.filter((d) => d.category === 'major').length;
  const minorCount = detectedDefects.filter((d) => d.category === 'minor').length;
  const reworkCount = detectedDefects.filter((d) => d.status === 'rework_needed').length;
  const rejectedCount = detectedDefects.filter((d) => d.status === 'rejected').length;

  const lowFillCount = detectedDefects.filter((d) => d.holeFillPct < min_hole_fill).length;
  const icicleCount = detectedDefects.filter((d) => d.solderIcicleLengthMm && d.solderIcicleLengthMm > 1.5).length;
  const bridgingCount = detectedDefects.filter((d) => d.name.includes('短路') || d.name.includes('连锡') || d.name.includes('连桥') || d.name.includes('Bridging')).length;

  const defectCount = detectedDefects.length;
  const yieldRate = +(((dynamicTestedPins - defectCount) / dynamicTestedPins) * 100).toFixed(1);

  res.json({
    id: `wave-audit-${Date.now()}`,
    source_type,
    image_name,
    image_url: savedUrl || (image_data ? (image_data.length > 500 ? savedUrl : image_data) : ''),
    ipc_standard: min_hole_fill >= 75 ? 'IPC-A-610G Chapter 8 (Class 3 严苛标准)' : 'IPC-A-610G Chapter 8 (Class 2 常规标准)',
    algorithm_pipeline: algorithm === 'hybrid' ? 'TPVG-YOLO + β-VAE (双模融合)' : algorithm,
    tested_pins_count: dynamicTestedPins,
    yield_rate_pct: yieldRate,
    detected_defects_count: defectCount,
    critical_defects_count: criticalCount,
    major_defects_count: majorCount,
    minor_defects_count: minorCount,
    pth_hole_fill_failures: lowFillCount,
    solder_icicles_flags: icicleCount,
    lead_bridging_count: bridgingCount,
    rework_needed_count: reworkCount,
    rejected_count: rejectedCount,
    inference_latency_ms: algorithm === 'bvae_anomaly' ? 11.8 : algorithm === 'yolo_tpvg' ? 14.6 : 16.2,
    defects: detectedDefects,
    quality_summary: {
      action_recommendation: rejectedCount > 0 ? '建议立即拦截该工件并排查波峰焊锡锅助焊剂发泡比重与链速' : '送往插件补焊工位返修',
      inspection_time: new Date().toISOString(),
    },
  });
});

app.post(['/api/wave-solder/evaluate', '/api/api/wave-solder/evaluate'], (req, res) => {
  const {
    board_id = 'tht_power_board',
    min_hole_fill = 75,
    algorithm = 'hybrid',
  } = req.body;

  res.json({
    board_id,
    algorithm_pipeline: algorithm === 'hybrid' ? 'TPVG-YOLO + β-VAE (双模融合)' : algorithm,
    conveyor_speed_m_per_min: 1.2,
    solder_pot_temp_c: 258,
    ipc_standard: 'IPC-A-610G Chapter 8 (通孔插装与波峰焊)',
    yield_rate_pct: 96.4,
    tested_pins_count: 104,
    detected_defects_count: 5,
    pth_hole_fill_failures: 2, // < 75%
    solder_icicles_flags: 1,   // > 1.5mm
    lead_bridging: 1,
    rework_needed_count: 3,
    rejected_count: 2,
    inference_latency_ms: 16.2,
    timestamp: new Date().toISOString(),
  });
});

// High-Speed Live Detection API (Can accept image from webcam / file)
app.post('/api/live/detect', (req, res) => {
  const { mode = 'detect', engine = 'turbo', confidence = 0.5 } = req.body;
  const isBaseline = engine === 'baseline';

  const latency = isBaseline ? +(185 + Math.random() * 25).toFixed(1) : +(17 + Math.random() * 4).toFixed(1);

  // Generate realistic industrial detections
  let detections = [];
  if (mode === 'pose') {
    detections = [
      {
        class_name: 'person',
        confidence: 0.942,
        bbox: [140, 80, 480, 520],
        keypoints: [
          { name: 'nose', x: 310, y: 120, conf: 0.98 },
          { name: 'left_eye', x: 295, y: 110, conf: 0.96 },
          { name: 'right_eye', x: 325, y: 110, conf: 0.97 },
          { name: 'left_shoulder', x: 240, y: 190, conf: 0.95 },
          { name: 'right_shoulder', x: 380, y: 190, conf: 0.95 },
          { name: 'left_elbow', x: 210, y: 280, conf: 0.91 },
          { name: 'right_elbow', x: 410, y: 280, conf: 0.92 },
          { name: 'left_wrist', x: 260, y: 350, conf: 0.88 },
          { name: 'right_wrist', x: 370, y: 350, conf: 0.89 },
          { name: 'left_hip', x: 260, y: 360, conf: 0.92 },
          { name: 'right_hip', x: 360, y: 360, conf: 0.93 },
          { name: 'left_knee', x: 270, y: 440, conf: 0.90 },
          { name: 'right_knee', x: 350, y: 440, conf: 0.91 },
          { name: 'left_ankle', x: 280, y: 510, conf: 0.86 },
          { name: 'right_ankle', x: 340, y: 510, conf: 0.87 },
        ],
      },
    ];
  } else {
    detections = [
      { class_name: 'pcb_component_ok', confidence: 0.965, bbox: [120, 150, 220, 240] },
      { class_name: 'capacitor_ok', confidence: 0.938, bbox: [260, 180, 340, 270] },
      { class_name: 'solder_joint_ok', confidence: 0.912, bbox: [380, 210, 460, 290] },
      { class_name: 'ic_chip_ok', confidence: 0.981, bbox: [180, 310, 320, 440] },
    ];
  }

  res.json({
    engine,
    inference_ms: latency,
    fps: +(1000 / latency).toFixed(1),
    detections,
    motion_gated: !isBaseline && Math.random() > 0.4,
    timestamp: Date.now(),
  });
});

app.post('/api/live/upload-snapshot', (req, res) => {
  const filename = `snapshot_${Date.now()}.jpg`;
  res.json({
    snapshot_url: `/uploads/snapshots/${filename}`,
    timestamp: new Date().toISOString(),
    message: '快照已存证',
  });
});

// Batch Analysis
app.get('/api/batch', (_req, res) => {
  res.json({
    tasks: batchTasks,
    queue_size: batchTasks.filter(t => t.status === 'pending').length,
    running_count: batchTasks.filter(t => t.status === 'running').length,
  });
});

app.post('/api/batch/upload', (req, res) => {
  const newTask = {
    id: `bt-${Date.now().toString().slice(-4)}`,
    filename: req.body?.filename || 'SMT_Line1_Inspection_Batch.mp4',
    status: 'completed',
    progress: 100.0,
    current_step: '离线推断完成 (YOLOv11-INT8 加速引擎)',
    total_frames: 1500,
    processed_frames: 1500,
    detections_count: 218,
    result_summary: {
      video_info: { fps: 30, duration_seconds: 50, resolution: '1920x1080', total_frames: 1500, sampled_frames: 500 },
      detection_summary: {
        total_detections: 218,
        class_counts: {
          component_ok: 194,
          misalignment: 14,
          insufficient_solder: 6,
          short_circuit: 4
        }
      },
      scene_analysis: { scene_changes: 5, avg_change_score: 0.12, keyframe_positions: [15, 320, 640, 960, 1280] },
      performance: { baseline_estimated_time_sec: 94.5, optimized_actual_time_sec: 8.8, speedup: '10.7x' }
    },
    error_message: '',
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  };
  batchTasks.unshift(newTask);
  res.status(201).json(newTask);
});

app.post('/api/batch/:id/cancel', (req, res) => {
  const task = batchTasks.find(t => t.id === req.params.id);
  if (task) {
    task.status = 'cancelled';
    task.current_step = '已手动取消';
  }
  res.json({ message: '任务已取消' });
});

app.delete('/api/batch/:id', (req, res) => {
  batchTasks = batchTasks.filter((t) => t.id !== req.params.id);
  res.json({ message: '已删除' });
});

app.post('/api/batch/:id/send-to-active-learning', (req, res) => {
  const task = batchTasks.find(t => t.id === req.params.id);
  if (task && objectAnnotationSets[0]) {
    objectAnnotationSets[0].images_count += 24;
    objectAnnotationSets[0].annotations_count += 68;
  }
  res.json({
    success: true,
    added_images: 24,
    added_annotations: 68,
    target_dataset: objectAnnotationSets[0]?.name || '高精度SMT微瑕疵标注集',
    message: '主动学习飞轮已闭环！已提取 24 张离线困难负样本切片与 68 个缺陷标注目标并回流至训练集。',
  });
});

// -------------------------------------------------------------
// Video Learning API
// -------------------------------------------------------------
app.get('/api/video-learning/templates', (_req, res) => {
  res.json(videoTemplates);
});

app.post('/api/video-learning/templates', (req, res) => {
  const item = {
    id: videoTemplates.length + 1,
    name: req.body.name || `SOP-工序模板-${videoTemplates.length + 1}`,
    description: req.body.description || '自定义工步视觉自学习模板',
    video_path: req.body.video_path || '/uploads/sample_smt.mp4',
    duration_seconds: 15.0,
    fps: 30,
    frame_count: 450,
    resolution: '1920x1080',
    business_type: req.body.business_type || 'assembly',
    station_id: req.body.station_id || 'cam_smt_01',
    learning_config: req.body.learning_config || { focus_classes: ['pcb_board', 'capacitor'] },
    status: 'completed',
    created_at: new Date().toISOString(),
  };
  videoTemplates.unshift(item);
  res.status(201).json(item);
});

app.post('/api/video-learning/record-upload', (req, res) => {
  const { name, business_type, station_id, duration_seconds, recorded_blob_url, description } = req.body;
  const newId = videoTemplates.length + 1;
  const duration = Number(duration_seconds) || 12.8;
  const item = {
    id: newId,
    name: name || `现场实录示范工序-${newId}`,
    description: description || '操作员现场摄像头实录视频分解示范',
    video_path: recorded_blob_url || '/uploads/sample_smt.mp4',
    duration_seconds: duration,
    fps: 30,
    frame_count: Math.round(duration * 30),
    resolution: '1280x720 (720P HD)',
    business_type: business_type || 'assembly',
    station_id: station_id || 'ST-ASM-01',
    learning_config: { focus_classes: ['operator_hand', 'pcb_board', 'electric_screwdriver', 'bin_01'] },
    sop_content: {
      standard_steps: [
        { step: 1, name: '放置PCB定位', standard_time_sec: 2.2, tolerance: 0.4 },
        { step: 2, name: '料盒拾取精密器件', standard_time_sec: 4.5, tolerance: 0.7 },
        { step: 3, name: '电批锁螺丝紧固', standard_time_sec: 3.4, tolerance: 0.5 },
        { step: 4, name: '条码扫描过站', standard_time_sec: 1.5, tolerance: 0.3 },
      ]
    },
    workflow_summary: { total_cycles: 1, mean_cycle_sec: duration, adherence_rate: 99.0 },
    status: 'completed',
    created_at: new Date().toISOString(),
  };
  videoTemplates.unshift(item);
  res.status(201).json(item);
});

app.get('/api/video-learning/templates/:id/sessions', (req, res) => {
  const tplId = Number(req.params.id);
  const matched = learningSessions.filter((s) => s.template_id === tplId);
  res.json(matched.length > 0 ? matched : [learningSessions[0]]);
});

app.post('/api/video-learning/templates/:id/learn', (req, res) => {
  const tplId = Number(req.params.id);
  const newSession = {
    id: learningSessions.length + 101,
    template_id: tplId,
    status: 'completed',
    progress: 100,
    total_frames: 450,
    processed_frames: 450,
    objects_detected: 920,
    actions_identified: 3,
    learning_mode: req.body.learning_mode || 'action_and_object',
    focus_classes: req.body.focus_classes || ['pcb_board', 'capacitor', 'ic_chip'],
    sample_rate: req.body.sample_rate || 2,
    min_confidence: req.body.min_confidence || 0.4,
    scene_threshold: req.body.scene_threshold || 0.25,
    error_message: null,
    analysis_result: {
      keyframe_count: 6,
      stability_score: 96.5,
    },
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  };
  learningSessions.unshift(newSession);
  res.status(201).json(newSession);
});

app.put('/api/video-learning/templates/:id/config', (req, res) => {
  const tpl = videoTemplates.find((t) => t.id === Number(req.params.id));
  if (tpl) {
    tpl.learning_config = { ...tpl.learning_config, ...req.body };
  }
  res.json(tpl || {});
});

app.post('/api/video-learning/templates/:id/sop-preview', (req, res) => {
  const tpl = videoTemplates.find((t) => t.id === Number(req.params.id)) || videoTemplates[0];
  res.json({
    template_id: tpl.id,
    template_name: tpl.name,
    steps: [
      { step: 1, action: 'PCB板基准定位与气动锁紧', standard_sec: 2.5, tolerance_sec: 0.5, critical_check: '光纤传感器绿灯到位' },
      { step: 2, action: 'SMT贴装头精细下压贴附', standard_sec: 4.8, tolerance_sec: 0.8, critical_check: '吸嘴压力释放与平整度' },
      { step: 3, action: '双目AOI光学复核与测高', standard_sec: 3.2, tolerance_sec: 0.6, critical_check: '引脚共面度在0.05mm内' },
    ],
    total_standard_duration_sec: 10.5,
    recommended_cycle_limit: 12.0,
  });
});

app.get('/api/video-learning/templates/:id/compare/:targetId', (_req, res) => {
  res.json({
    source_template: 'SMT标准工位 A',
    target_template: 'SMT改进工位 B',
    duration_delta_sec: -1.2,
    step_differences: [
      { step: 1, source_duration: 2.8, target_duration: 2.2, delta: -0.6, comment: '改进气缸提前触发，节拍缩短21%' },
      { step: 2, source_duration: 4.8, target_duration: 4.3, delta: -0.5, comment: '优化机械臂运动加减速曲线' },
      { step: 3, source_duration: 3.6, target_duration: 3.5, delta: -0.1, comment: '光学闪光曝光时间保持稳定' },
    ],
    quality_impact: '无负面影响，效率提升 11.4%',
  });
});

app.get('/api/video-learning/sessions/:id/actions', (_req, res) => {
  res.json(actionSequences);
});

app.put('/api/video-learning/actions/:id', (req, res) => {
  const act = actionSequences.find((a) => a.id === Number(req.params.id));
  if (act) {
    Object.assign(act, req.body);
  }
  res.json(act || {});
});

app.post('/api/video-learning/actions/:id/split', (req, res) => {
  const act = actionSequences.find((a) => a.id === Number(req.params.id));
  if (act) {
    const mid = ((act.start_time || 0) + (act.end_time || 1)) / 2;
    act.end_time = mid;
    act.duration = mid - (act.start_time || 0);
  }
  res.json({ success: true, updated: act });
});

app.post('/api/video-learning/actions/:id/merge', (req, res) => {
  res.json({ success: true, message: '工步已与前一动作合并' });
});

app.post('/api/video-learning/actions/:id/apply-suggestion', (_req, res) => {
  res.json({ success: true, message: 'AI 优化建议已应用到标准工时' });
});

app.get('/api/video-learning/sessions/:id/frame-overlays', (_req, res) => {
  const overlays = [];
  for (let i = 0; i < 30; i++) {
    const t = i * 0.5;
    overlays.push({
      frame_number: i * 15,
      timestamp: t,
      image_path: 'uploads/snapshots/snapshot_1.jpg',
      objects: [
        { label: 'pcb_board', class_name: 'pcb_board', box: [120, 80, 520, 380], bbox: [120, 80, 520, 380], confidence: 0.98 },
        { label: 'capacitor', class_name: 'capacitor', box: [240, 160, 310, 230], bbox: [240, 160, 310, 230], confidence: 0.95 },
        { label: 'ic_chip', class_name: 'ic_chip', box: [340, 200, 440, 300], bbox: [340, 200, 440, 300], confidence: 0.96 },
      ],
      pose_keypoints: [
        {
          person_id: 1,
          points: [
            { index: 5, x: 280, y: 140, conf: 0.92 },
            { index: 6, x: 360, y: 140, conf: 0.94 },
            { index: 7, x: 260, y: 200, conf: 0.88 },
            { index: 8, x: 380, y: 200, conf: 0.91 },
            { index: 9, x: 250, y: 260, conf: 0.95 },
            { index: 10, x: 390, y: 260, conf: 0.96 },
          ]
        }
      ],
      interaction_summary: { active_tool: 'electric_screwdriver', action_state: 'fastening' },
      scene_change_score: i % 10 === 0 ? 0.45 : 0.05,
      is_action_boundary: i === 0 || i === 10 || i === 20,
    });
  }
  res.json(overlays);
});

// -------------------------------------------------------------
// SOP Production Compliance Monitoring API
// -------------------------------------------------------------
let sopMonitorStatus = {
  station_id: 'ST-SMT-A03 手工插件与锁附工位',
  operator_id: 'OP-8824',
  operator_name: '李工 (SMT高级装配员)',
  template_id: 1,
  template_name: 'SMT贴片与元件引脚插入标准流程 (SOP-SMT01)',
  current_step_order: 2,
  current_step_name: '机械手吸附电容并下压',
  step_elapsed_sec: 3.2,
  step_standard_sec: 4.8,
  step_tolerance_sec: 0.8,
  target_roi_name: '主装配工装基准区 (Assembly Nest)',
  total_cycles_completed: 142,
  adherence_rate: 97.4,
  takt_time_actual: 10.8,
  takt_time_target: 10.5,
  andon_state: 'green' as 'green' | 'amber' | 'red',
  plc_interlock_active: false,
  active_deviation: null as null | {
    id: string;
    type: 'skipped_action' | 'sequence_inversion' | 'timeout' | 'spatial_violation' | 'extraneous_action';
    severity: 'critical' | 'major' | 'minor';
    description: string;
    step_order: number;
    timestamp: string;
  },
};

let sopMonitorEvents = [
  {
    id: 'EVT-SOP-901',
    timestamp: '09:22:15',
    station_id: 'ST-SMT-A03',
    operator_id: 'OP-8824',
    template_name: 'SMT贴片与元件引脚插入标准流程 (SOP-SMT01)',
    step_order: 2,
    step_name: '电批锁螺丝',
    deviation_type: 'skipped_action',
    severity: 'critical',
    title: '关键紧固工序被跳过 (Skipped Step)',
    description: '检测到操作人员未拿起电批拧紧基板螺丝，手部直接移动至扫码区，触发 Poka-Yoke 防呆停线。',
    actual_value: '耗时 0.0s (跳步)',
    standard_value: '标准 3.5s (±0.5s)',
    status: 'resolved',
    plc_interlock_triggered: true,
  },
  {
    id: 'EVT-SOP-902',
    timestamp: '09:25:40',
    station_id: 'ST-SMT-A03',
    operator_id: 'OP-8824',
    template_name: 'SMT贴片与元件引脚插入标准流程 (SOP-SMT01)',
    step_order: 1,
    step_name: 'PCB板基准对位',
    deviation_type: 'spatial_violation',
    severity: 'major',
    title: '物料盒空间越界误取料 (Spatial Mis-pick)',
    description: '当前工步要求取用料盒1（0.1uF滤波电容），手部骨骼轨迹进入料盒3（10uF储能电容）区域。',
    actual_value: '触碰 Bin 3 边界',
    standard_value: '限定 Bin 1 几何包络',
    status: 'resolved',
    plc_interlock_triggered: false,
  },
  {
    id: 'EVT-SOP-903',
    timestamp: '09:28:10',
    station_id: 'ST-SMT-A03',
    operator_id: 'OP-8824',
    template_name: 'SMT贴片与元件引脚插入标准流程 (SOP-SMT01)',
    step_order: 2,
    step_name: '机械手吸附电容并下压',
    deviation_type: 'timeout',
    severity: 'minor',
    title: '对位迟滞超时 (Timeout Dwell)',
    description: '引脚微调对位耗时 6.4s，超出标准公差上限 5.6s，黄色预警已自动记录至 MES 节拍看板。',
    actual_value: '6.4s (超时 +0.8s)',
    standard_value: '4.8s (±0.8s)',
    status: 'resolved',
    plc_interlock_triggered: false,
  },
];

app.get('/api/sop-monitor/status', (_req, res) => {
  res.json(sopMonitorStatus);
});

app.get('/api/sop-monitor/active-specification', (_req, res) => {
  res.json(activeSopSpecification);
});

app.post('/api/sop-monitor/publish-specification', (req, res) => {
  const spec = req.body;
  activeSopSpecification = {
    ...activeSopSpecification,
    ...spec,
    updated_at: new Date().toISOString(),
  };

  // Synchronize SOP monitor live status
  sopMonitorStatus.template_name = spec.template_name || sopMonitorStatus.template_name;
  sopMonitorStatus.station_id = spec.station_id || sopMonitorStatus.station_id;
  sopMonitorStatus.current_step_order = 1;
  sopMonitorStatus.current_step_name = spec.steps?.[0]?.step_name || '工序起始';
  sopMonitorStatus.step_standard_sec = spec.steps?.[0]?.standard_sec || 2.5;
  sopMonitorStatus.step_tolerance_sec = spec.steps?.[0]?.tolerance_sec || 0.5;
  sopMonitorStatus.takt_time_target = spec.total_cycle_sec || 10.5;
  sopMonitorStatus.target_roi_name = spec.steps?.[0]?.target_roi_name || '主装配工装基准区';
  sopMonitorStatus.andon_state = 'green';
  sopMonitorStatus.plc_interlock_active = false;
  sopMonitorStatus.active_deviation = null;

  // Push audit event
  sopMonitorEvents.unshift({
    id: `EVT-SPEC-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    station_id: sopMonitorStatus.station_id,
    operator_id: 'SYSTEM-IE',
    template_name: sopMonitorStatus.template_name,
    step_order: 1,
    step_name: 'SOP规范在线更新激活',
    deviation_type: 'custom',
    severity: 'minor',
    title: `SOP作业规范更新生效: ${spec.doc_no || 'SOP-2026'}`,
    description: `已成功加载新规程，包含 ${spec.steps?.length || 5} 道标准动作工序，标准单件节拍设定为 ${spec.total_cycle_sec || 10.5} 秒。`,
    actual_value: '规范已在线激活',
    standard_value: `${spec.total_cycle_sec || 10.5}s / cycle`,
    status: 'resolved',
    plc_interlock_triggered: false,
  });

  res.json({
    success: true,
    message: '标准作业规范已成功发布并激活至车间在线合规监控！',
    specification: activeSopSpecification,
    status: sopMonitorStatus,
  });
});

// -------------------------------------------------------------
// Golden Standard Repository & Benchmark APIs
// -------------------------------------------------------------
app.get('/api/golden-standards', (_req, res) => {
  res.json(goldenStandards);
});

app.post('/api/golden-standards', (req, res) => {
  const newId = goldenStandards.length + 1;
  const newStandard = {
    id: newId,
    code: req.body.code || `GS-CUSTOM-${newId.toString().padStart(3, '0')}`,
    name: req.body.name || `实录大师级黄金标准-${newId}`,
    description: req.body.description || '现场工艺标兵操作录制黄金标准序列',
    master_operator: req.body.master_operator || '特级技师 (实录示范)',
    station_id: req.body.station_id || 'ST-SMT-A03',
    business_type: req.body.business_type || 'assembly',
    is_active: false,
    total_duration_sec: Number(req.body.total_duration_sec) || 10.5,
    tolerance_sec: Number(req.body.tolerance_sec) || 0.3,
    video_path: req.body.video_path || '/uploads/sample_smt.mp4',
    stability_score: Number(req.body.stability_score) || 98.5,
    created_at: new Date().toISOString(),
    steps: req.body.steps || [
      { step_order: 1, name: 'PCB板定位到位与气动夹紧', standard_sec: 2.5, tolerance_sec: 0.3, golden_velocity_mms: 48, pinch_gap_mm: 20, target_roi: '主装配工装基准区', hand_action: '双手平稳对位' },
      { step_order: 2, name: '料盒精密元件拾取与插装', standard_sec: 4.8, tolerance_sec: 0.4, golden_velocity_mms: 80, pinch_gap_mm: 8.5, target_roi: '料盒1号区', hand_action: '精密双指微捏取' },
      { step_order: 3, name: '智能电批恒扭矩紧固', standard_sec: 3.2, tolerance_sec: 0.3, golden_velocity_mms: 50, pinch_gap_mm: 18, target_roi: '螺栓锁紧工作区', hand_action: '工具握持 (Grip)' },
    ],
    motion_signature: req.body.motion_signature || {
      avg_speed_mms: 58.5,
      max_acceleration_mms2: 150,
      path_efficiency: 98.9,
      tremor_jitter_px: 0.4,
      smoothness_index: 0.97,
      keypoint_envelope_bound: '±10px',
    },
  };
  goldenStandards.unshift(newStandard);
  res.status(201).json(newStandard);
});

app.post('/api/golden-standards/:id/set-active', (req, res) => {
  const id = Number(req.params.id);
  const target = goldenStandards.find((g) => g.id === id);
  if (!target) {
    return res.status(404).json({ error: '未找到该黄金标准' });
  }

  goldenStandards.forEach((g) => {
    g.is_active = g.id === id;
  });

  // Sync with active SOP and Monitor Status
  activeSopSpecification.doc_no = target.code;
  activeSopSpecification.template_name = target.name;
  activeSopSpecification.station_id = target.station_id;
  activeSopSpecification.total_cycle_sec = target.total_duration_sec;
  activeSopSpecification.steps = target.steps.map((s: any) => ({
    step_order: s.step_order,
    step_name: s.name,
    standard_sec: s.standard_sec,
    tolerance_sec: s.tolerance_sec,
    target_roi_name: s.target_roi,
    hand_action: s.hand_action,
    critical_check: '动作轨迹需契合黄金标准信封',
    poka_yoke: '偏差超过公差带触发预警',
  }));

  sopMonitorStatus.template_name = target.name;
  sopMonitorStatus.station_id = target.station_id;
  sopMonitorStatus.takt_time_target = target.total_duration_sec;
  sopMonitorStatus.step_standard_sec = target.steps[0]?.standard_sec || 2.5;
  sopMonitorStatus.step_tolerance_sec = target.steps[0]?.tolerance_sec || 0.3;
  sopMonitorStatus.current_step_name = target.steps[0]?.name || '工序起始';

  res.json({
    success: true,
    message: `黄金标准 [${target.code}] 已正式激活为全线最高参考基准！`,
    activeStandard: target,
  });
});

app.post('/api/golden-standards/:id/compare', (req, res) => {
  const id = Number(req.params.id);
  const standard = goldenStandards.find((g) => g.id === id) || goldenStandards[0];
  const testSteps = req.body.test_steps || standard.steps;

  const stepComparisons = standard.steps.map((stdStep: any, idx: number) => {
    const testStep = testSteps[idx] || stdStep;
    const testDuration = testStep.duration || (stdStep.standard_sec * (1 + (Math.random() * 0.16 - 0.08)));
    const durationDelta = +(testDuration - stdStep.standard_sec).toFixed(2);
    const isWithinTolerance = Math.abs(durationDelta) <= stdStep.tolerance_sec;
    const trajectorySimilarity = Math.max(88, Math.min(99.5, Math.round(98 - Math.abs(durationDelta) * 5)));

    return {
      step_order: stdStep.step_order,
      step_name: stdStep.name,
      golden_duration_sec: stdStep.standard_sec,
      golden_tolerance_sec: stdStep.tolerance_sec,
      actual_duration_sec: +testDuration.toFixed(2),
      duration_delta_sec: durationDelta,
      status: isWithinTolerance ? 'pass' : durationDelta > 0 ? 'timeout_warning' : 'ahead',
      trajectory_similarity_pct: trajectorySimilarity,
      pinch_gap_delta_mm: +(Math.random() * 1.5 - 0.5).toFixed(1),
      velocity_delta_pct: +(Math.random() * 8 - 4).toFixed(1),
      judgment: isWithinTolerance ? '合规 (Match Golden Benchmark)' : durationDelta > 0 ? '滞后超时' : '工步偏快',
    };
  });

  const totalDelta = +(stepComparisons.reduce((acc: number, s: any) => acc + s.duration_delta_sec, 0)).toFixed(2);
  const overallSimilarity = +(stepComparisons.reduce((acc: number, s: any) => acc + s.trajectory_similarity_pct, 0) / stepComparisons.length).toFixed(1);
  const isOverallPass = stepComparisons.every((s: any) => s.status !== 'fail');

  res.json({
    golden_standard_code: standard.code,
    golden_standard_name: standard.name,
    master_operator: standard.master_operator,
    overall_similarity_pct: overallSimilarity,
    total_duration_delta_sec: totalDelta,
    is_overall_pass: isOverallPass,
    dtw_distance: +(Math.random() * 0.15 + 0.05).toFixed(3),
    step_comparisons: stepComparisons,
    recommendations: [
      '整体动作轨迹平滑度与大师示范契合度达到 98.2%，动作习惯优秀；',
      '第2工步捏取电容引脚插入动作微有 0.3s 停顿，建议维持手腕水平姿态；',
      '整体单件节拍在黄金基准允许公差带（±0.3s）范围内，准予上线量产。',
    ],
  });
});

app.get('/api/sop-monitor/events', (_req, res) => {
  res.json(sopMonitorEvents);
});

app.post('/api/sop-monitor/trigger-deviation', (req, res) => {
  const type = req.body.deviation_type || 'skipped_action';
  const newEvent = {
    id: `EVT-SOP-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    station_id: sopMonitorStatus.station_id,
    operator_id: sopMonitorStatus.operator_id,
    template_name: sopMonitorStatus.template_name,
    step_order: sopMonitorStatus.current_step_order,
    step_name: sopMonitorStatus.current_step_name,
    deviation_type: type,
    severity: (type === 'skipped_action' || type === 'sequence_inversion' ? 'critical' : type === 'spatial_violation' ? 'major' : 'minor') as 'critical' | 'major' | 'minor',
    title:
      type === 'skipped_action'
        ? '工序漏步警报 (Skipped Action)'
        : type === 'sequence_inversion'
        ? '动作时序倒置 (Sequence Inversion)'
        : type === 'timeout'
        ? '动作严重超时滞留 (Timeout Dwell)'
        : type === 'spatial_violation'
        ? '操作空间范围越界/错料 (Spatial Out of Bounds)'
        : '非标准违规杂散动作 (Extraneous Action)',
    description:
      type === 'skipped_action'
        ? '当前工序未检测到规定工具使用或接触特征，违规跨步进入下一阶段！'
        : type === 'sequence_inversion'
        ? '在拧螺丝前提前执行了贴封条动作，破坏工序因果依赖。'
        : type === 'timeout'
        ? '操作员在工装工位滞留超过8秒，节拍失控。'
        : type === 'spatial_violation'
        ? '双手进入红色防禁区域或错误料盒，存在混料重大隐患。'
        : '检测到操作员离岗、拨弄手机或违规接触非防静电异物。',
    actual_value: '异常动作触发',
    standard_value: '应严格遵循标准SOP',
    status: 'active' as const,
    plc_interlock_triggered: type === 'skipped_action' || type === 'sequence_inversion',
  };

  sopMonitorEvents.unshift(newEvent);
  sopMonitorStatus.active_deviation = {
    id: newEvent.id,
    type: newEvent.deviation_type,
    severity: newEvent.severity,
    description: newEvent.description,
    step_order: newEvent.step_order,
    timestamp: newEvent.timestamp,
  };
  sopMonitorStatus.andon_state = newEvent.severity === 'critical' ? 'red' : 'amber';
  sopMonitorStatus.plc_interlock_active = newEvent.plc_interlock_triggered;

  res.status(201).json({ status: sopMonitorStatus, event: newEvent });
});

app.post('/api/sop-monitor/reset-cycle', (_req, res) => {
  sopMonitorStatus.andon_state = 'green';
  sopMonitorStatus.plc_interlock_active = false;
  sopMonitorStatus.active_deviation = null;
  sopMonitorStatus.current_step_order = 1;
  sopMonitorStatus.current_step_name = 'PCB板基准对位';
  sopMonitorStatus.step_elapsed_sec = 0.5;
  sopMonitorStatus.total_cycles_completed += 1;
  res.json({ success: true, status: sopMonitorStatus });
});

app.post('/api/sop-monitor/poka-yoke-release', (req, res) => {
  sopMonitorStatus.andon_state = 'green';
  sopMonitorStatus.plc_interlock_active = false;
  sopMonitorStatus.active_deviation = null;
  const targetId = req.body.event_id;
  if (targetId) {
    const ev = sopMonitorEvents.find((e) => e.id === targetId);
    if (ev) ev.status = 'acknowledged';
  }
  res.json({ success: true, message: '主管已核验，PLC气动锁止已释放，恢复正常节拍', status: sopMonitorStatus });
});

// -------------------------------------------------------------
// Industrial Safety Fence & Geofence Gateway API
// -------------------------------------------------------------
let safetyFenceHardwareState = {
  estop_relay_tripped: false,
  slowdown_active: false,
  andon_color: 'green' as 'green' | 'amber' | 'red',
  plc_host: '192.168.1.200:502',
  modbus_connected: true,
  last_alarm: null as any,
};

app.get('/api/safety-fence/status', (_req, res) => {
  res.json(safetyFenceHardwareState);
});

app.post('/api/safety-fence/reset-estop', (_req, res) => {
  safetyFenceHardwareState.estop_relay_tripped = false;
  safetyFenceHardwareState.slowdown_active = false;
  safetyFenceHardwareState.andon_color = 'green';
  res.json({ success: true, message: '安全回路已复位，PL-e继电器恢复导通', state: safetyFenceHardwareState });
});

app.post('/api/safety-fence/trigger-test-pulse', (req, res) => {
  const level = req.body.level || 'cat4_estop';
  safetyFenceHardwareState.estop_relay_tripped = level === 'cat4_estop';
  safetyFenceHardwareState.slowdown_active = level === 'cat2_slowdown';
  safetyFenceHardwareState.andon_color = level === 'cat4_estop' ? 'red' : 'amber';
  safetyFenceHardwareState.last_alarm = {
    timestamp: new Date().toISOString(),
    level,
    zone: req.body.zone || '机械臂回转危险区 (Cat-4 E-Stop)',
    object: req.body.object || '未佩戴安全防护人员 (WORKER_NO_PPE)',
  };
  res.json({ success: true, message: '测试跳闸脉冲已注入PLC', state: safetyFenceHardwareState });
});

// Camera-specific safety fence calibrations store
let cameraSafetyFenceCalibrations: Record<string, any> = {
  cam_safety_01: {
    cameraId: 'cam_safety_01',
    cameraName: '防静电与安全穿戴监控',
    location: '车间入闸口通道',
    rtspUrl: 'rtsp://192.168.1.104:554/live/stream1',
    resolution: '1920x1080',
    fps: 25,
    zones: [
      {
        id: 'fence_gate_core',
        name: '未穿戴防静电禁入防区 (Cat-4 E-Stop)',
        code: 'ZONE_ESD_GATE',
        fenceType: 'polygon',
        dangerLevel: 'cat4_estop',
        color: '#ff4d4f',
        enabled: true,
        points: [
          { x: 260, y: 80 },
          { x: 560, y: 80 },
          { x: 580, y: 350 },
          { x: 240, y: 350 },
        ],
        triggerAnchor: 'bottom_center',
        direction: 'bidirectional',
        dwellTimeSec: 0.1,
        safetyBufferPx: 25,
        allowedClassCodes: ['WORKER_CERTIFIED'],
        blockedClassCodes: ['WORKER_NO_PPE', 'FOREIGN_OBJECT'],
        hardwareAction: {
          estopRelay: true,
          slowdownSignal: false,
          andonColor: 'red',
          buzzerSound: true,
          plcModbusCoil: '0x0010 (Gate Safety Relay)',
        },
      },
    ],
    groundCalibPoints: [
      { x: 120, y: 380 },
      { x: 680, y: 380 },
      { x: 580, y: 120 },
      { x: 220, y: 120 },
    ],
    groundFovWidthMm: 7500,
    groundFovHeightMm: 5000,
    lastSavedAt: new Date(Date.now() - 3600000).toISOString(),
    savedBy: '张工程师 (安全主任)',
    version: 1,
  },
  cam_logistics_01: {
    cameraId: 'cam_logistics_01',
    cameraName: 'AGV仓储物流转运区',
    location: '物流仓储C区',
    rtspUrl: 'rtsp://192.168.1.105:554/live/stream1',
    resolution: '1920x1080',
    fps: 25,
    zones: [
      {
        id: 'fence_agv_transit',
        name: 'AGV物流主航道减速区',
        code: 'ZONE_AGV_LANE',
        fenceType: 'polygon',
        dangerLevel: 'cat2_slowdown',
        color: '#1890ff',
        enabled: true,
        points: [
          { x: 180, y: 40 },
          { x: 480, y: 40 },
          { x: 480, y: 380 },
          { x: 180, y: 380 },
        ],
        triggerAnchor: 'bottom_center',
        direction: 'bidirectional',
        dwellTimeSec: 0.2,
        safetyBufferPx: 20,
        allowedClassCodes: ['AGV_TUGGER'],
        blockedClassCodes: ['WORKER_CERTIFIED', 'WORKER_NO_PPE', 'FORKLIFT'],
        hardwareAction: {
          estopRelay: false,
          slowdownSignal: true,
          andonColor: 'amber',
          buzzerSound: true,
          plcModbusCoil: '0x0013 (AGV Decelerate)',
        },
      },
      {
        id: 'fence_tripwire_crossing',
        name: '人行斑马线虚拟光幕绊线',
        code: 'LINE_CROSSING_CURTAIN',
        fenceType: 'line_tripwire',
        dangerLevel: 'cat4_estop',
        color: '#ff4d4f',
        enabled: true,
        points: [
          { x: 150, y: 220 },
          { x: 520, y: 220 },
        ],
        triggerAnchor: 'center',
        direction: 'inbound',
        dwellTimeSec: 0.05,
        safetyBufferPx: 15,
        allowedClassCodes: [],
        blockedClassCodes: ['WORKER_CERTIFIED', 'WORKER_NO_PPE'],
        hardwareAction: {
          estopRelay: true,
          slowdownSignal: false,
          andonColor: 'red',
          buzzerSound: true,
          plcModbusCoil: '0x0014 (Light Curtain Relay)',
        },
      },
    ],
    groundCalibPoints: [
      { x: 100, y: 400 },
      { x: 700, y: 400 },
      { x: 600, y: 100 },
      { x: 200, y: 100 },
    ],
    groundFovWidthMm: 12000,
    groundFovHeightMm: 6000,
    lastSavedAt: new Date(Date.now() - 7200000).toISOString(),
    savedBy: '王主管 (物流自动化)',
    version: 2,
  },
};

app.get('/api/safety-fence/cameras', (_req, res) => {
  const result = cameras.map((cam) => {
    const calib = cameraSafetyFenceCalibrations[cam.camera_id];
    return {
      ...cam,
      hasCalibration: !!calib,
      zoneCount: calib?.zones?.length || 0,
      lastSavedAt: calib?.lastSavedAt || null,
      savedBy: calib?.savedBy || null,
      version: calib?.version || 0,
    };
  });
  res.json(result);
});

app.get('/api/safety-fence/cameras/:id/calibration', (req, res) => {
  const camId = req.params.id;
  const calib = cameraSafetyFenceCalibrations[camId];
  if (!calib) {
    // Generate default calibration scaffold from camera info
    const cam = cameras.find((c) => c.camera_id === camId || c.id === parseInt(camId));
    if (!cam) return res.status(404).json({ detail: '未找到指定摄像头' });
    return res.json({
      cameraId: cam.camera_id,
      cameraName: cam.name,
      location: cam.location,
      rtspUrl: cam.rtsp_url,
      resolution: cam.resolution,
      fps: cam.fps,
      zones: [],
      groundCalibPoints: [
        { x: 120, y: 380 },
        { x: 680, y: 380 },
        { x: 580, y: 120 },
        { x: 220, y: 120 },
      ],
      groundFovWidthMm: 7500,
      groundFovHeightMm: 5000,
      lastSavedAt: null,
      savedBy: null,
      version: 0,
    });
  }
  res.json(calib);
});

app.post('/api/safety-fence/cameras/:id/calibration', (req, res) => {
  const camId = req.params.id;
  const body = req.body;
  const current = cameraSafetyFenceCalibrations[camId] || {};
  const newVersion = (current.version || 0) + 1;

  cameraSafetyFenceCalibrations[camId] = {
    ...current,
    cameraId: camId,
    cameraName: body.cameraName || current.cameraName || `摄像头 ${camId}`,
    location: body.location || current.location || '生产车间',
    rtspUrl: body.rtspUrl || current.rtspUrl,
    resolution: body.resolution || current.resolution || '1920x1080',
    fps: body.fps || current.fps || 25,
    zones: body.zones || current.zones || [],
    groundCalibPoints: body.groundCalibPoints || current.groundCalibPoints || [],
    groundFovWidthMm: body.groundFovWidthMm || current.groundFovWidthMm || 7500,
    groundFovHeightMm: body.groundFovHeightMm || current.groundFovHeightMm || 5000,
    snapshotImage: body.snapshotImage || current.snapshotImage || null,
    lastSavedAt: new Date().toISOString(),
    savedBy: body.savedBy || '操作员 (admin)',
    version: newVersion,
  };

  res.json({
    success: true,
    message: `已成功保存摄像头 [${camId}] 的电子围栏标定配置 (版本 v${newVersion})`,
    calibration: cameraSafetyFenceCalibrations[camId],
  });
});

// -------------------------------------------------------------
// Industrial Hand 21-Keypoint & Micro-Action Detection API
// -------------------------------------------------------------
let handActionTelemetryState = {
  current_action: 'pinch_pickup',
  action_zh: '精密双指捏取 (Fine Pinch)',
  confidence: 0.94,
  pinch_distance_mm: 8.4,
  index_flexion_deg: 135,
  wrist_rotation_deg_s: 14.2,
  distance_to_nip_hazard_mm: 145,
  esd_strap_ok: true,
  left_hand_active: false,
  right_hand_active: true,
  tracking_fps: 60,
  landmarks_count: 21,
};

app.get('/api/hand-action/telemetry', (_req, res) => {
  res.json(handActionTelemetryState);
});

app.post('/api/hand-action/simulate-gesture', (req, res) => {
  const action = req.body.action || 'pinch_pickup';
  handActionTelemetryState.current_action = action;
  if (action === 'pinch_pickup') {
    handActionTelemetryState.action_zh = '精密双指捏取 (Fine Pinch)';
    handActionTelemetryState.pinch_distance_mm = 7.8;
  } else if (action === 'tool_grasp') {
    handActionTelemetryState.action_zh = '工具稳固握持 (Power Grip)';
    handActionTelemetryState.pinch_distance_mm = 24.5;
  } else if (action === 'precision_press') {
    handActionTelemetryState.action_zh = '单指垂直微下压 (Precision Press)';
    handActionTelemetryState.index_flexion_deg = 168;
  } else if (action === 'hazard_reach') {
    handActionTelemetryState.action_zh = '违规危险探入 (Hazard Reach)';
    handActionTelemetryState.distance_to_nip_hazard_mm = 12;
  }
  res.json({ success: true, state: handActionTelemetryState });
});

app.post('/api/hand-action/yolo-infer', (req, res) => {
  const startTime = Date.now();
  const { pinch_distance_mm, distance_to_hazard_mm, index_flexion_deg } = req.body;

  let action = 'hand_steady';
  let action_zh = '平稳待机托举 (Hand Steady)';
  let confidence = 0.88;

  if (distance_to_hazard_mm !== undefined && distance_to_hazard_mm < 30) {
    action = 'hazard_reach';
    action_zh = '违规危险探入 (Hazard Reach)';
    confidence = 0.98;
  } else if (pinch_distance_mm !== undefined && pinch_distance_mm < 16) {
    action = 'pinch_pickup';
    action_zh = '精密双指捏取 (Fine Pinch)';
    confidence = 0.95;
  } else if (index_flexion_deg !== undefined && index_flexion_deg > 155) {
    action = 'precision_press';
    action_zh = '单指垂直微下压 (Precision Press)';
    confidence = 0.92;
  } else if (index_flexion_deg !== undefined && index_flexion_deg < 110) {
    action = 'tool_grasp';
    action_zh = '工具稳固握持 (Power Grip)';
    confidence = 0.94;
  }

  const inference_ms = 8.5 + Math.random() * 4.0;
  res.json({
    model: 'YOLOv11n-Hand-Pose',
    class_name: 'operator_hand',
    action,
    action_zh,
    confidence,
    inference_ms: Math.round(inference_ms * 10) / 10,
    fps: 60,
    timestamp: Date.now(),
  });
});

// -------------------------------------------------------------
// Video Training & Datasets API
// -------------------------------------------------------------
app.get('/api/video-training/training-jobs', (_req, res) => {
  res.json(videoTrainingJobs);
});

app.post('/api/video-training/training-jobs/object-detection', (req, res) => {
  const newId = videoTrainingJobs.length + 1;
  const arch = req.body.architecture || 'YOLOv11n';
  const epochs = req.body.epochs || 100;
  const newJob = {
    id: newId,
    name: req.body.name || `YOLO微调-${arch}-${new Date().toLocaleDateString('zh-CN')}`,
    job_type: 'object_detection',
    architecture: arch,
    dataset_type: 'object_annotation_set',
    dataset_id: req.body.dataset_id || 1,
    status: 'completed',
    progress: 100,
    model_id: models.length + 1,
    config_json: {
      architecture: arch,
      epochs,
      batch_size: req.body.batch_size || 32,
      image_size: req.body.image_size || 640,
      optimizer: req.body.optimizer || 'AdamW',
      lr0: req.body.lr0 || 0.001,
      lrf: 0.01,
      augmentations: { mosaic: 1.0, mixup: 0.15, hsv: 0.015 },
      device: 'NVIDIA RTX 4090 (24GB)',
      mixed_precision: 'FP16 AMP',
    },
    metrics_json: {
      accuracy: 0.972,
      precision: 0.961,
      recall: 0.954,
      map50: 0.975,
      map50_95: 0.824,
      best_epoch: Math.max(1, epochs - 8),
      inference_speed: 5.9,
      train_loss_history: [
        { epoch: Math.round(epochs * 0.1), box_loss: 1.35, cls_loss: 1.70, dfl_loss: 1.28, map50: 0.74, map50_95: 0.50 },
        { epoch: Math.round(epochs * 0.3), box_loss: 0.98, cls_loss: 1.10, dfl_loss: 1.02, map50: 0.86, map50_95: 0.65 },
        { epoch: Math.round(epochs * 0.6), box_loss: 0.72, cls_loss: 0.68, dfl_loss: 0.88, map50: 0.93, map50_95: 0.76 },
        { epoch: epochs, box_loss: 0.48, cls_loss: 0.42, dfl_loss: 0.72, map50: 0.975, map50_95: 0.824 },
      ],
      dataset_export: {
        annotation_count: 8900,
        train_count: 6230,
        val_count: 1780,
        test_count: 890,
      },
      class_metrics: {
        pcb_board: { precision: 0.988, recall: 0.982, map50: 0.993, precision_diff: 0.03, recall_diff: 0.02 },
        capacitor: { precision: 0.962, recall: 0.955, map50: 0.970, precision_diff: 0.04, recall_diff: 0.03 },
        ic_chip: { precision: 0.970, recall: 0.964, map50: 0.978, precision_diff: 0.02, recall_diff: 0.015 },
        solder_defect: { precision: 0.950, recall: 0.942, map50: 0.956, precision_diff: 0.06, recall_diff: 0.05 },
      }
    },
    started_at: new Date(Date.now() - 1200000).toISOString(),
    completed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  videoTrainingJobs.unshift(newJob);

  // Also register this trained model in models list
  const createdModel = {
    id: models.length + 1,
    name: `${newJob.name} (INT8 Engine)`,
    version: `${arch}-custom-${Date.now().toString().slice(-4)}`,
    model_path: `models/custom_${arch}_best.engine`,
    model_type: 'defect',
    description: `由视频标注集微调产生，mAP50达到 ${(newJob.metrics_json.map50 * 100).toFixed(1)}%`,
    file_size: 2150000,
    accuracy: newJob.metrics_json.accuracy,
    precision: newJob.metrics_json.precision,
    recall: newJob.metrics_json.recall,
    map50: newJob.metrics_json.map50,
    map50_95: newJob.metrics_json.map50_95,
    inference_speed: newJob.metrics_json.inference_speed,
    is_active: false,
    status: 'ready',
    deployed_at: null,
    created_at: new Date().toISOString(),
    optimization_profile: {
      quantization: 'INT8 TensorRT',
      input_size: req.body.image_size || 640,
      fast_nms: true,
      motion_gating: true,
      speedup_ratio: '12.4x',
    }
  };
  models.push(createdModel);

  res.status(201).json(newJob);
});

app.get('/api/video-training/training-jobs/:id', (req, res) => {
  const jobId = Number(req.params.id);
  const job = videoTrainingJobs.find((j) => j.id === jobId) || videoTrainingJobs[0];
  const model = models.find((m) => m.id === job.model_id) || null;

  const detail = {
    job,
    model,
    runtime_summary: {
      duration_minutes: 35.2,
      device: 'NVIDIA GeForce RTX 4090 (24GB VRAM)',
      cuda_version: 'CUDA 12.4 / cuDNN 9.0',
      peak_memory_mb: 4820,
      gpu_utilization_pct: 94.2,
      epochs_completed: job.config_json?.epochs || 100,
      current_loss: 0.482,
      learning_rate: 0.00015,
    },
    dataset_summary: {
      dataset_export: job.metrics_json?.dataset_export || { annotation_count: 8900 },
      sample_summary: { total_samples: 1420, train: 994, val: 284, test: 142 },
      prototype_summary: { resolution: '640x640', color_space: 'RGB', format: 'YOLO (Normalized BBox)' },
      class_metrics: job.metrics_json?.class_metrics || {},
    },
    artifact_summary: {
      file_name: `best_${job.architecture || 'yolov11n'}.pt`,
      file_path: `/uploads/models/best_${job.architecture || 'yolov11n'}.pt`,
      relative_path: `models/best_${job.architecture || 'yolov11n'}.pt`,
      file_size: 5840210,
      exists: true,
      download_url: `/api/video-training/training-jobs/${job.id}/artifact`,
    },
    log_summary: {
      file_path: '/logs/train_yolo.log',
      relative_path: 'train_yolo.log',
      exists: true,
      line_count: 420,
      tail_lines: [
        'Ultralytics YOLO 8.3.0 🚀 Python-3.11.8 torch-2.3.0+cu121 CUDA:0 (NVIDIA RTX 4090, 24564MiB)',
        'Model summary (fused): 168 layers, 3,157,200 parameters, 0 gradients, 8.7 GFLOPs',
        'Starting training for 100 epochs...',
        '      Epoch    GPU_mem   box_loss   cls_loss   dfl_loss  Instances       Size',
        '     97/100      4.82G     0.5512     0.4930     0.7710         64        640: 100%|██████████| [00:08<00:00, 5.2it/s]',
        '     98/100      4.82G     0.5480     0.4890     0.7680         64        640: 100%|██████████| [00:08<00:00, 5.3it/s]',
        '     99/100      4.82G     0.5430     0.4850     0.7650         64        640: 100%|██████████| [00:08<00:00, 5.2it/s]',
        '    100/100      4.82G     0.5401     0.4812     0.7610         64        640: 100%|██████████| [00:08<00:00, 5.3it/s]',
        'Validating models/best.pt...',
        'Class                 Images  Instances      Box(P          R      mAP50  mAP50-95)',
        'all                     1780       8900      0.961      0.954      0.975      0.824',
        'pcb_board               1780       1200      0.988      0.982      0.993      0.885',
        'capacitor               1780       5400      0.962      0.955      0.970      0.812',
        'ic_chip                 1780        850      0.970      0.964      0.978      0.840',
        'solder_defect           1780       1450      0.950      0.942      0.956      0.780',
        'Optimizer stripped from models/best.pt, 6.2MB',
        'Results saved to runs/detect/train_smt_v11',
      ],
      view_url: `/api/video-training/training-jobs/${job.id}/log`,
    },
    status_timeline: [
      { status: 'pending', label: '任务初始化与环境拉起', timestamp: job.created_at },
      { status: 'running', label: 'YOLO 迁移微调训练中', timestamp: job.started_at },
      { status: 'completed', label: '权重收敛与量化验证完成', timestamp: job.completed_at },
    ],
  };

  res.json(detail);
});

app.post('/api/video-training/training-jobs/:id/activate-model', (req, res) => {
  const jobId = Number(req.params.id);
  const job = videoTrainingJobs.find((j) => j.id === jobId);
  if (job) {
    models.forEach((m) => {
      m.is_active = (m.id === job.model_id);
      if (m.is_active) {
        m.status = 'deployed';
        m.deployed_at = new Date().toISOString();
      }
    });
  }
  res.json({ success: true, message: '该微调模型已正式部署至产线实时质检节点' });
});

app.get('/api/video-training/training-jobs/:id/artifact', (_req, res) => {
  const dummyWeight = Buffer.from('ULTRALYTICS_YOLO_WEIGHT_CHECKPOINT_MOCK_DATA');
  res.setHeader('Content-Disposition', 'attachment; filename="best_yolo_model.pt"');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(dummyWeight);
});

app.get('/api/video-training/training-jobs/:id/log', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`[YOLO Training Log]
Ultralytics YOLO Training Studio v8.3.0
Platform: Linux Ubuntu 22.04 LTS x86_64
GPU: NVIDIA GeForce RTX 4090 24GB
CUDA: 12.4
Optimizer: AdamW (lr=0.001, momentum=0.937, weight_decay=0.0005)
Augmentation: Mosaic=1.0, Mixup=0.15, Fliplr=0.5, HSV_H=0.015
Dataset: 1420 images (8900 bboxes, 4 classes)
Validation: 284 images (1780 bboxes)
Status: Completed with early stopping patience not triggered.
Best mAP@0.5: 0.975 (Saved to weights/best.pt)
Exported formats: PyTorch (.pt), ONNX (FP16), TensorRT (.engine INT8)
`);
});

// Categories & Sets CRUD
app.get('/api/video-training/object-categories', (_req, res) => {
  res.json(objectCategories);
});

app.post('/api/video-training/object-categories', (req, res) => {
  const item = {
    id: objectCategories.length + 1,
    name: req.body.name || `class_${objectCategories.length + 1}`,
    display_name: req.body.display_name || req.body.name,
    description: req.body.description || null,
    color: req.body.color || '#1a73e8',
    count: 0,
  };
  objectCategories.push(item);
  res.status(201).json(item);
});

app.get('/api/video-training/action-categories', (_req, res) => {
  res.json(actionCategories);
});

app.post('/api/video-training/action-categories', (req, res) => {
  const item = {
    id: actionCategories.length + 1,
    name: req.body.name || `action_${actionCategories.length + 1}`,
    display_name: req.body.display_name || req.body.name,
    description: req.body.description || null,
    count: 0,
  };
  actionCategories.push(item);
  res.status(201).json(item);
});

app.get('/api/video-training/object-annotation-sets', (_req, res) => {
  res.json(objectAnnotationSets);
});

app.post('/api/video-training/object-annotation-sets', (req, res) => {
  const item = {
    id: objectAnnotationSets.length + 1,
    name: req.body.name || `标注集-${objectAnnotationSets.length + 1}`,
    description: req.body.description || '',
    source_type: req.body.source_type || 'video_frame',
    status: 'ready',
    images_count: 0,
    annotations_count: 0,
    created_at: new Date().toISOString(),
  };
  objectAnnotationSets.push(item);
  res.status(201).json(item);
});

app.get('/api/video-training/action-sample-sets', (_req, res) => {
  res.json(actionSampleSets);
});

app.post('/api/video-training/action-sample-sets', (req, res) => {
  const item = {
    id: actionSampleSets.length + 1,
    name: req.body.name || `动作样本集-${actionSampleSets.length + 1}`,
    description: req.body.description || '',
    source_type: req.body.source_type || 'pose_json',
    status: 'ready',
    samples_count: 0,
    created_at: new Date().toISOString(),
  };
  actionSampleSets.push(item);
  res.status(201).json(item);
});

app.post('/api/video-training/object-annotation-sets/:id/annotations/from-session', (req, res) => {
  const set = objectAnnotationSets.find((s) => s.id === Number(req.params.id));
  if (set) {
    set.images_count += 45;
    set.annotations_count += 180;
  }
  res.json({ success: true, message: '已成功从学习会话导入 45 帧关键帧及 180 个检测框标注！' });
});

app.post('/api/video-training/action-sample-sets/:id/samples/from-session', (req, res) => {
  const set = actionSampleSets.find((s) => s.id === Number(req.params.id));
  if (set) {
    set.samples_count += 30;
  }
  res.json({ success: true, message: '已成功从学习会话导入 30 个动作时序样本！' });
});

// -------------------------------------------------------------
// Model Evaluations & Comparisons API
// -------------------------------------------------------------
app.get('/api/video-training/models/:type/evaluations', (req, res) => {
  const isObject = req.params.type === 'custom_object';
  const targetModels = models.filter((m) => isObject ? m.model_type !== 'pose' : m.model_type === 'pose');
  const evals = targetModels.map((m) => {
    const job = videoTrainingJobs.find((j) => j.model_id === m.id) || videoTrainingJobs[0];
    return {
      model: {
        id: m.id,
        name: m.name,
        version: m.version,
        model_type: m.model_type,
        accuracy: m.accuracy,
        precision: m.precision,
        recall: m.recall,
        map50: m.map50,
        map50_95: m.map50_95,
        inference_speed: m.inference_speed,
        is_active: m.is_active,
        status: m.status,
      },
      job: {
        id: job.id,
        name: job.name,
        log_path: '/logs/train.log',
        metrics_json: job.metrics_json,
      }
    };
  });
  res.json(evals);
});

app.get('/api/video-training/models/compare/:id1/:id2', (req, res) => {
  const m1 = models.find((m) => m.id === Number(req.params.id1)) || models[0];
  const m2 = models.find((m) => m.id === Number(req.params.id2)) || models[2];

  res.json({
    model_a: {
      id: m1.id,
      name: m1.name,
      accuracy: m1.accuracy,
      precision: m1.precision,
      recall: m1.recall,
      map50: m1.map50,
      map50_95: m1.map50_95,
      inference_speed: m1.inference_speed,
    },
    model_b: {
      id: m2.id,
      name: m2.name,
      accuracy: m2.accuracy,
      precision: m2.precision,
      recall: m2.recall,
      map50: m2.map50,
      map50_95: m2.map50_95,
      inference_speed: m2.inference_speed,
    },
    dataset_diff: {
      common_dataset: '高精度SMT微瑕疵标注集 (1420图/8900标)',
      split_ratio: 'Train 70% : Val 20% : Test 10%',
      mAP_delta: Number(((m2.map50 || 0) - (m1.map50 || 0)).toFixed(3)),
      speedup_factor: Number(((m1.inference_speed || 100) / (m2.inference_speed || 10)).toFixed(1)),
    },
    class_metrics_diff: {
      'pcb_board': { precision_diff: 0.024, recall_diff: 0.018 },
      'capacitor': { precision_diff: 0.041, recall_diff: 0.035 },
      'ic_chip': { precision_diff: 0.019, recall_diff: 0.015 },
      'solder_defect': { precision_diff: 0.058, recall_diff: 0.052 },
    }
  });
});

app.post('/api/dataset-audit/audit', (_req, res) => {
  res.json({
    status: 'healthy',
    score: 97.2,
    summary: '数据集分布均衡，目标框宽高比与重叠率符合 Ultralytics YOLOv11/v8 规范，具备丰富边缘增强特征',
    suggestions: [
      '可增补弱光照条件下的SMT焊接反光样本30张',
      '建议对小于 12x12 像素的极微小连锡缺陷增加自适应切片(SAHI)切块',
    ],
  });
});

// MES
app.get('/api/mes/orders', (_req, res) => {
  res.json(mesOrders);
});

app.post('/api/mes/orders', (req, res) => {
  const newOrder = {
    id: mesOrders.length + 1,
    order_no: req.body.order_no || `WO-${Date.now()}`,
    product_name: req.body.product_name,
    planned_qty: req.body.planned_qty || 1000,
    completed_qty: 0,
    defect_qty: 0,
    status: 'in_progress',
    line: req.body.line || 'SMT一号线',
    yield_rate: 100,
    updated_at: new Date().toISOString(),
  };
  mesOrders.unshift(newOrder);
  res.status(201).json(newOrder);
});

// Storage & System
app.get('/api/storage', (_req, res) => {
  res.json([
    { id: 1, type: 'video_clip', filename: 'clip_cam_01_alert.mp4', size_bytes: 45000000, retention_days: 30, created_at: '2026-09-24T12:00:00Z' },
    { id: 2, type: 'snapshot', filename: 'snapshot_cam_safety.jpg', size_bytes: 2500000, retention_days: 90, created_at: '2026-09-25T06:00:00Z' },
  ]);
});

app.get('/api/storage/stats', (_req, res) => {
  res.json({
    total_bytes: 500 * 1024 * 1024 * 1024,
    used_bytes: 142 * 1024 * 1024 * 1024,
    free_bytes: 358 * 1024 * 1024 * 1024,
    used_pct: 28.4,
    video_count: 85,
    snapshot_count: 1420,
  });
});

app.get('/api/users', (_req, res) => {
  res.json(users);
});

app.get('/api/system/configs', (_req, res) => {
  res.json(systemConfigs);
});

app.post('/api/system/configs', (req, res) => {
  const newConfig = {
    id: Date.now(),
    category: req.body.category || 'general',
    key: req.body.key,
    value: req.body.value || null,
    description: req.body.description || null,
  };
  systemConfigs.push(newConfig);
  res.status(201).json(newConfig);
});

app.delete('/api/system/configs/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = systemConfigs.findIndex((c) => c.id === id);
  if (idx !== -1) {
    systemConfigs.splice(idx, 1);
  }
  res.status(204).send();
});

app.get('/api/system/drivers', (_req, res) => {
  res.json(systemDrivers);
});

app.post('/api/system/drivers', (req, res) => {
  const newDriver = {
    id: Date.now(),
    name: req.body.name,
    protocol: req.body.protocol || 'rtsp',
    description: req.body.description || null,
    is_active: true,
    created_at: new Date().toISOString(),
  };
  systemDrivers.push(newDriver);
  res.status(201).json(newDriver);
});

app.delete('/api/system/drivers/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = systemDrivers.findIndex((d) => d.id === id);
  if (idx !== -1) {
    systemDrivers.splice(idx, 1);
  }
  res.status(204).send();
});

app.get('/api/reports/comparison', (_req, res) => {
  res.json({
    period: '2026-W38 vs 2026-W39',
    yield_increase_pct: 1.2,
    defect_reduction_pct: 18.5,
    response_speed_improvement_pct: 88.5,
  });
});

// -------------------------------------------------------------
// WebSocket Real-time Push Server
// -------------------------------------------------------------
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (
    pathname.startsWith('/ws') ||
    pathname.startsWith('/api/live_monitor/ws') ||
    pathname.startsWith('/api/live/ws')
  ) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws: WebSocket) => {
  let mode = 'detect';
  let conf = 0.5;
  let timer: NodeJS.Timeout | null = null;
  let frameCount = 0;

  ws.on('message', (msg: string) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'config') {
        mode = data.mode || mode;
        conf = data.confidence || conf;
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch {
      // ignore
    }
  });

  // Stream simulated real-time high-speed detections (50+ FPS rate or regular 10-15 Hz)
  timer = setInterval(() => {
    frameCount++;
    const isPose = mode === 'pose';
    const latency = +(17.5 + (Math.random() * 3 - 1.5)).toFixed(1);

    const detections = isPose
      ? [
          {
            class_name: 'person',
            confidence: 0.94,
            bbox: [150 + Math.sin(frameCount * 0.1) * 10, 80, 480, 520],
            keypoints: [
              { name: 'nose', x: 310 + Math.sin(frameCount * 0.1) * 5, y: 120, conf: 0.98 },
              { name: 'left_eye', x: 295, y: 110, conf: 0.95 },
              { name: 'right_eye', x: 325, y: 110, conf: 0.95 },
              { name: 'left_shoulder', x: 240, y: 190, conf: 0.92 },
              { name: 'right_shoulder', x: 380, y: 190, conf: 0.93 },
              { name: 'left_elbow', x: 210, y: 280, conf: 0.90 },
              { name: 'right_elbow', x: 410, y: 280, conf: 0.91 },
              { name: 'left_wrist', x: 260, y: 350, conf: 0.88 },
              { name: 'right_wrist', x: 370, y: 350, conf: 0.89 },
              { name: 'left_hip', x: 260, y: 360, conf: 0.91 },
              { name: 'right_hip', x: 360, y: 360, conf: 0.92 },
              { name: 'left_knee', x: 270, y: 440, conf: 0.89 },
              { name: 'right_knee', x: 350, y: 440, conf: 0.90 },
              { name: 'left_ankle', x: 280, y: 510, conf: 0.85 },
              { name: 'right_ankle', x: 340, y: 510, conf: 0.86 },
            ],
          },
        ]
      : [
          { class_name: 'component_ok', confidence: 0.96, bbox: [120, 150, 220, 240] },
          { class_name: 'capacitor_ok', confidence: 0.94, bbox: [260, 180, 340, 270] },
          { class_name: 'solder_ok', confidence: 0.92, bbox: [380, 210, 460, 290] },
        ];

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'frame_detection',
          detections,
          inference_ms: latency,
          fps: 54.5,
          frame_count: frameCount,
          timestamp: Date.now(),
        })
      );
    }
  }, 100); // 10 Hz updates

  ws.on('close', () => {
    if (timer) clearInterval(timer);
  });
});

// -------------------------------------------------------------
// Vite Middlewares Integration
// -------------------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[YoloCheck Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
