import { HandLandmark, FineGrainedHandAction } from './types';

export interface HandActionFrame {
  timestampMs: number;
  landmarks: HandLandmark[];
  pinchDistanceMm: number;
  indexFlexionDeg: number;
  wristSpeedMmS: number;
  detectedAction: FineGrainedHandAction;
}

export interface GoldenActionSequence {
  id: string;
  code: string;
  name: string;
  masterTechnician: string;
  workstation: string;
  totalDurationSec: number;
  description: string;
  frames: HandActionFrame[];
  keyframeHighlights: Array<{ timeSec: number; label: string; action: FineGrainedHandAction }>;
}

export interface DtwComparisonResult {
  goldenSequenceId: string;
  goldenSequenceName: string;
  goldenCode: string;
  masterTechnician: string;
  testDurationSec: number;
  goldenDurationSec: number;
  durationDeltaSec: number;
  overallScore: number; // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  spatialTrajectoryScore: number; // 0 - 100
  timingConsistencyScore: number; // 0 - 100
  microActionPinchScore: number; // 0 - 100
  smoothnessScore: number; // 0 - 100
  dtwDistance: number;
  normalizedDistance: number;
  warpingPath: Array<{ testIdx: number; goldenIdx: number }>;
  pacingVerdict: 'ahead' | 'on_pace' | 'lagging';
  pacingDiffSec: number;
  keyFindings: string[];
}

// Generate realistic synthetic golden sequences for standard industrial hand gestures
function generateGoldenSequence(
  type: 'pinch_0402' | 'tool_grasp' | 'precision_press'
): HandActionFrame[] {
  const frames: HandActionFrame[] = [];
  const totalFrames = 45; // ~1.5 seconds sequence at 30fps
  const dt = 33.3; // ms

  for (let i = 0; i < totalFrames; i++) {
    const t = i / totalFrames; // 0.0 to 1.0 progress
    const timestampMs = Math.round(i * dt);

    let pinchMm = 28.0;
    let flexionDeg = 170.0;
    let wristSpeed = 20.0;
    let detectedAction: FineGrainedHandAction = 'hand_steady';

    if (type === 'pinch_0402') {
      // Phase 1 (0-0.3): Approach, fingers open (28mm -> 15mm)
      // Phase 2 (0.3-0.7): Precision pinch closure (15mm -> 7.8mm)
      // Phase 3 (0.7-1.0): Steady hold and slight retraction (7.8mm -> 9.0mm)
      if (t < 0.3) {
        const p = t / 0.3;
        pinchMm = 28.0 - p * 13.0;
        wristSpeed = 50.0 * Math.sin(p * Math.PI);
        flexionDeg = 165 - p * 15;
        detectedAction = 'hand_steady';
      } else if (t < 0.7) {
        const p = (t - 0.3) / 0.4;
        pinchMm = 15.0 - p * 7.2; // down to 7.8mm
        wristSpeed = 15.0;
        flexionDeg = 150 - p * 20; // 130 deg
        detectedAction = 'pinch_pickup';
      } else {
        const p = (t - 0.7) / 0.3;
        pinchMm = 7.8 + p * 1.2;
        wristSpeed = 25.0 * Math.sin(p * Math.PI);
        flexionDeg = 130 + p * 10;
        detectedAction = 'pinch_pickup';
      }
    } else if (type === 'tool_grasp') {
      // Tool grasp: fingers curl inwards (flexion 160 -> 85 deg)
      const curl = Math.sin(t * Math.PI);
      pinchMm = 25.0 - curl * 12.0;
      flexionDeg = 160 - curl * 75.0; // curls down to 85
      wristSpeed = 30.0 * Math.sin(t * Math.PI);
      detectedAction = flexionDeg < 110 ? 'tool_grasp' : 'hand_steady';
    } else {
      // Precision press: index finger extends while others curl
      const press = Math.sin(t * Math.PI);
      pinchMm = 22.0 + press * 6.0;
      flexionDeg = 175.0 - press * 10.0;
      wristSpeed = 35.0 * Math.sin(t * Math.PI);
      detectedAction = t > 0.3 && t < 0.8 ? 'precision_press' : 'hand_steady';
    }

    // Synthesize landmarks around wrist (360, 240)
    const wristX = 360 + Math.sin(t * Math.PI) * 12;
    const wristY = 240 + Math.cos(t * Math.PI) * 8;

    const landmarks: HandLandmark[] = [];
    landmarks.push({ id: 0, name: 'Wrist', nameZh: '手腕基准', x: wristX, y: wristY, z: 0, visibility: 0.99 });

    // Thumb 1..4
    for (let j = 1; j <= 4; j++) {
      const tipOffset = j === 4 ? pinchMm * 0.7 : j * 16;
      landmarks.push({
        id: j,
        name: `Thumb_${j}`,
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
        nameZh: `食指关节 ${step}`,
        x: wristX + tipOffset,
        y: wristY - step * 24,
        z: -step * 2,
        visibility: 0.98,
      });
    }

    // Other fingers 9..20
    for (let j = 9; j <= 20; j++) {
      landmarks.push({
        id: j,
        name: `Landmark_${j}`,
        nameZh: `关节 ${j}`,
        x: wristX + (j - 9) * 4,
        y: wristY - 45 - ((j % 4) * 15),
        z: 0,
        visibility: 0.96,
      });
    }

    frames.push({
      timestampMs,
      landmarks,
      pinchDistanceMm: +pinchMm.toFixed(1),
      indexFlexionDeg: Math.round(flexionDeg),
      wristSpeedMmS: +wristSpeed.toFixed(1),
      detectedAction,
    });
  }

  return frames;
}

