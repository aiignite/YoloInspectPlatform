import React, { useState } from 'react';
import {
  Drawer,
  Steps,
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Button,
  Table,
  Space,
  Typography,
  Divider,
  InputNumber,
  message,
  Alert,
  Tooltip,
} from 'antd';
import {
  VideoCameraOutlined,
  DeploymentUnitOutlined,
  SlidersOutlined,
  SafetyCertificateOutlined,
  RocketOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  EditOutlined,
  SaveOutlined,
  ReloadOutlined,
  BookOutlined,
  ThunderboltOutlined,
  AimOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

const { Title, Text, Paragraph } = Typography;

interface SopStepItem {
  step_order: number;
  step_name: string;
  standard_sec: number;
  tolerance_sec: number;
  target_roi_name: string;
  hand_action: string;
  critical_check: string;
  poka_yoke: string;
}

interface SopPipelineDrawerProps {
  open: boolean;
  onClose: () => void;
  activeSpecification: any;
  onSpecificationUpdated: (updatedSpec: any) => void;
}

export const SopPipelineDrawer: React.FC<SopPipelineDrawerProps> = ({
  open,
  onClose,
  activeSpecification,
  onSpecificationUpdated,
}) => {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  // Local editable copy of steps
  const defaultSteps: SopStepItem[] = [
    {
      step_order: 1,
      step_name: '物料盒取料对位',
      standard_sec: 2.2,
      tolerance_sec: 0.5,
      target_roi_name: '料盒1号区 (0402电容)',
      hand_action: '精密双指捏取 (Pinch)',
      critical_check: '严禁越界进入料盒2',
      poka_yoke: '光纤感应取料闭环',
    },
    {
      step_order: 2,
      step_name: '机械手吸附电容并下压',
      standard_sec: 4.8,
      tolerance_sec: 0.8,
      target_roi_name: '主装配工装基准区 (Assembly Nest)',
      hand_action: '垂直精准对齐并压紧',
      critical_check: '对准标记焊盘，平稳下压',
      poka_yoke: '下压深度≥4.0mm持压0.8s',
    },
    {
      step_order: 3,
      step_name: '电批锁螺丝',
      standard_sec: 3.5,
      tolerance_sec: 0.5,
      target_roi_name: '智能工具停靠区 (TOOL_DOCK)',
      hand_action: '工具稳固握持 (Tool Grasp)',
      critical_check: '电批离架到位，拧紧螺钉',
      poka_yoke: '扭矩达到0.35N·m信号',
    },
    {
      step_order: 4,
      step_name: '条码扫描自检',
      standard_sec: 2.0,
      tolerance_sec: 0.4,
      target_roi_name: '条码扫码自检区 (SCANNER)',
      hand_action: '双手平稳托举PCB',
      critical_check: '条码正对识读窗口',
      poka_yoke: '扫码成功蜂鸣与MES过站',
    },
  ];

  const [steps, setSteps] = useState<SopStepItem[]>(
    activeSpecification?.steps || defaultSteps
  );

  React.useEffect(() => {
    if (activeSpecification?.steps?.length) {
      setSteps(activeSpecification.steps);
    }
  }, [activeSpecification]);

  const handleToleranceChange = (order: number, newTol: number | null) => {
    if (newTol == null) return;
    setSteps((prev) =>
      prev.map((s) => (s.step_order === order ? { ...s, tolerance_sec: newTol } : s))
    );
  };

  const handleStandardSecChange = (order: number, newSec: number | null) => {
    if (newSec == null) return;
    setSteps((prev) =>
      prev.map((s) => (s.step_order === order ? { ...s, standard_sec: newSec } : s))
    );
  };

  const handleSaveAndHotDeploy = async () => {
    setIsSaving(true);
    try {
      const totalCycle = +(steps.reduce((acc, s) => acc + (s.standard_sec || 2.5), 0)).toFixed(1);
      const updated = {
        ...activeSpecification,
        total_cycle_sec: totalCycle,
        steps,
        updated_at: new Date().toISOString(),
      };
      await api.post('/sop-monitor/publish-specification', updated);
      message.success('已完成工步参数微调，产线在线监控已即刻热生效！');
      onSpecificationUpdated(updated);
    } catch {
      message.error('热下发配置失败，已在本地生效');
      onSpecificationUpdated({
        ...activeSpecification,
        steps,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const columns = [
    {
      title: '工步序号',
      dataIndex: 'step_order',
      key: 'step_order',
      width: 90,
      render: (val: number) => <Tag color="blue">工步 {val}</Tag>,
    },
    {
      title: '工步动作名称',
      dataIndex: 'step_name',
      key: 'step_name',
      render: (val: string, record: SopStepItem) => (
        <div>
          <Text strong style={{ color: '#0f172a' }}>{val}</Text>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            动作类型: <Tag color="cyan" style={{ fontSize: 10 }}>{record.hand_action}</Tag>
          </div>
        </div>
      ),
    },
    {
      title: '标准工时 (s)',
      dataIndex: 'standard_sec',
      key: 'standard_sec',
      width: 130,
      render: (val: number, record: SopStepItem) => (
        <InputNumber
          size="small"
          min={0.5}
          max={60}
          step={0.1}
          value={val}
          onChange={(v) => handleStandardSecChange(record.step_order, v)}
          addonAfter="s"
        />
      ),
    },
    {
      title: '允许公差 ± (s)',
      dataIndex: 'tolerance_sec',
      key: 'tolerance_sec',
      width: 140,
      render: (val: number, record: SopStepItem) => (
        <InputNumber
          size="small"
          min={0.1}
          max={10}
          step={0.1}
          value={val}
          onChange={(v) => handleToleranceChange(record.step_order, v)}
          addonAfter="s"
        />
      ),
    },
    {
      title: '目标区域 (ROI)',
      dataIndex: 'target_roi_name',
      key: 'target_roi_name',
      render: (val: string) => (
        <Space>
          <AimOutlined style={{ color: '#10b981' }} />
          <Text style={{ fontSize: 12 }}>{val}</Text>
        </Space>
      ),
    },
    {
      title: 'Poka-Yoke 防呆控制要点',
      dataIndex: 'poka_yoke',
      key: 'poka_yoke',
      render: (val: string) => <Tag color="purple">{val || '防呆联锁保护'}</Tag>,
    },
  ];

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <DeploymentUnitOutlined style={{ color: '#0284c7' }} />
            <span style={{ fontWeight: 600 }}>SOP 视频学习到产线监控全流程闭环控制中心</span>
          </Space>
          <Tag color="cyan">高效便捷流水线 Rev.2.0</Tag>
        </div>
      }
      placement="right"
      size={860}
      open={open}
      onClose={onClose}
      destroyOnHidden
      extra={
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={isSaving}
            onClick={handleSaveAndHotDeploy}
          >
            保存并即刻热生效
          </Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 4-Stage Lifecycle Stepper */}
        <Card size="small" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 10, color: '#334155' }}>
            标准作业规范全生命周期流转状态 (SOP End-to-End Pipeline):
          </Text>
          <Steps
            size="small"
            current={3}
            items={[
              {
                title: '1. 示范视频采集',
                content: '标杆操作员循环录像',
                icon: <VideoCameraOutlined />,
              },
              {
                title: '2. AI 动作分解',
                content: '骨骼拐点与工步切分',
                icon: <DeploymentUnitOutlined />,
              },
              {
                title: '3. 敏捷微调与绑定',
                content: '节拍公差与ROI防呆',
                icon: <SlidersOutlined />,
              },
              {
                title: '4. 产线监控与联锁',
                content: '在线监控中 (Active)',
                icon: <SafetyCertificateOutlined />,
              },
            ]}
          />
        </Card>

        {/* Current Active SOP Overview */}
        <Row gutter={[12, 12]}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="当前受控作业规程"
                value={activeSpecification?.template_name || 'SMT高精插件与紧固SOP'}
                styles={{ content: { fontSize: 14, fontWeight: 'bold', color: '#0284c7' } }}
              />
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                编号: {activeSpecification?.doc_no || 'SOP-SMT-A03'}
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="标准单件节拍 (Takt Time)"
                value={+(steps.reduce((acc, s) => acc + (s.standard_sec || 2.5), 0)).toFixed(1)}
                suffix="秒/件"
                styles={{ content: { fontSize: 18, fontWeight: 'bold', color: '#16a34a' } }}
              />
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                工步数量: {steps.length} 个原子动作
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="编制与签发单位"
                value="工艺部 IE工程科"
                styles={{ content: { fontSize: 14, color: '#8b5cf6' } }}
              />
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                质量体系: ISO 9001 / IATF 16949
              </div>
            </Card>
          </Col>
        </Row>

        {/* Quick Links & Fast Actions */}
        <Alert
          type="info"
          showIcon
          title="现场工艺便捷操作提醒"
          description={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 12 }}>
                下方可以直接微调每个工步的「标准工时」与「允许公差」。若需重新上传视频学习或深度标注关键帧，可点击右侧快捷按钮。
              </span>
              <Space>
                <Button
                  size="small"
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => {
                    onClose();
                    navigate('/video-learning');
                  }}
                >
                  前往示范视频分解工作台
                </Button>
              </Space>
            </div>
          }
        />

        {/* Editable Steps Table */}
        <Card
          size="small"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <SlidersOutlined style={{ color: '#0284c7' }} /> 当前工位加载的工步动作质量控制矩阵 (可现场微调)
              </span>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => setSteps(defaultSteps)}
              >
                重置为示教原始值
              </Button>
            </div>
          }
        >
          <Table
            dataSource={steps}
            columns={columns}
            rowKey="step_order"
            pagination={false}
            size="small"
          />
        </Card>

        {/* Closed-loop Poka-Yoke Rules Card */}
        <Card size="small" title="智能防呆联锁保障机制 (Closed-Loop Poka-Yoke)">
          <Row gutter={[10, 10]}>
            <Col span={12}>
              <div style={{ background: '#f0fdf4', padding: 10, borderRadius: 6, border: '1px solid #bbf7d0', fontSize: 12 }}>
                <Text strong style={{ color: '#166534', display: 'block' }}>✔ 毫秒级跳步与错序阻断</Text>
                <span style={{ color: '#15803d' }}>未检测到第 N 步有效完成信号前，强制锁死后续治具夹紧与放行，防止漏装元件流入下一工位。</span>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ background: '#eff6ff', padding: 10, borderRadius: 6, border: '1px solid #bfdbfe', fontSize: 12 }}>
                <Text strong style={{ color: '#1e40af', display: 'block' }}>✔ 节拍超差自适应容错</Text>
                <span style={{ color: '#1d4ed8' }}>单步耗时超出允许公差时触发 Andon 黄灯提示，连续超差自动提示现场班长介入，不打断正常流线。</span>
              </div>
            </Col>
          </Row>
        </Card>
      </div>
    </Drawer>
  );
};

export default SopPipelineDrawer;
