import { HandLandmark, FineGrainedHandAction, HandTelemetry } from './types';

// Standard 21 Hand Landmarks bone connections
export const HAND_CONNECTIONS: Array<[number, number]> = [
  // Thumb
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  // Index
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  // Middle
  [9, 10],
  [10, 11],
  [11, 12],
  // Ring
  [13, 14],
  [14, 15],
  [15, 16],
  // Pinky
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  // Palm transverse connections
  [5, 9],
  [9, 13],
  [13, 17],
];

export const FINGER_COLORS: Record<string, string> = {
  thumb: '#f59e0b', // Amber
  index: '#06b6d4', // Cyan
  middle: '#10b981', // Emerald
  ring: '#8b5cf6', // Violet
  pinky: '#ec4899', // Pink
  palm: '#3b82f6', // Blue
  wrist: '#6366f1', // Indigo
};

export const LANDMARK_NAMES_ZH = [
  '手腕 (Wrist)',
  '拇指腕掌 (Thumb CMC)',
  '拇指掌指 (Thumb MCP)',
  '拇指指间 (Thumb IP)',
  '拇指指尖 (Thumb TIP)',
  '食指掌指 (Index MCP)',
  '食指近指 (Index PIP)',
  '食指远指 (Index DIP)',
  '食指指尖 (Index TIP)',
  '中指掌指 (Middle MCP)',
  '中指近指 (Middle PIP)',
  '中指远指 (Middle DIP)',
  '中指指尖 (Middle TIP)',
  '无名指掌指 (Ring MCP)',
  '无名指近指 (Ring PIP)',
  '无名指远指 (Ring DIP)',
  '无名指指尖 (Ring TIP)',
  '小指掌指 (Pinky MCP)',
  '小指近指 (Pinky PIP)',
  '小指远指 (Pinky DIP)',
  '小指指尖 (Pinky TIP)',
];

// Calculate 3D Euclidean distance
export function distance3D(p1: HandLandmark, p2: HandLandmark): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y, (p1.z - p2.z) * 1.5);
}

// Convert pixel distance to millimeters (assume standard hand span 180mm = ~140px on screen)
export const MM_PER_PIXEL = 180 / 140; // ~1.28 mm/px

export function getPinchDistanceMm(landmarks: HandLandmark[]): number {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  if (!thumbTip || !indexTip) return 999;
  const px = distance3D(thumbTip, indexTip);
  return px * MM_PER_PIXEL;
}

// Calculate angle between three 2D/3D points (in degrees)
export function getJointAngleDeg(p1: HandLandmark, center: HandLandmark, p3: HandLandmark): number {
  const v1 = { x: p1.x - center.x, y: p1.y - center.y };
  const v2 = { x: p3.x - center.x, y: p3.y - center.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
}

// Compute full hand kinematics and classification
export function computeHandTelemetry(
  landmarks: HandLandmark[],
  hazardZone: { x: number; y: number; w: number; h: number },
  esdDetected: boolean
): { telemetry: HandTelemetry; detectedAction: FineGrainedHandAction; confidence: number } {
  if (landmarks.length < 21) {
    return {
      telemetry: {
        pinchDistanceMm: 0,
        thumbMiddleDistanceMm: 0,
        indexFlexionAngleDeg: 180,
        middleFlexionAngleDeg: 180,
        wristRotationSpeedDegS: 0,
        palmNormalAngleDeg: 0,
        esdStrapContactOk: false,
        distanceToNipHazardMm: 999,
      },
      detectedAction: 'hand_steady',
      confidence: 0.5,
    };
  }

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];
  const wrist = landmarks[0];

  // Distances
  const pinchDist = distance3D(thumbTip, indexTip) * MM_PER_PIXEL;
  const thumbMiddleDist = distance3D(thumbTip, middleTip) * MM_PER_PIXEL;

  // Angles
  const indexFlexion = getJointAngleDeg(landmarks[5], landmarks[6], landmarks[8]);
  const middleFlexion = getJointAngleDeg(landmarks[9], landmarks[10], landmarks[12]);

  // Distance to dangerous nip hazard box
  const minHandX = Math.min(thumbTip.x, indexTip.x, middleTip.x);
  const minHandY = Math.min(thumbTip.y, indexTip.y, middleTip.y);
  const distToHazardPx = Math.hypot(
    Math.max(0, hazardZone.x - minHandX),
    Math.max(0, hazardZone.y - minHandY)
  );
  const distToHazardMm = distToHazardPx * MM_PER_PIXEL;

  // Determine Fine-Grained Action
  let detectedAction: FineGrainedHandAction = 'hand_steady';
  let conf = 0.85;

  // 1. Hazard Reach: If fingertips penetrate or are within 25mm of hazard zone
  if (distToHazardMm < 25) {
    detectedAction = 'hazard_reach';
    conf = 0.98;
  }
  // 2. Pinch Pick: Thumb Tip & Index Tip are close (< 16mm)
  else if (pinchDist < 16) {
    detectedAction = 'pinch_pickup';
    conf = Math.min(0.99, 0.75 + (16 - pinchDist) * 0.02);
  }
  // 3. Precision Press: Index extended, other fingers curled
  else if (indexFlexion > 155 && middleFlexion < 110 && ringTip.y > landmarks[14].y) {
    detectedAction = 'precision_press';
    conf = 0.94;
  }
  // 4. Power Grip / Tool Hold: All fingers tightly curled around tool
  else if (indexFlexion < 100 && middleFlexion < 95 && pinchDist < 35) {
    detectedAction = 'tool_grasp';
    conf = 0.96;
  }
  // 5. Tweezers: Pinch but slightly offset
  else if (pinchDist < 25 && thumbMiddleDist < 30) {
    detectedAction = 'tweezers_handling';
    conf = 0.91;
  }
  // 6. Normal Steady
  else {
    detectedAction = 'hand_steady';
    conf = 0.88;
  }

  const telemetry: HandTelemetry = {
    pinchDistanceMm: Math.round(pinchDist * 10) / 10,
    thumbMiddleDistanceMm: Math.round(thumbMiddleDist * 10) / 10,
    indexFlexionAngleDeg: indexFlexion,
    middleFlexionAngleDeg: middleFlexion,
    wristRotationSpeedDegS: Math.round(Math.abs(wrist.x - 300) * 0.1),
    palmNormalAngleDeg: Math.round(Math.abs(landmarks[5].y - landmarks[17].y)),
    esdStrapContactOk: esdDetected,
    distanceToNipHazardMm: Math.round(distToHazardMm),
  };

  return { telemetry, detectedAction, confidence: conf };
}
