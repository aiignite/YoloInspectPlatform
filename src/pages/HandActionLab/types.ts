export interface HandLandmark {
  id: number;
  name: string;
  nameZh: string;
  x: number; // 0..800
  y: number; // 0..450
  z: number; // depth (-50..50)
  visibility: number;
}

export type Handedness = 'left' | 'right';

export type FineGrainedHandAction =
  | 'pinch_pickup' // 精密双指捏取 (0402贴片器件/微螺钉)
  | 'tool_grasp' // 工具稳固握持 (握紧电批/胶枪)
  | 'precision_press' // 单指垂直下压 (按键/对齐贴平)
  | 'wrist_rotation' // 手腕旋转扭动 (螺丝拧紧自转)
  | 'tweezers_handling' // 镊子精密夹持
  | 'hand_steady' // 双手平稳托举PCB
  | 'esd_strap_ok' // 防静电手环正常佩戴
  | 'hazard_reach'; // 手指违规探入危险行程区

export interface HandActionConfidence {
  action: FineGrainedHandAction;
  nameZh: string;
  confidence: number; // 0..1
  threshold: number;
  isTriggered: boolean;
  color: string;
  description: string;
}

export interface HandScenarioPreset {
  id: string;
  name: string;
  workstation: string;
  description: string;
  primaryAction: FineGrainedHandAction;
  leftHand?: HandLandmark[];
  rightHand: HandLandmark[];
  targetObject: {
    name: string;
    type: string;
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
  };
  esdStrapDetected: boolean;
  inHazardZone: boolean;
}

export interface HandTelemetry {
  pinchDistanceMm: number; // Thumb Tip to Index Tip
  thumbMiddleDistanceMm: number;
  indexFlexionAngleDeg: number; // 食指屈曲角
  middleFlexionAngleDeg: number;
  wristRotationSpeedDegS: number;
  palmNormalAngleDeg: number; // 掌心仰角
  esdStrapContactOk: boolean;
  distanceToNipHazardMm: number;
}
