import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Button,
  Radio,
  Progress,
  Space,
  Typography,
  Divider,
  Alert,
  Badge,
  Steps,
  Table,
  Tooltip,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  AimOutlined,
  ToolOutlined,
  ThunderboltOutlined,
  SlidersOutlined,
  PlayCircleOutlined,
  StopOutlined,
  SafetyCertificateOutlined,
  DeploymentUnitOutlined,
  ExclamationCircleOutlined,
  SwapOutlined,
  CompassOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export type ActionLifecycleStage =
  | 'STAGE_1_IDLE'
  | 'STAGE_2_APPROACH'
  | 'STAGE_3_ENGAGE'
  | 'STAGE_4_TRANSIT'
  | 'STAGE_5_PROCESS'
  | 'STAGE_6_RELEASE'
  | 'STAGE_7_VERIFY';

export interface ActionSimulationScenario {
  id: string;
  name: string;
  type: 'VALID_FULL' | 'ANOMALY_PHANTOM' | 'ANOMALY_UNDERPRESS' | 'ANOMALY_WRONG_TOOL' | 'ANOMALY_SKIPPED';
  targetPart: string;
  targetTool: string;
  sourceZone: string;
  destZone: string;
  description: string;
  expectedResult: 'PASS' | 'INTERCEPTED_ALARM';
  interceptionReason?: string;
}

const ACTION_SCENARIOS: ActionSimulationScenario[] = [
  {
    id: 'SCENARIO_CAPACITOR_VALID',
    name: '【标准合规】0402 贴片电容微插装全周期',
    type: 'VALID_FULL',
    targetPart: '0402 贴片陶瓷电容 (C12)',
    targetTool: '精密防静电镊子',
    sourceZone: '料盒区 A (BIN_01)',
    destZone: 'PCB 主装配治具焊盘 (NEST_PAD_C12)',
    description: '前置检查OK ➔ 镊子精细捏取 ➔ 空间平稳转移 ➔ 焊盘对齐下压 4.2mm (持压1.2s) ➔ 释放 ➔ 焊盘在位视觉后验OK',
    expectedResult: 'PASS',
  },
  {
    id: 'SCENARIO_SCREW_VALID',
    name: '【标准合规】M2.5 螺丝紧固与扭矩闭环',
    type: 'VALID_FULL',
    targetPart: 'M2.5 镀镍自攻螺丝',
    targetTool: '智能扭矩闭环电批',
    sourceZone: '智能工具停靠区 (TOOL_DOCK)',
    destZone: 'PCB 角落接地螺孔 (NEST_SCREW_HOLE_1)',
    description: '电批离架传感器触发 ➔ 移动至螺孔垂直位 ➔ 旋转拧紧且扭矩达到 0.35 N·m ➔ 归架 ➔ 紧固状态视觉后验OK',
    expectedResult: 'PASS',
  },
  {
    id: 'SCENARIO_PHANTOM_ACTION',
    name: '【防呆拦截】虚假做样子动作 (Phantom/Fake Action)',
    type: 'ANOMALY_PHANTOM',
    targetPart: '无物料 (抓空气)',
    targetTool: '空手捏合',
    sourceZone: '料盒区 A (BIN_01)',
    destZone: 'PCB 主装配治具焊盘 (NEST_PAD_C12)',
    description: '手部在料盒区上方做捏合动作但未抓起零件，移动至焊盘下压。系统检测到手-物交互未绑定，且目标焊盘无像素差分，拦截报警！',
    expectedResult: 'INTERCEPTED_ALARM',
    interceptionReason: '手-物拓扑绑定失败 (Contact Disconnected)，终点焊盘元器件在位差分检验未通过 (Delta = 0.0%)',
  },
  {
    id: 'SCENARIO_UNDERPRESS_ACTION',
    name: '【防呆拦截】下压行程不足即提前松手 (Incomplete Press)',
    type: 'ANOMALY_UNDERPRESS',
    targetPart: '0402 贴片电容',
    targetTool: '精密防静电镊子',
    sourceZone: '料盒区 A (BIN_01)',
    destZone: 'PCB 主装配治具焊盘 (NEST_PAD_C12)',
    description: '零件已取起并移至焊盘，但 Z 轴下压仅 1.1mm (标准 $\\ge 4.0$mm)，持压仅 0.1s 即脱开，存在引脚虚插风险，系统告警拦截！',
    expectedResult: 'INTERCEPTED_ALARM',
    interceptionReason: 'Z 轴下压深度超差 (实际 1.1mm < 标准 4.0mm)，保压驻留时间不足 (实际 0.12s < 标准 0.80s)',
  },
  {
    id: 'SCENARIO_WRONG_TOOL',
    name: '【防呆拦截】工序工具混用违规 (Wrong Tool Violation)',
    type: 'ANOMALY_WRONG_TOOL',
    targetPart: 'M2.5 螺丝',
    targetTool: '徒手按压 (违规未使用电批)',
    sourceZone: '装配治具区',
    destZone: 'PCB 螺孔',
    description: '检测到操作员直接用手指下压螺丝试图强行卡入，未从工具架取用智能电批，触发工艺规程违规联锁！',
    expectedResult: 'INTERCEPTED_ALARM',
    interceptionReason: '关键工艺工具实体缺失：检测到 Hand Action 为徒手下压，未能识别到 TOOL_SCREWDRIVER 实体绑定',
  },
  {
    id: 'SCENARIO_SKIPPED_STEP',
    name: '【防呆拦截】跨工步遗漏跳序 (Skipped Action Step)',
    type: 'ANOMALY_SKIPPED',
    targetPart: '跳过取料与插件',
    targetTool: '条码无线扫码枪',
    sourceZone: '空',
    destZone: '扫码自检区 (SCANNER_STATION)',
    description: '操作员漏插电容，直接抓起扫码枪进行过站扫码，系统因前置必要工序未闭环，强制切断出板电机！',
    expectedResult: 'INTERCEPTED_ALARM',
    interceptionReason: '因果链状态前置依赖未满足：工序 STEP_02 (电容插装) 未生成合法完成信号，禁止跃进到 STEP_04',
  },
];

