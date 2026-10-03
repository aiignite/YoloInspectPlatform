export type IndustrialSceneId =
  | 'smt_aoi'
  | 'cobot_safety'
  | 'battery_cell'
  | 'wafer_inspection'
  | 'custom_upload';

export type CanvasToolMode = 'select' | 'edit_polygon' | 'edit_line' | 'ruler' | 'loupe';

export type CvFilterMode = 'normal' | 'grayscale' | 'canny' | 'clahe' | 'thermal';

export type AnnotatorStyle = 'corner' | 'box' | 'round_box' | 'halo';

export type DefectSeverity = 'critical' | 'major' | 'minor' | 'normal';

export interface Point {
  x: number;
  y: number;
}

export interface TrackedIndustrialObject {
  id: number;
  trackId: number;
  className: string;
  category: 'workpiece' | 'defect' | 'worker' | 'agv' | 'tool';
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  speed: number;
  confidence: number;
  polygonMask?: Point[];
  history: Point[];
  inZone: boolean;
  zoneDwellFrames: number;
  crossedLine: boolean;
  status: 'normal' | 'defect_alert' | 'danger_intrusion' | 'counted';
  defectName?: string;
  defectDetail?: string;
  physicalSizeMm?: { w: number; h: number };
  ipcCode?: string;
  color?: string;
}

export interface PolygonZoneConfig {
  id: string;
  name: string;
  points: Point[];
  alertClassFilter: string[]; // e.g. ['Worker', 'Tool', 'Tombstone']
  triggerOn: 'enter' | 'dwell' | 'both';
  dwellThresholdSec: number;
  color: string;
  enabled: boolean;
}

export interface LineZoneConfig {
  id: string;
  name: string;
  start: Point;
  end: Point;
  inCount: number;
  outCount: number;
  targetClasses: string[]; // e.g. ['PCB', 'BatteryCell', 'WaferDie']
  color: string;
  enabled: boolean;
}

export interface DefectEventLog {
  id: string;
  timestamp: string;
  sceneName: string;
  trackId: number;
  title: string;
  type: string;
  severity: DefectSeverity;
  confidence: number;
  location: string;
  snapshotCropDataUrl?: string;
  reviewedStatus: 'pending' | 'confirmed_ng' | 'false_alarm';
  plcTriggered: boolean;
}

export interface PlcSignalState {
  andonLight: 'green' | 'amber' | 'red';
  buzzerActive: boolean;
  pneumaticCylinderActive: boolean;
  emergencyStopLine: boolean;
  modbusTcpConnected: boolean;
  plcPulseCount: number;
  lastTriggerTime?: string;
}

export interface CalibrationSetting {
  mmPerPixel: number; // e.g. 0.05 mm per pixel (calibrated from 100mm optical field of view)
  referenceTargetName: string;
}
