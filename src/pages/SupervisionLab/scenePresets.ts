import {
  IndustrialSceneId,
  PolygonZoneConfig,
  LineZoneConfig,
  TrackedIndustrialObject,
  Point,
} from './types';

export interface ScenePreset {
  id: IndustrialSceneId;
  name: string;
  tag: string;
  industry: string;
  description: string;
  defaultPolygon: PolygonZoneConfig;
  defaultLineZone: LineZoneConfig;
  defaultTaktTargetSec: number;
  fovSizeMm: { w: number; h: number };
  mmPerPixel: number;
  initialObjects: () => TrackedIndustrialObject[];
  drawBackground: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    tick: number
  ) => void;
}

export const SCENE_PRESETS: Record<IndustrialSceneId, ScenePreset> = {
  smt_aoi: {
    id: 'smt_aoi',
    name: 'SMT 高速贴片与回流焊 AOI 质检',
    tag: '电子制造 / SMT AOI',
    industry: '3C 电子制造',
    description:
      '双轨 ESD 防静电传送带，检测微阻容 0201 墓碑立碑、QFP 引脚桥接连锡、元器件漏装与微小飞溅锡珠，结合 LineZone 高速过线计件与不良品气动剔除。',
    fovSizeMm: { w: 160, h: 120 },
    mmPerPixel: 0.2,
    defaultTaktTargetSec: 1.2,
    defaultPolygon: {
      id: 'poly_smt_aoi',
      name: '回流炉前贴片精度判定防区 (AOI Critical Zone)',
      points: [
        { x: 260, y: 50 },
        { x: 580, y: 50 },
        { x: 610, y: 390 },
        { x: 280, y: 390 },
      ],
      alertClassFilter: ['Tombstone', 'Solder_Bridge', 'Missing_IC', 'Foreign_Particle'],
      triggerOn: 'both',
      dwellThresholdSec: 0.8,
      color: '#ff4d4f',
      enabled: true,
    },
    defaultLineZone: {
      id: 'line_smt_aoi',
      name: 'AOI 虚拟光学出检计数线',
      start: { x: 60, y: 230 },
      end: { x: 240, y: 230 },
      inCount: 286,
      outCount: 281,
      targetClasses: ['PCB_Board', 'PCB_Carrier'],
      color: '#faad14',
      enabled: true,
    },
    initialObjects: () => [
      {
        id: 1,
        trackId: 101,
        className: 'PCB_V5_Mainboard',
        category: 'workpiece',
        x: 100,
        y: 40,
        w: 90,
        h: 70,
        vx: 0,
        vy: 2.2,
        speed: 2.2,
        confidence: 0.985,
        history: [],
        inZone: false,
        zoneDwellFrames: 0,
        crossedLine: false,
        status: 'normal',
        physicalSizeMm: { w: 18.0, h: 14.0 },
      },
      {
        id: 2,
        trackId: 102,
        className: 'PCB_V5_Mainboard',
        category: 'workpiece',
        x: 100,
        y: 170,
        w: 90,
        h: 70,
        vx: 0,
        vy: 2.2,
        speed: 2.2,
        confidence: 0.991,
        history: [],
        inZone: false,
        zoneDwellFrames: 0,
        crossedLine: false,
        status: 'normal',
        physicalSizeMm: { w: 18.0, h: 14.0 },
      },
      {
        id: 3,
        trackId: 103,
        className: 'Solder_Bridge_Defect',
        category: 'defect',
        x: 320,
        y: 110,
        w: 64,
        h: 56,
        vx: 0.3,
        vy: 0.2,
        speed: 0.4,
        confidence: 0.964,
        polygonMask: [
          { x: 325, y: 125 },
          { x: 375, y: 115 },
          { x: 380, y: 155 },
          { x: 335, y: 160 },
        ],
        history: [],
        inZone: true,
        zoneDwellFrames: 12,
        crossedLine: false,
        status: 'defect_alert',
        defectName: 'QFP-128 引脚微间距连锡',
        defectDetail: '引脚 42-43 发生焊锡漫溢连锡，间隙 0mm，IPC-A-610G 7.3.5 Class 3 拒收。',
        ipcCode: 'IPC-610G-7.3.5',
        physicalSizeMm: { w: 12.8, h: 11.2 },
      },
      {
        id: 4,
        trackId: 104,
        className: 'Tombstone_0201',
        category: 'defect',
        x: 430,
        y: 200,
        w: 52,
        h: 48,
        vx: -0.2,
        vy: 0.4,
        speed: 0.4,
        confidence: 0.952,
        history: [],
        inZone: true,
        zoneDwellFrames: 8,
        crossedLine: false,
        status: 'defect_alert',
        defectName: '0201微贴片电容立碑 (Tombstone)',
        defectDetail: '贴片端头润湿不平衡导致元件一端抬起脱焊，虚焊失效率 100%。',
        ipcCode: 'IPC-610G-7.3.1',
        physicalSizeMm: { w: 10.4, h: 9.6 },
      },
      {
        id: 5,
        trackId: 105,
        className: 'IC_QFP_Pass',
        category: 'workpiece',
        x: 480,
        y: 290,
        w: 78,
        h: 70,
        vx: 0.2,
        vy: -0.1,
        speed: 0.2,
        confidence: 0.988,
        history: [],
        inZone: true,
        zoneDwellFrames: 30,
        crossedLine: false,
        status: 'normal',
        physicalSizeMm: { w: 15.6, h: 14.0 },
      },
    ],
    drawBackground: (ctx, width, height, tick) => {
      // 1. Factory floor background
      ctx.fillStyle = '#0f141c';
      ctx.fillRect(0, 0, width, height);

      // Fine grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. High-speed ESD conveyor rails on left lane (x: 50 to 250)
      const cLeft = 50;
      const cWidth = 190;
      // Rail shadows
      ctx.fillStyle = '#171e29';
      ctx.fillRect(cLeft, 0, cWidth, height);

      // ESD belt textured bands
      ctx.fillStyle = '#1c2433';
      ctx.fillRect(cLeft + 15, 0, cWidth - 30, height);

      // Conveyor aluminum extrusions
      ctx.fillStyle = '#323f54';
      ctx.fillRect(cLeft, 0, 10, height);
      ctx.fillRect(cLeft + cWidth - 10, 0, 10, height);

      // Conveyor drive rollers & belt slats moving with tick
      const offset = (tick * 2.2) % 36;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      for (let y = -36 + offset; y < height + 36; y += 36) {
        ctx.beginPath();
        ctx.moveTo(cLeft + 12, y);
        ctx.lineTo(cLeft + cWidth - 12, y);
        ctx.stroke();
      }

      // 3. Right side: AOI Inspection Chamber & Lighting Ring
      ctx.fillStyle = 'rgba(24, 144, 255, 0.03)';
      ctx.fillRect(250, 0, width - 250, height);

      // High-precision telecentric optical lens target rings
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(440, 220, 140, 0, Math.PI * 2);
      ctx.arc(440, 220, 90, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Industrial fiducial alignment marks on corners
      const drawFiducial = (fx: number, fy: number) => {
        ctx.strokeStyle = 'rgba(250, 219, 20, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(fx, fy, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(fx - 10, fy);
        ctx.lineTo(fx + 10, fy);
        ctx.moveTo(fx, fy - 10);
        ctx.lineTo(fx, fy + 10);
        ctx.stroke();
      };
      drawFiducial(290, 70);
      drawFiducial(570, 70);
      drawFiducial(290, 370);
      drawFiducial(570, 370);
    },
  },

  cobot_safety: {
    id: 'cobot_safety',
    name: '工业机器人与 AGV 安全协同电子围栏',
    tag: '工控安全 / 安全生产',
    industry: '汽车装备 / 重工制造',
    description:
      '六轴激光焊接机器人作业半径电子围栏 (PolygonZone 动态防区)，实时识别人机协作侵入、AGV 路径动态交叉预警、未戴安全帽/防静电服违规入侵，触发急停与蜂鸣。',
    fovSizeMm: { w: 6000, h: 4500 },
    mmPerPixel: 7.5,
    defaultTaktTargetSec: 18.0,
    defaultPolygon: {
      id: 'poly_cobot_safety',
      name: '机器人极限回转危险防区 (Cat-4 Safety Perimeter)',
      points: [
        { x: 260, y: 70 },
        { x: 590, y: 80 },
        { x: 620, y: 390 },
        { x: 240, y: 380 },
      ],
      alertClassFilter: ['Worker_No_Helmet', 'Unauthorized_Personnel', 'Foreign_Object'],
      triggerOn: 'both',
      dwellThresholdSec: 0.5,
      color: '#ff4d4f',
      enabled: true,
    },
    defaultLineZone: {
      id: 'line_agv_lane',
      name: 'AGV 物料出入通道光栅线',
      start: { x: 50, y: 220 },
      end: { x: 220, y: 220 },
      inCount: 64,
      outCount: 62,
      targetClasses: ['AGV_Cart', 'Pallet_Jack'],
      color: '#52c41a',
      enabled: true,
    },
    initialObjects: () => [
      {
        id: 11,
        trackId: 201,
        className: 'AGV_Tugger_03',
        category: 'agv',
        x: 80,
        y: 60,
        w: 90,
        h: 75,
        vx: 0,
        vy: 1.6,
        speed: 1.6,
        confidence: 0.978,
        history: [],
        inZone: false,
        zoneDwellFrames: 0,
        crossedLine: false,
        status: 'normal',
        physicalSizeMm: { w: 675, h: 562 },
      },
      {
        id: 12,
        trackId: 202,
        className: 'Worker_No_Helmet',
        category: 'worker',
        x: 310,
        y: 160,
        w: 68,
        h: 115,
        vx: 0.7,
        vy: 0.4,
        speed: 0.8,
        confidence: 0.945,
        history: [],
        inZone: true,
        zoneDwellFrames: 18,
        crossedLine: false,
        status: 'danger_intrusion',
        defectName: '操作工未佩戴安全帽违规入侵',
        defectDetail: '人员穿戴检测未识别到安全帽反光条，已处于焊接机械臂 1.5m 碰撞缓冲区。',
        ipcCode: 'ISO-13849-1-PLe',
        physicalSizeMm: { w: 510, h: 860 },
      },
      {
        id: 13,
        trackId: 203,
        className: 'Kuka_Welding_Arm',
        category: 'tool',
        x: 440,
        y: 190,
        w: 120,
        h: 120,
        vx: 0,
        vy: 0,
        speed: 0,
        confidence: 0.994,
        history: [],
        inZone: true,
        zoneDwellFrames: 100,
        crossedLine: false,
        status: 'normal',
        physicalSizeMm: { w: 900, h: 900 },
      },
      {
        id: 14,
        trackId: 204,
        className: 'Certified_Safety_Operator',
        category: 'worker',
        x: 100,
        y: 330,
        w: 65,
        h: 105,
        vx: -0.3,
        vy: 0.2,
        speed: 0.4,
        confidence: 0.971,
        history: [],
        inZone: false,
        zoneDwellFrames: 0,
        crossedLine: false,
        status: 'normal',
        physicalSizeMm: { w: 480, h: 790 },
      },
    ],
    drawBackground: (ctx, width, height, tick) => {
      // Concrete workshop floor
      ctx.fillStyle = '#16191f';
      ctx.fillRect(0, 0, width, height);

      // Yellow/Black safety caution floor markings on the right edge
      ctx.save();
      const markX = 230;
      for (let y = 0; y < height; y += 30) {
        ctx.fillStyle = y % 60 === 0 ? '#faad14' : '#141414';
        ctx.fillRect(markX, y, 16, 30);
      }
      ctx.restore();

      // AGV magnetic navigation guidance strip on the left (x: 125)
      ctx.strokeStyle = '#389e0d';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.moveTo(125, 0);
      ctx.lineTo(125, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Robot pedestal mounting base (circular plate)
      ctx.fillStyle = '#222c3c';
      ctx.beginPath();
      ctx.arc(500, 250, 65, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#486581';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Hex bolts on pedestal
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        const bx = 500 + Math.cos(a) * 50;
        const by = 250 + Math.sin(a) * 50;
        ctx.fillStyle = '#829ab1';
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Robot rotating arm envelope ring
      ctx.strokeStyle = 'rgba(255, 77, 79, 0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(500, 250, 160, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dynamic robot laser beam effect
      const angle = (tick * 0.03) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 77, 79, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(500, 250);
      ctx.lineTo(500 + Math.cos(angle) * 70, 250 + Math.sin(angle) * 70);
      ctx.stroke();
    },
  },

  battery_cell: {
    id: 'battery_cell',
    name: '动力锂电池电芯极耳焊接与外观分选',
    tag: '新能源 / 锂电制造',
    industry: '新能源动力电池',
    description:
      '方形大容量铝壳电芯与极耳 (Tab) 超声波焊接熔池监控。检测极耳翻折错位、外壳凹坑划痕、顶盖密封防爆阀鼓包，联动 A/B 品与剔除气阀。',
    fovSizeMm: { w: 320, h: 240 },
    mmPerPixel: 0.5,
    defaultTaktTargetSec: 0.8,
    defaultPolygon: {
      id: 'poly_battery_tab',
      name: '极耳超声波焊接熔池高危区 (Tab Welding Pool)',
      points: [
        { x: 270, y: 60 },
        { x: 570, y: 60 },
        { x: 600, y: 380 },
        { x: 250, y: 380 },
      ],
      alertClassFilter: ['Tab_Wrinkle', 'Tab_Misaligned', 'Casing_Dent', 'Seal_Defect'],
      triggerOn: 'both',
      dwellThresholdSec: 0.4,
      color: '#ff4d4f',
      enabled: true,
    },
    defaultLineZone: {
      id: 'line_battery_sort',
      name: 'A品合格电芯过检计件线',
      start: { x: 50, y: 220 },
      end: { x: 220, y: 220 },
      inCount: 412,
      outCount: 406,
      targetClasses: ['Battery_Prismatic_Cell'],
      color: '#13c2c2',
      enabled: true,
    },
    initialObjects: () => [
      {
        id: 21,
        trackId: 301,
        className: 'Battery_Prismatic_Cell',
        category: 'workpiece',
        x: 80,
        y: 45,
        w: 95,
        h: 70,
        vx: 0,
        vy: 2.4,
        speed: 2.4,
        confidence: 0.989,
        history: [],
        inZone: false,
        zoneDwellFrames: 0,
        crossedLine: false,
        status: 'normal',
        physicalSizeMm: { w: 47.5, h: 35.0 },
      },
      {
        id: 22,
        trackId: 302,
        className: 'Battery_Prismatic_Cell',
        category: 'workpiece',
        x: 80,
        y: 175,
        w: 95,
        h: 70,
        vx: 0,
        vy: 2.4,
        speed: 2.4,
        confidence: 0.993,
        history: [],
        inZone: false,
        zoneDwellFrames: 0,
        crossedLine: false,
        status: 'normal',
        physicalSizeMm: { w: 47.5, h: 35.0 },
      },
      {
        id: 23,
        trackId: 303,
        className: 'Tab_Wrinkle_Defect',
        category: 'defect',
        x: 320,
        y: 110,
        w: 70,
        h: 60,
        vx: 0.2,
        vy: 0.1,
        speed: 0.2,
        confidence: 0.962,
        polygonMask: [
          { x: 330, y: 120 },
          { x: 380, y: 115 },
          { x: 385, y: 165 },
          { x: 325, y: 160 },
        ],
        history: [],
        inZone: true,
        zoneDwellFrames: 10,
        crossedLine: false,
        status: 'defect_alert',
        defectName: '正极铜铝极耳边缘翻折褶皱',
        defectDetail: '超声波焊头下压不均导致极耳折弯，有效导电截面积缩减 >35%，内阻超标。',
        ipcCode: 'GB/T 31484-2015',
        physicalSizeMm: { w: 35.0, h: 30.0 },
      },
      {
        id: 24,
        trackId: 304,
        className: 'Casing_Dent',
        category: 'defect',
        x: 440,
        y: 230,
        w: 60,
        h: 55,
        vx: -0.1,
        vy: 0.3,
        speed: 0.3,
        confidence: 0.938,
        history: [],
        inZone: true,
        zoneDwellFrames: 15,
        crossedLine: false,
        status: 'defect_alert',
        defectName: '铝壳侧壁机械碰撞凹坑',
        defectDetail: '模组滚筒挤压划痕深 0.42mm，破坏壳体绝缘阻抗并存在漏液隐患。',
        ipcCode: 'GB/T 31467.3',
        physicalSizeMm: { w: 30.0, h: 27.5 },
      },
    ],
    drawBackground: (ctx, width, height, tick) => {
      // Dark anodized industrial chamber
      ctx.fillStyle = '#101720';
      ctx.fillRect(0, 0, width, height);

      // Roller conveyor tracks (x: 40 to 220)
      const rX = 40;
      const rW = 180;
      ctx.fillStyle = '#1a222d';
      ctx.fillRect(rX, 0, rW, height);

      // Rotating metal rollers
      const rollerSpacing = 32;
      const rOffset = (tick * 2.4) % rollerSpacing;
      for (let y = -rollerSpacing + rOffset; y < height + rollerSpacing; y += rollerSpacing) {
        ctx.fillStyle = '#2d3b4e';
        ctx.fillRect(rX + 8, y, rW - 16, 12);
        ctx.fillStyle = '#4a5d78';
        ctx.fillRect(rX + 8, y + 2, rW - 16, 3);
      }

      // Laser measurement triangulation beam line
      ctx.strokeStyle = 'rgba(235, 47, 150, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(230, 180);
      ctx.lineTo(width - 40, 180);
      ctx.stroke();

      // Inspection optic halo
      ctx.save();
      const grad = ctx.createRadialGradient(420, 220, 20, 420, 220, 150);
      grad.addColorStop(0, 'rgba(19, 194, 194, 0.12)');
      grad.addColorStop(1, 'rgba(19, 194, 194, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(250, 50, 350, 340);
      ctx.restore();
    },
  },

  wafer_inspection: {
    id: 'wafer_inspection',
    name: '半导体晶圆切片与洁净室超净巡检',
    tag: '半导体 / 晶圆划片',
    industry: '半导体集成电路',
    description:
      '300mm 硅片晶圆超净划片机工位，高倍率亚微米视觉检测 Die 崩边 (Chipping)、金属化微裂纹 (Micro-crack) 与颗粒异物沾污，结合洁净室围栏管控。',
    fovSizeMm: { w: 30, h: 22.5 },
    mmPerPixel: 0.05, // 50 microns per pixel
    defaultTaktTargetSec: 0.45,
    defaultPolygon: {
      id: 'poly_wafer_station',
      name: 'Class-1 垂直层流工作区 (Cleanroom Hood)',
      points: [
        { x: 260, y: 50 },
        { x: 580, y: 50 },
        { x: 610, y: 390 },
        { x: 270, y: 390 },
      ],
      alertClassFilter: ['Die_Chipping', 'Micro_Crack', 'Particle_Contamination'],
      triggerOn: 'both',
      dwellThresholdSec: 0.3,
      color: '#722ed1',
      enabled: true,
    },
    defaultLineZone: {
      id: 'line_die_sort',
      name: '良品 Die 划片拾取分选计数线',
      start: { x: 50, y: 220 },
      end: { x: 220, y: 220 },
      inCount: 1580,
      outCount: 1572,
      targetClasses: ['Good_Die', 'Silicon_Chip'],
      color: '#722ed1',
      enabled: true,
    },
    initialObjects: () => [
      {
        id: 31,
        trackId: 401,
        className: 'Good_Die',
        category: 'workpiece',
        x: 80,
        y: 40,
        w: 80,
        h: 60,
        vx: 0,
        vy: 2.8,
        speed: 2.8,
        confidence: 0.996,
        history: [],
        inZone: false,
        zoneDwellFrames: 0,
        crossedLine: false,
        status: 'normal',
        physicalSizeMm: { w: 4.0, h: 3.0 },
      },
      {
        id: 32,
        trackId: 402,
        className: 'Good_Die',
        category: 'workpiece',
        x: 80,
        y: 160,
        w: 80,
        h: 60,
        vx: 0,
        vy: 2.8,
        speed: 2.8,
        confidence: 0.992,
        history: [],
        inZone: false,
        zoneDwellFrames: 0,
        crossedLine: false,
        status: 'normal',
        physicalSizeMm: { w: 4.0, h: 3.0 },
      },
      {
        id: 33,
        trackId: 403,
        className: 'Die_Chipping',
        category: 'defect',
        x: 330,
        y: 120,
        w: 64,
        h: 56,
        vx: 0.2,
        vy: 0.1,
        speed: 0.2,
        confidence: 0.974,
        polygonMask: [
          { x: 335, y: 130 },
          { x: 385, y: 125 },
          { x: 390, y: 165 },
          { x: 340, y: 170 },
        ],
        history: [],
        inZone: true,
        zoneDwellFrames: 14,
        crossedLine: false,
        status: 'defect_alert',
        defectName: '金刚石刀轮划片崩边 (Die Edge Chipping)',
        defectDetail: '划切槽边缘发生贝壳状剥落，崩边宽度达 42μm，超过允许阈值 15μm。',
        ipcCode: 'SEMI G73-0996',
        physicalSizeMm: { w: 3.2, h: 2.8 },
      },
      {
        id: 34,
        trackId: 404,
        className: 'Micro_Crack',
        category: 'defect',
        x: 460,
        y: 220,
        w: 58,
        h: 52,
        vx: -0.1,
        vy: 0.2,
        speed: 0.2,
        confidence: 0.958,
        history: [],
        inZone: true,
        zoneDwellFrames: 20,
        crossedLine: false,
        status: 'defect_alert',
        defectName: '硅基底微裂纹 (Sub-surface Micro-crack)',
        defectDetail: '红外共聚焦检测发现深层微裂纹延伸 88μm，封装热循环应力下极易断裂。',
        ipcCode: 'MIL-STD-883 TM 2010',
        physicalSizeMm: { w: 2.9, h: 2.6 },
      },
    ],
    drawBackground: (ctx, width, height, tick) => {
      // Cleanroom ultra-deep blue background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Wafer blue carrier tape conveyor on left
      ctx.fillStyle = '#0e1726';
      ctx.fillRect(50, 0, 180, height);
      ctx.fillStyle = '#102a43';
      ctx.fillRect(60, 0, 160, height);

      // Wafer circular wafer chuck (300mm wafer simulation)
      ctx.save();
      const wCenterX = 430;
      const wCenterY = 220;
      const wRadius = 155;

      // Rainbow thin-film optical interference shimmer on silicon surface
      const grad = ctx.createLinearGradient(
        wCenterX - wRadius,
        wCenterY - wRadius,
        wCenterX + wRadius,
        wCenterY + wRadius
      );
      grad.addColorStop(0, '#102a43');
      grad.addColorStop(0.3, '#243b53');
      grad.addColorStop(0.6, '#334e68');
      grad.addColorStop(0.85, '#20304c');
      grad.addColorStop(1, '#0e1726');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(wCenterX, wCenterY, wRadius, 0, Math.PI * 2);
      ctx.fill();

      // Notch on wafer top
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(wCenterX, wCenterY - wRadius, 8, 0, Math.PI);
      ctx.fill();

      // Wafer grid lines (Dice street)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let x = wCenterX - wRadius + 15; x < wCenterX + wRadius; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, wCenterY - wRadius);
        ctx.lineTo(x, wCenterY + wRadius);
        ctx.stroke();
      }
      for (let y = wCenterY - wRadius + 15; y < wCenterY + wRadius; y += 18) {
        ctx.beginPath();
        ctx.moveTo(wCenterX - wRadius, y);
        ctx.lineTo(wCenterX + wRadius, y);
        ctx.stroke();
      }

      ctx.restore();
    },
  },

  custom_upload: {
    id: 'custom_upload',
    name: '现场图像/自定义视频流导入',
    tag: '工控调试 / 自定义导入',
    industry: '多场景通用',
    description:
      '支持从本地导入工业现场相机抓拍样本 (SMT/冲压/锂电/半导体) 或自定义测试帧，在真实工业图像上交互式划定防区与计件线。',
    fovSizeMm: { w: 100, h: 75 },
    mmPerPixel: 0.15,
    defaultTaktTargetSec: 1.0,
    defaultPolygon: {
      id: 'poly_custom',
      name: '自定义检测电子围栏 (Custom ROI Zone)',
      points: [
        { x: 200, y: 80 },
        { x: 500, y: 80 },
        { x: 520, y: 360 },
        { x: 220, y: 360 },
      ],
      alertClassFilter: ['Defect', 'Worker', 'Object'],
      triggerOn: 'both',
      dwellThresholdSec: 0.5,
      color: '#1890ff',
      enabled: true,
    },
    defaultLineZone: {
      id: 'line_custom',
      name: '自定义流水线计件标定线',
      start: { x: 80, y: 220 },
      end: { x: 300, y: 220 },
      inCount: 88,
      outCount: 85,
      targetClasses: ['Item', 'Part'],
      color: '#faad14',
      enabled: true,
    },
    initialObjects: () => [
      {
        id: 51,
        trackId: 501,
        className: 'Inspected_Workpiece',
        category: 'workpiece',
        x: 140,
        y: 120,
        w: 80,
        h: 70,
        vx: 0.8,
        vy: 1.2,
        speed: 1.4,
        confidence: 0.982,
        history: [],
        inZone: false,
        zoneDwellFrames: 0,
        crossedLine: false,
        status: 'normal',
        physicalSizeMm: { w: 12.0, h: 10.5 },
      },
      {
        id: 52,
        trackId: 502,
        className: 'Surface_Scratch_Defect',
        category: 'defect',
        x: 310,
        y: 190,
        w: 90,
        h: 60,
        vx: 0.3,
        vy: -0.2,
        speed: 0.4,
        confidence: 0.941,
        polygonMask: [
          { x: 320, y: 200 },
          { x: 390, y: 195 },
          { x: 385, y: 240 },
          { x: 315, y: 245 },
        ],
        history: [],
        inZone: true,
        zoneDwellFrames: 15,
        crossedLine: false,
        status: 'defect_alert',
        defectName: '工件表面机械划痕缺陷',
        defectDetail: '划痕深度 0.28mm，长度 8.4mm，属于外观A级不良品。',
        ipcCode: 'ISO 2859-1',
        physicalSizeMm: { w: 13.5, h: 9.0 },
      },
    ],
    drawBackground: (ctx, width, height) => {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = 'rgba(75, 85, 99, 0.2)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(156, 163, 175, 0.4)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        '请在控制面板点击「导入现场工件图片」以加载真实机台拍摄样本',
        width / 2,
        height / 2
      );
    },
  },
};
