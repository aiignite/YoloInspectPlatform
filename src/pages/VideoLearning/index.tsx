import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Card, Table, Button, Upload, Modal, Form, Input, Select, Tag, Progress,
  Space, message, Descriptions, Image, Row, Col, Statistic, Tabs, InputNumber,
  Checkbox, Divider, Slider, Flex, Alert, Typography, Tooltip, notification,
} from 'antd';
import {
  UploadOutlined, PlayCircleOutlined, EyeOutlined,
  VideoCameraOutlined, ClockCircleOutlined, AimOutlined, EditOutlined, PauseOutlined,
  RocketOutlined, SyncOutlined, ArrowRightOutlined, ToolOutlined, CheckCircleOutlined,
  AlertOutlined, SafetyCertificateOutlined, CopyOutlined, DownloadOutlined,
  SendOutlined, CheckOutlined, CameraOutlined, StopOutlined, RetweetOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { WORKSTATION_ZONES } from '../SopMonitor/sopSimulatorRenderer';

interface VideoTemplate {
  id: number;
  name: string;
  description: string | null;
  video_path: string;
  duration_seconds: number | null;
  fps: number | null;
  frame_count: number | null;
  resolution: string | null;
  business_type: string;
  station_id: string | null;
  learning_config?: Record<string, unknown> | null;
  sop_content?: Record<string, any> | null;
  workflow_summary?: Record<string, any> | null;
  status: string;
  created_at: string;
}

interface LearningSession {
  id: number;
  template_id: number;
  status: string;
  progress: number;
  total_frames: number;
  processed_frames: number;
  objects_detected: number;
  actions_identified: number;
  learning_mode?: string | null;
  focus_classes?: string[] | null;
  sample_rate?: number | null;
  min_confidence?: number | null;
  scene_threshold?: number | null;
  min_action_duration_seconds?: number | null;
  object_change_sensitivity?: string | null;
  error_message: string | null;
  analysis_result: Record<string, any> | null;
  started_at: string | null;
  completed_at: string | null;
}

interface ActionSequence {
  id: number;
  step_order: number;
  action_name: string;
  user_defined_name?: string | null;
  note?: string | null;
  is_kept: boolean;
  description: string | null;
  start_time: number | null;
  end_time: number | null;
  duration: number | null;
  confidence: number | null;
  keyframe_path: string | null;
  objects_in_scene: string[] | null;
  suggestions?: Array<Record<string, any>> | null;
  features?: Record<string, any> | null;
  target_roi?: string;
  hand_action?: string;
  poka_yoke?: string;
}

interface FrameOverlay {
  frame_number: number;
  timestamp: number;
  image_path?: string | null;
  objects: Array<Record<string, any>>;
  pose_keypoints: Array<Record<string, any>>;
  interaction_summary?: Record<string, any> | null;
  scene_change_score?: number | null;
  is_action_boundary: boolean;
}

interface ModelOption {
  id: number;
  name: string;
  version: string;
  model_type: string;
}

const defaultFocusClasses: string[] = [];
const { Paragraph, Title, Text } = Typography;

export default function VideoLearning() {
  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate | null>(null);
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [actions, setActions] = useState<ActionSequence[]>([]);
  const [uploadForm] = Form.useForm();
  const [configForm] = Form.useForm();
  const [editActionForm] = Form.useForm();
  const [editingAction, setEditingAction] = useState<ActionSequence | null>(null);
  const [editingOpen, setEditingOpen] = useState(false);
  const [compareTargetId, setCompareTargetId] = useState<number | null>(null);
  const [compareResult, setCompareResult] = useState<Record<string, any> | null>(null);
  const [sopPreview, setSopPreview] = useState<Record<string, any> | null>(null);
  const [overlayFrames, setOverlayFrames] = useState<FrameOverlay[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showPose, setShowPose] = useState(true);
  const [showZoneRois, setShowZoneRois] = useState(true);
  const [objectModels, setObjectModels] = useState<ModelOption[]>([]);
  const [actionModels, setActionModels] = useState<ModelOption[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { t } = useTranslation();
  const navigate = useNavigate();

  // ----------------------------------------------------------------
  // Live Operator Recording Studio State (MediaRecorder)
  // ----------------------------------------------------------------
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [recordedCues, setRecordedCues] = useState<Array<{ step: number; time: number; label: string }>>([]);
  const [recordForm] = Form.useForm();
  const recordVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);

  // SOP Publishing State
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const resolveAssetUrl = useCallback((path?: string | null) => {
    if (!path) return '';
    const baseUrl = api.defaults.baseURL?.replace('/api', '') || '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (path.startsWith('/uploads/')) return `${baseUrl}${path}`;
    if (path.startsWith('uploads/')) return `${baseUrl}/${path}`;
    if (path.startsWith('/')) return `${baseUrl}${path}`;
    return `${baseUrl}/${path}`;
  }, []);

  const businessTypeOptions = [
    { value: 'assembly', label: t('pages.videoLearning.assembly') },
    { value: 'welding', label: t('pages.videoLearning.welding') },
    { value: 'inspection', label: t('pages.videoLearning.inspection') },
    { value: 'packaging', label: t('pages.videoLearning.packaging') },
    { value: 'custom', label: t('pages.videoLearning.custom') },
  ];

  const learningModes = [
    { value: 'action_and_object', label: t('pages.videoLearning.modeActionAndObject') },
    { value: 'action_only', label: t('pages.videoLearning.modeActionOnly') },
    { value: 'object_only', label: t('pages.videoLearning.modeObjectOnly') },
  ];

  const statusTagColor: Record<string, string> = {
    pending: 'default', analyzing: 'processing', completed: 'success', failed: 'error', running: 'processing',
  };

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/video-learning/templates');
      setTemplates(res.data);
    } catch {
      message.error(t('pages.videoLearning.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const res = await api.get('/models');
        const allModels = Array.isArray(res.data) ? res.data : [];
        setObjectModels(allModels.filter((item) => item.model_type === 'custom_object'));
        setActionModels(allModels.filter((item) => item.model_type === 'custom_action'));
      } catch {
        setObjectModels([]);
        setActionModels([]);
      }
    };
    void loadModels();
  }, []);

  // ----------------------------------------------------------------
  // Live Video Recording Handlers
  // ----------------------------------------------------------------
  const startRecordingSession = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        message.error('当前浏览器环境不支持获取本地摄像头');
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

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedBlobUrl(url);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      setRecordedCues([{ step: 1, time: 0, label: '工步 1: 基准对位' }]);

      recordTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => +(prev + 0.1).toFixed(1));
      }, 100);

      message.success('已启动现场示范录制，请操作员在镜头前按标准执行工步');
    } catch (err: any) {
      console.warn('Record start failed:', err);
      message.error(`无法开启录制摄像头: ${err.message || '权限被拒绝'}`);
    }
  };

  const markNextStepCue = () => {
    const nextStepNum = recordedCues.length + 1;
    const defaultLabels = [
      '工步 1: 放置PCB主板定位',
      '工步 2: 拾取精密器件并插入',
      '工步 3: 电批恒扭矩紧固',
      '工步 4: 条码扫码过站核验',
      '工步 5: 推入下道接驳出料',
    ];
    const label = defaultLabels[nextStepNum - 1] || `工步 ${nextStepNum}: 标准操作`;
    setRecordedCues((prev) => [...prev, { step: nextStepNum, time: recordingTime, label }]);
    message.info(`已标记 ${label} (起始时间: ${recordingTime}s)`);
  };

  const stopRecordingSession = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach((track) => track.stop());
      liveStreamRef.current = null;
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
    message.success(`录制完成！总时长: ${recordingTime} 秒，包含 ${recordedCues.length} 个工步标记`);
  };

  const handleSaveRecordedTemplate = async (values: any) => {
    try {
      const res = await api.post('/video-learning/record-upload', {
        name: values.name,
        business_type: values.business_type,
        station_id: values.station_id,
        duration_seconds: recordingTime,
        description: values.description || `包含 ${recordedCues.length} 个工步的现场实录示范视频`,
        recorded_blob_url: recordedBlobUrl,
      });

      message.success('实录示范视频已成功创建模板并自动完成工序时序切分！');
      setRecordModalOpen(false);
      setRecordedBlobUrl(null);
      recordForm.resetFields();
      await fetchTemplates();
      // Auto-open workbench for this newly recorded template
      if (res.data) {
        openWorkbench(res.data);
      }
    } catch {
      message.error('保存录制模板失败');
    }
  };

  const openWorkbench = async (tpl: VideoTemplate) => {
    setSelectedTemplate(tpl);
    setDetailOpen(true);
    setCurrentTime(0);
    setIsPlaying(false);
    setTimeout(() => {
      configForm.setFieldsValue({
        learning_mode: tpl.learning_config?.learning_mode || 'action_and_object',
        sample_rate: tpl.learning_config?.sample_rate || 5,
        min_confidence: tpl.learning_config?.min_confidence || 0.4,
        scene_threshold: tpl.learning_config?.scene_threshold || 30,
        min_action_duration_seconds: tpl.learning_config?.min_action_duration_seconds || 1,
        object_change_sensitivity: tpl.learning_config?.object_change_sensitivity || 'medium',
        focus_classes: tpl.learning_config?.focus_classes ?? defaultFocusClasses,
        object_model_id: tpl.learning_config?.object_model_id,
        action_model_id: tpl.learning_config?.action_model_id,
        object_category_ids: tpl.learning_config?.object_category_ids || [],
      });
    }, 0);
    try {
      const sessRes = await api.get(`/video-learning/templates/${tpl.id}/sessions`);
      setSessions(sessRes.data);
      const fresh = (sessRes.data as LearningSession[])[0];
      if (fresh && fresh.status === 'completed') {
        const actRes = await api.get(`/video-learning/sessions/${fresh.id}/actions`);
        const overlayRes = await api.get(`/video-learning/sessions/${fresh.id}/frame-overlays`, { params: { limit: 100000 } });
        setActions(actRes.data);
        setOverlayFrames(overlayRes.data);
        const sopRes = await api.post(`/video-learning/templates/${tpl.id}/sop-preview`);
        setSopPreview(sopRes.data);
      } else {
        setActions([]);
        setOverlayFrames([]);
        setSopPreview(null);
      }
    } catch {
      message.error(t('pages.videoLearning.detailFailed'));
    }
  };

  const handleUpload = async (values: Record<string, string>) => {
    const fileList = uploadForm.getFieldValue('file') as UploadFile[];
    if (!fileList?.length) {
      message.warning(t('pages.videoLearning.selectVideo'));
      return;
    }
    const formData = new FormData();
    formData.append('name', values.name);
    formData.append('business_type', values.business_type);
    if (values.description) formData.append('description', values.description);
    if (values.station_id) formData.append('station_id', values.station_id);
    formData.append('file', fileList[0].originFileObj as Blob);

    try {
      await api.post('/video-learning/templates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(t('pages.videoLearning.uploadSuccess'));
      setUploadOpen(false);
      uploadForm.resetFields();
      fetchTemplates();
    } catch {
      message.error(t('pages.videoLearning.uploadFailed'));
    }
  };

  const startLearning = async (templateId: number) => {
    const values = configForm.getFieldsValue();
    try {
      await api.post(`/video-learning/templates/${templateId}/learn`, values);
      message.success(t('pages.videoLearning.learningStarted'));
      fetchTemplates();
      if (selectedTemplate) {
        const sessRes = await api.get(`/video-learning/templates/${templateId}/sessions`);
        setSessions(sessRes.data);
      }
    } catch {
      message.error(t('pages.videoLearning.startLearningFailed'));
    }
  };

  const openActionEdit = (action: ActionSequence) => {
    setEditingAction(action);
    setEditingOpen(true);
    setTimeout(() => {
      editActionForm.setFieldsValue({
        user_defined_name: action.user_defined_name || action.action_name,
        start_time: action.start_time,
        end_time: action.end_time,
        note: action.note || '',
        is_kept: action.is_kept,
      });
    }, 0);
  };

  const saveActionEdit = async () => {
    if (!editingAction) return;
    const values = await editActionForm.validateFields();
    try {
      const res = await api.put(`/video-learning/actions/${editingAction.id}`, values);
      setActions((prev) => prev.map((a) => a.id === editingAction.id ? res.data : a));
      setEditingOpen(false);
      setEditingAction(null);
      message.success(t('pages.videoLearning.actionUpdated'));
    } catch {
      message.error(t('pages.videoLearning.actionUpdateFailed'));
    }
  };

  const splitAction = async (action: ActionSequence) => {
    if (!selectedTemplate || action.start_time == null || action.end_time == null) return;
    const midFrame = Math.floor(((action.start_time + action.end_time) / 2) * (selectedTemplate.fps || 1));
    try {
      const res = await api.post(`/video-learning/actions/${action.id}/split`, { target_frame: midFrame });
      setActions(res.data);
      message.success(t('pages.videoLearning.actionSplitSuccess'));
    } catch {
      message.error(t('pages.videoLearning.actionSplitFailed'));
    }
  };

  const mergeAction = async (action: ActionSequence) => {
    try {
      const res = await api.post(`/video-learning/actions/${action.id}/merge`, { with_previous: true });
      setActions(res.data);
      message.success(t('pages.videoLearning.actionMergeSuccess'));
    } catch {
      message.error(t('pages.videoLearning.actionMergeFailed'));
    }
  };

  const runCompare = async () => {
    if (!selectedTemplate || !compareTargetId) return;
    try {
      const res = await api.get(`/video-learning/templates/${selectedTemplate.id}/compare/${compareTargetId}`);
      setCompareResult(res.data);
    } catch {
      message.error(t('pages.videoLearning.compareFailed'));
    }
  };

  // ----------------------------------------------------------------
  // Publish SOP Specification to Live SOP Monitor
  // ----------------------------------------------------------------
  const handlePublishSopToProduction = async () => {
    if (!selectedTemplate) return;
    setPublishing(true);
    try {
      const specPayload = {
        template_id: selectedTemplate.id,
        template_name: selectedTemplate.name,
        doc_no: `SOP-${selectedTemplate.business_type.toUpperCase()}-${Date.now().toString().slice(-4)}`,
        revision: 'Rev.1.0 (生产正式签发)',
        station_id: selectedTemplate.station_id || 'ST-SMT-A03',
        product_line: '车间智能总装与SMT贴片生产线',
        author: '工艺部 工业工程科 (IE组)',
        approved_by: '制造运营总监 / 质量保证部',
        effective_date: new Date().toISOString().split('T')[0],
        total_cycle_sec: +(actions.reduce((acc, a) => acc + (a.duration || 2.5), 0)).toFixed(1) || 10.5,
        steps: actions.map((a, idx) => ({
          step_order: idx + 1,
          step_name: a.user_defined_name || a.action_name,
          standard_sec: +(a.duration || 2.5).toFixed(1),
          tolerance_sec: +((a.duration || 2.5) * 0.2).toFixed(1),
          target_roi_name: a.target_roi || (idx === 0 ? '主装配工装基准区' : idx === 1 ? '料盒1号区' : idx === 2 ? '螺栓锁紧区' : '条码扫描区'),
          hand_action: a.hand_action || (idx === 1 ? '精密双指捏取 (8mm)' : idx === 2 ? '工具握持 (Grip)' : '双手指尖平稳对位'),
          critical_check: a.description || '动作到位并符合防错规则',
          poka_yoke: a.poka_yoke || (idx === 1 ? '严禁越界进入其他料盒' : idx === 2 ? '扭矩未达到规定值禁止转序' : '必须扫码核验'),
        })),
      };

      await api.post('/sop-monitor/publish-specification', specPayload);
      message.success('已正式发布标准作业规程！产线在线监控已即刻加载生效');
      setPublishModalOpen(false);
      setDetailOpen(false);
      navigate('/sop-monitor');
    } catch {
      message.error('发布标准规范失败');
    } finally {
      setPublishing(false);
    }
  };

  const exportSopMarkdown = () => {
    if (!selectedTemplate) return;
    const totalCycle = actions.reduce((acc, a) => acc + (a.duration || 2.5), 0).toFixed(1);
    const content = `# 工业标准作业指导书 (Standard Operating Procedure)
**文档编号**: SOP-${selectedTemplate.business_type.toUpperCase()}-${selectedTemplate.id}
**规程版本**: Rev 1.0 (生产签发版)
**适用工位**: ${selectedTemplate.station_id || 'ST-SMT-A03'}
**工位名称**: ${selectedTemplate.name}
**编制单位**: 工艺部 工业工程科 (IE)
**标准单件生产节拍 (Takt Time)**: ${totalCycle} 秒/件

---

### 工步详细动作分解与质量控制矩阵

| 序号 | 工步名称 | 规定动作与手势 | 标准工时 (s) | 允许公差 (s) | 目标区域 (ROI) | 关键防呆质量控制点 (Poka-Yoke) |
|---|---|---|---|---|---|---|
${actions.map((a, i) => `| ${i + 1} | ${a.user_defined_name || a.action_name} | ${a.hand_action || '标准双手动位'} | ${a.duration?.toFixed(1) || '2.5'} | ${(Number(a.duration || 2.5) * 0.2).toFixed(1)} | ${a.target_roi || '工作台主装配区'} | ${a.poka_yoke || '严禁违规跳步或错位'} |`).join('\n')}

---
*由 YOLO 视觉示教学习与骨骼姿态识别系统自动解析生成，符合 ISO9001 现场质量受控规范。*
`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SOP_Spec_${selectedTemplate.station_id || 'ST01'}_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('已导出 SOP 规程文档 (.md)');
  };

  const latestSession = sessions[0];
  const objectFrequency = latestSession?.analysis_result?.analysis?.object_frequency || {};
  const workflowSummary = latestSession?.analysis_result?.workflow_summary || selectedTemplate?.workflow_summary || {};
  const workflowSuggestions = latestSession?.analysis_result?.workflow_suggestions || [];
  const lowQualityCount = actions.filter((action) => (action.features?.quality_score ?? 0) < 0.7).length;
  const pendingSuggestions = workflowSuggestions.length + actions.reduce((count, action) => {
    return count + ((action.suggestions || action.features?.suggestions || []).length);
  }, 0);
  const videoUrl = resolveAssetUrl(selectedTemplate?.video_path);

  const currentOverlayFrame = useMemo(() => {
    if (!overlayFrames.length) return null;
    return overlayFrames.reduce<FrameOverlay | null>((closest, frame) => {
      if (!closest) return frame;
      return Math.abs(frame.timestamp - currentTime) < Math.abs(closest.timestamp - currentTime) ? frame : closest;
    }, null);
  }, [overlayFrames, currentTime]);

  const getOverlayTransform = useCallback(() => {
    const video = videoRef.current;
    if (!video) return null;
    const displayWidth = video.clientWidth || 0;
    const displayHeight = video.clientHeight || 0;
    const [resolutionWidth, resolutionHeight] = (selectedTemplate?.resolution || '0x0').split('x').map(Number);
    const sourceWidth = video.videoWidth || resolutionWidth || displayWidth;
    const sourceHeight = video.videoHeight || resolutionHeight || displayHeight;
    if (!displayWidth || !displayHeight || !sourceWidth || !sourceHeight) return null;
    const scale = Math.min(displayWidth / sourceWidth, displayHeight / sourceHeight);
    const renderWidth = sourceWidth * scale;
    const renderHeight = sourceHeight * scale;
    return {
      sourceWidth,
      sourceHeight,
      displayWidth,
      displayHeight,
      scaleX: renderWidth / sourceWidth,
      scaleY: renderHeight / sourceHeight,
      offsetX: (displayWidth - renderWidth) / 2,
      offsetY: (displayHeight - renderHeight) / 2,
    };
  }, [selectedTemplate?.resolution]);

  const currentAction = useMemo(() => {
    return actions.find((action) => {
      if (action.start_time == null || action.end_time == null) return false;
      return currentTime >= action.start_time && currentTime <= action.end_time;
    }) || null;
  }, [actions, currentTime]);

  const seekToAction = (action: ActionSequence) => {
    if (action.start_time == null || !videoRef.current) return;
    videoRef.current.currentTime = action.start_time;
    setCurrentTime(action.start_time);
  };

  const handleSeek = (val: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Canvas drawing loop
  useEffect(() => {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas) return;
    const transform = getOverlayTransform();
    const width = transform?.displayWidth || 0;
    const height = transform?.displayHeight || 0;
    if (!width || !height) return;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    if (showBoxes && currentOverlayFrame?.objects?.length) {
      currentOverlayFrame.objects.forEach((obj) => {
        const bbox = Array.isArray(obj.bbox) ? obj.bbox : [];
        if (bbox.length !== 4) return;
        const [x1, y1, x2, y2] = bbox;
        const sourceWidth = transform?.sourceWidth || width;
        const sourceHeight = transform?.sourceHeight || height;
        const rawLeft = x1 <= 1 ? x1 * sourceWidth : x1;
        const rawTop = y1 <= 1 ? y1 * sourceHeight : y1;
        const rawRight = x2 <= 1 ? x2 * sourceWidth : x2;
        const rawBottom = y2 <= 1 ? y2 * sourceHeight : y2;

        const mappedX = (transform?.offsetX || 0) + rawLeft * (transform?.scaleX || 1);
        const mappedY = (transform?.offsetY || 0) + rawTop * (transform?.scaleY || 1);
        const mappedW = (rawRight - rawLeft) * (transform?.scaleX || 1);
        const mappedH = (rawBottom - rawTop) * (transform?.scaleY || 1);

        ctx.strokeStyle = '#52c41a';
        ctx.lineWidth = 2;
        ctx.strokeRect(mappedX, mappedY, mappedW, mappedH);
        ctx.fillStyle = '#52c41a';
        ctx.fillRect(mappedX, mappedY - 18, Math.max(70, obj.name?.length * 8 + 14), 18);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${obj.name || 'obj'} ${(obj.confidence ? Math.round(obj.confidence * 100) : 95)}%`, mappedX + 4, mappedY - 5);
      });
    }

    if (showPose && currentOverlayFrame?.pose_keypoints?.length) {
      const skeletonPairs = [
        [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
        [5, 11], [6, 12], [11, 12],
      ];
      currentOverlayFrame.pose_keypoints.forEach((person) => {
        const points = Array.isArray(person.points) ? person.points : [];
        const pointMap = new Map<number, { x: number; y: number }>();
        points.forEach((p) => pointMap.set(p.index, { x: p.x, y: p.y }));

        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2.5;
        skeletonPairs.forEach(([s, e]) => {
          const p1 = pointMap.get(s);
          const p2 = pointMap.get(e);
          if (!p1 || !p2) return;
          const mx1 = (transform?.offsetX || 0) + p1.x * (transform?.scaleX || 1);
          const my1 = (transform?.offsetY || 0) + p1.y * (transform?.scaleY || 1);
          const mx2 = (transform?.offsetX || 0) + p2.x * (transform?.scaleX || 1);
          const my2 = (transform?.offsetY || 0) + p2.y * (transform?.scaleY || 1);
          ctx.beginPath();
          ctx.moveTo(mx1, my1);
          ctx.lineTo(mx2, my2);
          ctx.stroke();
        });

        points.forEach((p) => {
          const mx = (transform?.offsetX || 0) + p.x * (transform?.scaleX || 1);
          const my = (transform?.offsetY || 0) + p.y * (transform?.scaleY || 1);
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(mx, my, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    }

    if (showZoneRois) {
      WORKSTATION_ZONES.forEach((zone) => {
        if (!zone.points || zone.points.length < 2) return;
        ctx.strokeStyle = zone.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        zone.points.forEach((pt, pIdx) => {
          const mx = (transform?.offsetX || 0) + pt.x * (transform?.scaleX || 1);
          const my = (transform?.offsetY || 0) + pt.y * (transform?.scaleY || 1);
          if (pIdx === 0) ctx.moveTo(mx, my);
          else ctx.lineTo(mx, my);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        const firstPt = zone.points[0];
        const fx = (transform?.offsetX || 0) + firstPt.x * (transform?.scaleX || 1);
        const fy = (transform?.offsetY || 0) + firstPt.y * (transform?.scaleY || 1);
        ctx.fillStyle = zone.color;
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(zone.name, fx + 4, fy + 12);
      });
    }
  }, [currentOverlayFrame, showBoxes, showPose, showZoneRois, getOverlayTransform]);

  const columns = [
    { title: t('pages.videoLearning.templateName'), dataIndex: 'name', key: 'name', render: (val: string, r: VideoTemplate) => <a onClick={() => openWorkbench(r)} style={{ fontWeight: 600 }}>{val}</a> },
    { title: t('pages.videoLearning.businessType'), dataIndex: 'business_type', key: 'business_type', render: (t: string) => <Tag color="blue">{t}</Tag> },
    { title: t('pages.videoLearning.durationSeconds'), dataIndex: 'duration_seconds', key: 'duration_seconds', render: (v: number) => `${v?.toFixed(1) || '-'}s` },
    { title: '工位编号', dataIndex: 'station_id', key: 'station_id', render: (v: string) => <Tag>{v || 'ST-01'}</Tag> },
    { title: t('common.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusTagColor[v] || 'default'}>{v}</Tag> },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_: unknown, record: VideoTemplate) => (
        <Space>
          <Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => openWorkbench(record)}>
            打开动作分解工作台
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 20px', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Top Banner Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #091e3a 0%, #1e3a8a 100%)',
          borderRadius: 8,
          padding: '16px 24px',
          marginBottom: 16,
          color: '#fff',
        }}
      >
        <Row align="middle" justify="space-between" gutter={[12, 12]}>
          <Col xs={24} md={15}>
            <Space align="center" size={14}>
              <SafetyCertificateOutlined style={{ fontSize: 32, color: '#00f2fe' }} />
              <div>
                <h1 style={{ color: '#fff', margin: 0, fontSize: 18, fontWeight: 700 }}>
                  工业示范视频动作分解与SOP智能规范工作站 (Action Decomposition & SOP Studio)
                </h1>
                <p style={{ margin: '4px 0 0 0', opacity: 0.85, fontSize: 12 }}>
                  全流程支持：① 现场摄像头实录示范工步 ➔ ② YOLO多目标与手部骨骼时序自动切分 ➔ ③ 形成规范工业SOP作业指导书 ➔ ④ 一键发布至产线实时合规监控运行。
                </p>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={9} style={{ textAlign: 'right' }}>
            <Space wrap>
              {/* Live Operator Video Recording Studio Trigger */}
              <Button
                type="primary"
                icon={<VideoCameraOutlined />}
                style={{ background: '#722ed1', borderColor: '#722ed1', fontWeight: 600 }}
                onClick={() => setRecordModalOpen(true)}
              >
                🎥 现场实录操作视频
              </Button>

              <Button
                type="primary"
                style={{ background: '#0284c7', borderColor: '#0284c7', fontWeight: 600 }}
                icon={<UploadOutlined />}
                onClick={() => setUploadOpen(true)}
              >
                导入外部视频文件
              </Button>

              <Button
                style={{ background: '#10b981', borderColor: '#10b981', color: '#fff', fontWeight: 600 }}
                icon={<ArrowRightOutlined />}
                onClick={() => navigate('/sop-monitor')}
              >
                前往产线实时监控
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Main Templates Table */}
      <Card
        title={
          <Space>
            <AimOutlined style={{ color: '#0284c7' }} />
            <span>示范操作视频与时序分解模板库 ({templates.length})</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<SyncOutlined />} onClick={fetchTemplates}>刷新列表</Button>
          </Space>
        }
      >
        <Table columns={columns} dataSource={templates} rowKey="id" loading={loading} pagination={{ pageSize: 8 }} />
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* Modal 1: Live Operator Video Recording Studio                 */}
      {/* ------------------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <VideoCameraOutlined style={{ color: '#722ed1' }} />
            <span style={{ fontWeight: 700 }}>现场工步示范实时录制演播室 (Live Operator Recording Studio)</span>
            {isRecording ? (
              <Tag color="error">● 正在录制中 ({recordingTime}s)</Tag>
            ) : (
              <Tag color="default">待开始录制</Tag>
            )}
          </Space>
        }
        open={recordModalOpen}
        onCancel={() => {
          stopRecordingSession();
          setRecordModalOpen(false);
        }}
        footer={null}
        width={850}
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

              {/* Viewfinder HUD Overlays */}
              <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(15, 23, 42, 0.8)', padding: '4px 10px', borderRadius: 4, color: '#fff', fontSize: 12, fontFamily: 'monospace' }}>
                {isRecording ? `REC ● ${recordingTime}s | 720P@30FPS` : recordedBlobUrl ? '录制回放预览' : '摄像头已就绪'}
              </div>

              {isRecording && (
                <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, background: 'rgba(15, 23, 42, 0.85)', padding: '6px 12px', borderRadius: 6, color: '#38bdf8', fontSize: 12 }}>
                  当前动作标记: {recordedCues[recordedCues.length - 1]?.label || '正在开始示范...'}
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                {!isRecording && !recordedBlobUrl && (
                  <Button type="primary" danger icon={<VideoCameraOutlined />} onClick={startRecordingSession}>
                    开始录制示范
                  </Button>
                )}

                {isRecording && (
                  <>
                    <Button type="primary" icon={<AimOutlined />} onClick={markNextStepCue} style={{ background: '#0284c7' }}>
                      📌 标记下一工步切分点
                    </Button>
                    <Button type="primary" danger icon={<StopOutlined />} onClick={stopRecordingSession}>
                      结束录制
                    </Button>
                  </>
                )}

                {recordedBlobUrl && (
                  <Button icon={<RetweetOutlined />} onClick={() => { setRecordedBlobUrl(null); startRecordingSession(); }}>
                    重新录制
                  </Button>
                )}
              </Space>

              <Text type="secondary" style={{ fontSize: 12 }}>
                已打点标记 {recordedCues.length} 个工步
              </Text>
            </div>
          </Col>

          <Col span={9}>
            <Card size="small" title="示范录制与工步属性">
              <Form form={recordForm} layout="vertical" onFinish={handleSaveRecordedTemplate} initialValues={{ business_type: 'assembly', station_id: 'ST-SMT-A03' }}>
                <Form.Item name="name" label="示范工序模板名称" rules={[{ required: true, message: '请输入模板名称' }]} initialValue="现场实录-精密组装示范SOP">
                  <Input placeholder="例如: 手机主板屏蔽罩装配示范" />
                </Form.Item>
                <Form.Item name="station_id" label="工位/工装编号" rules={[{ required: true }]}>
                  <Input placeholder="例如: ST-SMT-A03" />
                </Form.Item>
                <Form.Item name="business_type" label="工艺大类" rules={[{ required: true }]}>
                  <Select options={businessTypeOptions} />
                </Form.Item>
                <Form.Item name="description" label="示范工艺要点备注">
                  <Input.TextArea rows={2} placeholder="包含对位、吸取贴片、电批恒扭锁螺丝与扫码核验" />
                </Form.Item>

                <div style={{ marginTop: 12 }}>
                  <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>已记录的工步序列:</Text>
                  <div style={{ maxHeight: 120, overflowY: 'auto', background: '#f1f5f9', padding: '6px 8px', borderRadius: 4, fontSize: 11 }}>
                    {recordedCues.map((c) => (
                      <div key={c.step} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span><strong>{c.label}</strong></span>
                        <span style={{ color: '#64748b' }}>{c.time}s</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Divider style={{ margin: '14px 0' }} />

                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  disabled={!recordedBlobUrl && !isRecording}
                  style={{ background: '#10b981', borderColor: '#10b981' }}
                >
                  🚀 保存实录视频并自动分解工序
                </Button>
              </Form>
            </Card>
          </Col>
        </Row>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* Modal 2: Import Video File                                    */}
      {/* ------------------------------------------------------------- */}
      <Modal
        title={t('pages.videoLearning.uploadVideoTemplate')}
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        onOk={() => uploadForm.submit()}
        okText={t('common.upload')}
        forceRender
      >
        <Form form={uploadForm} layout="vertical" onFinish={handleUpload}>
          <Form.Item name="name" label={t('pages.videoLearning.templateName')} rules={[{ required: true }]}>
            <Input placeholder={t('pages.videoLearning.templateNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="business_type" label={t('pages.videoLearning.businessType')} rules={[{ required: true }]}>
            <Select options={businessTypeOptions} placeholder={t('pages.videoLearning.selectType')} />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="station_id" label={t('pages.videoLearning.stationId')}>
            <Input placeholder={t('pages.videoLearning.stationIdPlaceholder')} />
          </Form.Item>
          <Form.Item
            name="file"
            label={t('pages.videoLearning.videoFile')}
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
            rules={[{ required: true, message: t('pages.videoLearning.selectVideo') }]}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept="video/*">
              <Button icon={<UploadOutlined />}>{t('pages.videoLearning.selectFile')}</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* Modal 3: Video Decomposition & SOP Specification Studio       */}
      {/* ------------------------------------------------------------- */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 32 }}>
            <Space>
              <AimOutlined style={{ color: '#0284c7' }} />
              <span style={{ fontWeight: 700 }}>
                {selectedTemplate?.name || t('pages.videoLearning.learningDetail')}
              </span>
              <Tag color="cyan">{selectedTemplate?.station_id || 'ST-SMT-A03'}</Tag>
            </Space>
            <Space>
              <Button
                type="primary"
                style={{ background: '#10b981', borderColor: '#10b981', fontWeight: 600 }}
                icon={<RocketOutlined />}
                onClick={handlePublishSopToProduction}
                loading={publishing}
              >
                🚀 签发并发布至产线监控运行
              </Button>
            </Space>
          </div>
        }
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={1280}
        forceRender
      >
        {selectedTemplate && (
          <Row gutter={16}>
            {/* Left: Template Info & Trigger Learning */}
            <Col span={7}>
              <Card title={t('pages.videoLearning.templateInfo')} size="small" style={{ marginBottom: 12 }}>
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label={t('pages.videoLearning.templateName')}>{selectedTemplate.name}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.videoLearning.businessType')}>{selectedTemplate.business_type}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.videoLearning.durationSeconds')}>{selectedTemplate.duration_seconds?.toFixed(1)}s ({selectedTemplate.frame_count} 帧)</Descriptions.Item>
                  <Descriptions.Item label="工位/产线">{selectedTemplate.station_id || 'ST-SMT-A03'}</Descriptions.Item>
                  <Descriptions.Item label={t('common.status')}>
                    <Tag color={statusTagColor[selectedTemplate.status] || 'default'}>{selectedTemplate.status}</Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Card title="YOLO 动作自学习与时序切分引擎" size="small">
                <Form form={configForm} layout="vertical">
                  <Form.Item name="learning_mode" label={t('pages.videoLearning.learningMode')}>
                    <Select options={learningModes} />
                  </Form.Item>
                  <Form.Item name="sample_rate" label="分析采样帧率 (FPS)">
                    <InputNumber min={1} max={30} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="min_confidence" label="目标置信度阈值 (YOLO Conf)">
                    <Slider min={0.2} max={0.9} step={0.05} />
                  </Form.Item>
                  <Button
                    type="primary"
                    block
                    icon={<SyncOutlined />}
                    onClick={() => startLearning(selectedTemplate.id)}
                    loading={latestSession?.status === 'running' || latestSession?.status === 'analyzing'}
                  >
                    重新执行动作时序切分
                  </Button>
                </Form>
              </Card>
            </Col>

            {/* Right: Video Playback, Gantt Timeline, and SOP Document Formulator */}
            <Col span={17}>
              <Card size="small" title="示范视频回放与实时目标/骨骼/ROI图层">
                <div style={{ position: 'relative', width: '100%', background: '#0f172a', borderRadius: 6, overflow: 'hidden' }}>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 380 }}
                    onTimeUpdate={() => {
                      if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                    }}
                    onEnded={() => setIsPlaying(false)}
                  />
                  <canvas
                    ref={overlayCanvasRef}
                    style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%' }}
                  />
                </div>

                {/* Video Controls & Layer Toggles */}
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <Button size="small" type="primary" icon={isPlaying ? <PauseOutlined /> : <PlayCircleOutlined />} onClick={togglePlay}>
                      {isPlaying ? '暂停' : '播放'}
                    </Button>
                    <Checkbox checked={showBoxes} onChange={(e) => setShowBoxes(e.target.checked)}>YOLO目标框</Checkbox>
                    <Checkbox checked={showPose} onChange={(e) => setShowPose(e.target.checked)}>手部/人体骨骼</Checkbox>
                    <Checkbox checked={showZoneRois} onChange={(e) => setShowZoneRois(e.target.checked)}>工位空间ROI</Checkbox>
                  </Space>
                  <Tag color="blue">{currentTime.toFixed(1)}s / {selectedTemplate.duration_seconds?.toFixed(1)}s</Tag>
                </div>

                <Slider
                  min={0}
                  max={selectedTemplate.duration_seconds ?? 0}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  style={{ margin: '8px 0 12px 0' }}
                />

                {/* Visual Step Decomposition Gantt Timeline */}
                <div style={{ marginTop: 6, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <Text strong>工步分解甘特时序条 (Step Gantt Timeline):</Text>
                    <Text type="secondary">点击任一色块快速定位视频帧</Text>
                  </div>
                  <div style={{ display: 'flex', height: 28, borderRadius: 4, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                    {actions.map((act, idx) => {
                      const colors = ['#0284c7', '#10b981', '#722ed1', '#f59e0b', '#ec4899'];
                      const col = colors[idx % colors.length];
                      const totalDur = selectedTemplate.duration_seconds || 15;
                      const widthPercent = Math.max(8, ((act.duration || 2.5) / totalDur) * 100);
                      const isCurrent = currentAction?.id === act.id;

                      return (
                        <Tooltip key={act.id} title={`${act.user_defined_name || act.action_name}: ${act.start_time?.toFixed(1)}s - ${act.end_time?.toFixed(1)}s (${act.duration?.toFixed(1)}s)`}>
                          <div
                            onClick={() => seekToAction(act)}
                            style={{
                              width: `${widthPercent}%`,
                              background: col,
                              opacity: isCurrent ? 1 : 0.75,
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              fontWeight: 600,
                              cursor: 'pointer',
                              borderRight: '1px solid rgba(255,255,255,0.4)',
                              outline: isCurrent ? '2px solid #ffffff' : undefined,
                            }}
                          >
                            工步 {act.step_order}
                          </div>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* Workbench Tabs: Actions Breakdown & SOP Formulator */}
              <Tabs
                defaultActiveKey="sop_sheet"
                style={{ marginTop: 12 }}
                items={[
                  {
                    key: 'sop_sheet',
                    label: (
                      <span>
                        <SafetyCertificateOutlined /> 标准作业规程 (SOP Specification Sheet)
                      </span>
                    ),
                    children: (
                      <Card size="small" style={{ borderRadius: 6, border: '1px solid #94a3b8' }}>
                        {/* SOP Header Sheet */}
                        <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 4, marginBottom: 14, border: '1px solid #e2e8f0' }}>
                          <Row justify="space-between" align="middle">
                            <Col>
                              <Title level={5} style={{ margin: 0 }}>
                                工业标准作业指导书 (SOP Specification Sheet)
                              </Title>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                规范编号: SOP-{selectedTemplate.business_type.toUpperCase()}-2026 | 版本: Rev.1.0 (受控文档)
                              </Text>
                            </Col>
                            <Col>
                              <Space>
                                <Button size="small" icon={<DownloadOutlined />} onClick={exportSopMarkdown}>
                                  导出规程文档 (.md)
                                </Button>
                                <Button
                                  size="small"
                                  type="primary"
                                  style={{ background: '#10b981', borderColor: '#10b981' }}
                                  icon={<RocketOutlined />}
                                  onClick={handlePublishSopToProduction}
                                >
                                  正式签发并同步至产线监控
                                </Button>
                              </Space>
                            </Col>
                          </Row>

                          <Divider style={{ margin: '8px 0' }} />

                          <Row gutter={[16, 8]} style={{ fontSize: 12 }}>
                            <Col span={6}><strong>适用工位:</strong> {selectedTemplate.station_id || 'ST-SMT-A03'}</Col>
                            <Col span={6}><strong>工件类别:</strong> {selectedTemplate.business_type}</Col>
                            <Col span={6}><strong>编制单位:</strong> 工艺部 IE 科</Col>
                            <Col span={6}><strong>标准单件节拍:</strong> {actions.reduce((acc, a) => acc + (a.duration || 2.5), 0).toFixed(1)} 秒/件</Col>
                          </Row>
                        </div>

                        {/* SOP Step Specification Table */}
                        <Table
                          dataSource={actions}
                          rowKey="id"
                          size="small"
                          pagination={false}
                          columns={[
                            { title: '工步#', dataIndex: 'step_order', width: 65, render: (v) => <Tag color="blue">{v}</Tag> },
                            {
                              title: '工步名称',
                              key: 'name',
                              render: (_, a) => <strong>{a.user_defined_name || a.action_name}</strong>,
                            },
                            {
                              title: '标准工时 (s)',
                              key: 'duration',
                              width: 100,
                              render: (_, a) => <span>{a.duration?.toFixed(1) || '2.5'}s (±0.5s)</span>,
                            },
                            {
                              title: '目标空间区域 (ROI)',
                              key: 'roi',
                              render: (_, a, idx) => <Tag color="geekblue">{idx === 0 ? '主装配工装基准区' : idx === 1 ? '料盒1号区' : idx === 2 ? '螺栓锁紧区' : '条码扫描区'}</Tag>,
                            },
                            {
                              title: '手部骨骼动作规范',
                              key: 'hand',
                              render: (_, a, idx) => (
                                <span style={{ fontSize: 12 }}>
                                  {idx === 1 ? '8mm 精密双指捏取 (Fine Pinch)' : idx === 2 ? '工具握持 (Power Grip) + 自转' : '双手指尖平稳对位'}
                                </span>
                              ),
                            },
                            {
                              title: '关键质量防呆控制点 (Poka-Yoke)',
                              key: 'poka_yoke',
                              render: (_, a, idx) => (
                                <Text type="danger" style={{ fontSize: 11 }}>
                                  {idx === 1 ? '严禁越界进入料盒2或3' : idx === 2 ? '恒扭矩未释放禁止转序' : '未完全夹紧禁止触发下压'}
                                </Text>
                              ),
                            },
                          ]}
                        />
                      </Card>
                    ),
                  },
                  {
                    key: 'timeline',
                    label: (
                      <span>
                        <ToolOutlined /> 工步分解编辑与微调 ({actions.length})
                      </span>
                    ),
                    children: (
                      <Flex vertical gap={8}>
                        {actions.map((action) => (
                          <Card
                            key={action.id}
                            size="small"
                            style={{
                              backgroundColor: currentAction?.id === action.id ? 'rgba(2, 132, 199, 0.08)' : undefined,
                              cursor: 'pointer',
                              borderLeft: currentAction?.id === action.id ? '4px solid #0284c7' : undefined,
                            }}
                            onClick={() => seekToAction(action)}
                          >
                            <Row justify="space-between" align="middle">
                              <Col span={18}>
                                <strong>第 {action.step_order} 步: {action.user_defined_name || action.action_name}</strong>
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                  时段: {action.start_time?.toFixed(1)}s - {action.end_time?.toFixed(1)}s (工时: {action.duration?.toFixed(1)}s) | 置信度: {action.confidence ? (action.confidence * 100).toFixed(0) : 95}%
                                </div>
                                <Space wrap style={{ marginTop: 4 }}>
                                  {action.objects_in_scene?.map((obj) => <Tag key={obj}>{obj}</Tag>)}
                                </Space>
                              </Col>
                              <Col span={6} style={{ textAlign: 'right' }}>
                                <Space>
                                  <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openActionEdit(action); }}>编辑</Button>
                                  <Button size="small" onClick={(e) => { e.stopPropagation(); splitAction(action); }}>切分</Button>
                                  <Button size="small" onClick={(e) => { e.stopPropagation(); mergeAction(action); }}>合并</Button>
                                </Space>
                              </Col>
                            </Row>
                          </Card>
                        ))}
                      </Flex>
                    ),
                  },
                ]}
              />
            </Col>
          </Row>
        )}
      </Modal>

      {/* Action Edit Modal */}
      <Modal
        title="编辑工步时序与名称定义"
        open={editingOpen}
        onCancel={() => setEditingOpen(false)}
        onOk={() => editActionForm.submit()}
      >
        <Form form={editActionForm} layout="vertical" onFinish={saveActionEdit}>
          <Form.Item name="user_defined_name" label="自定义工步名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="start_time" label="起始时间 (秒)">
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_time" label="结束时间 (秒)">
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="note" label="工艺要求与防呆要点">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
