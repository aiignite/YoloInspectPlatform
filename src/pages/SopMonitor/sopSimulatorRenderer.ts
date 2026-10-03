import { ActionZoneROI, SopStepDef, DeviationType } from './types';

export const WORKSTATION_ZONES: ActionZoneROI[] = [
  {
    id: 'zone_bin_1',
    name: '料盒区 1 (SMT电容/阻容)',
    code: 'BIN_01',
    color: '#00f2fe',
    points: [
      { x: 40, y: 40 },
      { x: 150, y: 40 },
      { x: 150, y: 120 },
      { x: 40, y: 120 },
    ],
    description: '存放 0402 贴片电容与无源元器件，光纤感应取料',
  },
  {
    id: 'zone_bin_2',
    name: '料盒区 2 (IC主控芯片盘)',
    code: 'BIN_02',
    color: '#1890ff',
    points: [
      { x: 170, y: 40 },
      { x: 280, y: 40 },
      { x: 280, y: 120 },
      { x: 170, y: 120 },
    ],
    description: 'ESD防静电华夫盒，放置 QFP-128 主控芯片',
  },
  {
    id: 'zone_assembly_nest',
    name: '主装配工装夹具基准区',
    code: 'NEST_ASSEMBLY',
    color: '#52c41a',
    points: [
      { x: 200, y: 160 },
      { x: 440, y: 160 },
      { x: 440, y: 320 },
      { x: 200, y: 320 },
    ],
    description: '气动定位锁紧治具，PCB板在此进行插件与紧固',
  },
  {
    id: 'zone_tool_holster',
    name: '智能电批工具停靠区',
    code: 'TOOL_SCREWDRIVER',
    color: '#faad14',
    points: [
      { x: 500, y: 40 },
      { x: 620, y: 40 },
      { x: 620, y: 130 },
      { x: 500, y: 130 },
    ],
    description: '扭矩闭环电批挂架，带有传感器检测工具取离/归位',
  },
  {
    id: 'zone_scanner_inspect',
    name: '条码扫码与光学自检区',
    code: 'SCANNER_STATION',
    color: '#722ed1',
    points: [
      { x: 480, y: 220 },
      { x: 620, y: 220 },
      { x: 620, y: 330 },
      { x: 480, y: 330 },
    ],
    description: '固定式条码识读器与高亮补光灯，记录追溯码',
  },
  {
    id: 'zone_outfeed',
    name: '良品送出输送带缓冲区',
    code: 'OUTFEED_BUFFER',
    color: '#13c2c2',
    points: [
      { x: 40, y: 220 },
      { x: 160, y: 220 },
      { x: 160, y: 330 },
      { x: 40, y: 330 },
    ],
    description: '装配完毕合格品送入下游AOI自动输送通道',
  },
];

export const STANDARD_SOP_STEPS: SopStepDef[] = [
  {
    step_order: 1,
    name: '工位导轨送板定位与治具锁紧',
    code: 'STEP_01_FEED_LOCK',
    standard_time_sec: 2.5,
    tolerance_sec: 0.5,
    target_roi_id: 'zone_assembly_nest',
    hand_action: 'place',
    description: '操作员双手承托PCB板基底放入气动治具，按压双启动按键锁紧。',
  },
  {
    step_order: 2,
    name: '取用料盒IC与无源元器件精细对齐插件',
    code: 'STEP_02_INSERTION',
    standard_time_sec: 4.8,
    tolerance_sec: 0.8,
    target_roi_id: 'zone_bin_2',
    hand_action: 'pick',
    description: '右手从BIN 02精密夹取IC芯片，左手稳固板面，将多引脚对准穿入通孔。',
  },
  {
    step_order: 3,
    name: '取电批对位并恒扭矩锁紧基板螺钉',
    code: 'STEP_03_TORQUE_FASTEN',
    standard_time_sec: 3.5,
    tolerance_sec: 0.5,
    target_roi_id: 'zone_tool_holster',
    required_tool: 'electric_screwdriver',
    hand_action: 'fasten',
    description: '从工具挂架取下电批，对准定位沉孔施加下压力，等待扭矩绿灯离合释放。',
    prerequisite_step: 2,
  },
  {
    step_order: 4,
    name: 'DPM条码激光扫码与引脚外观自检',
    code: 'STEP_04_SCAN_INSPECT',
    standard_time_sec: 2.2,
    tolerance_sec: 0.4,
    target_roi_id: 'zone_scanner_inspect',
    required_tool: 'barcode_scanner',
    hand_action: 'scan',
    description: '将板卡移入扫码区触发红外激光线，绑定治具批次与元件序列号。',
    prerequisite_step: 3,
  },
  {
    step_order: 5,
    name: '气动松开治具，成品推入下游输送线',
    code: 'STEP_05_RELEASE_OUTFEED',
    standard_time_sec: 1.8,
    tolerance_sec: 0.3,
    target_roi_id: 'zone_outfeed',
    hand_action: 'place',
    description: '触碰松开气动按钮，平稳推入防静电滚筒通道，完成一个装配节拍循环。',
    prerequisite_step: 4,
  },
];

