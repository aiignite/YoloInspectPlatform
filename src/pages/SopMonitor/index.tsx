import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Tag,
  Progress,
  Table,
  Badge,
  Alert,
  Space,
  Modal,
  Typography,
  Divider,
  Switch,
  message,
  Tooltip,
  Segmented,
  Tabs,
} from 'antd';
import {
  SafetyCertificateOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  FieldTimeOutlined,
  AimOutlined,
  ToolOutlined,
  SettingOutlined,
  AuditOutlined,
  LockOutlined,
  UnlockOutlined,
  EyeOutlined,
  ArrowRightOutlined,
  BookOutlined,
  VideoCameraOutlined,
  SlidersOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  InfoCircleOutlined,
  FilterOutlined,
  SoundOutlined,
  CameraOutlined,
  BarChartOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { SopPipelineDrawer } from './SopPipelineDrawer';
import {
  DeviationType,
  DeviationSeverity,
  SopMonitorStatus,
  DeviationEventRecord,
} from './types';
import {
  WORKSTATION_ZONES,
  STANDARD_SOP_STEPS,
  drawWorkstationSim,
} from './sopSimulatorRenderer';

const { Text, Paragraph } = Typography;

export const SopMonitor: React.FC = () => {
  const navigate = useNavigate();

  // Status & Events from API / Mock State
  const [monitorStatus, setMonitorStatus] = useState<SopMonitorStatus>({
    station_id: 'ST-SMT-A03 手工插件与锁附工位',
    operator_id: 'OP-8824',
    operator_name: '李工 (SMT高级装配员)',
    template_id: 1,
    template_name: 'SMT精密主板组件插装与螺丝紧固标准工序 (SOP-SMT01)',
    current_step_order: 2,
    current_step_name: '机械手吸附电容并下压',
    step_elapsed_sec: 3.2,
    step_standard_sec: 4.8,
    step_tolerance_sec: 0.8,
    target_roi_name: '主装配工装基准区 (Assembly Nest)',
    total_cycles_completed: 142,
    adherence_rate: 97.4,
    takt_time_actual: 10.8,
    takt_time_target: 10.5,
    andon_state: 'green',
    plc_interlock_active: false,
    active_deviation: null,
  });

  const [deviationEvents, setDeviationEvents] = useState<DeviationEventRecord[]>([
    {
      id: 'EVT-SOP-901',
      timestamp: '09:22:15',
      station_id: 'ST-SMT-A03',
      operator_id: 'OP-8824',
      template_name: 'SMT贴片与元件引脚插入标准流程 (SOP-SMT01)',
      step_order: 3,
      step_name: '电批锁螺丝',
      deviation_type: 'skipped_action',
      severity: 'critical',
      title: '关键紧固工序被跳过 (Skipped Step)',
      description: '检测到操作员未拿起电批拧紧基板螺栓，直接移至扫码区，触发 Poka-Yoke 防呆停线。',
      actual_value: '耗时 0.0s (跳步)',
      standard_value: '标准 3.5s (±0.5s)',
      status: 'resolved',
      plc_interlock_triggered: true,
    },
    {
      id: 'EVT-SOP-902',
      timestamp: '09:25:40',
      station_id: 'ST-SMT-A03',
      operator_id: 'OP-8824',
      template_name: 'SMT贴片与元件引脚插入标准流程 (SOP-SMT01)',
      step_order: 2,
      step_name: '料盒取料对位',
      deviation_type: 'spatial_violation',
      severity: 'major',
      title: '物料盒空间越界误取料 (Spatial Mis-pick)',
      description: '当前工步要求取用料盒1（0.1uF贴片电容），手部骨骼进入料盒2（IC芯片）区域。',
      actual_value: '触碰 Bin 2 边界',
      standard_value: '限定 Bin 1 几何包络',
      status: 'resolved',
      plc_interlock_triggered: false,
    },
    {
      id: 'EVT-SOP-903',
      timestamp: '09:28:10',
      station_id: 'ST-SMT-A03',
      operator_id: 'OP-8824',
      template_name: 'SMT贴片与元件引脚插入标准流程 (SOP-SMT01)',
      step_order: 2,
      step_name: '机械手吸附电容并下压',
      deviation_type: 'timeout',
      severity: 'minor',
      title: '对位迟滞超时 (Timeout Dwell)',
      description: '引脚微调对位耗时 6.4s，超出标准公差上限 5.6s，黄色预警已自动记录至 MES 节拍看板。',
      actual_value: '6.4s (超时 +0.8s)',
      standard_value: '4.8s (±0.8s)',
      status: 'resolved',
      plc_interlock_triggered: false,
    },
  ]);

  // Canvas visual toggles
  const [activeSpecification, setActiveSpecification] = useState<any>(null);
  const [pipelineDrawerOpen, setPipelineDrawerOpen] = useState<boolean>(false);
  const [isKioskMode, setIsKioskMode] = useState<boolean>(false);
  const [touchFriendlyMode, setTouchFriendlyMode] = useState<boolean>(false);
  const [showPipGuide, setShowPipGuide] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);
  const [showBBoxes, setShowBBoxes] = useState<boolean>(true);
  const [showZoneRois, setShowZoneRois] = useState<boolean>(true);
  const [cameraPerspective, setCameraPerspective] = useState<'wide' | 'macro'>('wide');
  const [voiceCoachEnabled, setVoiceCoachEnabled] = useState<boolean>(false);
  const [selectedEventForEvidence, setSelectedEventForEvidence] = useState<DeviationEventRecord | null>(null);
  const [activeTabKey, setActiveTabKey] = useState<string>('zones');

  // Canvas ref & animation loop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tickRef = useRef<number>(0);

  // Web Speech API Digital Coach synthesis
  const speakPrompt = useCallback((text: string) => {
    if (!voiceCoachEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-CN';
      utter.rate = 1.05;
      window.speechSynthesis.speak(utter);
    } catch {
      // SpeechSynthesis may fail silently if audio not allowed
    }
  }, [voiceCoachEnabled]);

  // Fetch initial status from server if available
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statRes, evRes, specRes] = await Promise.all([
          api.get('/sop-monitor/status'),
          api.get('/sop-monitor/events'),
          api.get('/sop-monitor/active-specification'),
        ]);
        if (statRes.data) setMonitorStatus(statRes.data);
        if (evRes.data) setDeviationEvents(evRes.data);
        if (specRes.data) {
          setActiveSpecification(specRes.data);
          if (specRes.data.template_name) {
            setMonitorStatus((prev) => ({
              ...prev,
              template_name: specRes.data.template_name,
              station_id: specRes.data.station_id || prev.station_id,
              takt_time_target: specRes.data.total_cycle_sec || prev.takt_time_target,
            }));
          }
        }
      } catch {
        // Fallback to local state if backend route takes a moment
      }
    };
    fetchData();
  }, []);

  // Main Simulation step ticker: continuously advances step progress in normal mode
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      tickRef.current += 1;

      setMonitorStatus((prev) => {
        // If there's an active critical deviation with PLC interlock locked, halt progress
        if (prev.active_deviation && prev.plc_interlock_active) {
          return prev;
        }

        const currentStep = STANDARD_SOP_STEPS.find((s) => s.step_order === prev.current_step_order);
        const maxTime = currentStep ? currentStep.standard_time_sec + currentStep.tolerance_sec : 5.0;

        const nextElapsed = +(prev.step_elapsed_sec + 0.1).toFixed(1);

        // Check for normal step completion
        if (nextElapsed >= (currentStep?.standard_time_sec || 3.0)) {
          // Advance to next step
          const nextStepOrder = prev.current_step_order >= 5 ? 1 : prev.current_step_order + 1;
          const nextStep = STANDARD_SOP_STEPS.find((s) => s.step_order === nextStepOrder)!;
          const isCycleComplete = prev.current_step_order === 5;

          return {
            ...prev,
            current_step_order: nextStepOrder,
            current_step_name: nextStep.name,
            step_elapsed_sec: 0,
            step_standard_sec: nextStep.standard_time_sec,
            step_tolerance_sec: nextStep.tolerance_sec,
            target_roi_name: WORKSTATION_ZONES.find((z) => z.id === nextStep.target_roi_id)?.name || '',
            total_cycles_completed: isCycleComplete ? prev.total_cycles_completed + 1 : prev.total_cycles_completed,
            andon_state: 'green',
          };
        }

        return {
          ...prev,
          step_elapsed_sec: nextElapsed,
        };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      drawWorkstationSim({
        ctx,
        width: canvas.width,
        height: canvas.height,
        tick: tickRef.current,
        currentStepOrder: monitorStatus.current_step_order,
        activeDeviation: monitorStatus.active_deviation,
        stepElapsedSec: monitorStatus.step_elapsed_sec,
        showSkeleton,
        showBBoxes,
        showZoneRois,
        perspective: cameraPerspective,
      });

      if (isSimulating) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [
    isSimulating,
    monitorStatus.current_step_order,
    monitorStatus.active_deviation,
    monitorStatus.step_elapsed_sec,
    showSkeleton,
    showBBoxes,
    showZoneRois,
    cameraPerspective,
  ]);

  // Trigger simulated deviation
  const handleTriggerDeviation = async (type: DeviationType) => {
    try {
      const res = await api.post('/sop-monitor/trigger-deviation', { deviation_type: type });
      setMonitorStatus(res.data.status);
      setDeviationEvents((prev) => [res.data.event, ...prev]);
      message.error(`已模拟触发【${res.data.event.title}】！Andon 红灯告警并已启动气缸防呆锁止。`);
    } catch {
      // Local fallback simulation
      const newEv: DeviationEventRecord = {
        id: `EVT-SOP-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        station_id: monitorStatus.station_id,
        operator_id: monitorStatus.operator_id,
        template_name: monitorStatus.template_name,
        step_order: monitorStatus.current_step_order,
        step_name: monitorStatus.current_step_name,
        deviation_type: type,
        severity: type === 'skipped_action' || type === 'sequence_inversion' ? 'critical' : 'major',
        title:
          type === 'skipped_action'
            ? '工序漏步警报 (Skipped Action)'
            : type === 'sequence_inversion'
            ? '动作时序倒置 (Sequence Inversion)'
            : type === 'timeout'
            ? '动作超时滞留 (Timeout Dwell)'
            : type === 'spatial_violation'
            ? '空间范围越界/错料 (Spatial Out of Bounds)'
            : '违规杂散动作 (Extraneous Action)',
        description:
          type === 'skipped_action'
            ? '操作员未拿电批拧紧螺栓，直接跨步进入下一阶段！Poka-Yoke 锁止下料气缸。'
            : type === 'sequence_inversion'
            ? '在固定螺丝前提前执行了贴封条动作，破坏工序因果依赖。'
            : type === 'timeout'
            ? '操作员在工装工位滞留超过8秒，节拍失控。'
            : type === 'spatial_violation'
            ? '双手进入料盒3取料，而当前工序必须取用料盒1电容！'
            : '检测到操作员离岗、拨弄手机或违规接触非防静电异物。',
        actual_value: '异常动作触发',
        standard_value: '应严格遵循标准SOP',
        status: 'active',
        plc_interlock_triggered: type === 'skipped_action' || type === 'sequence_inversion',
      };
      setDeviationEvents((prev) => [newEv, ...prev]);
      setMonitorStatus((prev) => ({
        ...prev,
        active_deviation: {
          id: newEv.id,
          type: newEv.deviation_type,
          severity: newEv.severity,
          description: newEv.description,
          step_order: newEv.step_order,
          timestamp: newEv.timestamp,
        },
        andon_state: newEv.severity === 'critical' ? 'red' : 'amber',
        plc_interlock_active: newEv.plc_interlock_triggered,
      }));
      message.error(`已模拟触发【${newEv.title}】！`);
    }
  };

  // Reset to normal compliant green run
  const handleResetCycle = async () => {
    try {
      const res = await api.post('/sop-monitor/reset-cycle');
      setMonitorStatus(res.data.status);
      message.success('已恢复合规生产节拍，Andon 绿灯运行！');
    } catch {
      setMonitorStatus((prev) => ({
        ...prev,
        andon_state: 'green',
        plc_interlock_active: false,
        active_deviation: null,
        current_step_order: 1,
        current_step_name: STANDARD_SOP_STEPS[0].name,
        step_elapsed_sec: 0.5,
        total_cycles_completed: prev.total_cycles_completed + 1,
      }));
      message.success('已恢复合规生产节拍，Andon 绿灯运行！');
    }
  };

  // Release Poka-Yoke interlock
  const handleReleasePokaYoke = async () => {
    try {
      const res = await api.post('/sop-monitor/poka-yoke-release', {
        event_id: monitorStatus.active_deviation?.id,
      });
      setMonitorStatus(res.data.status);
      setDeviationEvents((prev) =>
        prev.map((e) =>
          e.id === monitorStatus.active_deviation?.id ? { ...e, status: 'acknowledged' } : e
        )
      );
      message.success('主管已完成复核确认！PLC防呆气缸已解锁放行。');
    } catch {
      setMonitorStatus((prev) => ({
        ...prev,
        andon_state: 'green',
        plc_interlock_active: false,
        active_deviation: null,
      }));
      message.success('已解除气缸防呆锁止！');
    }
  };

  // Quick Non-Defect False Alarm Exemption
  const handleQuickBypass = () => {
    setMonitorStatus((prev) => ({
      ...prev,
      andon_state: 'green',
      plc_interlock_active: false,
      active_deviation: null,
    }));
    message.success('已一键豁免非工艺良性动作 (如擦拭/翻单/清洁)，产线保持放行！');
  };

  const currentSopStep =
    STANDARD_SOP_STEPS.find((s) => s.step_order === monitorStatus.current_step_order) ||
    STANDARD_SOP_STEPS[0];

  return (
    <div
      style={
        isKioskMode
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9999,
              overflowY: 'auto',
              background: '#090d16',
              padding: '12px 18px',
            }
          : { padding: '8px 12px' }
      }
    >
      {/* Top Banner: Industrial SOP Compliance Monitoring Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #09131f 0%, #102136 60%, #17375e 100%)',
          padding: '16px 24px',
          borderRadius: 8,
          marginBottom: 14,
          border: '1px solid rgba(0, 242, 254, 0.25)',
          color: '#fff',
        }}
      >
        <Row align="middle" justify="space-between" gutter={[16, 12]}>
          <Col xs={24} md={15}>
            <Space align="center" size={14}>
              <SafetyCertificateOutlined style={{ fontSize: 32, color: '#00f2fe' }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ color: '#fff', margin: 0, fontSize: 20, fontWeight: 700 }}>
                    操作员装配动作学习与SOP合规实时监控台 (Production SOP Monitor)
                  </h1>
                  <Tag color="cyan">在线视频推断</Tag>
                  <Tag color="green">Poka-Yoke防呆闭环</Tag>
                  {activeSpecification?.doc_no && (
                    <Tag color="gold">
                      受控作业指导书: {activeSpecification.doc_no} ({activeSpecification.revision || 'Rev.1.0'})
                    </Tag>
                  )}
                </div>
                <p style={{ margin: '4px 0 0 0', opacity: 0.88, fontSize: 13 }}>
                  实时工位: <strong>{monitorStatus.station_id}</strong> · 在线操作员: <strong>{monitorStatus.operator_name}</strong> · 当前规程: <strong>{monitorStatus.template_name}</strong> · 标准单件节拍: <strong>{monitorStatus.takt_time_target}s</strong>
                </p>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={9} style={{ textAlign: 'right' }}>
            <Space wrap size={10} style={{ justifyContent: 'flex-end' }}>
              {/* Andon Status Tower */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background:
                      monitorStatus.andon_state === 'red'
                        ? '#ff4d4f'
                        : monitorStatus.andon_state === 'amber'
                        ? '#faad14'
                        : '#52c41a',
                    boxShadow:
                      monitorStatus.andon_state === 'red'
                        ? '0 0 10px #ff4d4f'
                        : monitorStatus.andon_state === 'amber'
                        ? '0 0 10px #faad14'
                        : '0 0 10px #52c41a',
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>
                  ANDON: {monitorStatus.andon_state.toUpperCase()}
                </span>
              </div>

              {/* PLC Interlock Status */}
              <Tag
                color={monitorStatus.plc_interlock_active ? 'error' : 'success'}
                style={{ padding: '4px 8px', fontSize: 12 }}
                icon={monitorStatus.plc_interlock_active ? <LockOutlined /> : <UnlockOutlined />}
              >
                {monitorStatus.plc_interlock_active ? '气缸防呆锁止中 (HALTED)' : '产线气缸放行 (RUN)'}
              </Tag>

              {/* Quick Jump back to Calibration Workbench */}
              <Button
                size={touchFriendlyMode ? 'middle' : 'small'}
                icon={<BookOutlined />}
                onClick={() => navigate('/video-learning')}
              >
                SOP动作标定与学习中心
              </Button>

              <Button
                size={touchFriendlyMode ? 'middle' : 'small'}
                type="primary"
                icon={<SlidersOutlined />}
                style={{ background: '#722ed1', borderColor: '#722ed1' }}
                onClick={() => setPipelineDrawerOpen(true)}
              >
                SOP全流程流转与微调
              </Button>

              <Button
                size={touchFriendlyMode ? 'middle' : 'small'}
                icon={isKioskMode ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                style={isKioskMode ? { background: '#0284c7', borderColor: '#0284c7', color: '#fff' } : {}}
                onClick={() => setIsKioskMode(!isKioskMode)}
              >
                {isKioskMode ? '退出大屏' : '大屏展台'}
              </Button>

              <Button
                size={touchFriendlyMode ? 'middle' : 'small'}
                type={touchFriendlyMode ? 'primary' : 'default'}
                style={touchFriendlyMode ? { background: '#f59e0b', borderColor: '#f59e0b' } : {}}
                onClick={() => setTouchFriendlyMode(!touchFriendlyMode)}
              >
                {touchFriendlyMode ? '触控大按钮 (已开)' : '触控模式'}
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 4-Stage End-to-End Pipeline Quick Ribbon */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 14,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Tag color="geekblue" style={{ margin: 0, fontWeight: 600 }}>全流程闭环</Tag>
          <Text style={{ fontSize: 12, color: '#334155' }}>
            ① 示范视频录制采集 ➔ ② AI 动作时序分解 ➔ ③ 低代码敏捷微调 ➔ ④ 产线实时监控与 PLC 防呆
          </Text>
        </div>
        <Space size="middle">
          <Button
            size="small"
            type="link"
            icon={<VideoCameraOutlined />}
            onClick={() => navigate('/video-learning')}
          >
            示范视频示教中心
          </Button>
          <Divider orientation="vertical" />
          <Button
            size="small"
            type="link"
            icon={<SlidersOutlined />}
            onClick={() => setPipelineDrawerOpen(true)}
          >
            现场工步微调 ({activeSpecification?.steps?.length || 4}个工步)
          </Button>
        </Space>
      </div>

      {/* Production KPIs Row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        <Col xs={12} sm={6} lg={4}>
          <Card size="small" hoverable>
            <Statistic
              title="当前班次总件数 (Completed)"
              value={monitorStatus.total_cycles_completed}
              suffix="件"
              styles={{ content: { color: '#1890ff', fontWeight: 'bold', fontSize: 18 } }}
              prefix={<ThunderboltOutlined />}
            />
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
              节拍节流合格率 99.2%
            </div>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={4}>
          <Card size="small" hoverable>
            <Statistic
              title="SOP 动作遵从率 (Adherence)"
              value={monitorStatus.adherence_rate}
              precision={1}
              suffix="%"
              styles={{ content: { color: '#52c41a', fontWeight: 'bold', fontSize: 18 } }}
              prefix={<CheckCircleOutlined />}
            />
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
              时序与空间综合合规判定
            </div>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={4}>
          <Card size="small" hoverable>
            <Statistic
              title="平均节拍时间 (Actual Takt)"
              value={monitorStatus.takt_time_actual}
              precision={1}
              suffix="s"
              styles={{ content: { color: '#faad14', fontWeight: 'bold', fontSize: 18 } }}
              prefix={<FieldTimeOutlined />}
            />
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
              设计标准节拍: {monitorStatus.takt_time_target}s (±0.8s)
            </div>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={4}>
          <Card size="small" hoverable>
            <Statistic
              title="当前动作耗时 (Elapsed)"
              value={monitorStatus.step_elapsed_sec}
              precision={1}
              suffix={`/ ${monitorStatus.step_standard_sec}s`}
              styles={{
                content: {
                  color:
                    monitorStatus.step_elapsed_sec > monitorStatus.step_standard_sec + monitorStatus.step_tolerance_sec
                      ? '#ff4d4f'
                      : '#00f2fe',
                  fontWeight: 'bold',
                  fontSize: 18,
                },
              }}
              prefix={<AimOutlined />}
            />
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
              工步 {monitorStatus.current_step_order}/5: {monitorStatus.current_step_name.slice(0, 8)}...
            </div>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={4}>
          <Card size="small" hoverable>
            <Statistic
              title="累计偏差拦截 (Deviations)"
              value={deviationEvents.length}
              suffix="次"
              styles={{ content: { color: '#cf1322', fontWeight: 'bold', fontSize: 18 } }}
              prefix={<CloseCircleOutlined />}
            />
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
              已自动闭环拦截漏序与错料
            </div>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={4}>
          <Card size="small" hoverable>
            <Statistic
              title="YOLO-Pose 视觉时延"
              value={8.4}
              precision={1}
              suffix="ms"
              styles={{ content: { color: '#722ed1', fontWeight: 'bold', fontSize: 18 } }}
              prefix={<EyeOutlined />}
            />
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
              帧率 60 FPS | 工业远心镜头
            </div>
          </Card>
        </Col>
      </Row>

      {/* Main Action Sequence Pipeline Visual Tracker */}
      <Card
        size="small"
        style={{ marginBottom: 14, background: '#fafafa', border: '1px solid #e8e8e8' }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Space>
              <AimOutlined style={{ color: '#1890ff' }} />
              <span style={{ fontWeight: 600 }}>SOP 标准工步时序流实时状态机 (Real-Time Action Sequence State Machine)</span>
            </Space>
            {monitorStatus.plc_interlock_active && (
              <Space>
                <Button
                  size={touchFriendlyMode ? 'middle' : 'small'}
                  type="primary"
                  danger
                  icon={<UnlockOutlined />}
                  onClick={handleReleasePokaYoke}
                >
                  主管授权解除气缸防呆锁止
                </Button>
                <Button
                  size={touchFriendlyMode ? 'middle' : 'small'}
                  icon={<FilterOutlined />}
                  style={{ color: '#d97706', borderColor: '#fde68a', background: '#fefce8' }}
                  onClick={handleQuickBypass}
                >
                  一键非工艺动作豁免 (免除停线)
                </Button>
              </Space>
            )}
          </div>
        }
      >
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0' }}>
          {STANDARD_SOP_STEPS.map((step) => {
            const isCompleted = step.step_order < monitorStatus.current_step_order;
            const isCurrent = step.step_order === monitorStatus.current_step_order;
            const isPending = step.step_order > monitorStatus.current_step_order;

            const isViolated =
              monitorStatus.active_deviation &&
              monitorStatus.active_deviation.step_order === step.step_order;

            return (
              <div
                key={step.step_order}
                style={{
                  flex: 1,
                  minWidth: 190,
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: isViolated
                    ? '#fff1f0'
                    : isCurrent
                    ? '#e6f7ff'
                    : isCompleted
                    ? '#f6ffed'
                    : '#f5f5f5',
                  border: `1.5px solid ${
                    isViolated
                      ? '#ff4d4f'
                      : isCurrent
                      ? '#1890ff'
                      : isCompleted
                      ? '#52c41a'
                      : '#d9d9d9'
                  }`,
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>
                    工步 {step.step_order}
                  </span>
                  {isViolated ? (
                    <Tag color="error">⚠️ 异常拦截</Tag>
                  ) : isCurrent ? (
                    <Tag color="processing">🔥 进行中</Tag>
                  ) : isCompleted ? (
                    <Tag color="success">✓ 已完成</Tag>
                  ) : (
                    <Tag color="default">⏳ 待执行</Tag>
                  )}
                </div>

                <div style={{ fontSize: 12, fontWeight: 600, color: '#262626', marginBottom: 4, height: 36, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {step.name}
                </div>

                <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                  标准工时: <strong>{step.standard_time_sec}s</strong> (±{step.tolerance_sec}s)
                </div>

                {isCurrent && (
                  <div style={{ marginTop: 6 }}>
                    <Progress
                      percent={Math.min(100, Math.round((monitorStatus.step_elapsed_sec / step.standard_time_sec) * 100))}
                      status={
                        monitorStatus.step_elapsed_sec > step.standard_time_sec + step.tolerance_sec
                          ? 'exception'
                          : 'active'
                      }
                      size="small"
                      showInfo={false}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8c8c8c', marginTop: 2 }}>
                      <span>已耗时: {monitorStatus.step_elapsed_sec}s</span>
                      <span>目标: {step.standard_time_sec}s</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Main Viewport & Interactive Deviation Simulation Controls */}
      <Row gutter={[14, 14]}>
        {/* Left: Industrial Camera Feed with Pose Skeleton & ROI Highlighting */}
        <Col xs={24} xl={16}>
          <Card
            title={
              <Space>
                <EyeOutlined style={{ color: '#00f2fe' }} />
                <span>工位工业相机实时画面与动作骨骼姿态识别 (Live Pose & ROI Canvas)</span>
              </Space>
            }
            extra={
              <Space wrap>
                <Button
                  size="small"
                  icon={isSimulating ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={() => setIsSimulating(!isSimulating)}
                >
                  {isSimulating ? '暂停流' : '启动流'}
                </Button>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={handleResetCycle}
                >
                  重置为合规节拍
                </Button>
              </Space>
            }
          >
            {/* Viewport Controlstrip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                background: '#0b111b',
                borderRadius: '6px 6px 0 0',
                borderBottom: '1px solid #1f2937',
                color: '#fff',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <Space wrap size={12}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>视觉图层叠加:</span>
                <span style={{ fontSize: 12 }}>
                  <Switch
                    size="small"
                    checked={showSkeleton}
                    onChange={setShowSkeleton}
                    style={{ marginRight: 4 }}
                  />
                  YOLO-Pose人体骨骼
                </span>
                <span style={{ fontSize: 12 }}>
                  <Switch
                    size="small"
                    checked={showBBoxes}
                    onChange={setShowBBoxes}
                    style={{ marginRight: 4 }}
                  />
                  工件/手部目标框
                </span>
                <span style={{ fontSize: 12 }}>
                  <Switch
                    size="small"
                    checked={showZoneRois}
                    onChange={setShowZoneRois}
                    style={{ marginRight: 4 }}
                  />
                  SOP空间作业防区 (ROIs)
                </span>
                <span style={{ fontSize: 12 }}>
                  <Switch
                    size="small"
                    checked={showPipGuide}
                    onChange={setShowPipGuide}
                    style={{ marginRight: 4 }}
                  />
                  画中画SOP标准示范
                </span>
                <span style={{ fontSize: 12 }}>
                  <Switch
                    size="small"
                    checked={voiceCoachEnabled}
                    onChange={(checked) => {
                      setVoiceCoachEnabled(checked);
                      if (checked) {
                        message.success('已开启数字教练语音提示，将在工步切换与异常时智能播报');
                        speakPrompt('数字教练语音已启动，进入工位监控');
                      } else {
                        message.info('已静音数字教练语音');
                      }
                    }}
                    style={{ marginRight: 4 }}
                  />
                  <SoundOutlined /> 语音教练
                </span>
                <Segmented
                  size="small"
                  value={cameraPerspective}
                  onChange={(val) => {
                    const p = val as 'wide' | 'macro';
                    setCameraPerspective(p);
                    message.info(`已切换至: ${p === 'wide' ? '工位全局俯视视角 (Wide)' : 'PCB与手部微距特写视角 (Macro)'}`);
                  }}
                  options={[
                    { label: '📷 全景俯视', value: 'wide' },
                    { label: '🔍 微距特写', value: 'macro' },
                  ]}
                />
              </Space>

              <div style={{ fontSize: 11, color: '#00f2fe', fontFamily: 'monospace' }}>
                当前目标防区: {monitorStatus.target_roi_name}
              </div>
            </div>

            {/* Canvas Container */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                overflow: 'hidden',
                borderRadius: '0 0 6px 6px',
                background: '#090d16',
              }}
            >
              <canvas
                ref={canvasRef}
                width={660}
                height={420}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />

              {/* HUD Telemetry Overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 12,
                  background: 'rgba(9, 13, 22, 0.88)',
                  backdropFilter: 'blur(4px)',
                  padding: '8px 12px',
                  borderRadius: 4,
                  color: '#00f2fe',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  border: '1px solid rgba(0, 242, 254, 0.35)',
                  pointerEvents: 'none',
                }}
              >
                <div style={{ color: '#ffffff', fontWeight: 'bold', marginBottom: 2 }}>
                  SOP COMPLIANCE ENGINE
                </div>
                <div>Model: YOLOv11-Pose (17-Keypoints)</div>
                <div>Tracking: Wrist L/R Trajectory Active</div>
                <div>Active Step: #{monitorStatus.current_step_order} / 5</div>
                <div>Deviation Mode: {monitorStatus.active_deviation ? '⚠️ VIOLATION DETECTED' : '✓ NORMAL'}</div>
              </div>

              {/* Live Picture-in-Picture Standard SOP Guide Card */}
              {showPipGuide && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    left: 12,
                    background: 'rgba(15, 23, 42, 0.94)',
                    backdropFilter: 'blur(6px)',
                    padding: '10px 14px',
                    borderRadius: 6,
                    border: '1px solid #38bdf8',
                    maxWidth: 340,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                    color: '#fff',
                    zIndex: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
                      📖 画中画 SOP 标准示范 · 工步 {currentSopStep.step_order}
                    </span>
                    <Tag color="cyan" style={{ fontSize: 9, lineHeight: '16px', margin: 0 }}>
                      标准: {currentSopStep.standard_time_sec}s
                    </Tag>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#f8fafc', marginBottom: 4 }}>
                    {currentSopStep.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                    {currentSopStep.description}
                  </div>
                  <div style={{ fontSize: 10, color: '#34d399', marginTop: 4 }}>
                    ⚡ 防呆要点: 限定在 {monitorStatus.target_roi_name || '基准工装区'} 内精准闭环
                  </div>
                </div>
              )}
            </div>

            {/* Action Simulation Scenario Sandbox */}
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                background: '#f5f5f5',
                borderRadius: 6,
                border: '1px solid #e8e8e8',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ThunderboltOutlined style={{ color: '#faad14' }} />
                <span>工况现场异常模拟沙盒 (Simulate Real-World Production Deviations):</span>
              </div>
              <Space wrap size={8}>
                <Button
                  size="small"
                  type="primary"
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  onClick={handleResetCycle}
                >
                  ✓ 模拟合规正常循环
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => handleTriggerDeviation('skipped_action')}
                >
                  🚨 模拟工步漏做 (漏锁螺丝)
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => handleTriggerDeviation('sequence_inversion')}
                >
                  🚨 模拟时序倒置 (先扫码后锁紧)
                </Button>
                <Button
                  size="small"
                  style={{ borderColor: '#faad14', color: '#d48806' }}
                  onClick={() => handleTriggerDeviation('timeout')}
                >
                  ⚠️ 模拟工序超时停顿 (对位困难)
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => handleTriggerDeviation('spatial_violation')}
                >
                  🚨 模拟空间越界错料 (伸入错误料盒)
                </Button>
                <Button
                  size="small"
                  style={{ borderColor: '#faad14', color: '#d48806' }}
                  onClick={() => handleTriggerDeviation('extraneous_action')}
                >
                  ⚠️ 模拟杂散动作 (玩手机/违规动作)
                </Button>
              </Space>
            </div>
          </Card>

          {/* Real-Time Deviation Events Stream */}
          <Card
            title={
              <Space>
                <AlertOutlined style={{ color: '#ff4d4f' }} />
                <span>SOP 动作偏差与质量拦截流水 (Live Deviation Audit Stream)</span>
              </Space>
            }
            size="small"
            style={{ marginTop: 14 }}
          >
            <Table
              size="small"
              rowKey="id"
              dataSource={deviationEvents}
              pagination={{ pageSize: 4 }}
              columns={[
                {
                  title: '触发时间',
                  dataIndex: 'timestamp',
                  key: 'timestamp',
                  width: 90,
                  render: (t) => <span style={{ fontFamily: 'monospace' }}>{t}</span>,
                },
                {
                  title: '工步与偏差类型',
                  dataIndex: 'title',
                  key: 'title',
                  render: (title, rec) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{title}</div>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>{rec.description}</div>
                    </div>
                  ),
                },
                {
                  title: '严重级别',
                  dataIndex: 'severity',
                  key: 'severity',
                  width: 95,
                  render: (sev) => (
                    <Tag color={sev === 'critical' ? 'red' : sev === 'major' ? 'orange' : 'blue'}>
                      {sev === 'critical' ? '严重致命' : sev === 'major' ? '主要缺陷' : '轻微预警'}
                    </Tag>
                  ),
                },
                {
                  title: '现场实测 vs 标准SOP',
                  key: 'compare',
                  width: 170,
                  render: (_, rec) => (
                    <div style={{ fontSize: 11 }}>
                      <div style={{ color: '#cf1322' }}>实测: {rec.actual_value}</div>
                      <div style={{ color: '#52c41a' }}>标准: {rec.standard_value}</div>
                    </div>
                  ),
                },
                {
                  title: '防呆状态',
                  dataIndex: 'plc_interlock_triggered',
                  key: 'plc_interlock_triggered',
                  width: 105,
                  render: (plc) =>
                    plc ? (
                      <Tag color="error">气缸已锁止</Tag>
                    ) : (
                      <Tag color="warning">声光预警</Tag>
                    ),
                },
                {
                  title: '状态 / 处置',
                  key: 'status',
                  width: 95,
                  render: (_, rec) => (
                    <Tag color={rec.status === 'resolved' || rec.status === 'acknowledged' ? 'green' : 'red'}>
                      {rec.status === 'resolved' ? '已恢复' : rec.status === 'acknowledged' ? '已核验' : '待处理'}
                    </Tag>
                  ),
                },
                {
                  title: '证据追溯',
                  key: 'action',
                  width: 95,
                  render: (_, rec) => (
                    <Button
                      size="small"
                      type="link"
                      icon={<CameraOutlined />}
                      onClick={() => setSelectedEventForEvidence(rec)}
                    >
                      抓拍证据
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        {/* Right: Workstation Spatial ROIs & Industrial Practice Guidelines */}
        <Col xs={24} xl={8}>
          <Card size="small" style={{ marginBottom: 14 }}>
            <Tabs
              activeKey={activeTabKey}
              onChange={setActiveTabKey}
              size="small"
              items={[
                {
                  key: 'zones',
                  label: (
                    <span>
                      <AimOutlined /> 空间防区标定 (ROIs)
                    </span>
                  ),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                      {WORKSTATION_ZONES.map((zone) => {
                        const isCurrentActive =
                          STANDARD_SOP_STEPS.find((s) => s.step_order === monitorStatus.current_step_order)
                            ?.target_roi_id === zone.id;

                        return (
                          <div
                            key={zone.id}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 6,
                              background: isCurrentActive ? '#e6f7ff' : '#fafafa',
                              border: `1.5px solid ${isCurrentActive ? '#1890ff' : '#e8e8e8'}`,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, fontSize: 12 }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    background: zone.color,
                                    marginRight: 6,
                                  }}
                                />
                                {zone.name}
                              </span>
                              <Tag color={isCurrentActive ? 'processing' : 'default'} style={{ fontSize: 10 }}>
                                {zone.code}
                              </Tag>
                            </div>
                            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                              {zone.description}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ),
                },
                {
                  key: 'ie_analytics',
                  label: (
                    <span>
                      <BarChartOutlined /> 节拍与瓶颈分析 (IE)
                    </span>
                  ),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                      <div style={{ background: '#f0fdf4', padding: '8px 10px', borderRadius: 6, border: '1px solid #bbf7d0', fontSize: 11 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span><strong>整线节拍效率:</strong> 94.6% (优)</span>
                          <span><strong>稳定度:</strong> 96.2%</span>
                        </div>
                        <div style={{ color: '#166534' }}>当前线平衡率正常，工步间无严重堆料或假等待。</div>
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                        工步实测平均工时 vs 标准公差:
                      </div>

                      {STANDARD_SOP_STEPS.map((step) => {
                        const isBottleneck = step.step_order === 2;
                        const actualAvg = isBottleneck ? 5.1 : step.standard_time_sec * 0.96;
                        const pctOfTakt = Math.round((actualAvg / 14.8) * 100);

                        return (
                          <div
                            key={step.step_order}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 6,
                              background: isBottleneck ? '#fff7ed' : '#f8fafc',
                              border: isBottleneck ? '1.5px solid #fdba74' : '1px solid #e2e8f0',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, fontSize: 12 }}>
                                #{step.step_order} {step.name.slice(0, 10)}...
                              </span>
                              {isBottleneck ? (
                                <Tag color="warning" style={{ fontSize: 10 }}>⚠️ 瓶颈工序 (35%)</Tag>
                              ) : (
                                <Tag color="success" style={{ fontSize: 10 }}>正常</Tag>
                              )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 4 }}>
                              <span>标准: {step.standard_time_sec}s (±{step.tolerance_sec}s)</span>
                              <span>实测均值: <strong style={{ color: isBottleneck ? '#ea580c' : '#059669' }}>{actualAvg.toFixed(1)}s</strong></span>
                            </div>
                            <Progress
                              percent={pctOfTakt * 2.5}
                              size="small"
                              showInfo={false}
                              strokeColor={isBottleneck ? '#f97316' : '#10b981'}
                              style={{ margin: '4px 0 0 0' }}
                            />
                          </div>
                        );
                      })}

                      <Alert
                        type="info"
                        showIcon
                        title="IE 精益动作改善建议"
                        description={
                          <span style={{ fontSize: 11 }}>
                            工步 2 (IC微插件) 动作耗时占总节拍 35%，由于引脚微调存在细微迟滞。建议工装升级为「预弯脚自定位治具」，预计可压减工时 1.2s，提高单班产能 14.3%。
                          </span>
                        }
                      />
                    </div>
                  ),
                },
              ]}
            />
          </Card>

          {/* Industrial Best Practices: Poka-Yoke & Action Supervision Architecture */}
          <Card
            title={
              <Space>
                <ToolOutlined style={{ color: '#1890ff' }} />
                <span>工业现场生产动作监控实施最佳实践 (Best Practices)</span>
              </Space>
            }
            size="small"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#1890ff' }}>
                  1. Poka-Yoke 视觉软硬防呆联锁
                </div>
                <div style={{ fontSize: 12, color: '#595959', lineHeight: 1.5, marginTop: 2 }}>
                  当发生「漏拧螺栓」或「漏插芯片」时，视觉算法在 20ms 内通过 Modbus TCP / GPIO 触发下料气缸锁止，<strong>彻底杜绝不良半成品流向下游</strong>。
                </div>
              </div>

              <Divider style={{ margin: '4px 0' }} />

              <div>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#52c41a' }}>
                  2. 动作时序公差与自适应学习
                </div>
                <div style={{ fontSize: 12, color: '#595959', lineHeight: 1.5, marginTop: 2 }}>
                  标准工时 T_std 需预留容差 [T_std - Δt, T_std + Δt]，避免因操作员动作微小生理变异造成误报；通过多次示教视频的自学习可自动拟合最优时序高斯分布。
                </div>
              </div>

              <Divider style={{ margin: '4px 0' }} />

              <div>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#faad14' }}>
                  3. 空间几何包络与错料阻断
                </div>
                <div style={{ fontSize: 12, color: '#595959', lineHeight: 1.5, marginTop: 2 }}>
                  对多物料盒（Bin）进行多边形或矩形包络标定，操作员手腕骨骼坐标越界取料时即刻发出蜂鸣预警，从源头杜绝混料与错装。
                </div>
              </div>

              <Divider style={{ margin: '4px 0' }} />

              <div>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#722ed1' }}>
                  4. 闭环关联 MES 追溯系统
                </div>
                <div style={{ fontSize: 12, color: '#595959', lineHeight: 1.5, marginTop: 2 }}>
                  每次节拍循环绑定工单号、操作员工号、扫码序列号与装配偏差快照，实现全要素数字化质量追溯与绩效分析。
                </div>
              </div>

              <Button
                type="primary"
                block
                style={{ marginTop: 6 }}
                icon={<ArrowRightOutlined />}
                onClick={() => navigate('/video-learning')}
              >
                前往动作标定中心编辑工步
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Real-Time Deviation Evidence Snapshot Modal */}
      <Modal
        title={
          <Space>
            <CameraOutlined style={{ color: '#ff4d4f' }} />
            <span>SOP 偏差瞬间视觉抓拍证据卡 ({selectedEventForEvidence?.id})</span>
            {selectedEventForEvidence && (
              <Tag color={selectedEventForEvidence.severity === 'critical' ? 'red' : 'orange'}>
                {selectedEventForEvidence.severity === 'critical' ? '严重致命缺陷' : '主要工步偏差'}
              </Tag>
            )}
          </Space>
        }
        open={!!selectedEventForEvidence}
        onCancel={() => setSelectedEventForEvidence(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedEventForEvidence(null)}>
            关闭
          </Button>,
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={() => {
              message.success('已导出该偏差事件的数字质量证据包 (PNG/JSON)');
            }}
          >
            导出证据卡
          </Button>,
          <Button
            key="feedback"
            type="primary"
            style={{ background: '#722ed1', borderColor: '#722ed1' }}
            onClick={() => {
              message.success('已将该异常样本标记并回流至工艺工程模型库，用于后续自学习优化');
              setSelectedEventForEvidence(null);
            }}
          >
            标记为模型优化自学习样本
          </Button>,
        ]}
        width={700}
      >
        {selectedEventForEvidence && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Visual Simulated Snapshot Canvas */}
            <div
              style={{
                background: '#0f172a',
                padding: '16px',
                borderRadius: 8,
                position: 'relative',
                border: '1px solid #ef4444',
                color: '#fff',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  height: 190,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'radial-gradient(circle, #1e293b 0%, #090d16 100%)',
                  borderRadius: 6,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', top: 12, left: 14, fontSize: 11, color: '#38bdf8', fontFamily: 'monospace' }}>
                  CAM-01 4K-SNAPSHOT · REC: {selectedEventForEvidence.timestamp} · OPERATOR: {selectedEventForEvidence.operator_id}
                </div>
                <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 11, color: '#ef4444', fontFamily: 'monospace', fontWeight: 'bold' }}>
                  [VIOLATION DETECTED: {selectedEventForEvidence.deviation_type.toUpperCase()}]
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ border: '2px dashed #ef4444', padding: '12px 24px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.15)', display: 'inline-block' }}>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: '#fca5a5' }}>
                      ⚠️ {selectedEventForEvidence.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>
                      实测数值: {selectedEventForEvidence.actual_value} (标准: {selectedEventForEvidence.standard_value})
                    </div>
                  </div>
                </div>

                <div style={{ position: 'absolute', bottom: 10, left: 14, fontSize: 10, color: '#94a3b8' }}>
                  工位: {selectedEventForEvidence.station_id} | 触发工步: #{selectedEventForEvidence.step_order} {selectedEventForEvidence.step_name}
                </div>
                <div style={{ position: 'absolute', bottom: 10, right: 14, fontSize: 10, color: '#4ade80' }}>
                  气缸防呆状态: {selectedEventForEvidence.plc_interlock_triggered ? '气阀锁死 (INTERLOCKED)' : '声光预警 (WARN)'}
                </div>
              </div>
            </div>

            {/* Event Details Sheet */}
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
              <Row gutter={[12, 8]}>
                <Col span={12}>
                  <strong>事件编号:</strong> {selectedEventForEvidence.id}
                </Col>
                <Col span={12}>
                  <strong>发生时间:</strong> {selectedEventForEvidence.timestamp}
                </Col>
                <Col span={12}>
                  <strong>责任操作员:</strong> {selectedEventForEvidence.operator_id} (李工 - SMT高级装配)
                </Col>
                <Col span={12}>
                  <strong>归属工单 (MES):</strong> WO-20261101-SMT08
                </Col>
                <Col span={24}>
                  <strong>异常详细诊断:</strong>
                  <div style={{ color: '#475569', marginTop: 2 }}>{selectedEventForEvidence.description}</div>
                </Col>
              </Row>
            </div>
          </div>
        )}
      </Modal>

      {/* SOP Pipeline Orchestrator Drawer */}
      <SopPipelineDrawer
        open={pipelineDrawerOpen}
        onClose={() => setPipelineDrawerOpen(false)}
        activeSpecification={activeSpecification}
        onSpecificationUpdated={(updated) => {
          setActiveSpecification(updated);
          if (updated.template_name) {
            setMonitorStatus((prev) => ({
              ...prev,
              template_name: updated.template_name,
              station_id: updated.station_id || prev.station_id,
              takt_time_target: updated.total_cycle_sec || prev.takt_time_target,
            }));
          }
        }}
      />
    </div>
  );
};

export default SopMonitor;
