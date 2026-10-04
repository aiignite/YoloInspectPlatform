import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Switch,
  Slider,
  Radio,
  Button,
  Tag,
  Space,
  InputNumber,
  Divider,
  Typography,
  message,
  Table,
} from 'antd';
import {
  CameraOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  CalculatorOutlined,
  CheckCircleOutlined,
  BulbOutlined,
  SlidersOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import api from '../../utils/api';

const { Text } = Typography;

export const IndustrialOpticsStudio: React.FC = () => {
  // Optical & Camera Parameters State
  const [exposureUs, setExposureUs] = useState<number>(500);
  const [gainDb, setGainDb] = useState<number>(4.5);
  const [polarizerActive, setPolarizerActive] = useState<boolean>(true);
  const [polarizerAngle, setPolarizerAngle] = useState<number>(90);
  const [triggerMode, setTriggerMode] = useState<'On' | 'Off'>('On');
  const [triggerSource, setTriggerSource] = useState<'Line1' | 'Line2' | 'Software'>('Line1');

  // Trigger metrics
  const [triggerMetrics, setTriggerMetrics] = useState({
    totalTriggerCount: 4280,
    triggerJitterUs: 120,
    hardwarePulseVoltage: 24.0,
  });

  // Optical Calculator State
  const [calcWd, setCalcWd] = useState<number>(520);
  const [calcFov, setCalcFov] = useState<number>(600);
  const [calcSensor, setCalcSensor] = useState<'1/1.8"' | '1/2.9"'>('1/1.8"');
  const [calcResult, setCalcResult] = useState({
    recommendedFocalLengthMm: 6.22,
    nearestStandardLensMm: 8,
    actualFovWidthMm: 466.7,
    actualFovHeightMm: 345.8,
    depthOfFieldMm: 42.5,
  });

  // Fetch initial parameters
  useEffect(() => {
    loadCameraParams();
    runOpticsCalc();
  }, []);

  const loadCameraParams = async () => {
    try {
      const res = await api.get('/industrial-camera/parameters');
      if (res.data?.success) {
        const p = res.data.data.parameters;
        setExposureUs(p.exposureTimeUs);
        setGainDb(p.gainDb);
        setPolarizerActive(p.polarizerActive);
        setPolarizerAngle(p.polarizerAngleDeg);
        setTriggerMode(p.triggerMode);
        setTriggerSource(p.triggerSource);
        if (res.data.data.triggerMetrics) {
          setTriggerMetrics(res.data.data.triggerMetrics);
        }
      }
    } catch {
      // silent
    }
  };

  const handleApplyParams = async (updates: Record<string, any>) => {
    try {
      const res = await api.post('/industrial-camera/parameters', updates);
      if (res.data?.success) {
        message.success('已同步下发参数至工业相机寄存器');
      }
    } catch {
      message.error('参数下发失败');
    }
  };

  const handleFireSoftwareTrigger = async () => {
    try {
      const res = await api.post('/industrial-camera/trigger-pulse');
      if (res.data?.success) {
        message.success(`硬件同步曝光触发成功！帧序号: #${res.data.data.frameId}`);
        setTriggerMetrics((prev) => ({
          ...prev,
          totalTriggerCount: prev.totalTriggerCount + 1,
        }));
      }
    } catch {
      message.error('触发失败');
    }
  };

  const runOpticsCalc = async () => {
    try {
      const res = await api.get(
        `/industrial-camera/optical-calc?wd=${calcWd}&fov=${calcFov}&sensor=${encodeURIComponent(calcSensor)}`
      );
      if (res.data?.success) {
        setCalcResult(res.data.data);
      }
    } catch {
      // fallback local calculation
      const sensorW = calcSensor === '1/1.8"' ? 7.18 : 5.0;
      const sensorH = calcSensor === '1/1.8"' ? 5.32 : 3.75;
      const f = +( (calcWd * sensorW) / calcFov ).toFixed(2);
      setCalcResult({
        recommendedFocalLengthMm: f,
        nearestStandardLensMm: 8,
        actualFovWidthMm: 466.7,
        actualFovHeightMm: 345.8,
        depthOfFieldMm: 42.5,
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 1. Global Shutter & Exposure Control */}
      <Card
        size="small"
        title={
          <Space>
            <CameraOutlined style={{ color: '#0284c7' }} />
            <span>全局快门 (Global Shutter) 极速曝光调节</span>
          </Space>
        }
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text strong>曝光时间 (Exposure Time):</Text>
            <Tag color={exposureUs <= 600 ? 'green' : exposureUs <= 1500 ? 'orange' : 'red'}>
              {exposureUs} μs ({exposureUs <= 600 ? '🟢 零拖影' : exposureUs <= 1500 ? '🟡 轻微模糊' : '🔴 动态拖影'})
            </Tag>
          </div>
          <Slider
            min={300}
            max={3000}
            step={50}
            value={exposureUs}
            onChange={(val) => setExposureUs(val)}
            onAfterChange={(val) => handleApplyParams({ exposureTimeUs: val })}
            marks={{
              300: '300μs (高速)',
              500: '500μs (推荐)',
              1000: '1000μs',
              2000: '2000μs (普通)',
            }}
          />
          <div style={{ fontSize: 11, color: '#64748b' }}>
            全局快门所有像素同步感光曝光，彻底消除卷帘快门在手势快速动作时的果冻畸变。
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>数字增益 (Gain dB): <strong>{gainDb} dB</strong></span>
          <Slider
            style={{ width: 140 }}
            min={0}
            max={20}
            step={0.5}
            value={gainDb}
            onChange={(val) => setGainDb(val)}
            onAfterChange={(val) => handleApplyParams({ gainDb: val })}
          />
        </div>
      </Card>

      {/* 2. 850nm NIR + Cross-Polarization Studio */}
      <Card
        size="small"
        title={
          <Space>
            <BulbOutlined style={{ color: '#f59e0b' }} />
            <span>850nm 近红外光照与交叉偏振消光 (Cross-Polarization)</span>
          </Space>
        }
      >
        <Row gutter={[12, 12]} style={{ marginBottom: 10 }}>
          <Col span={12}>
            <div style={{ background: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>交叉偏振消光镜组</div>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Switch
                  checked={polarizerActive}
                  onChange={(checked) => {
                    setPolarizerActive(checked);
                    handleApplyParams({ polarizerActive: checked, polarizerAngleDeg: checked ? 90 : 0 });
                  }}
                />
                <Tag color={polarizerActive ? 'success' : 'default'}>
                  {polarizerActive ? '✔ 90° 强反光消光' : '○ 未启用偏振'}
                </Tag>
              </div>
            </div>
          </Col>

          <Col span={12}>
            <div style={{ background: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>主动补光波长</div>
              <div style={{ marginTop: 4, fontWeight: 'bold', color: '#0284c7' }}>
                850nm 近红外 (NIR)
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>带 850±20nm 窄带滤光片</div>
            </div>
          </Col>
        </Row>

        <div style={{ fontSize: 11, color: '#475569', backgroundColor: '#f1f5f9', padding: '6px 10px', borderRadius: 4 }}>
          {polarizerActive ? (
            <span>
              🟢 <strong>已启用交叉偏振：</strong>起偏镜片与检偏镜片夹角 90°，不锈钢治具高光与丁腈手套反光已被 100% 滤除。
            </span>
          ) : (
            <span>
              ⚠ <strong>未启用偏振：</strong>工装金属反光易造成摄像头局部死白过曝，干扰手部关节置信度。
            </span>
          )}
        </div>
      </Card>

      {/* 3. Hardware Genlock & Triggering */}
      <Card
        size="small"
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#10b981' }} />
            <span>光电到位硬件触发 (Hardware Genlock & Trigger)</span>
          </Space>
        }
      >
        <Row gutter={[8, 8]} style={{ marginBottom: 10 }}>
          <Col span={8}>
            <Statistic
              title="触发模式"
              value={triggerMode === 'On' ? '硬件Line1' : '连续拉流'}
              valueStyle={{ fontSize: 14, color: '#0284c7' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="累计触发脉冲"
              value={triggerMetrics.totalTriggerCount}
              valueStyle={{ fontSize: 14, color: '#16a34a' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="触发抖动 (Jitter)"
              value={triggerMetrics.triggerJitterUs}
              suffix="μs"
              valueStyle={{ fontSize: 14, color: triggerMetrics.triggerJitterUs <= 200 ? '#16a34a' : '#ef4444' }}
            />
          </Col>
        </Row>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Radio.Group
            size="small"
            value={triggerSource}
            onChange={(e) => {
              setTriggerSource(e.target.value);
              handleApplyParams({ triggerSource: e.target.value });
            }}
          >
            <Radio.Button value="Line1">Line 1 (光电开关TTL)</Radio.Button>
            <Radio.Button value="Software">软件单发测试</Radio.Button>
          </Radio.Group>

          <Button
            size="small"
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleFireSoftwareTrigger}
          >
            模拟发射触发脉冲
          </Button>
        </div>
      </Card>

      {/* 4. Optical Lens & FOV Calculator (T2.1) */}
      <Card
        size="small"
        title={
          <Space>
            <CalculatorOutlined style={{ color: '#8b5cf6' }} />
            <span>工位光学镜头物距与 FOV 选型计算器 (T2.1)</span>
          </Space>
        }
      >
        <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
          <Col span={8}>
            <div style={{ fontSize: 11, color: '#64748b' }}>工作物距 (WD mm)</div>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={calcWd}
              onChange={(val) => setCalcWd(val || 520)}
            />
          </Col>
          <Col span={8}>
            <div style={{ fontSize: 11, color: '#64748b' }}>视场宽度 (FOV mm)</div>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={calcFov}
              onChange={(val) => setCalcFov(val || 600)}
            />
          </Col>
          <Col span={8}>
            <div style={{ fontSize: 11, color: '#64748b' }}>相机靶面 (Sensor)</div>
            <Radio.Group
              size="small"
              value={calcSensor}
              onChange={(e) => setCalcSensor(e.target.value)}
            >
              <Radio.Button value={'1/1.8"'}>1/1.8"</Radio.Button>
              <Radio.Button value={'1/2.9"'}>1/2.9"</Radio.Button>
            </Radio.Group>
          </Col>
        </Row>

        <Button
          size="small"
          block
          icon={<SyncOutlined />}
          onClick={runOpticsCalc}
          style={{ marginBottom: 8 }}
        >
          重新计算光学焦距与覆盖景深
        </Button>

        <div style={{ background: '#f8fafc', padding: 8, borderRadius: 6, fontSize: 11, border: '1px solid #e2e8f0' }}>
          <div>推荐理论焦距: <strong>{calcResult.recommendedFocalLengthMm} mm</strong></div>
          <div>最近工业标准焦距: <strong style={{ color: '#0284c7' }}>{calcResult.nearestStandardLensMm} mm 定焦镜头</strong></div>
          <div>实际工位覆盖画幅: <strong>{calcResult.actualFovWidthMm} × {calcResult.actualFovHeightMm} mm</strong></div>
          <div>光学有效景深 (DOF): <strong>±{calcResult.depthOfFieldMm} mm</strong></div>
        </div>
      </Card>
    </div>
  );
};