export const GOLDEN_STANDARD_SEQUENCES: GoldenActionSequence[] = [
  {
    id: 'GS-SMT-PINCH',
    code: 'GS-SMT-001',
    name: 'SMT 0402 阻容贴片双指捏取黄金动作序列 (Master Fine Pinch)',
    masterTechnician: '高志远 (全国技能竞赛冠军 / 特级技师)',
    workstation: 'ST-SMT-A03',
    totalDurationSec: 1.5,
    description: '国家技能大赛金牌得主高工标准规范动作，平滑接近、7.8mm闭环捏取、垂直稳定下压。',
    frames: generateGoldenSequence('pinch_0402'),
    keyframeHighlights: [
      { timeSec: 0.2, label: '预定位平稳接近', action: 'hand_steady' },
      { timeSec: 0.8, label: '7.8mm精密双指捏取锁定', action: 'pinch_pickup' },
      { timeSec: 1.3, label: '保压贴合平稳出料', action: 'pinch_pickup' },
    ],
  },
  {
    id: 'GS-TOOL-GRASP',
    code: 'GS-SCREW-002',
    name: '智能电批稳固紧固握持黄金动作序列 (Master Tool Grip)',
    masterTechnician: '李建军 (资深IE主管 / 工匠技师)',
    workstation: 'ST-ASM-02',
    totalDurationSec: 1.5,
    description: '电批手柄垂直握持同轴对位，五指贴合紧固，离合器释放时刻零轴向偏斜。',
    frames: generateGoldenSequence('tool_grasp'),
    keyframeHighlights: [
      { timeSec: 0.3, label: '电批垂直下压就位', action: 'hand_steady' },
      { timeSec: 0.8, label: '恒扭矩全握持拧紧', action: 'tool_grasp' },
      { timeSec: 1.4, label: '离合释放平稳退刀', action: 'tool_grasp' },
    ],
  },
  {
    id: 'GS-FINGERTIP-PRESS',
    code: 'GS-GLUE-003',
    name: 'PCB基准对齐单指微下压黄金动作序列 (Master Precision Press)',
    masterTechnician: '赵雪 (光学装配大师 / 质量标兵)',
    workstation: 'ST-GLUE-01',
    totalDurationSec: 1.5,
    description: '食指单独平直向下点压对位，其余四指自然收拢，压力接触传感器精准触发。',
    frames: generateGoldenSequence('precision_press'),
    keyframeHighlights: [
      { timeSec: 0.2, label: '食指对齐基准定位点', action: 'hand_steady' },
      { timeSec: 0.7, label: '垂直下压触发光纤传感', action: 'precision_press' },
      { timeSec: 1.3, label: '指尖平缓回弹复位', action: 'precision_press' },
    ],
  },
];

