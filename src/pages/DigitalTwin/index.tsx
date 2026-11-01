import React from 'react';
import { Typography, Breadcrumb, Space, Tag } from 'antd';
import { DesktopOutlined, HomeOutlined, EyeOutlined } from '@ant-design/icons';
import { DigitalTwin3DStudio } from '../HandActionLab/DigitalTwin3DStudio';

const { Title, Paragraph } = Typography;

export const DigitalTwinPage: React.FC = () => {
  return (
    <div style={{ padding: '20px 24px', minHeight: 'calc(100vh - 64px)' }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { title: <Space><HomeOutlined />首页</Space>, href: '/' },
          { title: '视觉算法与质检实验室' },
          { title: 'WebGL 3D 数字孪生工位' },
        ]}
        style={{ marginBottom: 12 }}
      />

      {/* Page Title & Intro */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DesktopOutlined style={{ color: '#0284c7' }} />
            沉浸式 WebGL 3D 数字孪生工位与相机视场干涉演练系统
            <Tag color="cyan">Three.js PBR 实时渲染</Tag>
            <Tag color="gold">双目空间视场重叠 (86.4%)</Tag>
            <Tag color="red">33.3ms PLC 物理硬联锁</Tag>
          </Title>
          <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 13 }}>
            面向工业 4.0 高端制造产线，构建毫米级精度 3D 虚拟装配工作台、传送带导轨、双作用冲压气缸与双目相机光锥覆盖模型。支持 21 关节物理骨骼实时镜像、45mm 安全光幕与机构干涉实时计算。
          </Paragraph>
        </div>
      </div>

      {/* Studio Component */}
      <DigitalTwin3DStudio />
    </div>
  );
};

export default DigitalTwinPage;