interface RenderSimOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  tick: number;
  currentStepOrder: number;
  activeDeviation: {
    type: DeviationType;
    description: string;
    severity: 'critical' | 'major' | 'minor';
  } | null;
  stepElapsedSec: number;
  showSkeleton: boolean;
  showBBoxes: boolean;
  showZoneRois: boolean;
}

export function drawWorkstationSim(opts: RenderSimOptions) {
  const {
    ctx,
    width,
    height,
    tick,
    currentStepOrder,
    activeDeviation,
    stepElapsedSec,
    showSkeleton,
    showBBoxes,
    showZoneRois,
  } = opts;

  // 1. Draw Factory Workbench ESD Mat Background
  ctx.fillStyle = '#111827'; // Dark industrial slate
  ctx.fillRect(0, 0, width, height);

  // Bench surface texture
  ctx.fillStyle = '#172033';
  ctx.fillRect(20, 20, width - 40, height - 40);

  // ESD Grounding Grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let x = 30; x < width - 30; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x, height - 20);
    ctx.stroke();
  }
  for (let y = 30; y < height - 30; y += 30) {
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();
  }

  // Draw Central Assembly Fixture Metallic Plate
  ctx.fillStyle = '#222f3e';
  ctx.fillRect(210, 170, 220, 140);
  ctx.strokeStyle = '#34495e';
  ctx.lineWidth = 3;
  ctx.strokeRect(210, 170, 220, 140);

  // PCB Board inside fixture
  ctx.fillStyle = '#0f5132'; // SMT Green PCB
  ctx.fillRect(235, 190, 170, 100);
  ctx.strokeStyle = '#198754';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(235, 190, 170, 100);

  // PCB Solder Pads & IC placeholder
  ctx.fillStyle = '#d4af37'; // Gold pads
  for (let px = 245; px <= 390; px += 20) {
    ctx.fillRect(px, 195, 6, 4);
    ctx.fillRect(px, 281, 6, 4);
  }
  // Central IC chip
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(285, 220, 60, 45);
  ctx.strokeStyle = '#9ca3af';
  ctx.strokeRect(285, 220, 60, 45);

  // Screwdriver Holster (Top Right)
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(520, 50, 80, 70);
  ctx.strokeStyle = '#e67e22';
  ctx.strokeRect(520, 50, 80, 70);
  ctx.fillStyle = '#e67e22';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('TOOL DOCK', 530, 65);

  // Tool presence: If step 3 and no deviation, tool is held by hand; otherwise docked
  const toolInHand = currentStepOrder === 3 && activeDeviation?.type !== 'skipped_action';
  if (!toolInHand) {
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(545, 75, 28, 35);
  }

  // 2. Render Spatial Action Zones (ROIs)
  if (showZoneRois) {
    WORKSTATION_ZONES.forEach((zone) => {
      const isTarget =
        STANDARD_SOP_STEPS.find((s) => s.step_order === currentStepOrder)?.target_roi_id ===
        zone.id;
      const isViolated =
        activeDeviation?.type === 'spatial_violation' &&
        (zone.id === 'zone_bin_1' || zone.id === 'zone_bin_2');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(zone.points[0].x, zone.points[0].y);
      for (let i = 1; i < zone.points.length; i++) {
        ctx.lineTo(zone.points[i].x, zone.points[i].y);
      }
      ctx.closePath();

      // Fill color
      if (isViolated) {
        ctx.fillStyle = 'rgba(255, 77, 79, 0.35)';
      } else if (isTarget) {
        ctx.fillStyle = 'rgba(82, 196, 26, 0.22)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      }
      ctx.fill();

      // Border line
      ctx.strokeStyle = isViolated ? '#ff4d4f' : isTarget ? '#52c41a' : zone.color;
      ctx.lineWidth = isTarget || isViolated ? 2.5 : 1;
      if (isTarget) {
        ctx.setLineDash([6, 4]);
      }
      ctx.stroke();

      // Zone Label Badge
      ctx.fillStyle = isViolated
        ? 'rgba(255, 77, 79, 0.9)'
        : isTarget
        ? 'rgba(82, 196, 26, 0.9)'
        : 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(zone.points[0].x, zone.points[0].y - 20, 130, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(
        isTarget ? `✓ 目标: ${zone.code}` : isViolated ? `⚠️ 越界: ${zone.code}` : zone.code,
        zone.points[0].x + 4,
        zone.points[0].y - 7
      );
      ctx.restore();
    });
  }

  // 3. Calculate Simulated Operator Hand & Arm Coordinates based on active step
  // Operator sits at bottom center (x: 320, y: 440)
  const shoulderLeft = { x: 260, y: 400 };
  const shoulderRight = { x: 380, y: 400 };

  // Targets for hands
  let targetLeft = { x: 250, y: 240 }; // Default resting on assembly fixture
  let targetRight = { x: 360, y: 240 };

  if (activeDeviation?.type === 'spatial_violation') {
    // Hand mistakenly enters Bin 1 or Bin 2 wrong area
    targetRight = { x: 95, y: 80 }; // wrong bin!
    targetLeft = { x: 220, y: 240 };
  } else if (activeDeviation?.type === 'extraneous_action') {
    // Hand reaching outside/pocket
    targetRight = { x: 580, y: 390 }; // picking up mobile phone
    targetLeft = { x: 230, y: 340 };
  } else if (currentStepOrder === 1) {
    // Step 1: Infeed / Placed PCB onto nest
    targetLeft = { x: 240 + Math.sin(tick * 0.08) * 10, y: 230 };
    targetRight = { x: 380 - Math.sin(tick * 0.08) * 10, y: 230 };
  } else if (currentStepOrder === 2) {
    // Step 2: Right hand picks from Bin 2, left hand steadies PCB
    const phase = (stepElapsedSec * 0.8) % 1;
    if (phase < 0.45) {
      targetRight = { x: 225, y: 80 }; // Picking from Bin 2
    } else {
      targetRight = { x: 320, y: 240 }; // Inserting onto PCB
    }
    targetLeft = { x: 250, y: 240 };
  } else if (currentStepOrder === 3) {
    // Step 3: Fastening screws with electric screwdriver
    targetRight = { x: 290 + (Math.sin(tick * 0.1) > 0 ? 30 : -20), y: 235 };
    targetLeft = { x: 230, y: 250 };
  } else if (currentStepOrder === 4) {
    // Step 4: Scan barcode
    targetRight = { x: 530, y: 260 };
    targetLeft = { x: 300, y: 240 };
  } else if (currentStepOrder === 5) {
    // Step 5: Push into outfeed conveyor
    targetRight = { x: 120, y: 260 };
    targetLeft = { x: 90, y: 280 };
  }

  // Inverse Kinematics 2-link Elbow calculation
  const getElbow = (shoulder: { x: number; y: number }, hand: { x: number; y: number }, isRight: boolean) => {
    const midX = (shoulder.x + hand.x) / 2;
    const midY = (shoulder.y + hand.y) / 2;
    const offset = isRight ? 35 : -35;
    return { x: midX + offset, y: midY + 15 };
  };

  const elbowLeft = getElbow(shoulderLeft, targetLeft, false);
  const elbowRight = getElbow(shoulderRight, targetRight, true);

  // 4. Render Human Skeleton Pose (YOLO-Pose 17-Keypoint model representation)
  if (showSkeleton) {
    ctx.save();
    // Neck & Head
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.arc(320, 420, 16, 0, Math.PI * 2);
    ctx.fill();

    // Torso line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(shoulderLeft.x, shoulderLeft.y);
    ctx.lineTo(shoulderRight.x, shoulderRight.y);
    ctx.stroke();

    // Left Arm Bones
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(shoulderLeft.x, shoulderLeft.y);
    ctx.lineTo(elbowLeft.x, elbowLeft.y);
    ctx.lineTo(targetLeft.x, targetLeft.y);
    ctx.stroke();

    // Right Arm Bones
    const rightArmColor =
      activeDeviation?.type === 'spatial_violation' || activeDeviation?.type === 'extraneous_action'
        ? '#ff4d4f'
        : '#52c41a';
    ctx.strokeStyle = rightArmColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(shoulderRight.x, shoulderRight.y);
    ctx.lineTo(elbowRight.x, elbowRight.y);
    ctx.lineTo(targetRight.x, targetRight.y);
    ctx.stroke();

    // Joints keypoints dots
    const drawJoint = (pt: { x: number; y: number }, color = '#ffffff') => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    drawJoint(shoulderLeft, '#60a5fa');
    drawJoint(shoulderRight, '#60a5fa');
    drawJoint(elbowLeft, '#00f2fe');
    drawJoint(elbowRight, rightArmColor);
    drawJoint(targetLeft, '#00f2fe'); // Left wrist/hand
    drawJoint(targetRight, rightArmColor); // Right wrist/hand

    // If holding tool in step 3
    if (toolInHand) {
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(targetRight.x - 6, targetRight.y - 30, 12, 35);
      // Tool torque status LED
      ctx.fillStyle = '#52c41a';
      ctx.beginPath();
      ctx.arc(targetRight.x, targetRight.y - 25, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // 5. Draw YOLO Object Detection Bounding Boxes
  if (showBBoxes) {
    ctx.save();
    // Bbox for PCB
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(230, 185, 180, 110);
    ctx.fillStyle = 'rgba(0, 242, 254, 0.85)';
    ctx.fillRect(230, 168, 110, 16);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('pcb_nest 98.4%', 234, 180);

    // Bbox for Active Hand & 21-Keypoint Fine Micro-Action
    const handBoxColor = activeDeviation ? '#ff4d4f' : '#52c41a';
    ctx.strokeStyle = handBoxColor;
    ctx.strokeRect(targetRight.x - 22, targetRight.y - 22, 44, 44);
    ctx.fillStyle = handBoxColor;
    ctx.fillRect(targetRight.x - 22, targetRight.y - 42, 140, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    const actionTag =
      currentStepOrder === 2
        ? '手部微动作: 精密捏取 (8mm)'
        : currentStepOrder === 3
        ? '手部微动作: 工具握持 (Grip)'
        : currentStepOrder === 1
        ? '手部微动作: 双手指尖对位 (Press)'
        : '手部骨骼: 21点追踪中';
    ctx.fillText(actionTag, targetRight.x - 18, targetRight.y - 28);

    // Draw small finger rays for realistic hand posture
    ctx.strokeStyle = handBoxColor;
    ctx.lineWidth = 1.5;
    const fAngles = [-0.6, -0.3, 0, 0.3, 0.6];
    fAngles.forEach((ang) => {
      ctx.beginPath();
      ctx.moveTo(targetRight.x, targetRight.y);
      ctx.lineTo(targetRight.x + Math.sin(ang) * 14, targetRight.y - Math.cos(ang) * 14);
      ctx.stroke();
    });
    ctx.restore();
  }

  // 6. Visual Warning Banner if Deviation Active
  if (activeDeviation) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 77, 79, 0.9)';
    ctx.fillRect(30, 360, width - 60, 40);
    ctx.strokeStyle = '#ff4d4f';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 360, width - 60, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`🚨 SOP偏差警报: ${activeDeviation.description}`, 45, 385);
    ctx.restore();
  }
}
