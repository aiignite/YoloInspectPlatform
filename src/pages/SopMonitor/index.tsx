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
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
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
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);
  const [showBBoxes, setShowBBoxes] = useState<boolean>(true);
  const [showZoneRois, setShowZoneRois] = useState<boolean>(true);

  // Canvas ref & animation loop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tickRef = useRef<number>(0);

  // Fetch initial status from server if available
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statRes, evRes] = await Promise.all([
          api.get('/sop-monitor/status'),
          api.get('/sop-monitor/events'),
        ]);
        if (statRes.data) setMonitorStatus(statRes.data);
        if (evRes.data) setDeviationEvents(evRes.data);
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

  return (
    <div style={{ padding: '8px 12px' }}>
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
                </div>
                <p style={{ margin: '4px 0 0 0', opacity: 0.88, fontSize: 13 }}>
                  实时工位: <strong>{monitorStatus.station_id}</strong> · 在线操作员: <strong>{monitorStatus.operator_name}</strong> · 当前规程: <strong>{monitorStatus.template_name}</strong>
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
                size="small"
                type="primary"
                icon={<BookOutlined />}
                style={{ background: '#096dd9', borderColor: '#096dd9' }}
                onClick={() => navigate('/video-learning')}
              >
                SOP动作标定与学习中心
              </Button>
            </Space>
          </Col>
        </Row>
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
              <Button
                size="small"
                type="primary"
                danger
                icon={<UnlockOutlined />}
                onClick={handleReleasePokaYoke}
              >
                主管授权解除气缸防呆锁止
              </Button>
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
              ]}
            />
          </Card>
        </Col>

        {/* Right: Workstation Spatial ROIs & Industrial Practice Guidelines */}
        <Col xs={24} xl={8}>
          {/* Spatial Action ROI Catalog */}
          <Card
            title={
              <Space>
                <AimOutlined style={{ color: '#00f2fe' }} />
                <span>工位动作空间范围标定目录 (Spatial Action ROIs)</span>
              </Space>
            }
            size="small"
            style={{ marginBottom: 14 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
    </div>
  );
};

export default SopMonitor;
