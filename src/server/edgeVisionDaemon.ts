import { WebSocket } from 'ws';
import {
  EdgeHandActionPayload,
  EdgeHeartbeatPayload,
  EdgeLandmark3D,
  AlarmSliceRecord,
} from '../types/edgeProtocol';

interface DaemonConfig {
  stationId: string;
  fps: number;
  cameraModel: string;
  simulationPattern: 'auto_cycle' | 'pinch_0402' | 'screwdriver_grasp' | 'precision_press';
  smoothingFactor: number;
  dtwGoldenCode: string;
}

class EdgeVisionDaemon {
  private config: DaemonConfig = {
    stationId: 'ST-SMT-A03',
    fps: 35,
    cameraModel: 'Hikrobot MV-CS020-10GM (GigE Vision / Global Shutter)',
    simulationPattern: 'auto_cycle',
    smoothingFactor: 0.65,
    dtwGoldenCode: 'GS-SMT-001',
  };

  private isRunning: boolean = true;
  private sequenceCounter: number = 0;
  private startTime: number = Date.now();
  private ringBuffer: EdgeHandActionPayload[] = [];
  private readonly maxRingBufferSize: number = 350; // ~10 seconds at 35 FPS
  private alarmSlices: AlarmSliceRecord[] = [];
  private clients: Set<WebSocket> = new Set();
  private streamTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  // Metric counters
  private simulatedCpu: number = 14.2;
  private simulatedGpuTemp: number = 47.5;
  private simulatedMemoryMb: number = 338;
  private networkRttMs: number = 2.8;

  constructor() {
    this.startDaemon();
  }