/**
 * Compute multi-dimensional feature distance between two hand frames
 */
function computeFrameDistance(a: HandActionFrame, b: HandActionFrame): number {
  // 1. Normalized Pinch distance delta (0 - 30mm)
  const pinchDelta = Math.abs(a.pinchDistanceMm - b.pinchDistanceMm) / 30.0;

  // 2. Index flexion angle delta (0 - 180deg)
  const flexionDelta = Math.abs(a.indexFlexionDeg - b.indexFlexionDeg) / 180.0;

  // 3. Wrist velocity delta
  const speedDelta = Math.abs(a.wristSpeedMmS - b.wristSpeedMmS) / 100.0;

  // 4. Key landmarks spatial distance (Thumb Tip #4, Index Tip #8, Wrist #0)
  let landmarkDist = 0;
  const keyPoints = [0, 4, 8, 12];
  keyPoints.forEach((id) => {
    const pA = a.landmarks.find((l) => l.id === id);
    const pB = b.landmarks.find((l) => l.id === id);
    if (pA && pB) {
      landmarkDist += Math.hypot(pA.x - pB.x, pA.y - pB.y);
    }
  });
  const normLandmarkDist = Math.min(1.0, landmarkDist / (keyPoints.length * 90.0));

  // 5. Categorical action mismatch penalty
  const actionPenalty = a.detectedAction === b.detectedAction ? 0 : 0.25;

  return (
    0.35 * pinchDelta +
    0.25 * normLandmarkDist +
    0.20 * flexionDelta +
    0.10 * speedDelta +
    0.10 * actionPenalty
  );
}

/**
 * Dynamic Time Warping (DTW) Core Alignment Algorithm
 */
