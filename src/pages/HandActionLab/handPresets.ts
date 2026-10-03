import { HandScenarioPreset, HandLandmark } from './types';
import { LANDMARK_NAMES_ZH } from './handGeometry';

// Helper to generate 21 landmarks
function makeHand(
  wristX: number,
  wristY: number,
  type: 'pinch' | 'grip' | 'press' | 'tweezers' | 'reach' | 'open'
): HandLandmark[] {
  const points: Array<[number, number, number]> = [];

  if (type === 'pinch') {
    // 0: Wrist
    points.push([wristX, wristY, 0]);
    // 1-4: Thumb (reaching toward index tip)
    points.push([wristX - 25, wristY - 30, -5]);
    points.push([wristX - 35, wristY - 60, -8]);
    points.push([wristX - 20, wristY - 85, -10]);
    points.push([wristX - 6, wristY - 105, -12]); // Thumb Tip close to index tip!

    // 5-8: Index (reaching toward thumb tip)
    points.push([wristX - 5, wristY - 55, -2]);
    points.push([wristX - 2, wristY - 78, -6]);
    points.push([wristX - 4, wristY - 95, -10]);
    points.push([wristX + 4, wristY - 108, -12]); // Index Tip close to thumb tip!

    // 9-12: Middle (slightly curled back)
    points.push([wristX + 18, wristY - 55, 0]);
    points.push([wristX + 24, wristY - 74, -4]);
    points.push([wristX + 28, wristY - 90, -7]);
    points.push([wristX + 32, wristY - 100, -8]);

    // 13-16: Ring (curled)
    points.push([wristX + 38, wristY - 50, 4]);
    points.push([wristX + 44, wristY - 65, 2]);
    points.push([wristX + 48, wristY - 78, 0]);
    points.push([wristX + 50, wristY - 88, -2]);

    // 17-20: Pinky (curled)
    points.push([wristX + 54, wristY - 40, 8]);
    points.push([wristX + 60, wristY - 52, 6]);
    points.push([wristX + 64, wristY - 64, 4]);
    points.push([wristX + 66, wristY - 74, 2]);
  } else if (type === 'grip') {
    // All fingers curled around a cylinder tool
    points.push([wristX, wristY, 0]);
    // Thumb wraps across
    points.push([wristX - 20, wristY - 25, 4]);
    points.push([wristX - 30, wristY - 50, 8]);
    points.push([wristX - 20, wristY - 70, 10]);
    points.push([wristX + 5, wristY - 72, 12]);

    // Index curled
    points.push([wristX - 8, wristY - 45, 0]);
    points.push([wristX - 10, wristY - 65, -8]);
    points.push([wristX + 2, wristY - 72, -12]);
    points.push([wristX + 14, wristY - 62, -10]);

    // Middle curled
    points.push([wristX + 12, wristY - 45, 2]);
    points.push([wristX + 10, wristY - 65, -6]);
    points.push([wristX + 22, wristY - 72, -10]);
    points.push([wristX + 30, wristY - 62, -8]);

    // Ring curled
    points.push([wristX + 30, wristY - 42, 4]);
    points.push([wristX + 30, wristY - 60, -4]);
    points.push([wristX + 40, wristY - 68, -8]);
    points.push([wristX + 46, wristY - 58, -6]);

    // Pinky curled
    points.push([wristX + 46, wristY - 36, 6]);
    points.push([wristX + 48, wristY - 52, -2]);
    points.push([wristX + 56, wristY - 60, -6]);
    points.push([wristX + 60, wristY - 50, -4]);
  } else if (type === 'press') {
    // Index finger extended straight down, other fingers curled
    points.push([wristX, wristY, 0]);
    // Thumb tucked
    points.push([wristX - 22, wristY - 25, 0]);
    points.push([wristX - 32, wristY - 45, 4]);
    points.push([wristX - 24, wristY - 60, 6]);
    points.push([wristX - 10, wristY - 68, 6]);

    // Index straight down pointing
    points.push([wristX - 4, wristY - 45, -4]);
    points.push([wristX - 4, wristY - 75, -8]);
    points.push([wristX - 4, wristY - 105, -12]);
    points.push([wristX - 4, wristY - 130, -15]); // Pointing tip!

    // Middle curled
    points.push([wristX + 16, wristY - 42, 2]);
    points.push([wristX + 18, wristY - 60, -2]);
    points.push([wristX + 14, wristY - 72, -6]);
    points.push([wristX + 6, wristY - 66, -4]);

    // Ring curled
    points.push([wristX + 34, wristY - 38, 4]);
    points.push([wristX + 36, wristY - 52, 0]);
    points.push([wristX + 32, wristY - 62, -4]);
    points.push([wristX + 24, wristY - 58, -2]);

    // Pinky curled
    points.push([wristX + 50, wristY - 32, 6]);
    points.push([wristX + 52, wristY - 45, 2]);
    points.push([wristX + 48, wristY - 54, -2]);
    points.push([wristX + 40, wristY - 50, 0]);
  } else if (type === 'reach') {
    // Hand reaching forward into hazard area
    points.push([wristX, wristY, 0]);
    points.push([wristX - 25, wristY - 30, 0]);
    points.push([wristX - 40, wristY - 60, 0]);
    points.push([wristX - 42, wristY - 90, 0]);
    points.push([wristX - 40, wristY - 118, 0]);

    points.push([wristX - 10, wristY - 50, 0]);
    points.push([wristX - 12, wristY - 85, 0]);
    points.push([wristX - 14, wristY - 118, 0]);
    points.push([wristX - 15, wristY - 142, 0]); // Penetrates hazard!

    points.push([wristX + 12, wristY - 50, 0]);
    points.push([wristX + 14, wristY - 86, 0]);
    points.push([wristX + 16, wristY - 120, 0]);
    points.push([wristX + 18, wristY - 145, 0]);

    points.push([wristX + 32, wristY - 45, 0]);
    points.push([wristX + 36, wristY - 78, 0]);
    points.push([wristX + 40, wristY - 108, 0]);
    points.push([wristX + 42, wristY - 132, 0]);

    points.push([wristX + 48, wristY - 38, 0]);
    points.push([wristX + 54, wristY - 65, 0]);
    points.push([wristX + 58, wristY - 90, 0]);
    points.push([wristX + 62, wristY - 112, 0]);
  } else {
    // Open steady hand
    points.push([wristX, wristY, 0]);
    points.push([wristX - 25, wristY - 25, 0]);
    points.push([wristX - 45, wristY - 50, 0]);
    points.push([wristX - 50, wristY - 75, 0]);
    points.push([wristX - 45, wristY - 98, 0]);

    points.push([wristX - 10, wristY - 45, 0]);
    points.push([wristX - 10, wristY - 75, 0]);
    points.push([wristX - 10, wristY - 105, 0]);
    points.push([wristX - 10, wristY - 130, 0]);

    points.push([wristX + 12, wristY - 45, 0]);
    points.push([wristX + 14, wristY - 78, 0]);
    points.push([wristX + 16, wristY - 110, 0]);
    points.push([wristX + 16, wristY - 135, 0]);

    points.push([wristX + 32, wristY - 40, 0]);
    points.push([wristX + 36, wristY - 70, 0]);
    points.push([wristX + 38, wristY - 98, 0]);
    points.push([wristX + 40, wristY - 122, 0]);

    points.push([wristX + 48, wristY - 35, 0]);
    points.push([wristX + 52, wristY - 58, 0]);
    points.push([wristX + 56, wristY - 82, 0]);
    points.push([wristX + 60, wristY - 104, 0]);
  }

  return points.map(([x, y, z], id) => ({
    id,
    name: `Landmark_${id}`,
    nameZh: LANDMARK_NAMES_ZH[id] || `关节 ${id}`,
    x,
    y,
    z,
    visibility: 0.98,
  }));
}