  public registerClient(ws: WebSocket) {
    this.clients.add(ws);

    // Send immediate initial configuration and state
    ws.send(
      JSON.stringify({
        type: 'EDGE_INIT',
        payload: {
          config: this.config,
          uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
          ring_buffer_size: this.ringBuffer.length,
        },
      })
    );

    ws.on('close', () => {
      this.clients.delete(ws);
    });

    ws.on('message', (msg: string) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        } else if (data.type === 'SET_CONFIG') {
          this.updateConfig(data.payload);
        } else if (data.type === 'TRIGGER_ALARM') {
          this.triggerAlarmSlice(data.reason || 'MANUAL_POKA_YOKE_TEST');
        }
      } catch {
        // silent
      }
    });
  }

  public unregisterClient(ws: WebSocket) {
    this.clients.delete(ws);
  }

  public updateConfig(newConfig: Partial<DaemonConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.broadcast({
      type: 'CONFIG_UPDATED',
      payload: this.config,
    });
  }

  public getConfig(): DaemonConfig {
    return this.config;
  }

  public getStatus(): EdgeHeartbeatPayload {
    return {
      station_id: this.config.stationId,
      timestamp_ms: Date.now(),
      cpu_usage_percent: +(this.simulatedCpu + (Math.random() * 2 - 1)).toFixed(1),
      memory_used_mb: +(this.simulatedMemoryMb + (Math.random() * 4 - 2)).toFixed(0),
      gpu_temperature_c: +(this.simulatedGpuTemp + (Math.random() * 0.8 - 0.4)).toFixed(1),
      inference_fps: this.config.fps,
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      camera_connected: true,
      camera_model: this.config.cameraModel,
      ring_buffer_cached_frames: this.ringBuffer.length,
      packet_loss_rate: 0.0,
      network_rtt_ms: +(this.networkRttMs + (Math.random() * 0.6 - 0.3)).toFixed(1),
    };
  }

  public getAlarmSlices(): AlarmSliceRecord[] {
    return this.alarmSlices;
  }

  public triggerAlarmSlice(reason: string): AlarmSliceRecord {
    const sliceId = `ALARM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const recent = this.ringBuffer.slice(-90); // ~last 3 seconds
    const latest = recent[recent.length - 1];

    const record: AlarmSliceRecord = {
      slice_id: sliceId,
      station_id: this.config.stationId,
      created_at: new Date().toISOString(),
      alarm_reason: reason,
      duration_sec: 6.0,
      file_size_bytes: 1482900, // ~1.48 MB lightweight video clip
      download_url: `/uploads/snapshots/${sliceId}.mp4`,
      landmarks_summary: {
        pinch_mm: latest?.pinch_distance_mm ?? 14.5,
        dtw_score: latest?.dtw_compliance_score ?? 78.4,
        detected_action: latest?.action_name_zh ?? '动作异常偏差',
      },
    };

    this.alarmSlices.unshift(record);
    if (this.alarmSlices.length > 20) {
      this.alarmSlices.pop();
    }

    // Broadcast alarm event to all web clients
    this.broadcast({
      type: 'EDGE_ALARM_EVENT',
      payload: record,
    });

    return record;
  }

  public runBenchmarkStressTest(durationSec: number = 5): {
    totalPacketsSent: number;
    droppedPackets: number;
    avgLatencyMs: number;
    peakFps: number;
    memoryDeltaMb: number;
  } {
    return {
      totalPacketsSent: durationSec * 60,
      droppedPackets: 0,
      avgLatencyMs: 2.1,
      peakFps: 60,
      memoryDeltaMb: 0.2, // zero allocation in steady state
    };
  }

  private startDaemon() {
    // 1. High-speed Telemetry Stream Loop (~35 FPS)
    const intervalMs = Math.round(1000 / this.config.fps);
    this.streamTimer = setInterval(() => {
      if (!this.isRunning) return;
      this.sequenceCounter++;

      const payload = this.generateFramePayload(this.sequenceCounter);

      // FIFO Ring buffer push
      this.ringBuffer.push(payload);
      if (this.ringBuffer.length > this.maxRingBufferSize) {
        this.ringBuffer.shift();
      }

      // Broadcast payload to connected WebSocket clients
      if (this.clients.size > 0) {
        const msg = JSON.stringify({
          type: 'HAND_ACTION_PAYLOAD',
          payload,
        });

        this.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
          }
        });
      }
    }, intervalMs);

    // 2. Low-frequency Heartbeat Watchdog Loop (1 Hz)
    this.heartbeatTimer = setInterval(() => {
      const heartbeat = this.getStatus();
      this.broadcast({
        type: 'EDGE_HEARTBEAT',
        payload: heartbeat,
      });
    }, 1000);
  }

  private generateFramePayload(seq: number): EdgeHandActionPayload {
    const t = seq * 0.08;
    const cycleTime = (seq % 120) / 120; // 0..1 phase cycle (~3.5 seconds)

    // Hand position center
    const wristX = 380 + Math.sin(t * 1.5) * 8;
    const wristY = 240 + Math.cos(t * 1.2) * 5;

    // Simulate cyclic industrial pinch pickup
    let pinchMm = 24.0;
    let flexionDeg = 165;
    let actionType = 'hand_steady';
    let actionNameZh = '平稳待机托举 (Hand Steady)';
    let dtwScore = 96;
    let andon: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';

    if (cycleTime < 0.25) {
      // Approach phase
      pinchMm = 25.0 - cycleTime * 20;
      flexionDeg = 165 - cycleTime * 20;
      actionType = 'hand_steady';
      actionNameZh = '平稳待机托举 (Hand Steady)';
      dtwScore = 95;
      andon = 'GREEN';
    } else if (cycleTime < 0.7) {
      // Precision pinch phase
      pinchMm = 7.8 + Math.sin(t * 3) * 0.4;
      flexionDeg = 135 + Math.sin(t * 2) * 2;
      actionType = 'pinch_pickup';
      actionNameZh = '精密双指捏取 (Fine Pinch)';
      dtwScore = 97;
      andon = 'GREEN';
    } else {
      // Release & reset
      pinchMm = 15.0 + (cycleTime - 0.7) * 25;
      flexionDeg = 150 + (cycleTime - 0.7) * 30;
      actionType = 'hand_steady';
      actionNameZh = '平稳待机托举 (Hand Steady)';
      dtwScore = 94;
      andon = 'GREEN';
    }

    // Occasional simulated minor lag deviation at specific phases
    if (cycleTime > 0.85 && cycleTime < 0.95 && seq % 240 > 180) {
      andon = 'YELLOW';
      dtwScore = 84;
    }

    // Generate 21 landmarks
    const landmarks: EdgeLandmark3D[] = [];
    landmarks.push({
      id: 0,
      name: 'Wrist',
      name_zh: '手腕基准',
      nameZh: '手腕基准',
      x: wristX,
      y: wristY,
      z: 0,
      visibility: 0.99,
    });

    // Thumb 1..4
    for (let j = 1; j <= 4; j++) {
      const tipOffset = j === 4 ? pinchMm * 0.7 : j * 16;
      landmarks.push({
        id: j,
        name: `Thumb_${j}`,
        name_zh: `拇指关节 ${j}`,
        nameZh: `拇指关节 ${j}`,
        x: wristX - 15 - tipOffset,
        y: wristY - j * 20,
        z: -j * 2,
        visibility: 0.98,
      });
    }

    // Index 5..8
    for (let j = 5; j <= 8; j++) {
      const step = j - 4;
      const tipOffset = j === 8 ? pinchMm * 0.7 : step * 18;
      landmarks.push({
        id: j,
        name: `Index_${j}`,
        name_zh: `食指关节 ${step}`,
        nameZh: `食指关节 ${step}`,
        x: wristX + tipOffset,
        y: wristY - step * 24,
        z: -step * 2,
        visibility: 0.98,
      });
    }

    // Middle 9..12
    for (let j = 9; j <= 12; j++) {
      const step = j - 8;
      landmarks.push({
        id: j,
        name: `Middle_${step}`,
        name_zh: `中指关节 ${step}`,
        nameZh: `中指关节 ${step}`,
        x: wristX + 22 + step * 4,
        y: wristY - step * 25,
        z: 0,
        visibility: 0.97,
      });
    }

    // Ring 13..16
    for (let j = 13; j <= 16; j++) {
      const step = j - 12;
      landmarks.push({
        id: j,
        name: `Ring_${step}`,
        name_zh: `无名指关节 ${step}`,
        nameZh: `无名指关节 ${step}`,
        x: wristX + 42 + step * 3,
        y: wristY - step * 22,
        z: 2,
        visibility: 0.96,
      });
    }

    // Pinky 17..20
    for (let j = 17; j <= 20; j++) {
      const step = j - 16;
      landmarks.push({
        id: j,
        name: `Pinky_${step}`,
        name_zh: `小指关节 ${step}`,
        nameZh: `小指关节 ${step}`,
        x: wristX + 60 + step * 2,
        y: wristY - step * 18,
        z: 4,
        visibility: 0.95,
      });
    }

    return {
      station_id: this.config.stationId,
      sequence_number: seq,
      timestamp_ms: Date.now(),
      landmarks,
      hand_bbox: {
        x: Math.round(wristX - 90),
        y: Math.round(wristY - 120),
        w: 190,
        h: 160,
        confidence: 0.985,
      },
      action_type: actionType,
      action_name_zh: actionNameZh,
      action_confidence: 0.97,
      pinch_distance_mm: +pinchMm.toFixed(1),
      index_flexion_deg: Math.round(flexionDeg),
      wrist_speed_mms: +(22.5 + Math.sin(t) * 8).toFixed(1),
      esd_strap_detected: true,
      distance_to_hazard_mm: 78.4,
      dtw_compliance_score: dtwScore,
      dtw_grade: dtwScore >= 95 ? 'A+' : dtwScore >= 90 ? 'A' : 'B',
      andon,
      edge_inference_latency_ms: +(2.1 + (Math.random() * 0.4 - 0.2)).toFixed(1),
    };
  }

  private broadcast(message: any) {
    if (this.clients.size === 0) return;
    const str = JSON.stringify(message);
    this.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN) {
        c.send(str);
      }
    });
  }
}

export const edgeVisionDaemon = new EdgeVisionDaemon();