export function runDtwActionComparison(
  testSequence: HandActionFrame[],
  goldenSequence: GoldenActionSequence
): DtwComparisonResult {
  const gFrames = goldenSequence.frames;
  const tFrames = testSequence.length > 0 ? testSequence : gFrames;

  const N = tFrames.length;
  const M = gFrames.length;

  if (N === 0 || M === 0) {
    throw new Error('测试序列或黄金序列为空，无法执行 DTW 比对');
  }

  // Allocate (N+1) x (M+1) cost matrix
  const costMatrix: number[][] = Array.from({ length: N + 1 }, () =>
    new Array(M + 1).fill(Infinity)
  );
  costMatrix[0][0] = 0;

  // Fill DTW cumulative cost matrix
  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      const d = computeFrameDistance(tFrames[i - 1], gFrames[j - 1]);
      costMatrix[i][j] =
        d + Math.min(costMatrix[i - 1][j], costMatrix[i][j - 1], costMatrix[i - 1][j - 1]);
    }
  }

  // Backtrack optimal warping path from (N, M) to (1, 1)
  let i = N;
  let j = M;
  const path: Array<{ testIdx: number; goldenIdx: number }> = [];

  while (i > 0 || j > 0) {
    path.push({ testIdx: Math.max(0, i - 1), goldenIdx: Math.max(0, j - 1) });
    if (i === 0) {
      j--;
    } else if (j === 0) {
      i--;
    } else {
      const minVal = Math.min(
        costMatrix[i - 1][j - 1],
        costMatrix[i - 1][j],
        costMatrix[i][j - 1]
      );
      if (minVal === costMatrix[i - 1][j - 1]) {
        i--;
        j--;
      } else if (minVal === costMatrix[i - 1][j]) {
        i--;
      } else {
        j--;
      }
    }
  }

  path.reverse();

  const dtwDistance = costMatrix[N][M];
  const pathLength = Math.max(1, path.length);
  const normalizedDistance = +(dtwDistance / pathLength).toFixed(4);

  // Convert distance to 0..100 compliance score
  // normalizedDistance typically ranges from 0.02 (near perfect) to 0.45 (mismatched)
  const overallScore = Math.max(
    55,
    Math.min(100, Math.round(100 - normalizedDistance * 110))
  );

  // Sub-dimension metrics
  let totalPinchDiff = 0;
  let totalFlexionDiff = 0;
  let warpingSkew = 0;

  path.forEach(({ testIdx, goldenIdx }) => {
    const tFrame = tFrames[testIdx];
    const gFrame = gFrames[goldenIdx];
    totalPinchDiff += Math.abs(tFrame.pinchDistanceMm - gFrame.pinchDistanceMm);
    totalFlexionDiff += Math.abs(tFrame.indexFlexionDeg - gFrame.indexFlexionDeg);
    warpingSkew += Math.abs(testIdx / N - goldenIdx / M);
  });

  const avgPinchDiff = totalPinchDiff / pathLength;
  const avgFlexionDiff = totalFlexionDiff / pathLength;
  const avgSkew = warpingSkew / pathLength;

  const microActionPinchScore = Math.max(60, Math.min(100, Math.round(100 - avgPinchDiff * 4.2)));
  const spatialTrajectoryScore = Math.max(65, Math.min(100, Math.round(overallScore * 0.98 + (100 - avgFlexionDiff) * 0.02)));
  const timingConsistencyScore = Math.max(60, Math.min(100, Math.round(100 - avgSkew * 140)));
  const smoothnessScore = Math.max(70, Math.min(99, Math.round(98 - normalizedDistance * 35)));

  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' = 'A';
  if (overallScore >= 95) grade = 'A+';
  else if (overallScore >= 90) grade = 'A';
  else if (overallScore >= 80) grade = 'B';
  else if (overallScore >= 70) grade = 'C';
  else grade = 'D';

  const testDurationSec = +(tFrames[N - 1].timestampMs / 1000).toFixed(2) || 1.5;
  const goldenDurationSec = goldenSequence.totalDurationSec || 1.5;
  const durationDeltaSec = +(testDurationSec - goldenDurationSec).toFixed(2);

  const pacingVerdict: 'ahead' | 'on_pace' | 'lagging' =
    durationDeltaSec > 0.25 ? 'lagging' : durationDeltaSec < -0.25 ? 'ahead' : 'on_pace';

  // Construct intelligent engineering findings
  const keyFindings: string[] = [];
  if (overallScore >= 92) {
    keyFindings.push('★ 动作序列高度吻合大师级黄金基准，空间轨迹平滑度与节拍执行符合受控标准。');
  } else if (overallScore >= 82) {
    keyFindings.push('▲ 整体动作大体合规，但在局部微细动作捏合深度上与黄金基准存在轻微离散。');
  } else {
    keyFindings.push('⚠ 动作序列偏离黄金标准较多，建议参照大师示范视频纠正手掌朝向与捏取姿势。');
  }

  if (avgPinchDiff <= 2.0) {
    keyFindings.push(`✔ 捏取间距贴合度极佳（平均误差仅 ${avgPinchDiff.toFixed(1)} mm），符合高精装配要求。`);
  } else {
    keyFindings.push(`⚠ 拇指-食指开合间距偏差达 ${avgPinchDiff.toFixed(1)} mm，提示动作过大或有混料掉件风险。`);
  }

  if (pacingVerdict === 'lagging') {
    keyFindings.push(`⏱ 操作节拍滞后大师基准 +${durationDeltaSec}s，瓶颈集中在工序中段对位停顿时间偏长。`);
  } else if (pacingVerdict === 'ahead') {
    keyFindings.push(`⏱ 操作节拍提前 ${Math.abs(durationDeltaSec)}s，请注意确认器件是否已充分保压到位。`);
  } else {
    keyFindings.push(`✔ 动作执行节拍与大师示范完美同频（Δt 仅 ${durationDeltaSec > 0 ? `+${durationDeltaSec}` : durationDeltaSec}s）。`);
  }

  return {
    goldenSequenceId: goldenSequence.id,
    goldenSequenceName: goldenSequence.name,
    goldenCode: goldenSequence.code,
    masterTechnician: goldenSequence.masterTechnician,
    testDurationSec,
    goldenDurationSec,
    durationDeltaSec,
    overallScore,
    grade,
    spatialTrajectoryScore,
    timingConsistencyScore,
    microActionPinchScore,
    smoothnessScore,
    dtwDistance,
    normalizedDistance,
    warpingPath: path,
    pacingVerdict,
    pacingDiffSec: durationDeltaSec,
    keyFindings,
  };
}