export const HAND_SCENARIOS: Record<string, HandScenarioPreset> = {
  pinch_0402: {
    id: 'pinch_0402',
    name: 'SMT 0402 阻容微器件双指精密捏取',
    workstation: 'ST-SMT-A02 显微手工补焊与贴片工位',
    description:
      '操作员使用拇指与食指捏取微型 0402 陶瓷电容或高精度引脚，指尖间距需保持在 6~14mm 之间，微振颤动幅度不得超过 0.8mm。',
    primaryAction: 'pinch_pickup',
    rightHand: makeHand(440, 260, 'pinch'),
    targetObject: {
      name: '0402 贴片电容 (10uF)',
      type: 'SMD_CAPACITOR',
      x: 435,
      y: 148,
      w: 12,
      h: 8,
      color: '#eab308',
    },
    esdStrapDetected: true,
    inHazardZone: false,
  },

  screwdriver_grasp: {
    id: 'screwdriver_grasp',
    name: '智能电动螺丝刀全握持与手腕自旋转',
    workstation: 'ST-ASM-04 智能扭力电批锁附工位',
    description:
      '手掌五指呈圆柱形紧密握持电批手柄，下压对齐 M2.5 沉孔并伴随手腕自转拧紧，系统实时检测握持力道与下压垂直度。',
    primaryAction: 'tool_grasp',
    rightHand: makeHand(420, 280, 'grip'),
    targetObject: {
      name: '智能伺服电批批头 (HIOS M2.5)',
      type: 'ELECTRIC_SCREWDRIVER',
      x: 410,
      y: 190,
      w: 24,
      h: 90,
      color: '#0284c7',
    },
    esdStrapDetected: true,
    inHazardZone: false,
  },

  fingertip_press: {
    id: 'fingertip_press',
    name: '基准对位单指指尖垂直微下压',
    workstation: 'ST-SMT-A03 手工插件与抚平对位工位',
    description:
      '食指指尖单指垂直下压贴片 IC 芯片或连接器，其他四指自然收拢，检测微按压行程深度与下压驻留时长 (0.5s±0.1s)。',
    primaryAction: 'precision_press',
    rightHand: makeHand(420, 290, 'press'),
    targetObject: {
      name: 'QFP-64 微控芯片插座',
      type: 'IC_SOCKET',
      x: 405,
      y: 155,
      w: 30,
      h: 28,
      color: '#10b981',
    },
    esdStrapDetected: true,
    inHazardZone: false,
  },

  tweezers_handling: {
    id: 'tweezers_handling',
    name: '防静电精密微镊子芯片引脚对齐',
    workstation: 'ST-QA-01 高倍体视显微镜质检台',
    description:
      '拇指与食指协同微操作精密防静电镊子，对微细 SMD 元件引脚进行微调对中，防止引脚歪斜虚焊。',
    primaryAction: 'tweezers_handling',
    rightHand: makeHand(440, 260, 'pinch'),
    targetObject: {
      name: 'VETUS ESD 精密弯头镊子',
      type: 'ESD_TWEEZERS',
      x: 432,
      y: 145,
      w: 8,
      h: 50,
      color: '#8b5cf6',
    },
    esdStrapDetected: true,
    inHazardZone: false,
  },

  nip_hazard_reach: {
    id: 'nip_hazard_reach',
    name: '手指违规探入飞达导轨夹伤防范 (防夹手)',
    workstation: 'ST-FEEDER-01 高速贴片飞达送料机械行程区',
    description:
      '高危场景监控。当操作员手指或手部关节点侵入飞达送料导轨或冲压机危险模具间距小于 30mm 时，毫秒级联锁停机。',
    primaryAction: 'hazard_reach',
    rightHand: makeHand(460, 240, 'reach'),
    targetObject: {
      name: '飞达送料往复剪切夹伤危险区 (Nip Hazard)',
      type: 'HAZARD_CUTTER',
      x: 420,
      y: 70,
      w: 120,
      h: 60,
      color: '#ef4444',
    },
    esdStrapDetected: true,
    inHazardZone: true,
  },

  esd_strap_missing: {
    id: 'esd_strap_missing',
    name: '防静电手环缺失违规预警 (ESD Violation)',
    workstation: 'ST-SMT-A01 SMT 洁净房入口防静电工位',
    description:
      '实时识别手腕处是否存在符合色标规范的 ESD 弹性导电腕带及螺旋接地线连接，手环缺失或未插线时发出声光警示。',
    primaryAction: 'hand_steady',
    rightHand: makeHand(430, 270, 'open'),
    targetObject: {
      name: '防静电手腕带监测仪 (ESD Monitor)',
      type: 'ESD_TERMINAL',
      x: 370,
      y: 260,
      w: 40,
      h: 30,
      color: '#f97316',
    },
    esdStrapDetected: false,
    inHazardZone: false,
  },
};
