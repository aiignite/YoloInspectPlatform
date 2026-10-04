import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Button,
  Table,
  Space,
  Typography,
  message,
  Divider,
  Input,
  Modal,
  Alert,
  Badge,
} from 'antd';
import {
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  KeyOutlined,
  FieldTimeOutlined,
  DisconnectOutlined,
  ApiOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import api from '../../utils/api';
import { PlcStatusPayload, PlcRegisterMap, InterlockEventRecord } from '../../types/plc';

const { Text } = Typography;

export const PlcInterlockStudio: React.FC = () => {
  const [plcStatus, setPlcStatus] = useState<PlcStatusPayload | null>(null);
  const [history, setHistory] = useState<InterlockEventRecord[]>([]);
  const [leaderBadge, setLeaderBadge] = useState<string>('TL-8820');
  const [leaderName, setLeaderName] = useState<string>('张工 (制造班长)');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchPlcStatus();
    fetchHistory();
    const interval = setInterval(fetchPlcStatus, 800);
    return () => clearInterval(interval);
  }, []);

  const fetchPlcStatus = async () => {
    try {
      const res = await api.get('/plc/status');
      if (res.data?.success) {
        setPlcStatus(res.data.data);
      }
    } catch {
      // silent
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/plc/interlock-history');
      if (res.data?.success) {
        setHistory(res.data.data);
      }
    } catch {
      // silent
    }
  };

  const handleTriggerInterlock = async (type: 'POKA_YOKE' | 'EMERGENCY_STOP') => {
    try {
      setIsLoading(true);
      const reason =
        type === 'EMERGENCY_STOP'
          ? '手指探入机械剪切行程区 (<30mm)'
          : '元件微插装工步未完成即试图流转 (动作严重偏差)';
      const res = await api.post('/plc/trigger-interlock', { type, reason });
      if (res.data?.success) {
        message.warning(`【PLC现场总线】已下发硬联锁控制字！机构已在 33.3ms 内完成物理断电切断！`);
        fetchPlcStatus();
        fetchHistory();
      }
    } catch {
      message.error('下发联锁指令失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReleaseInterlock = async () => {
    try {
      setIsLoading(true);
      const res = await api.post('/plc/release-interlock', {
        badgeId: leaderBadge,
        operatorName: leaderName,
      });
      if (res.data?.success) {
        message.success(res.data.message);
        fetchPlcStatus();
        fetchHistory();
      }
    } catch {
      message.error('刷卡解除联锁失败');
    } finally {
      setIsLoading(false);
    }
  };

  const isInterlocked = plcStatus?.isInterlocked;
  const isEstop = plcStatus?.interlockMode === 'EMERGENCY_STOP';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 1. Hardware Relay State & Interlock Banner */}
      <Card
        size="small"
        style={{
          background: isEstop
            ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
            : isInterlocked
            ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
            : 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
          border: isEstop
            ? '2px solid #ef4444'
            : isInterlocked
            ? '2px solid #f59e0b'
            : '1px solid #86efac',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Space>
            <SafetyCertificateOutlined
              style={{
                fontSize: 20,
                color: isEstop ? '#ef4444' : isInterlocked ? '#f59e0b' : '#16a34a',
              }}
            />
            <Text
              strong
              style={{
                fontSize: 15,
                color: isEstop ? '#991b1b' : isInterlocked ? '#92400e' : '#166534',
              }}
            >
              {isEstop
                ? '🚨 危险探入急停触发 · 机械模具气阀泄压断电'
                : isInterlocked
                ? '🔴 视觉动作防呆触发 · 下压气缸与出板电机已断电锁死'
                : '🟢 现场总线通信正常 · 物理安全继电器回路闭合'}
            </Text>
          </Space>
          <Tag color={isInterlocked ? 'error' : 'success'} style={{ fontWeight: 'bold' }}>
            {isInterlocked ? '● 物理机构已切断' : '● 正常通电放行'}
          </Tag>
        </div>

        {/* 4-Channel Relay Physical Outputs */}
        <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
            <strong>工业数字量 I/O 卡 (研华 USB-4750) 8路光耦隔离继电器干接点物理状态:</strong>
          </div>
          <Row gutter={[8, 8]}>
            <Col span={6}>
              <div style={{ fontSize: 11 }}>
                Y001 下压气缸阀 (24V):{' '}
                <Tag color={plcStatus?.activeRelayOutputs?.Y001_Cylinder_Down ? 'green' : 'red'}>
                  {plcStatus?.activeRelayOutputs?.Y001_Cylinder_Down ? '供电正常' : '已断电切断'}
                </Tag>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 11 }}>
                Y002 出板步进电机:{' '}
                <Tag color={plcStatus?.activeRelayOutputs?.Y002_Outfeed_Conveyor ? 'green' : 'red'}>
                  {plcStatus?.activeRelayOutputs?.Y002_Outfeed_Conveyor ? '允许步进' : '电机抱闸停止'}
                </Tag>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 11 }}>
                Y003 治具锁定销:{' '}
                <Tag color="blue">电磁销紧扣</Tag>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 11 }}>
                Y004 Andon蜂鸣红灯:{' '}
                <Tag color={plcStatus?.activeRelayOutputs?.Y004_Andon_Red_Siren ? 'error' : 'default'}>
                  {plcStatus?.activeRelayOutputs?.Y004_Andon_Red_Siren ? '警报长鸣' : '熄灭'}
                </Tag>
              </div>
            </Col>
          </Row>
        </div>
      </Card>

      {/* 2. ISO 13849-1 Total Cut-off Latency Breakdown (33.3ms) */}
      <Card
        size="small"
        title={
          <Space>
            <FieldTimeOutlined style={{ color: '#0284c7' }} />
            <span>ISO 13849-1 毫秒级物理切断全链路时延分解 (PLd / Category 3)</span>
          </Space>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, background: '#f8fafc', padding: 8, borderRadius: 6 }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 10, color: '#64748b' }}>① 边缘视觉推理</div>
            <div style={{ fontWeight: 'bold', color: '#16a34a' }}>2.1 ms</div>
            <div style={{ fontSize: 9, color: '#94a3b8' }}>TensorRT INT8</div>
          </div>
          <div style={{ color: '#cbd5e1' }}>+</div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 10, color: '#64748b' }}>② 现场总线通讯</div>
            <div style={{ fontWeight: 'bold', color: '#0284c7' }}>6.2 ms</div>
            <div style={{ fontSize: 9, color: '#94a3b8' }}>Modbus TCP (502)</div>
          </div>
          <div style={{ color: '#cbd5e1' }}>+</div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 10, color: '#64748b' }}>③ PLC 梯形图扫描</div>
            <div style={{ fontWeight: 'bold', color: '#8b5cf6' }}>10.0 ms</div>
            <div style={{ fontSize: 9, color: '#94a3b8' }}>西门子 S7-1500</div>
          </div>
          <div style={{ color: '#cbd5e1' }}>+</div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 10, color: '#64748b' }}>④ 气阀线圈断电</div>
            <div style={{ fontWeight: 'bold', color: '#ef4444' }}>15.0 ms</div>
            <div style={{ fontSize: 9, color: '#94a3b8' }}>电磁泄压复位</div>
          </div>
          <div style={{ color: '#cbd5e1' }}>=</div>
          <div style={{ textAlign: 'center', flex: 1.2, background: '#ecfdf5', padding: '4px 6px', borderRadius: 4, border: '1px solid #86efac' }}>
            <div style={{ fontSize: 10, color: '#166534', fontWeight: 'bold' }}>物理切断总耗时</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#16a34a' }}>33.3 ms</div>
            <div style={{ fontSize: 9, color: '#166534' }}>人体位移仅 5.3cm</div>
          </div>
        </div>
      </Card>

      {/* 3. Interactive Trigger & Release Controls */}
      <Card
        size="small"
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#ef4444' }} />
            <span>防呆联锁现场仿真与班长刷卡放行 (Interlock Controls)</span>
          </Space>
        }
      >
        <Row gutter={[12, 12]}>
          <Col span={12}>
            <div style={{ background: '#fef2f2', padding: 10, borderRadius: 6, border: '1px solid #fecaca' }}>
              <Text strong style={{ color: '#b91c1c', fontSize: 12, display: 'block', marginBottom: 4 }}>
                模拟视觉偏差与危险探入:
              </Text>
              <Space wrap>
                <Button
                  danger
                  size="small"
                  type="primary"
                  loading={isLoading}
                  onClick={() => handleTriggerInterlock('POKA_YOKE')}
                >
                  ⚡ 模拟动作跳步强制联锁
                </Button>
                <Button
                  danger
                  size="small"
                  loading={isLoading}
                  onClick={() => handleTriggerInterlock('EMERGENCY_STOP')}
                >
                  🚨 模拟危险区探入急停
                </Button>
              </Space>
            </div>
          </Col>

          <Col span={12}>
            <div style={{ background: '#f0fdf4', padding: 10, borderRadius: 6, border: '1px solid #bbf7d0' }}>
              <Text strong style={{ color: '#166534', fontSize: 12, display: 'block', marginBottom: 4 }}>
                班组长物理钥匙旋转 / RFID 刷卡放行:
              </Text>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Input
                  size="small"
                  style={{ width: 100 }}
                  value={leaderBadge}
                  onChange={(e) => setLeaderBadge(e.target.value)}
                />
                <Button
                  type="primary"
                  size="small"
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                  icon={<KeyOutlined />}
                  disabled={!isInterlocked}
                  loading={isLoading}
                  onClick={handleReleaseInterlock}
                >
                  刷卡放行并复位机构
                </Button>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 4. Live PLC Registers Table */}
      <Card
        size="small"
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <ApiOutlined style={{ color: '#0284c7' }} />
              <span>PLC Modbus TCP 寄存器映射实时监视 (端口 502)</span>
            </Space>
            <Tag color="blue">{plcStatus?.plcBrand || 'Siemens S7-1500'}</Tag>
          </div>
        }
      >
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '4px 6px' }}>寄存器</th>
                <th style={{ padding: '4px 6px' }}>信号标识</th>
                <th style={{ padding: '4px 6px' }}>读/写</th>
                <th style={{ padding: '4px 6px' }}>当前值 (HEX/DEC)</th>
                <th style={{ padding: '4px 6px' }}>业务含义</th>
              </tr>
            </thead>
            <tbody>
              {plcStatus?.registers?.map((reg) => (
                <tr key={reg.address} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px 6px', fontWeight: 'bold' }}>{reg.address}</td>
                  <td style={{ padding: '4px 6px', fontFamily: 'monospace', color: '#0284c7' }}>
                    {reg.name}
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <Tag color={reg.access === 'W' ? 'geekblue' : 'green'} style={{ fontSize: 9 }}>
                      {reg.access === 'W' ? '视觉写' : '视觉读'}
                    </Tag>
                  </td>
                  <td style={{ padding: '4px 6px', fontWeight: 'bold' }}>
                    <span style={{ color: reg.value > 0 ? (reg.address === 40004 || reg.address === 40005 ? '#ef4444' : '#16a34a') : '#64748b' }}>
                      {reg.value}
                    </span>
                  </td>
                  <td style={{ padding: '4px 6px', color: '#64748b', fontSize: 10 }}>
                    {reg.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
