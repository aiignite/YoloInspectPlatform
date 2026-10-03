export type FenceType = 'polygon' | 'line_tripwire' | 'circle_proximity';

export type DangerLevel = 'cat1_warning' | 'cat2_slowdown' | 'cat4_estop';

export type TriggerAnchor = 'center' | 'bottom_center' | 'bbox_intersect' | 'hands_feet_pose';

export type IntrusionDirection = 'inbound' | 'outbound' | 'bidirectional';

export interface Point {
  x: number;
  y: number;
}

export interface RecognizedObjectCalibration {
  id: string;
  name: string;
  code: string;
  category: 'personnel' | 'ppe' | 'vehicle' | 'equipment' | 'foreign_hazard';
  color: string;
  description: string;
  defaultAllowedZones: string[];
  mandatoryPPE?: string[];
  riskLevel: 'high' | 'medium' | 'low';
}

export interface SafetyFenceZone {
  id: string;
  name: string;
  code: string;
  fenceType: FenceType;
  dangerLevel: DangerLevel;
  color: string;
  enabled: boolean;
  points: Point[]; // Polygon or line points
  radius?: number; // for circle
  triggerAnchor: TriggerAnchor;
  direction: IntrusionDirection;
  dwellTimeSec: number; // e.g. 0.3s
  safetyBufferPx: number; // clearance buffer in pixels/mm
  allowedClassCodes: string[]; // Whitelist (e.g. ['ROBOT_ARM', 'CERTIFIED_WORKER'])
  blockedClassCodes: string[]; // Blacklist (e.g. ['WORKER_NO_HELMET', 'AGV_TUGGER', 'FOREIGN_OBJECT'])
  hardwareAction: {
    estopRelay: boolean;
    slowdownSignal: boolean;
    andonColor: 'red' | 'amber';
    buzzerSound: boolean;
    plcModbusCoil: string;
  };
}

export interface FenceCalibrationScenario {
  id: string;
  name: string;
  industry: string;
  cameraFov: string;
  resolution: string;
  description: string;
  defaultFences: SafetyFenceZone[];
  defaultObjects: Array<{
    id: number;
    trackId: number;
    code: string;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
    vx: number;
    vy: number;
    confidence: number;
    inDangerZone: boolean;
  }>;
}

export interface FenceAlarmEvent {
  id: string;
  timestamp: string;
  fenceId: string;
  fenceName: string;
  targetObject: string;
  dangerLevel: DangerLevel;
  hardwareOutput: string;
  status: 'active' | 'cleared' | 'acknowledged';
}

export interface CameraFenceCalibration {
  cameraId: string;
  cameraName: string;
  location: string;
  rtspUrl?: string;
  resolution?: string;
  fps?: number;
  zones: SafetyFenceZone[];
  groundCalibPoints: Point[];
  groundFovWidthMm: number;
  groundFovHeightMm: number;
  snapshotImage?: string;
  lastSavedAt?: string;
  savedBy?: string;
  version?: number;
}