export const ActionLifecycleStudio: React.FC = () => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('SCENARIO_CAPACITOR_VALID');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [cycleProgressPct, setCycleProgressPct] = useState<number>(0);

  // Live HOI Metrics
  const [handObjectDistanceMm, setHandObjectDistanceMm] = useState<number>(2.4);
  const [contactConfidence, setContactConfidence] = useState<number>(0.96);
  const [zPressDepthMm, setZPressDepthMm] = useState<number>(4.2);
  const [dwellTimeSec, setDwellTimeSec] = useState<number>(1.24);
  const [postConditionDeltaPct, setPostConditionDeltaPct] = useState<number>(98.5);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const currentScenario =
    ACTION_SCENARIOS.find((s) => s.id === selectedScenarioId) || ACTION_SCENARIOS[0];

  const STAGES = [
    { key: 'STAGE_1_IDLE', title: '1. 前置待命', sub: 'Pre-check', desc: '工件/治具就位，双手在安全区' },
    { key: 'STAGE_2_APPROACH', title: '2. 空间逼近', sub: 'Approach', desc: '手部向目标料盒/工具平稳移动' },
    { key: 'STAGE_3_ENGAGE', title: '3. 接触抓持', sub: 'Contact', desc: '指尖与物品绑定，触发抓取' },
    { key: 'STAGE_4_TRANSIT', title: '4. 空间转移', sub: 'Transit', desc: '携带物料沿安全通道前往目标区' },
    { key: 'STAGE_5_PROCESS', title: '5. 工艺执行', sub: 'Process', desc: '对准焊盘垂直下压/电批紧固' },
    { key: 'STAGE_6_RELEASE', title: '6. 释放脱离', sub: 'Release', desc: '指尖脱开物料，手部回缩' },
    { key: 'STAGE_7_VERIFY', title: '7. 后验确认', sub: 'Verify', desc: '焊盘在位差分与节拍时间核算' },
  ];

  // Animation & State Machine Loop
  useEffect(() => {
    let active = true;

    const runLoop = () => {
      if (!active) return;

      if (isPlaying) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const totalDuration = 6.0; // 6s per full cycle
        const progress = (elapsed % totalDuration) / totalDuration;
        setCycleProgressPct(Math.round(progress * 100));

        // Determine current stage (0 to 6)
        const stageIdx = Math.min(6, Math.floor(progress * 7));
        setCurrentStageIndex(stageIdx);

        // Dynamic metrics update based on scenario and stage
        if (currentScenario.type === 'VALID_FULL') {
          if (stageIdx <= 1) {
            setHandObjectDistanceMm(Math.round((60 - stageIdx * 35) * 10) / 10);
            setContactConfidence(0.12);
            setZPressDepthMm(0.0);
            setDwellTimeSec(0.0);
            setPostConditionDeltaPct(0.0);
          } else if (stageIdx === 2 || stageIdx === 3) {
            setHandObjectDistanceMm(1.2);
            setContactConfidence(0.96);
            setZPressDepthMm(0.5);
            setDwellTimeSec(0.2);
            setPostConditionDeltaPct(20.0);
          } else if (stageIdx === 4) {
            setHandObjectDistanceMm(0.8);
            setContactConfidence(0.98);
            setZPressDepthMm(4.2);
            setDwellTimeSec(1.25);
            setPostConditionDeltaPct(65.0);
          } else {
            setHandObjectDistanceMm(Math.round((10 + (stageIdx - 4) * 25) * 10) / 10);
            setContactConfidence(0.05);
            setZPressDepthMm(4.2);
            setDwellTimeSec(1.25);
            setPostConditionDeltaPct(98.8);
          }
        } else if (currentScenario.type === 'ANOMALY_PHANTOM') {
          // Phantom action: hand pinches air, contact never established, final delta = 0
          setHandObjectDistanceMm(45.0);
          setContactConfidence(0.08); // Failed contact
          setZPressDepthMm(stageIdx >= 4 ? 3.8 : 0.0);
          setDwellTimeSec(0.4);
          setPostConditionDeltaPct(0.0); // No part on pad!
        } else if (currentScenario.type === 'ANOMALY_UNDERPRESS') {
          // Underpress: depth is only 1.1mm, dwell time is 0.12s
          setHandObjectDistanceMm(1.0);
          setContactConfidence(0.92);
          setZPressDepthMm(stageIdx >= 4 ? 1.1 : 0.0);
          setDwellTimeSec(stageIdx >= 4 ? 0.12 : 0.0);
          setPostConditionDeltaPct(42.0); // Partially detected, not seated
        } else {
          setHandObjectDistanceMm(22.0);
          setContactConfidence(0.15);
          setZPressDepthMm(0.0);
          setDwellTimeSec(0.0);
          setPostConditionDeltaPct(0.0);
        }

        // Draw Canvas
        drawCanvas(stageIdx, progress);
      }

      animFrameRef.current = requestAnimationFrame(runLoop);
    };

    animFrameRef.current = requestAnimationFrame(runLoop);

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, currentScenario]);

  // Canvas Drawing
  const drawCanvas = (stageIdx: number, progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Background & ESD Grid
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Workstation Zones
    // Zone 1: Material Bin A (Left Top)
    const bin1 = { x: 40, y: 35, w: 120, h: 90 };
    ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.strokeRect(bin1.x, bin1.y, bin1.w, bin1.h);
    ctx.fillRect(bin1.x, bin1.y, bin1.w, bin1.h);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('BIN_01 (0402电容料盒)', bin1.x + 8, bin1.y + 18);
    // Draw component dots inside bin
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 3; j++) {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(bin1.x + 20 + i * 18, bin1.y + 30 + j * 18, 10, 6);
      }
    }

    // Zone 2: Tool Dock (Right Top)
    const toolDock = { x: w - 160, y: 35, w: 120, h: 90 };
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.strokeStyle = '#f59e0b';
    ctx.strokeRect(toolDock.x, toolDock.y, toolDock.w, toolDock.h);
    ctx.fillRect(toolDock.x, toolDock.y, toolDock.w, toolDock.h);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('TOOL_DOCK (电批挂架)', toolDock.x + 8, toolDock.y + 18);
    // Draw tool outline
    ctx.fillStyle = '#64748b';
    ctx.fillRect(toolDock.x + 45, toolDock.y + 30, 30, 48);

    // Zone 3: Main Fixture Nest (Center)
    const nest = { x: w / 2 - 110, y: 150, w: 220, h: 140 };
    ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
    ctx.strokeStyle = '#10b981';
    ctx.strokeRect(nest.x, nest.y, nest.w, nest.h);
    ctx.fillRect(nest.x, nest.y, nest.w, nest.h);
    ctx.fillStyle = '#34d399';
    ctx.fillText('NEST_ASSEMBLY (PCB 装配工装治具)', nest.x + 12, nest.y + 20);

    // PCB Board in center
    ctx.fillStyle = '#14532d';
    ctx.fillRect(nest.x + 25, nest.y + 32, 170, 90);
    // Target Pads (C12, C13, Screw hole)
    ctx.fillStyle = stageIdx >= 5 && currentScenario.type === 'VALID_FULL' ? '#38bdf8' : '#d97706';
    ctx.fillRect(nest.x + 60, nest.y + 55, 18, 12); // Pad C12
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.fillText('PAD_C12', nest.x + 55, nest.y + 80);

    ctx.fillStyle = '#d97706';
    ctx.fillRect(nest.x + 130, nest.y + 55, 18, 12); // Pad C13
    ctx.fillText('PAD_C13', nest.x + 125, nest.y + 80);

    // Zone 4: Scanner Station (Right Bottom)
    const scanner = { x: w - 160, y: h - 110, w: 120, h: 80 };
    ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
    ctx.strokeStyle = '#8b5cf6';
    ctx.strokeRect(scanner.x, scanner.y, scanner.w, scanner.h);
    ctx.fillRect(scanner.x, scanner.y, scanner.w, scanner.h);
    ctx.fillStyle = '#c084fc';
    ctx.fillText('SCANNER (条码自检区)', scanner.x + 8, scanner.y + 18);

    // Animate Hand & Path
    let handX = 80;
    let handY = 80;

    if (stageIdx <= 1) {
      // Approaching bin
      const t = (progress * 7) % 1;
      handX = 40 + t * 40;
      handY = 160 - t * 80;
    } else if (stageIdx === 2) {
      // Grasping at bin
      handX = 80;
      handY = 75;
    } else if (stageIdx === 3) {
      // In transit from bin to pad
      const t = (progress * 7) % 1;
      handX = 80 + t * (nest.x + 69 - 80);
      handY = 75 + t * (nest.y + 61 - 75);
    } else if (stageIdx === 4) {
      // Pressing on Pad
      handX = nest.x + 69;
      handY = nest.y + 61;
    } else {
      // Disengaging / returning
      const t = (progress * 7) % 1;
      handX = nest.x + 69 + t * 50;
      handY = nest.y + 61 + t * 40;
    }

    // Draw planned trajectory line
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.moveTo(80, 75);
    ctx.lineTo(nest.x + 69, nest.y + 61);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Hand Skeleton Mock Representation (Wrist + Thumb + Index)
    ctx.strokeStyle = currentScenario.expectedResult === 'PASS' ? '#38bdf8' : '#ef4444';
    ctx.lineWidth = 3;

    // Wrist
    ctx.beginPath();
    ctx.arc(handX, handY + 24, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#6366f1';
    ctx.fill();
    ctx.stroke();

    // Thumb Tip
    const pinchOffset = stageIdx >= 2 && stageIdx <= 4 ? 6 : 14;
    const thumbX = handX - pinchOffset;
    const thumbY = handY;
    ctx.beginPath();
    ctx.arc(thumbX, thumbY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.stroke();

    // Index Tip
    const indexX = handX + pinchOffset;
    const indexY = handY;
    ctx.beginPath();
    ctx.arc(indexX, indexY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#06b6d4';
    ctx.fill();
    ctx.stroke();

    // Connect wrist to fingers
    ctx.beginPath();
    ctx.moveTo(handX, handY + 24);
    ctx.lineTo(thumbX, thumbY);
    ctx.moveTo(handX, handY + 24);
    ctx.lineTo(indexX, indexY);
    ctx.stroke();

    // Hand Bounding Box
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(handX - 25, handY - 10, 50, 45);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.fillText('HAND_R [0.98]', handX - 25, handY - 14);

    // If item is bound (Contact Active)
    if (stageIdx >= 2 && stageIdx <= 4) {
      if (currentScenario.type !== 'ANOMALY_PHANTOM') {
        // Carried Part
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(handX - 5, handY - 4, 10, 8);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(handX - 9, handY - 8, 18, 16);
        ctx.fillStyle = '#4ade80';
        ctx.fillText('PART_C12 [HOI_BOUND]', handX - 35, handY - 18);
      } else {
        // Phantom Warning in Canvas
        ctx.fillStyle = '#ef4444';
        ctx.fillText('⚠️ NO_OBJECT_BOUND (抓空气)', handX - 45, handY - 18);
      }
    }

    // Status Banner on Bottom
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(0, h - 30, w, 30);
    ctx.fillStyle = currentScenario.expectedResult === 'PASS' ? '#4ade80' : '#f87171';
    ctx.font = '11px sans-serif';
    ctx.fillText(
      `时空状态: ${STAGES[stageIdx].title} | 目标: ${currentScenario.targetPart} | 判定: ${
        currentScenario.expectedResult === 'PASS' ? '✔ 动作生命周期合规' : '✖ 触发防呆拦截'
      }`,
      16,
      h - 10
    );
  };

  const handleScenarioChange = (id: string) => {
    setSelectedScenarioId(id);
    startTimeRef.current = Date.now();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Banner Alert */}
      <Alert
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <DeploymentUnitOutlined style={{ color: '#0284c7' }} />
              <span style={{ fontWeight: 600 }}>工业装配作业动作识别全景架构 · 物品-手势-区域时空防呆工作台</span>
              <Tag color="cyan">ST-HOI 时空图卷积</Tag>
              <Tag color="gold">7阶段原子生命周期</Tag>
              <Tag color="purple">因果状态转移</Tag>
            </Space>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              面向 SOP 错装、漏装、做样子假动作与违规跳步的毫秒级防呆拦截
            </span>
          </div>
        }
        type="info"
        showIcon={false}
        style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}
      />

      {/* Main 2-Column Layout */}
      <Row gutter={[14, 14]}>
        {/* Left Column: Interactive Visualizer & HOI Graph */}
        <Col xs={24} lg={15}>
          <Card
            size="small"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <AimOutlined style={{ color: '#0284c7' }} /> 作业现场手-物交互 (HOI) 与物品区域拓扑空间映射
                </span>
                <Space>
                  <Button
                    size="small"
                    type={isPlaying ? 'default' : 'primary'}
                    icon={isPlaying ? <StopOutlined /> : <PlayCircleOutlined />}
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? '暂停时序推演' : '继续推演'}
                  </Button>
                  <Button
                    size="small"
                    icon={<SyncOutlined />}
                    onClick={() => {
                      startTimeRef.current = Date.now();
                    }}
                  >
                    单周期重置
                  </Button>
                </Space>
              </div>
            }
          >
            {/* 2D Canvas */}
            <div style={{ width: '100%', borderRadius: 6, overflow: 'hidden', border: '1px solid #1e293b' }}>
              <canvas
                ref={canvasRef}
                width={720}
                height={380}
                style={{ width: '100%', height: 380, display: 'block' }}
              />
            </div>

            {/* Stage Stepper Ribbon */}
            <div style={{ marginTop: 14, padding: '10px 12px', background: '#f8fafc', borderRadius: 6 }}>
              <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                完整正确动作 7 阶段生命周期流转状态 (Action Lifecycle State Machine):
              </Text>
              <Steps
                size="small"
                current={currentStageIndex}
                items={STAGES.map((s, idx) => ({
                  title: s.title,
                  content: (
                    <span style={{ fontSize: 10, color: idx === currentStageIndex ? '#0284c7' : '#64748b' }}>
                      {s.sub}
                    </span>
                  ),
                  status:
                    idx < currentStageIndex
                      ? 'finish'
                      : idx === currentStageIndex
                      ? currentScenario.expectedResult === 'PASS'
                        ? 'process'
                        : 'error'
                      : 'wait',
                }))}
              />
            </div>
          </Card>

          {/* 4 Core Verification Dimensions Table */}
          <Card size="small" title="完整正确动作判定引擎：四大核心验核维度" style={{ marginTop: 12 }}>
            <Row gutter={[10, 10]}>
              <Col span={6}>
                <div style={{ background: '#f0fdf4', padding: '8px 10px', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                  <Text strong style={{ fontSize: 12, color: '#166534', display: 'block' }}>
                    ① 实体完备性 (Entity)
                  </Text>
                  <div style={{ fontSize: 11, color: '#15803d', marginTop: 4 }}>
                    手势 + 物料 + 工具匹配
                  </div>
                  <Progress percent={currentScenario.type === 'ANOMALY_WRONG_TOOL' ? 32 : 98} size="small" strokeColor="#16a34a" />
                </div>
              </Col>

              <Col span={6}>
                <div style={{ background: '#eff6ff', padding: '8px 10px', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                  <Text strong style={{ fontSize: 12, color: '#1e40af', display: 'block' }}>
                    ② 空间轨迹 (DTW Path)
                  </Text>
                  <div style={{ fontSize: 11, color: '#1d4ed8', marginTop: 4 }}>
                    源ROI ➔ 转移 ➔ 目标区
                  </div>
                  <Progress percent={currentScenario.type === 'ANOMALY_SKIPPED' ? 18 : 95} size="small" strokeColor="#2563eb" />
                </div>
              </Col>

              <Col span={6}>
                <div style={{ background: '#faf5ff', padding: '8px 10px', borderRadius: 6, border: '1px solid #e9d5ff' }}>
                  <Text strong style={{ fontSize: 12, color: '#6b21a8', display: 'block' }}>
                    ③ 工艺参数 (Physics)
                  </Text>
                  <div style={{ fontSize: 11, color: '#7e22ce', marginTop: 4 }}>
                    下压 $\ge 4$mm · 驻留 $\ge 0.8$s
                  </div>
                  <Progress percent={currentScenario.type === 'ANOMALY_UNDERPRESS' ? 27 : 96} size="small" strokeColor="#9333ea" />
                </div>
              </Col>

              <Col span={6}>
                <div style={{ background: '#fffbeb', padding: '8px 10px', borderRadius: 6, border: '1px solid #fde68a' }}>
                  <Text strong style={{ fontSize: 12, color: '#92400e', display: 'block' }}>
                    ④ 后置确认 (Post-Delta)
                  </Text>
                  <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>
                    焊盘在位差分检验
                  </div>
                  <Progress percent={currentScenario.type === 'ANOMALY_PHANTOM' ? 0 : 99} size="small" strokeColor="#d97706" />
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Right Column: Scenario Sandbox & Live Telemetry */}
        <Col xs={24} lg={9}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Live Metrics Card */}
            <Card size="small" title="实时时空交互特征参数流 (ST-Features)">
              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <Statistic
                    title="手-物空间距离 (Contact Dist)"
                    value={handObjectDistanceMm}
                    suffix="mm"
                    styles={{
                      content: {
                        fontSize: 18,
                        color: handObjectDistanceMm <= 3.0 ? '#10b981' : '#f59e0b',
                        fontWeight: 'bold',
                      },
                    }}
                  />
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    接触阈值 &lt; 5.0mm ({contactConfidence > 0.8 ? '已物理绑定' : '脱开'})
                  </div>
                </Col>

                <Col span={12}>
                  <Statistic
                    title="Z 轴下压深度行程"
                    value={zPressDepthMm}
                    suffix="mm"
                    styles={{
                      content: {
                        fontSize: 18,
                        color: zPressDepthMm >= 4.0 ? '#10b981' : '#ef4444',
                        fontWeight: 'bold',
                      },
                    }}
                  />
                  <div style={{ fontSize: 11, color: '#64748b' }}>工艺标准: 4.0 ~ 5.0 mm</div>
                </Col>

                <Col span={12}>
                  <Statistic
                    title="下压驻留保压时长"
                    value={dwellTimeSec}
                    suffix="s"
                    styles={{
                      content: {
                        fontSize: 18,
                        color: dwellTimeSec >= 0.8 ? '#0284c7' : '#ef4444',
                        fontWeight: 'bold',
                      },
                    }}
                  />
                  <div style={{ fontSize: 11, color: '#64748b' }}>避免虚插晃动弹起</div>
                </Col>

                <Col span={12}>
                  <Statistic
                    title="焊盘在位视觉差分比"
                    value={postConditionDeltaPct}
                    suffix="%"
                    styles={{
                      content: {
                        fontSize: 18,
                        color: postConditionDeltaPct >= 80 ? '#16a34a' : '#ef4444',
                        fontWeight: 'bold',
                      },
                    }}
                  />
                  <div style={{ fontSize: 11, color: '#64748b' }}>终点状态不可逆改变检验</div>
                </Col>
              </Row>
            </Card>

            {/* Scenario Selection & Simulation Sandbox */}
            <Card size="small" title="动作识别与防呆拦截仿真演练沙箱">
              <Text style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                选择作业场景或注入典型作业异常:
              </Text>
              <Radio.Group
                value={selectedScenarioId}
                onChange={(e) => handleScenarioChange(e.target.value)}
                style={{ width: '100%' }}
              >
                <Space orientation="vertical" style={{ width: '100%' }}>
                  {ACTION_SCENARIOS.map((sc) => (
                    <Radio
                      key={sc.id}
                      value={sc.id}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: selectedScenarioId === sc.id ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                        background: selectedScenarioId === sc.id ? '#eff6ff' : '#ffffff',
                        width: '100%',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{sc.name}</span>
                        {sc.expectedResult === 'PASS' ? (
                          <Tag color="success">标准合规</Tag>
                        ) : (
                          <Tag color="error">防呆拦截</Tag>
                        )}
                      </div>
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>

              {/* Scenario Detail Box */}
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 6,
                  background: currentScenario.expectedResult === 'PASS' ? '#f0fdf4' : '#fef2f2',
                  border: currentScenario.expectedResult === 'PASS' ? '1px solid #86efac' : '1px solid #fca5a5',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 12, color: currentScenario.expectedResult === 'PASS' ? '#166534' : '#991b1b', marginBottom: 4 }}>
                  {currentScenario.expectedResult === 'PASS' ? '✔ 动作生命周期完全合法' : '⚡ 触发 Poka-Yoke 防呆拦截并锁机'}
                </div>
                <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
                  <strong>过程描述:</strong> {currentScenario.description}
                </div>
                {currentScenario.interceptionReason && (
                  <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4, fontWeight: 600 }}>
                    <strong>拦截依据:</strong> {currentScenario.interceptionReason}
                  </div>
                )}
              </div>
            </Card>

            {/* Industrial Implementation Reference Card */}
            <Card size="small" title="生产级落地方案设计要点" style={{ backgroundColor: '#f8fafc' }}>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#334155', lineHeight: 1.6 }}>
                <li><strong>物品实体检测</strong>：YOLOv11 细粒度物料与工具识别，提供 2D/3D Bounding Box；</li>
                <li><strong>手-物拓扑绑定</strong>：基于欧式接触距离与运动速度协同判定 Physical Contact；</li>
                <li><strong>区域动态迁移</strong>：物料必须经历从源 ROI ➔ 轨迹走廊 ➔ 目标治具的空间单向流动；</li>
                <li><strong>真动作后置验核</strong>：结合高分辨率宏观相机对目标焊盘做在位像素差分，杜绝“假动作”；</li>
                <li><strong>PLC 毫秒级闭环</strong>：工序不合规（未插装/未锁紧）时，现场总线禁止下压模具与出板电机放行。</li>
              </ul>
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default ActionLifecycleStudio;
