export type DeviationType =
  | 'skipped_action'
  | 'sequence_inversion'
  | 'timeout'
  | 'spatial_violation'
  | 'extraneous_action';

export type DeviationSeverity = 'critical' | 'major' | 'minor';

export interface ActionZoneROI {
  id: string;
  name: string;
  code: string;
  color: string;
  points: { x: number; y: number }[]; // Normalized or canvas coords
  description: string;
}

export interface SopStepDef {
  step_order: number;
  name: string;
  code: string;
  standard_time_sec: number;
  tolerance_sec: number;
  target_roi_id: string;
  required_tool?: string;
  hand_action: 'pick' | 'assemble' | 'fasten' | 'scan' | 'place';
  description: string;
  prerequisite_step?: number;
}

export interface LivePoseKeypoint {
  index: number;
  name: string;
  x: number;
  y: number;
  conf: number;
}

export interface LiveOperatorSkeleton {
  keypoints: LivePoseKeypoint[];
  leftHandZone?: string;
  rightHandZone?: string;
  heldTool?: string;
}

export interface SopMonitorStatus {
  station_id: string;
  operator_id: string;
  operator_name: string;
  template_id: number;
  template_name: string;
  current_step_order: number;
  current_step_name: string;
  step_elapsed_sec: number;
  step_standard_sec: number;
  step_tolerance_sec: number;
  target_roi_name: string;
  total_cycles_completed: number;
  adherence_rate: number;
  takt_time_actual: number;
  takt_time_target: number;
  andon_state: 'green' | 'amber' | 'red';
  plc_interlock_active: boolean;
  active_deviation: null | {
    id: string;
    type: DeviationType;
    severity: DeviationSeverity;
    description: string;
    step_order: number;
    timestamp: string;
  };
}

export interface DeviationEventRecord {
  id: string;
  timestamp: string;
  station_id: string;
  operator_id: string;
  template_name: string;
  step_order: number;
  step_name: string;
  deviation_type: DeviationType;
  severity: DeviationSeverity;
  title: string;
  description: string;
  actual_value: string;
  standard_value: string;
  status: 'active' | 'resolved' | 'acknowledged';
  plc_interlock_triggered: boolean;
}
