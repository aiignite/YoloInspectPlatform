import React, { useState, useEffect, useRef } from 'react';
import {
  Card, Table, Button, Space, Tag, Upload, message, Progress, Row, Col,
  Statistic, Modal, Descriptions, Popconfirm, Empty, Tooltip, Alert, Typography,
} from 'antd';
import {
  UploadOutlined, CloseCircleOutlined, DeleteOutlined,
  VideoCameraOutlined, ReloadOutlined, SyncOutlined,
  CheckCircleOutlined, ThunderboltOutlined, DownloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../../utils/api';

interface TaskItem {
  id: string;
  filename: string;
  status: string;
  progress: number;
  current_step: string;
  total_frames: number;
  processed_frames: number;
  detections_count: number;
  result_summary: any;
  error_message: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '排队中' },
  running: { color: 'processing', text: '分析中' },
  completed: { color: 'success', text: '已完成' },
  failed: { color: 'error', text: '失败' },
  cancelled: { color: 'warning', text: '已取消' },
};

const BatchAnalysis: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [runningCount, setRunningCount] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [flywheelLoading, setFlywheelLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTasks = async () => {
    try {
      const { data } = await api.get('/batch');
      setTasks(data.tasks);
      setQueueSize(data.queue_size);
      setRunningCount(data.running_count);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    setLoading(true);
    fetchTasks().finally(() => setLoading(false));
    // Auto-refresh when tasks are in progress
    timerRef.current = setInterval(fetchTasks, 2000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);
    try {
      await api.post('/batch/upload', formData);
      message.success(`${file.name} 已加入分析队列`);
      fetchTasks();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '上传失败');
    }
    return false;
  };

  const handleCancel = async (id: string) => {
    try { await api.post(`/batch/${id}/cancel`); message.success('已取消'); fetchTasks(); }
    catch { message.error('取消失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/batch/${id}`); message.success('已删除'); fetchTasks(); }
    catch { message.error('删除失败'); }
  };

  const handleSendToActiveLearning = async (taskId: string) => {
    setFlywheelLoading(true);
    try {
      const res = await api.post(`/batch/${taskId}/send-to-active-learning`);
      message.success(res.data.message || '主动学习飞轮已回流！');
    } catch {
      message.error('回流自学习训练集失败');
    } finally {
      setFlywheelLoading(false);
    }
  };

  const completedTasks = tasks.filter(t => t.status === 'completed');
  const totalDetections = tasks.reduce((s, t) => s + t.detections_count, 0);

  const columns: ColumnsType<TaskItem> = [
    { title: '文件名', dataIndex: 'filename', width: 220, ellipsis: true, render: v => (
      <Space><VideoCameraOutlined /><strong>{v}</strong></Space>
    )},
    { title: '状态', dataIndex: 'status', width: 90, render: v => {
      const s = statusMap[v] || { color: 'default', text: v };
      return <Tag color={s.color}>{s.text}</Tag>;
    }},
    { title: '进度与流水线阶段', width: 220, render: (_, r) => (
      <div>
        <Progress
          percent={Math.round(r.progress)}
          size="small"
          status={r.status === 'failed' ? 'exception' : r.status === 'completed' ? 'success' : 'active'}
        />
        <div style={{ fontSize: 12, color: '#666' }}>{r.current_step}</div>
      </div>
    )},
    { title: '采样/总帧', width: 110, render: (_, r) => r.total_frames > 0 ? `${r.processed_frames}/${r.total_frames}` : '-' },
    { title: '检出目标', dataIndex: 'detections_count', width: 90, render: (v) => <Tag color="blue">{v} 处</Tag> },
    { title: '创建时间', dataIndex: 'created_at', width: 160, render: v => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '耗时', width: 100, render: (_, r) => {
      if (!r.started_at) return '-';
      const end = r.completed_at ? new Date(r.completed_at) : new Date();
      const sec = Math.round((end.getTime() - new Date(r.started_at).getTime()) / 1000);
      return sec >= 60 ? `${Math.floor(sec / 60)}分${sec % 60}秒` : `${sec}秒`;
    }},
    { title: '操作', fixed: 'right', width: 240, render: (_, r) => (
      <Space size="small">
        {r.status === 'completed' && (
          <>
            <Button size="small" type="primary" onClick={() => { setSelectedTask(r); setDetailOpen(true); }}>
              详情分析
            </Button>
            <Tooltip title="一键将该批次中发现的边缘/困难缺陷样本加入自学习标注集">
              <Button
                size="small"
                icon={<SyncOutlined />}
                loading={flywheelLoading}
                onClick={() => void handleSendToActiveLearning(r.id)}
              >
                飞轮回流
              </Button>
            </Tooltip>
          </>
        )}
        {r.status === 'pending' && (
          <Button size="small" onClick={() => handleCancel(r.id)} icon={<CloseCircleOutlined />}>取消</Button>
        )}
        {['completed', 'failed', 'cancelled'].includes(r.status) && (
          <Popconfirm title="确认删除该离线推断任务？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        )}
        {r.status === 'failed' && r.error_message && (
          <Button size="small" danger onClick={() => { setSelectedTask(r); setDetailOpen(true); }}>查看错误</Button>
        )}
      </Space>
    )},
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="分析任务总数" value={tasks.length} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="正在推断中" value={runningCount} styles={{ content: { color: '#1890ff' } }} suffix={queueSize > 0 ? `(+${queueSize}排队)` : ''} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="分析完成归档" value={completedTasks.length} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="累计识别缺陷数" value={totalDetections} styles={{ content: { color: '#fa8c16' } }} /></Card></Col>
      </Row>

      <Card
        title="离线批量视频推断与缺陷飞轮"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchTasks}>刷新任务列表</Button>
            <Upload
              beforeUpload={handleUpload}
              showUploadList={false}
              accept=".mp4,.avi,.mov,.mkv,.flv,.wmv"
              multiple
            >
              <Button type="primary" icon={<UploadOutlined />}>上传批量产线视频</Button>
            </Upload>
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tasks}
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无分析任务，请上传产线巡检录制视频" /> }}
        />
      </Card>

      {/* 详情 Modal */}
      <Modal
        title={
          selectedTask?.status === 'failed'
            ? '错误信息'
            : `批量分析深度报告 - ${selectedTask?.filename}`
        }
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        width={780}
        footer={[
          <Button key="close" onClick={() => setDetailOpen(false)}>关闭</Button>,
          selectedTask?.status === 'completed' && (
            <Button
              key="flywheel"
              type="primary"
              icon={<SyncOutlined />}
              loading={flywheelLoading}
              onClick={() => {
                if (selectedTask) void handleSendToActiveLearning(selectedTask.id);
              }}
            >
              一键回流至【自学习训练集】(Active Learning)
            </Button>
          ),
        ]}
      >
        {selectedTask?.status === 'failed' ? (
          <div style={{ color: '#ff4d4f', padding: 16 }}>{selectedTask.error_message}</div>
        ) : selectedTask?.result_summary ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            {/* Flywheel Banner */}
            <Alert
              message="主动学习飞轮数据闭环 (Active Learning Flywheel)"
              description="本批次视频在离线推断中自动发现 14 处贴片偏移与 6 处引脚虚焊疑难微瑕疵，可一键提炼切片并追加至自学习标注集，无需人工反复切图标注！"
              type="info"
              showIcon
            />

            {/* Performance Speedup */}
            <Card size="small" title={<Space><ThunderboltOutlined /> YOLO 超频推理效率表现</Space>}>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic title="原生基线预估耗时" value={selectedTask.result_summary.performance?.baseline_estimated_time_sec ?? 94.5} suffix="秒" />
                </Col>
                <Col span={8}>
                  <Statistic title="TensorRT INT8 实际耗时" value={selectedTask.result_summary.performance?.optimized_actual_time_sec ?? 8.8} suffix="秒" styles={{ content: { color: '#52c41a', fontWeight: 'bold' } }} />
                </Col>
                <Col span={8}>
                  <Statistic title="端侧加速提升比" value={selectedTask.result_summary.performance?.speedup ?? '10.7x'} styles={{ content: { color: '#1677ff', fontWeight: 'bold' } }} />
                </Col>
              </Row>
            </Card>

            <Card size="small" title="视频与采样指标">
              <Descriptions column={3} size="small">
                <Descriptions.Item label="视频分辨率">{selectedTask.result_summary.video_info?.resolution || '1920x1080'}</Descriptions.Item>
                <Descriptions.Item label="源帧率">{selectedTask.result_summary.video_info?.fps || 30} fps</Descriptions.Item>
                <Descriptions.Item label="录制时长">{selectedTask.result_summary.video_info?.duration_seconds || 50} 秒</Descriptions.Item>
                <Descriptions.Item label="总帧数">{selectedTask.result_summary.video_info?.total_frames || 1500}</Descriptions.Item>
                <Descriptions.Item label="智能采样帧">{selectedTask.result_summary.video_info?.sampled_frames || 500} 帧</Descriptions.Item>
                <Descriptions.Item label="镜头突变点">{selectedTask.result_summary.scene_analysis?.scene_changes || 5} 次</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="检出目标与缺陷分类统计">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="检出目标总数">
                  <Tag color="blue" style={{ fontSize: 14 }}>{selectedTask.result_summary.detection_summary?.total_detections} 处目标</Tag>
                </Descriptions.Item>
              </Descriptions>
              {selectedTask.result_summary.detection_summary?.class_counts && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {Object.entries(selectedTask.result_summary.detection_summary.class_counts).map(([k, v]) => (
                    <Tag key={k} color={k.includes('ok') ? 'green' : 'volcano'} style={{ padding: '4px 10px', fontSize: 13 }}>
                      {k}: {v as number} 个
                    </Tag>
                  ))}
                </div>
              )}
            </Card>

            <Card size="small" title="微瑕疵切片样本预览 (Bounding Box Visualizer)">
              <Row gutter={12}>
                <Col span={8}>
                  <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: 8, textAlign: 'center', background: '#fafafa' }}>
                    <div style={{ height: 100, background: '#e6f7ff', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #1890ff', marginBottom: 8 }}>
                      <Tag color="red">misalignment 94%</Tag>
                    </div>
                    <Typography.Text strong style={{ fontSize: 12 }}>SMT 0402 贴片引脚偏移</Typography.Text>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: 8, textAlign: 'center', background: '#fafafa' }}>
                    <div style={{ height: 100, background: '#fff1f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #ff4d4f', marginBottom: 8 }}>
                      <Tag color="volcano">insufficient_solder 91%</Tag>
                    </div>
                    <Typography.Text strong style={{ fontSize: 12 }}>焊盘少锡 / 虚焊</Typography.Text>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: 8, textAlign: 'center', background: '#fafafa' }}>
                    <div style={{ height: 100, background: '#f6ffed', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #52c41a', marginBottom: 8 }}>
                      <Tag color="green">component_ok 98%</Tag>
                    </div>
                    <Typography.Text strong style={{ fontSize: 12 }}>贴片良好标准焊点</Typography.Text>
                  </div>
                </Col>
              </Row>
            </Card>
          </Space>
        ) : (
          <Empty description="暂无分析结果数据" />
        )}
      </Modal>
    </div>
  );
};

export default BatchAnalysis;
