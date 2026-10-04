import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Radio,
  Space,
  Button,
  Tooltip,
  Typography,
  Badge,
} from 'antd';
import {
  LineChartOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  AimOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts';

const { Text } = Typography;

export interface ConfidenceTrendPoint {
  timeStr: string;
  timeSec: number;
  confidence: number; // 0 - 100
  threshold: number; // 0 - 100
  pinchDistanceMm: number;
  stabilityScore: number;
  actionName: string;
  isCompliant: boolean;
}

interface ConfidenceTrendDashboardProps {
  data: ConfidenceTrendPoint[];
  currentActionName: string;
  currentConfidence: number; // 0 - 100
  currentPinchMm: number;
  stabilityScore: number;
  threshold?: number;
  onClearHistory?: () => void;
  isPaused?: boolean;
  onTogglePause?: () => void;
}

export const ConfidenceTrendDashboard: React.FC<ConfidenceTrendDashboardProps> = ({
  data,
  currentActionName,
  currentConfidence,
  currentPinchMm,
  stabilityScore,
  threshold = 80,
  onClearHistory,
  isPaused = false,
  onTogglePause,
}) => {
  const [metricView, setMetricView] = useState<'confidence' | 'pinch' | 'stability'>('confidence');

  // Compute stats across current buffer
  const sampleCount = data.length;
  const confValues = data.map((d) => d.confidence);
  const avgConf =
    sampleCount > 0 ? +(confValues.reduce((a, b) => a + b, 0) / sampleCount).toFixed(1) : currentConfidence;
  const peakConf = sampleCount > 0 ? Math.max(...confValues) : currentConfidence;
  const minConf = sampleCount > 0 ? Math.min(...confValues) : currentConfidence;
  const compliantCount = data.filter((d) => d.confidence >= threshold).length;
  const complianceRate =
    sampleCount > 0 ? Math.round((compliantCount / sampleCount) * 100) : 100;

  // Trend direction (compare latest vs 3 points prior)
  const prevPoint = data[Math.max(0, data.length - 4)];
  const delta = prevPoint ? +(currentConfidence - prevPoint.confidence).toFixed(1) : 0;

  // Custom Dark Tooltip
  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item: ConfidenceTrendPoint = payload[0].payload;
      return (
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            border: '1px solid #334155',
            padding: '8px 12px',
            borderRadius: 6,
            color: '#fff',
            fontSize: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>
            采样时刻: <strong>{label}</strong>
          </div>
          <div style={{ color: '#38bdf8', fontWeight: 'bold' }}>
            动作识别: {item.actionName}
          </div>
          <div style={{ margin: '3px 0' }}>
            实时置信度: <strong style={{ color: item.confidence >= threshold ? '#10b981' : '#f59e0b' }}>{item.confidence}%</strong>
            <span style={{ color: '#64748b', marginLeft: 6 }}>
              (基准阈值: {item.threshold}%)
            </span>
          </div>
          <div>
            双指捏距: <strong>{item.pinchDistanceMm} mm</strong> · 空间稳定性: <strong>{item.stabilityScore}%</strong>
          </div>
          <div style={{ marginTop: 4 }}>
            {item.confidence >= threshold ? (
              <Tag color="success" style={{ margin: 0, fontSize: 10 }}>✔ 符合动作标准</Tag>
            ) : (
              <Tag color="warning" style={{ margin: 0, fontSize: 10 }}>⚠ 偏离基准动作</Tag>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card
      size="small"
      style={{
        borderRadius: 8,
        marginTop: 16,
        border: '1px solid #e2e8f0',
        background: '#ffffff',
      }}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space align="center" size={8}>
            <LineChartOutlined style={{ color: '#0284c7', fontSize: 15 }} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              动作对比置信度实时趋势迷你仪表盘 (Live Confidence Trend Monitor)
            </span>
            <Badge status={isPaused ? 'default' : currentConfidence >= threshold ? 'success' : 'warning'} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {isPaused ? '【数据流已暂停】' : `采样点: ${sampleCount} 帧`}
            </Text>
          </Space>

          <Space size={6} wrap>
            <Radio.Group
              size="small"
              value={metricView}
              onChange={(e) => setMetricView(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="confidence">置信度波动曲线</Radio.Button>
              <Radio.Button value="pinch">捏取间距波动</Radio.Button>
              <Radio.Button value="stability">骨骼稳定性</Radio.Button>
            </Radio.Group>

            {onTogglePause && (
              <Tooltip title={isPaused ? '继续采样' : '暂停采样'}>
                <Button
                  size="small"
                  icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                  onClick={onTogglePause}
                />
              </Tooltip>
            )}

            {onClearHistory && (
              <Tooltip title="重置趋势图">
                <Button size="small" icon={<ReloadOutlined />} onClick={onClearHistory} />
              </Tooltip>
            )}
          </Space>
        </div>
      }
    >
      {/* Top 4 KPI Metrics */}
      <Row gutter={[12, 8]} style={{ marginBottom: 10 }}>
        <Col xs={12} sm={6}>
          <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>实时动作置信度</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: currentConfidence >= threshold ? '#0284c7' : '#d97706',
                }}
              >
                {currentConfidence}%
              </span>
              {delta !== 0 && (
                <span style={{ fontSize: 11, color: delta > 0 ? '#16a34a' : '#dc2626' }}>
                  {delta > 0 ? <RiseOutlined /> : <FallOutlined />} {delta > 0 ? `+${delta}%` : `${delta}%`}
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>
              当前: {currentActionName}
            </div>
          </div>
        </Col>

        <Col xs={12} sm={6}>
          <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>滑动窗口均值 / 峰值</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#334155' }}>
              {avgConf}%
              <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b', marginLeft: 4 }}>
                (峰值 {peakConf}%)
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>
              低点波动: {minConf}%
            </div>
          </div>
        </Col>

        <Col xs={12} sm={6}>
          <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>合规受控合格率</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: complianceRate >= 85 ? '#16a34a' : '#d97706' }}>
              {complianceRate}%
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>
              基于基准阈值 (≥{threshold}%)
            </div>
          </div>
        </Col>

        <Col xs={12} sm={6}>
          <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>微动作物理捏距 / 稳定性</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#06b6d4' }}>
              {currentPinchMm} mm
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>
              空间平滑度得分: {stabilityScore}%
            </div>
          </div>
        </Col>
      </Row>

      {/* Recharts Area Chart */}
      <div style={{ width: '100%', height: 160, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="pinchGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="stabGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

            <XAxis
              dataKey="timeStr"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
            />

            <YAxis
              domain={metricView === 'pinch' ? [0, 40] : [50, 100]}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
              unit={metricView === 'pinch' ? 'mm' : '%'}
            />

            <RechartsTooltip content={renderCustomTooltip} />

            {/* Threshold line */}
            {metricView === 'confidence' && (
              <ReferenceLine
                y={threshold}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{
                  value: `合规阈值 (${threshold}%)`,
                  fill: '#d97706',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
            )}

            {metricView === 'pinch' && (
              <ReferenceLine
                y={15}
                stroke="#06b6d4"
                strokeDasharray="4 4"
                label={{
                  value: '捏取上限 (15mm)',
                  fill: '#0891b2',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
            )}

            {/* Area Line */}
            {metricView === 'confidence' && (
              <Area
                type="monotone"
                dataKey="confidence"
                stroke="#0284c7"
                strokeWidth={2.2}
                fillOpacity={1}
                fill="url(#confGrad)"
                isAnimationActive={false}
                dot={{ r: 2, fill: '#0284c7' }}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
              />
            )}

            {metricView === 'pinch' && (
              <Area
                type="monotone"
                dataKey="pinchDistanceMm"
                stroke="#8b5cf6"
                strokeWidth={2.2}
                fillOpacity={1}
                fill="url(#pinchGrad)"
                isAnimationActive={false}
                dot={{ r: 2, fill: '#8b5cf6' }}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
              />
            )}

            {metricView === 'stability' && (
              <Area
                type="monotone"
                dataKey="stabilityScore"
                stroke="#10b981"
                strokeWidth={2.2}
                fillOpacity={1}
                fill="url(#stabGrad)"
                isAnimationActive={false}
                dot={{ r: 2, fill: '#10b981' }}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Summary Bar */}
      <div
        style={{
          marginTop: 6,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: '#64748b',
          borderTop: '1px solid #f1f5f9',
          paddingTop: 6,
        }}
      >
        <span>
          波动状态判定:{' '}
          <strong style={{ color: currentConfidence >= threshold ? '#16a34a' : '#d97706' }}>
            {currentConfidence >= threshold ? '🟢 动作高度稳定且合规 (IN SPEC)' : '🟡 动作存在微量离散或偏离 (SLIGHT DEVIATION)'}
          </strong>
        </span>
        <span>
          基准信封: <strong>±3.5%</strong> · 采样频率: <strong>~3.5 Hz</strong>
        </span>
      </div>
    </Card>
  );
};
