export interface EdgeLandmark3D {
  id: number;
  name: string;
  name_zh: string;
  nameZh: string;
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface EdgeBoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
}

export type EdgeAndonStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface EdgeHandActionPayload {
  station_id: string;
  sequence_number: number;
  timestamp_ms: number;
  landmarks: EdgeLandmark3D[];
  hand_bbox: EdgeBoundingBox;
  action_type: string;
  action_name_zh: string;
  action_confidence: number; // 0..1
  pinch_distance_mm: number;
  index_flexion_deg: number;
  wrist_speed_mms: number;
  esd_strap_detected: boolean;
  distance_to_hazard_mm: number;
  dtw_compliance_score: number;
  dtw_grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  andon: EdgeAndonStatus;
  edge_inference_latency_ms: number;
}

export interface EdgeHeartbeatPayload {
  station_id: string;
  timestamp_ms: number;
  cpu_usage_percent: number;
  memory_used_mb: number;
  gpu_temperature_c: number;
  inference_fps: number;
  uptime_seconds: number;
  camera_connected: boolean;
  camera_model: string;
  ring_buffer_cached_frames: number;
  packet_loss_rate: number;
  network_rtt_ms: number;
}

export interface AlarmSliceRecord {
  slice_id: string;
  station_id: string;
  created_at: string;
  alarm_reason: string;
  duration_sec: number;
  file_size_bytes: number;
  download_url: string;
  landmarks_summary: {
    pinch_mm: number;
    dtw_score: number;
    detected_action: string;
  };
}
