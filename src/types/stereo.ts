export interface CameraExtrinsics {
  rotationMatrix: number[][]; // 3x3
  translationVectorMm: number[]; // [Tx, Ty, Tz]
  reprojectionErrorPx: number; // e.g. 0.098 px
}

export interface CameraIntrinsics {
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  distortionK: number[];
}

export interface StereoLandmark3D {
  index: number;
  nameZh: string;
  worldXmm: number;
  worldYmm: number;
  worldZmm: number;
  confidenceCamA: number;
  confidenceCamB: number;
  fusedConfidence: number;
  isOccludedInCamA: boolean;
  isOccludedInCamB: boolean;
  primaryCamera: 'CamA' | 'CamB' | 'Fused_Weighted';
}

export interface StereoRigConfig {
  rigBaselineMm: number;
  rigElevationAngleDeg: number;
  camATopView: {
    deviceId: string;
    name: string;
    workingDistanceMm: number;
    fov: string;
    intrinsics: CameraIntrinsics;
  };
  camBSideView: {
    deviceId: string;
    name: string;
    workingDistanceMm: number;
    angleDeg: number;
    fov: string;
    intrinsics: CameraIntrinsics;
  };
  extrinsics: CameraExtrinsics;
  reprojectionErrorPx: number;
}

export interface InsertionStrokeResult {
  currentZDepthMm: number;
  targetZDepthMm: number;
  toleranceZMm: number; // e.g. 0.65 mm
  isWithinEnvelope: boolean;
  strokeStatus: 'APPROACHING' | 'PRESSED_IN_SPEC' | 'UNDER_PRESSED' | 'OVER_PRESSED_WARNING';
  accuracyConfidencePct: number;
}

export interface OcclusionScenario {
  id: string;
  nameZh: string;
  description: string;
  camAConfidenceDrop: number;
  camBConfidenceDrop: number;
  occludedJoints: number[];
}
