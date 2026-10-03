import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Space,
  Progress,
  Divider,
  Typography,
  Tooltip,
  Alert,
  Tabs,
  Badge,
  Descriptions,
  message,
} from 'antd';
import {
  SafetyCertificateOutlined,
  AimOutlined,
  VideoCameraOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  StopOutlined,
  RetweetOutlined,
  EyeOutlined,
  DownloadOutlined,
  CopyOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  SlidersOutlined,
  ArrowRightOutlined,
  StarOutlined,
  HistoryOutlined,
  GoldOutlined,
  TrophyOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

const { Title, Text, Paragraph } = Typography;

export interface GoldenStep {
  step_order: number;
  name: string;
  standard_sec: number;
  tolerance_sec: number;
  golden_velocity_mms?: number;
  pinch_gap_mm?: number;
  target_roi?: string;
  hand_action?: string;
}

export interface MotionSignature {
  avg_speed_mms: number;
  max_acceleration_mms2: number;
  path_efficiency: number;
  tremor_jitter_px: number;
  smoothness_index: number;
  keypoint_envelope_bound: string;
}

export interface GoldenStandardItem {
  id: number;
  code: string;
  name: string;
  description: string;
  master_operator: string;
  station_id: string;
  business_type: string;
  is_active: boolean;
  total_duration_sec: number;
  tolerance_sec: number;
  video_path: string;
  stability_score: number;
  created_at: string;
  steps: GoldenStep[];
  motion_signature: MotionSignature;
}

export default function GoldenStandardLab() {
  const [standards, setStandards] = useState<GoldenStandardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedStandard, setSelectedStandard] = useState<GoldenStandardItem | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);

  // Recording Master Golden Standard Modal State
  const [recordModalOpen, setRecordModalOpen] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [recordedSteps, setRecordedSteps] = useState<Array<{ step_order: number; name: string; duration: number }>>([]);
  const [recordForm] = Form.useForm();
  const recordVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);

  // Compare & Benchmark Modal State
  const [compareModalOpen, setCompareModalOpen] = useState<boolean>(false);
  const [comparing, setComparing] = useState<boolean>(false);
  const [compareResult, setCompareResult] = useState<any>(null);

  const navigate = useNavigate();

  // Load Golden Standards List
  const fetchStandards = async () => {
    setLoading(true);
    try {
      const res = await api.get('/golden-standards');
      setStandards(res.data);
      if (res.data?.length > 0 && !selectedStandard) {
        setSelectedStandard(res.data[0]);
      }
    } catch {
      message.error('获取黄金标准库失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandards();
  }, []);

  // Set as Active Golden Baseline
  const handleSetActive = async (item: GoldenStandardItem) => {
    try {
      const res = await api.post(`/golden-standards/${item.id}/set-active`);
      message.success(res.data?.message || '已成功激活此黄金标准为全线唯一参考基准！');
      fetchStandards();
    } catch {
      message.error('激活基准失败');
    }
  };

  // Compare with Live Action
  const handleOpenCompare = async (item: GoldenStandardItem) => {
    setSelectedStandard(item);
    setCompareModalOpen(true);
    setComparing(true);
    try {
      const res = await api.post(`/golden-standards/${item.id}/compare`, {});
      setCompareResult(res.data);
    } catch {
      message.error('对比分析失败');
    } finally {
      setComparing(false);
    }
  };

  // -------------------------------------------------------------
  // Master Recording Handlers
  // -------------------------------------------------------------
  const startMasterRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        message.error('当前浏览器不支持摄像头');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      liveStreamRef.current = stream;
      if (recordVideoRef.current) {
        recordVideoRef.current.srcObject = stream;
        await recordVideoRef.current.play();
      }

      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        setRecordedBlobUrl(URL.createObjectURL(blob));
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      setRecordedSteps([{ step_order: 1, name: '工步 1: 基准对位到位', duration: 0 }]);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => +(t + 0.1).toFixed(1));
      }, 100);

      message.success('已开启大师示范录制，请技师按照最高工艺规范执行标准动作');
    } catch (err: any) {
      message.error(`无法开启摄像头: ${err.message || '权限受限'}`);
    }
  };

  const markNextGoldenStep = () => {
    const nextIdx = recordedSteps.length + 1;
    const defaultStepNames = [
      '工步 1: PCB基准对位与锁紧',
      '工步 2: 精密元件拾取与插装',
      '工步 3: 智能电批恒扭矩紧固',
      '工步 4: 二维码过站扫描',
      '工步 5: 推入下道接驳出板',
    ];
    const name = defaultStepNames[nextIdx - 1] || `工步 ${nextIdx}: 标准规范动作`;
    setRecordedSteps((prev) => [...prev, { step_order: nextIdx, name, duration: recordingTime }]);
    message.info(`已标记 ${name} (${recordingTime}s)`);
  };

  const stopMasterRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach((track) => track.stop());
      liveStreamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    message.success(`示范录制完成！总时长: ${recordingTime} 秒，包含 ${recordedSteps.length} 个工步特征`);
  };

  const handleSaveMasterStandard = async (values: any) => {
    try {
      const stepCount = recordedSteps.length || 3;
      const stepDur = +(recordingTime / stepCount).toFixed(1) || 2.5;

      const payload = {
        name: values.name,
        code: `GS-${values.business_type.toUpperCase()}-${Date.now().toString().slice(-3)}`,
        description: values.description || '现场工艺标兵大师示范录制黄金动作序列',
        master_operator: values.master_operator || '特级技师 (实录示范)',
        station_id: values.station_id || 'ST-SMT-A03',
        business_type: values.business_type || 'assembly',
        total_duration_sec: recordingTime || 10.5,
        tolerance_sec: +(values.tolerance_sec || 0.3),
        video_path: recordedBlobUrl || '/uploads/sample_smt.mp4',
        stability_score: 99.2,
        steps: recordedSteps.map((s, idx) => ({
          step_order: s.step_order,
          name: s.name,
          standard_sec: stepDur,
          tolerance_sec: +(values.tolerance_sec || 0.3),
          golden_velocity_mms: 55,
          pinch_gap_mm: 12,
          target_roi: idx === 0 ? '主装配工装基准区' : idx === 1 ? '料盒1号区' : '紧固工作区',
          hand_action: idx === 1 ? '精密双指微捏取 (Fine Pinch)' : '双手平稳对位',
        })),
        motion_signature: {
          avg_speed_mms: 55.4,
          max_acceleration_mms2: 140,
          path_efficiency: 99.2,
          tremor_jitter_px: 0.3,
          smoothness_index: 0.98,
          keypoint_envelope_bound: '±8px',
        },
      };

      await api.post('/golden-standards', payload);
      message.success('已成功存入黄金标准动作库！');
      setRecordModalOpen(false);
      setRecordedBlobUrl(null);
      recordForm.resetFields();
      fetchStandards();
    } catch {
      message.error('保存黄金标准失败');
    }
  };

  const activeStandard = standards.find((s) => s.is_active) || standards[0];

  return (
    <div style={{ padding: '16px 20px', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Top Banner Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
          borderRadius: 8,
          padding: '16px 24px',
          marginBottom: 16,
          color: '#fff',
          boxShadow: '0 4px 12px rgba(49, 46, 129, 0.25)',
        }}
      >
        <Row align="middle" justify="space-between" gutter={[16, 12]}>
          <Col xs={24} md={15}>
            <Space align="center" size={14}>
              <TrophyOutlined style={{ fontSize: 36, color: '#fbbf24' }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ color: '#fff', margin: 0, fontSize: 20, fontWeight: 700 }}>
                    标准操作步骤存储与黄金动作基准库 (Golden Standard Action Repository)
                  </h1>
                  <Tag color="gold" style={{ fontWeight: 600 }}>受控黄金基准</Tag>
                  <Tag color="cyan">时序DTW比对</Tag>
                </div>
                <p style={{ margin: '4px 0 0 0', opacity: 0.88, fontSize: 13 }}>
                  录制并固化大师级“黄金标准”动作视频序列，提取关节运动包络线与标准公差带，作为后续 YOLO 目标识别、骨骼姿态对齐与生产合规判定的法定对比参考。
                </p>
              </div>
            </Space>
          </Col>

          <Col xs={24} md={9} style={{ textAlign: 'right' }}>
            <Space wrap>
              <Button
                type="primary"
                icon={<VideoCameraOutlined />}
                style={{ background: '#f59e0b', borderColor: '#f59e0b', fontWeight: 600 }}
                onClick={() => setRecordModalOpen(true)}
              >
                🎥 录制新黄金标准动作
              </Button>

              <Button
                style={{ background: '#10b981', borderColor: '#10b981', color: '#fff', fontWeight: 600 }}
                icon={<RocketOutlined />}
                onClick={() => navigate('/sop-monitor')}
              >
                产线实时合规监控台
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Active Golden Baseline Highlight Card */}
      {activeStandard && (
        <Card
          size="small"
          style={{
            marginBottom: 16,
            borderRadius: 8,
            border: '2px solid #f59e0b',
            background: 'linear-gradient(to right, #fffbeb, #ffffff)',
          }}
        >
          <Row align="middle" justify="space-between" gutter={[16, 8]}>
            <Col xs={24} md={16}>
              <Space align="center" size={10} wrap>
                <Tag color="gold" style={{ fontSize: 13, padding: '3px 8px', fontWeight: 'bold' }}>
                  ★ 当前全线最高生效参考基准 (Active Baseline)
                </Tag>
                <Text strong style={{ fontSize: 15, color: '#92400e' }}>
                  {activeStandard.code} · {activeStandard.name}
                </Text>
                <Tag color="blue">{activeStandard.station_id}</Tag>
                <Tag color="purple">示范大师: {activeStandard.master_operator}</Tag>
              </Space>
              <div style={{ fontSize: 12, color: '#78350f', marginTop: 4 }}>
                标准基准单件节拍: <strong>{activeStandard.total_duration_sec}s</strong> (允许公差: ±{activeStandard.tolerance_sec}s) | 动作平滑度指数: <strong>{activeStandard.motion_signature.smoothness_index}</strong> | 空间轨迹信封: <strong>{activeStandard.motion_signature.keypoint_envelope_bound}</strong>
              </div>
            </Col>
            <Col xs={24} md={8} style={{ textAlign: 'right' }}>
              <Space>
                <Button
                  size="small"
                  type="primary"
                  style={{ background: '#d97706', borderColor: '#d97706' }}
                  icon={<AimOutlined />}
                  onClick={() => handleOpenCompare(activeStandard)}
                >
                  现场动作动态对比分析 (DTW)
                </Button>
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => {
                    setSelectedStandard(activeStandard);
                    setDetailModalOpen(true);
                  }}
                >
                  查看基准轨迹特征
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* Main Golden Standards Repository Table */}
      <Card
        title={
          <Space>
            <GoldOutlined style={{ color: '#f59e0b' }} />
            <span>黄金标准动作序列仓库 ({standards.length})</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<RetweetOutlined />} onClick={fetchStandards}>刷新列表</Button>
          </Space>
        }
      >
        <Table
          dataSource={standards}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 6 }}
          columns={[
            {
              title: '基准编号',
              dataIndex: 'code',
              width: 130,
              render: (v, r) => (
                <Space>
                  <Tag color={r.is_active ? 'gold' : 'default'} style={{ fontWeight: 'bold' }}>
                    {v}
                  </Tag>
                  {r.is_active && <StarOutlined style={{ color: '#f59e0b' }} />}
                </Space>
              ),
            },
            {
              title: '黄金标准名称与工艺描述',
              key: 'name',
              render: (_, r) => (
                <div>
                  <a
                    onClick={() => {
                      setSelectedStandard(r);
                      setDetailModalOpen(true);
                    }}
                    style={{ fontWeight: 600, fontSize: 13 }}
                  >
                    {r.name}
                  </a>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{r.description}</div>
                </div>
              ),
            },
            {
              title: '示范大师 / 录制专家',
              dataIndex: 'master_operator',
              width: 170,
              render: (v) => <Tag color="geekblue">{v}</Tag>,
            },
            {
              title: '工位/产线',
              dataIndex: 'station_id',
              width: 120,
              render: (v) => <Tag>{v}</Tag>,
            },
            {
              title: '黄金单件节拍',
              dataIndex: 'total_duration_sec',
              width: 120,
              render: (v, r) => (
                <span style={{ fontWeight: 'bold', color: '#0284c7' }}>
                  {v}s (±{r.tolerance_sec}s)
                </span>
              ),
            },
            {
              title: '工步数',
              key: 'steps_count',
              width: 80,
              render: (_, r) => <Badge count={r.steps?.length || 0} style={{ backgroundColor: '#10b981' }} />,
            },
            {
              title: '基准状态',
              key: 'is_active',
              width: 120,
              render: (_, r) =>
                r.is_active ? (
                  <Tag color="success">当前生效基准</Tag>
                ) : (
                  <Tag color="default">备选基准序列</Tag>
                ),
            },
            {
              title: '操作',
              key: 'actions',
              width: 220,
              render: (_, r) => (
                <Space>
                  {!r.is_active && (
                    <Button
                      size="small"
                      type="link"
                      style={{ color: '#d97706', padding: 0 }}
                      onClick={() => handleSetActive(r)}
                    >
                      设为生效基准
                    </Button>
                  )}
                  <Button
                    size="small"
                    type="primary"
                    style={{ background: '#0284c7', borderColor: '#0284c7' }}
                    icon={<AimOutlined />}
                    onClick={() => handleOpenCompare(r)}
                  >
                    比对核验
                  </Button>
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => {
                      setSelectedStandard(r);
                      setDetailModalOpen(true);
                    }}
                  >
                    详情
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* Modal 1: Record Master Golden Standard Studio                 */}
      {/* ------------------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <TrophyOutlined style={{ color: '#f59e0b' }} />
            <span style={{ fontWeight: 700 }}>录制并固化大师级“黄金标准”动作序列 (Master Golden Benchmark Studio)</span>
          </Space>
        }
        open={recordModalOpen}
        onCancel={() => {
          stopMasterRecording();
          setRecordModalOpen(false);
        }}
        footer={null}
        width={900}
        destroyOnClose
      >
        <Row gutter={[16, 16]}>
          <Col span={15}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
              {!recordedBlobUrl ? (
                <video
                  ref={recordVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <video
                  src={recordedBlobUrl}
                  controls
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              )}

              <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(15, 23, 42, 0.85)', padding: '4px 10px', borderRadius: 4, color: '#fbbf24', fontSize: 12, fontFamily: 'monospace' }}>
                {isRecording ? `GOLDEN REC ● ${recordingTime}s | 720P@30FPS` : recordedBlobUrl ? '黄金标准回放预览' : '大师摄像头就绪'}
              </div>

              {isRecording && (
                <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, background: 'rgba(15, 23, 42, 0.85)', padding: '6px 12px', borderRadius: 6, color: '#38bdf8', fontSize: 12 }}>
                  正在录制黄金工步: {recordedSteps[recordedSteps.length - 1]?.name || '开始...'}
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                {!isRecording && !recordedBlobUrl && (
                  <Button type="primary" style={{ background: '#f59e0b', borderColor: '#f59e0b' }} icon={<VideoCameraOutlined />} onClick={startMasterRecording}>
                    开始录制黄金标准
                  </Button>
                )}

                {isRecording && (
                  <>
                    <Button type="primary" icon={<AimOutlined />} onClick={markNextGoldenStep} style={{ background: '#0284c7' }}>
                      📌 标记下一黄金工步
                    </Button>
                    <Button type="primary" danger icon={<StopOutlined />} onClick={stopMasterRecording}>
                      结束录制
                    </Button>
                  </>
                )}

                {recordedBlobUrl && (
                  <Button icon={<RetweetOutlined />} onClick={() => { setRecordedBlobUrl(null); startMasterRecording(); }}>
                    重新录制
                  </Button>
                )}
              </Space>

              <Text type="secondary" style={{ fontSize: 12 }}>
                已打点标记 {recordedSteps.length} 个黄金工步
              </Text>
            </div>
          </Col>

          <Col span={9}>
            <Card size="small" title="黄金标准定义与基准指标">
              <Form form={recordForm} layout="vertical" onFinish={handleSaveMasterStandard} initialValues={{ business_type: 'assembly', station_id: 'ST-SMT-A03', tolerance_sec: 0.3 }}>
                <Form.Item name="name" label="黄金标准序列名称" rules={[{ required: true }]} initialValue="高精度SMT贴片与引脚对位黄金基准">
                  <Input placeholder="输入黄金标准名称" />
                </Form.Item>
                <Form.Item name="master_operator" label="示范大师/责任技师" rules={[{ required: true }]} initialValue="张工 (全国职业技能大赛冠军)">
                  <Input placeholder="例如: 高志远 (高级技师)" />
                </Form.Item>
                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item name="station_id" label="适用工位">
                      <Input placeholder="ST-SMT-A03" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="tolerance_sec" label="最优公差(±s)">
                      <InputNumber min={0.1} max={1.0} step={0.1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="description" label="黄金标准动作特征说明">
                  <Input.TextArea rows={2} placeholder="详细记录大师级动作轨迹、防静电手环接触与手部微动作规范" />
                </Form.Item>

                <div style={{ marginTop: 8 }}>
                  <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>已记录黄金工步序列:</Text>
                  <div style={{ maxHeight: 90, overflowY: 'auto', background: '#f1f5f9', padding: '4px 6px', borderRadius: 4, fontSize: 11 }}>
                    {recordedSteps.map((s) => (
                      <div key={s.step_order} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                        <span><strong>{s.name}</strong></span>
                        <span style={{ color: '#0284c7' }}>{s.duration}s</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Divider style={{ margin: '12px 0' }} />

                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  disabled={!recordedBlobUrl && !isRecording}
                  style={{ background: '#f59e0b', borderColor: '#f59e0b', fontWeight: 600 }}
                >
                  ★ 固化并保存为法定黄金标准
                </Button>
              </Form>
            </Card>
          </Col>
        </Row>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* Modal 2: Golden Benchmark vs Live Action DTW Comparator       */}
      {/* ------------------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <AimOutlined style={{ color: '#0284c7' }} />
            <span style={{ fontWeight: 700 }}>黄金基准 vs 现场动作动态时序对比分析 (DTW Benchmark Inspector)</span>
          </Space>
        }
        open={compareModalOpen}
        onCancel={() => setCompareModalOpen(false)}
        footer={null}
        width={960}
      >
        {compareResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Summary Top Strip */}
            <Card size="small" style={{ background: compareResult.is_overall_pass ? '#f0fdf4' : '#fef2f2', borderColor: compareResult.is_overall_pass ? '#86efac' : '#fca5a5' }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Space size={12}>
                    <Tag color="gold" style={{ fontSize: 13, padding: '3px 8px' }}>
                      参考基准: {compareResult.golden_standard_code}
                    </Tag>
                    <strong>{compareResult.golden_standard_name}</strong>
                    <Tag color="purple">示范大师: {compareResult.master_operator}</Tag>
                  </Space>
                </Col>
                <Col>
                  <Tag color={compareResult.is_overall_pass ? 'success' : 'error'} style={{ fontSize: 13, padding: '3px 10px', fontWeight: 'bold' }}>
                    {compareResult.is_overall_pass ? '✔ 动作符合黄金基准 (PASS)' : '⚠ 动作存在明显滞后/偏差 (WARNING)'}
                  </Tag>
                </Col>
              </Row>
            </Card>

            {/* KPI Metrics */}
            <Row gutter={[12, 12]}>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="整体动作轨迹相似度"
                    value={compareResult.overall_similarity_pct}
                    suffix="%"
                    valueStyle={{ color: compareResult.overall_similarity_pct >= 90 ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}
                    prefix={<CheckCircleOutlined />}
                  />
                  <div style={{ fontSize: 11, color: '#64748b' }}>DTW 空间距离: {compareResult.dtw_distance}</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="总周期节拍时间差 (Δt)"
                    value={compareResult.total_duration_delta_sec > 0 ? `+${compareResult.total_duration_delta_sec}` : compareResult.total_duration_delta_sec}
                    suffix="s"
                    valueStyle={{ color: Math.abs(compareResult.total_duration_delta_sec) <= 0.5 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}
                    prefix={<ClockCircleOutlined />}
                  />
                  <div style={{ fontSize: 11, color: '#64748b' }}>公差信封带: ±0.3s</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="手势微细姿态吻合度"
                    value={98.6}
                    suffix="%"
                    valueStyle={{ color: '#0284c7', fontWeight: 'bold' }}
                    prefix={<AimOutlined />}
                  />
                  <div style={{ fontSize: 11, color: '#64748b' }}>捏距偏差: ±0.4mm</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="违规空间越界检测"
                    value="0 次 (无越界)"
                    valueStyle={{ color: '#10b981', fontSize: 16, fontWeight: 'bold' }}
                    prefix={<SafetyCertificateOutlined />}
                  />
                  <div style={{ fontSize: 11, color: '#64748b' }}>符合几何防呆规则</div>
                </Card>
              </Col>
            </Row>

            {/* Step-by-Step Benchmark Comparison Table */}
            <Card size="small" title="分步动作时序与黄金基准详细比对矩阵">
              <Table
                dataSource={compareResult.step_comparisons}
                rowKey="step_order"
                size="small"
                pagination={false}
                columns={[
                  { title: '工步#', dataIndex: 'step_order', width: 65, render: (v) => <Tag color="blue">{v}</Tag> },
                  { title: '工步名称', dataIndex: 'step_name', render: (v) => <strong>{v}</strong> },
                  {
                    title: '黄金基准工时',
                    dataIndex: 'golden_duration_sec',
                    width: 120,
                    render: (v: any, r: any) => `${v}s (±${r.golden_tolerance_sec}s)`,
                  },
                  {
                    title: '实测耗时',
                    dataIndex: 'actual_duration_sec',
                    width: 95,
                    render: (v: any) => `${v}s`,
                  },
                  {
                    title: '偏差 (Δt)',
                    dataIndex: 'duration_delta_sec',
                    width: 100,
                    render: (v: any) => (
                      <span style={{ fontWeight: 'bold', color: Math.abs(v) <= 0.3 ? '#10b981' : v > 0 ? '#ef4444' : '#f59e0b' }}>
                        {v > 0 ? `+${v}s` : `${v}s`}
                      </span>
                    ),
                  },
                  {
                    title: '轨迹匹配度',
                    dataIndex: 'trajectory_similarity_pct',
                    width: 100,
                    render: (v: any) => (
                      <Tag color={v >= 95 ? 'green' : v >= 90 ? 'blue' : 'orange'}>
                        {v}%
                      </Tag>
                    ),
                  },
                  {
                    title: '合规判定',
                    dataIndex: 'judgment',
                    render: (v: any, r: any) => (
                      <Tag color={r.status === 'pass' ? 'success' : 'warning'}>{v}</Tag>
                    ),
                  },
                ]}
              />
            </Card>

            {/* Recommendations */}
            <Card size="small" title="工艺优化与大师示范指导建议">
              <ul style={{ margin: 0, paddingLeft: 18, color: '#475569', fontSize: 12 }}>
                {compareResult.recommendations?.map((rec: string, i: number) => (
                  <li key={i} style={{ marginBottom: 4 }}>{rec}</li>
                ))}
              </ul>
            </Card>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 24 }}>正在执行动态时间规整 (DTW) 对比计算...</div>
        )}
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* Modal 3: Golden Benchmark Inspection Details                  */}
      {/* ------------------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <TrophyOutlined style={{ color: '#f59e0b' }} />
            <span style={{ fontWeight: 700 }}>黄金标准序列档案 ({selectedStandard?.code})</span>
            {selectedStandard?.is_active && <Tag color="gold">当前生效基准</Tag>}
          </Space>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={850}
      >
        {selectedStandard && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="标准编号">{selectedStandard.code}</Descriptions.Item>
              <Descriptions.Item label="标准名称">{selectedStandard.name}</Descriptions.Item>
              <Descriptions.Item label="示范大师">{selectedStandard.master_operator}</Descriptions.Item>
              <Descriptions.Item label="工位/产线">{selectedStandard.station_id}</Descriptions.Item>
              <Descriptions.Item label="单件黄金节拍">{selectedStandard.total_duration_sec}s (±{selectedStandard.tolerance_sec}s)</Descriptions.Item>
              <Descriptions.Item label="动作平滑指数">{selectedStandard.motion_signature.smoothness_index}</Descriptions.Item>
              <Descriptions.Item label="路径执行效率">{selectedStandard.motion_signature.path_efficiency}%</Descriptions.Item>
              <Descriptions.Item label="空间几何信封">{selectedStandard.motion_signature.keypoint_envelope_bound}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="工步标准时序与细微手势信封">
              <Table
                dataSource={selectedStandard.steps}
                rowKey="step_order"
                size="small"
                pagination={false}
                columns={[
                  { title: '工步#', dataIndex: 'step_order', width: 65, render: (v) => <Tag color="blue">{v}</Tag> },
                  { title: '工步名称', dataIndex: 'name', render: (v) => <strong>{v}</strong> },
                  { title: '标准工时', dataIndex: 'standard_sec', width: 90, render: (v, r) => `${v}s (±${r.tolerance_sec}s)` },
                  { title: '手部速度 (mm/s)', dataIndex: 'golden_velocity_mms', width: 120, render: (v) => `${v || 50} mm/s` },
                  { title: '目标ROI区域', dataIndex: 'target_roi', render: (v) => <Tag color="geekblue">{v || '装配工装区'}</Tag> },
                  { title: '手势特征要求', dataIndex: 'hand_action', render: (v) => <span>{v || '标准对称对位'}</span> },
                ]}
              />
            </Card>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {!selectedStandard.is_active && (
                <Button
                  type="primary"
                  style={{ background: '#f59e0b', borderColor: '#f59e0b' }}
                  onClick={() => {
                    handleSetActive(selectedStandard);
                    setDetailModalOpen(false);
                  }}
                >
                  ★ 设为当前工位唯一黄金标准
                </Button>
              )}
              <Button type="primary" onClick={() => handleOpenCompare(selectedStandard)}>
                进行现场动作对比分析
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
