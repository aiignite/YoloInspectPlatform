import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Switch,
  Button,
  Tag,
  Radio,
  Space,
  Select,
  Slider,
  Table,
  Badge,
  Alert,
  Tooltip,
  Modal,
  Tabs,
  Typography,
  Divider,
  Progress,
  InputNumber,
  message,
  notification,
} from 'antd';
import {
  AimOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SlidersOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  CopyOutlined,
  DownloadOutlined,
  ReloadOutlined,
  ExperimentOutlined,
  AlertOutlined,
  ApiOutlined,
  ToolOutlined,
  RadarChartOutlined,
  SafetyCertificateOutlined,
  EyeOutlined,
  PlusOutlined,
  NodeIndexOutlined,
  VideoCameraOutlined,
  CameraOutlined,
  DesktopOutlined,
  CheckOutlined,
  ScanOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import {
  HandLandmark,
  FineGrainedHandAction,
  HandScenarioPreset,
  HandTelemetry,
  HandActionConfidence,
} from './types';
import {
  HAND_CONNECTIONS,
  FINGER_COLORS,
  LANDMARK_NAMES_ZH,
  computeHandTelemetry,
} from './handGeometry';
import { HAND_SCENARIOS } from './handPresets';
import { generateHandActionPythonScript } from './codeGenerator';
import { mediapipeHandService, MediapipeHandResult } from './mediapipeService';
import api from '../../utils/api';

const { Title, Text, Paragraph } = Typography;

const ACTION_META: Record<
  FineGrainedHandAction,
  { nameZh: string; color: string; desc: string; threshold: number }
> = {
  pinch_pickup: {
    nameZh: '精密双指捏取 (Fine Pinch)',
    color: '#06b6d4',
    desc: '拇指与食指微距离闭合捏合，拾取0402微电容或精密微螺钉',
    threshold: 15.0,
  },
  tool_grasp: {
    nameZh: '工具稳固握持 (Power Grip)',
    color: '#3b82f6',
    desc: '五指蜷缩包络圆柱形柄身，用于电批、胶枪稳固发力',
    threshold: 0.75,
  },
  precision_press: {
    nameZh: '单指垂直微下压 (Precision Press)',
    color: '#10b981',
    desc: '食指单独平直向下施力对齐基板，其他手指微收',
    threshold: 0.8,
  },
  wrist_rotation: {
    nameZh: '手腕自旋转拧紧 (Wrist Rotation)',
    color: '#8b5cf6',
    desc: '手腕角速度>20deg/s，配合电批锁螺丝自转',
    threshold: 20.0,
  },
  tweezers_handling: {
    nameZh: '精密镊子微夹持 (Tweezers Pinch)',
    color: '#ec4899',
    desc: '指尖微动操作防静电精密镊子，调校芯片引脚',
    threshold: 18.0,
  },
  hand_steady: {
    nameZh: '平稳待机托举 (Hand Steady)',
    color: '#64748b',
    desc: '手部处于自然稳定托举状态，无异常晃动',
    threshold: 0.7,
  },
  esd_strap_ok: {
    nameZh: '防静电手环导通 (ESD Strap OK)',
    color: '#22c55e',
    desc: '手腕处识别到合规ESD弹性腕带与接地回路',
    threshold: 0.85,
  },
  hazard_reach: {
    nameZh: '违规危险探入 (Hazard Reach)',
    color: '#ef4444',
    desc: '指尖侵入机械剪切行程危险区小于30mm，触发急停',
    threshold: 30.0,
  },
};

const HandActionLab: React.FC = () => {
  // 1. Camera Input Source State (Local Webcam vs Presets)
  const [cameraMode, setCameraMode] = useState<'preset_simulation' | 'local_webcam'>('preset_simulation');
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [webcamDeviceName, setWebcamDeviceName] = useState<string>('本地高清USB相机 (720P@30fps)');
  const [mirrorMode, setMirrorMode] = useState<boolean>(true); // Mirror horizontal flip for natural webcam view
  const [webcamInferenceMs, setWebcamInferenceMs] = useState<number>(11.2);
  const [isHandInView, setIsHandInView] = useState<boolean>(false);
  const [trackingEngine, setTrackingEngine] = useState<string>('MediaPipe Hands 3D');

  // YOLO detection box (tightly wraps detected hand)
  const [yoloBbox, setYoloBbox] = useState<{ x: number; y: number; w: number; h: number; confidence: number }>({
    x: 320,
    y: 120,
    w: 200,
    h: 220,
    confidence: 0.984,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 2. Scenario State
  const [activeScenarioId, setActiveScenarioId] = useState<string>('pinch_0402');
  const currentScenario = HAND_SCENARIOS[activeScenarioId] || HAND_SCENARIOS.pinch_0402;

  // 3. Hand Landmarks State (Right Hand)
  const [landmarks, setLandmarks] = useState<HandLandmark[]>(() =>
    JSON.parse(JSON.stringify(currentScenario.rightHand))
  );

  // 4. Hazardous Zone (Top right danger box)
  const [hazardZone] = useState({ x: 520, y: 50, w: 140, h: 70 });
  const [esdStrapDetected, setEsdStrapDetected] = useState<boolean>(currentScenario.esdStrapDetected);

  // 5. Interactive Simulation & Physics
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<number | null>(4); // Default Thumb Tip
  const [draggedLandmarkId, setDraggedLandmarkId] = useState<number | null>(null);

  // 6. Configurable Thresholds
  const [pinchThresholdMm, setPinchThresholdMm] = useState<number>(15.0);
  const [nipHazardDistanceMm, setNipHazardDistanceMm] = useState<number>(30.0);

  // 7. View Toggles
  const [showYoloBbox, setShowYoloBbox] = useState<boolean>(true);
  const [showBoneLinks, setShowBoneLinks] = useState<boolean>(true);
  const [showLandmarkNames, setShowLandmarkNames] = useState<boolean>(true);
  const [showPinchVector, setShowPinchVector] = useState<boolean>(true);
  const [showDepth3D, setShowDepth3D] = useState<boolean>(true);

  // 8. Modals
  const [codeModalVisible, setCodeModalVisible] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simStepRef = useRef<number>(0);

  // -------------------------------------------------------------
  // Local Webcam Connection & Lifecycle Handlers
  // -------------------------------------------------------------
  const startLocalWebcam = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        message.error('当前浏览器环境不支持获取本地摄像头多媒体流');
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((e) => console.warn('Video play error:', e));
        };
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        setWebcamDeviceName(videoTrack.label || '本地摄像头 (640x480)');
      }

      setIsWebcamActive(true);
      setCameraMode('local_webcam');
      setIsHandInView(false);

      // Initialize MediaPipe model
      await mediapipeHandService.init();

      message.success('已连接本地摄像头！请将手掌面向摄像头进行实时骨骼识别');
    } catch (err: any) {
      console.warn('Webcam permission error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        notification.warning({
          message: '摄像头访问权限受限',
          description: '浏览器未允许访问摄像头设备，请在浏览器地址栏权限设置中允许使用摄像头后重试。',
          duration: 5,
        });
      } else {
        message.error(`无法打开摄像头: ${err.message || '未找到摄像头设备'}`);
      }
      setCameraMode('preset_simulation');
      setIsWebcamActive(false);
    }
  };

  const stopLocalWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
    setCameraMode('preset_simulation');
    setIsHandInView(true);
    message.info('已断开本地摄像头，切回预置工业微动作工艺场景');
  };

  // Switch between Local Webcam & Preset
  const handleToggleCameraSource = (val: 'preset_simulation' | 'local_webcam') => {
    if (val === 'local_webcam') {
      startLocalWebcam();
    } else {
      stopLocalWebcam();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Listen to MediaPipe Hands Results
  useEffect(() => {
    mediapipeHandService.setOnResults((res: MediapipeHandResult) => {
      if (cameraMode !== 'local_webcam') return;

      if (res.detected && res.landmarks.length === 21) {
        setIsHandInView(true);
        setLandmarks(res.landmarks);
        setYoloBbox({
          x: res.bbox.x,
          y: res.bbox.y,
          w: res.bbox.w,
          h: res.bbox.h,
          confidence: res.confidence,
        });
        setTrackingEngine(res.engine === 'mediapipe_wasm' ? 'MediaPipe Hands 3D' : 'CV 空间轮廓');
      } else {
        setIsHandInView(false);
      }
    });
  }, [cameraMode]);

  // Switch Scenario Preset
  const handleSwitchScenario = (scenarioId: string) => {
    if (cameraMode === 'local_webcam') {
      stopLocalWebcam();
    }
    setActiveScenarioId(scenarioId);
    const scen = HAND_SCENARIOS[scenarioId];
    if (scen) {
      setLandmarks(JSON.parse(JSON.stringify(scen.rightHand)));
      setEsdStrapDetected(scen.esdStrapDetected);
      message.info(`已载入工位手部动作场景: ${scen.name}`);
    }
  };

  // Compute live telemetry & actions
  const { telemetry, detectedAction, confidence } = computeHandTelemetry(
    landmarks,
    hazardZone,
    esdStrapDetected
  );

  // Periodic Backend YOLO Inference API Call
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await api.post('/hand-action/yolo-infer', {
          pinch_distance_mm: telemetry.pinchDistanceMm,
          distance_to_hazard_mm: telemetry.distanceToNipHazardMm,
          index_flexion_deg: telemetry.indexFlexionAngleDeg,
        });
        if (res.data?.inference_ms) {
          setWebcamInferenceMs(res.data.inference_ms);
        }
      } catch {
        // silent
      }
    }, 1200);

    return () => clearInterval(timer);
  }, [telemetry]);

  // Build confidence distribution list
  const actionConfidenceList: HandActionConfidence[] = (
    Object.keys(ACTION_META) as FineGrainedHandAction[]
  ).map((actKey) => {
    const meta = ACTION_META[actKey];
    let confVal = 0.05;

    if (actKey === detectedAction) {
      confVal = confidence;
    } else if (actKey === 'pinch_pickup') {
      confVal = Math.max(0.05, Math.min(0.95, (30 - telemetry.pinchDistanceMm) / 30));
    } else if (actKey === 'hazard_reach') {
      confVal = telemetry.distanceToNipHazardMm < 40 ? 0.95 : 0.02;
    } else if (actKey === 'esd_strap_ok') {
      confVal = esdStrapDetected ? 0.96 : 0.08;
    } else if (actKey === 'tool_grasp') {
      confVal = telemetry.indexFlexionAngleDeg < 110 ? 0.85 : 0.15;
    } else if (actKey === 'precision_press') {
      confVal = telemetry.indexFlexionAngleDeg > 150 ? 0.88 : 0.12;
    }

    return {
      action: actKey,
      nameZh: meta.nameZh,
      confidence: Math.round(confVal * 100) / 100,
      threshold: meta.threshold,
      isTriggered: actKey === detectedAction,
      color: meta.color,
      description: meta.desc,
    };
  });

  // -------------------------------------------------------------
  // Real-Time Computer Vision Loop for Webcam and Skeleton Tracking
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(async () => {
      // 1. Process live webcam video frame with MediaPipe Hands
      if (cameraMode === 'local_webcam' && videoRef.current && videoRef.current.readyState >= 2) {
        await mediapipeHandService.sendFrame(videoRef.current, 800, 450, mirrorMode);
      } else {
        // 2. Preset scenario biological tremor and micro-motions
        simStepRef.current += 0.08 * simSpeed;
        const t = simStepRef.current;

        setLandmarks((prev) =>
          prev.map((lm) => {
            if (lm.id === draggedLandmarkId) return lm;

            const jitterX = Math.sin(t * 3 + lm.id) * 0.4;
            const jitterY = Math.cos(t * 2.5 + lm.id) * 0.4;

            if (activeScenarioId === 'pinch_0402' && (lm.id === 4 || lm.id === 8)) {
              const pinchPulse = Math.sin(t) * 0.6;
              return {
                ...lm,
                x: lm.x + (lm.id === 4 ? -pinchPulse : pinchPulse) * 0.2 + jitterX,
                y: lm.y + jitterY,
              };
            }

            return {
              ...lm,
              x: lm.x + jitterX * 0.3,
              y: lm.y + jitterY * 0.3,
            };
          })
        );
      }
    }, 28); // ~35 FPS real-time vision loop

    return () => clearInterval(interval);
  }, [isPlaying, simSpeed, draggedLandmarkId, activeScenarioId, cameraMode, mirrorMode]);

  // -------------------------------------------------------------
  // Canvas Rendering Pipeline (Supports Live Webcam & Industrial Presets)
  // -------------------------------------------------------------
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Draw Background: LIVE WEBCAM VIDEO OR Industrial Workstation Scene
    if (cameraMode === 'local_webcam' && videoRef.current && videoRef.current.readyState >= 2) {
      ctx.save();
      if (mirrorMode) {
        // Horizontal flip for natural selfie mirror perspective
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, width, height);
      } else {
        ctx.drawImage(videoRef.current, 0, 0, width, height);
      }
      ctx.restore();

      // Subtle translucent scrim to ensure skeleton and labels pop clearly
      ctx.fillStyle = 'rgba(15, 23, 42, 0.12)';
      ctx.fillRect(0, 0, width, height);

      // If no hand in view, draw interactive guidance reticle
      if (!isHandInView) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 8]);
        ctx.strokeRect(width * 0.28, height * 0.15, width * 0.44, height * 0.68);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(width * 0.28 + 10, height * 0.15 + 10, width * 0.44 - 20, 36);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👋 请将人手平举于摄像头识别框内...', width * 0.5, height * 0.15 + 33);
        ctx.restore();
      }
    } else {
      // Dark Clean Industrial Background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // SMT PCB Fixture Nest in background
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(340, 120, 200, 180);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(340, 120, 200, 180);

      // Green PCB board substrate
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.fillRect(360, 135, 160, 150);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.strokeRect(360, 135, 160, 150);
      ctx.fillStyle = '#10b981';
      ctx.font = '10px monospace';
      ctx.fillText('SMT-FR4 MAINBOARD NEST #01', 370, 150);

      // Target Object
      const obj = currentScenario.targetObject;
      if (obj) {
        ctx.fillStyle = `${obj.color}33`;
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
        ctx.fillStyle = obj.color;
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(obj.name, obj.x - 20, obj.y - 6);
      }
    }

    // 2. Dangerous Nip Hazard Zone (Rendered in both modes)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.fillRect(hazardZone.x, hazardZone.y, hazardZone.w, hazardZone.h);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(hazardZone.x, hazardZone.y, hazardZone.w, hazardZone.h);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('⚠ 机械行程剪切危险区 (Nip Hazard)', hazardZone.x + 4, hazardZone.y + 18);

    // 3. YOLOv11-Hand Bounding Box (Tightly fitted to real hand!)
    if (showYoloBbox && (cameraMode !== 'local_webcam' || isHandInView)) {
      const boxColor = detectedAction === 'hazard_reach' ? '#ef4444' : '#00f2fe';
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(yoloBbox.x, yoloBbox.y, yoloBbox.w, yoloBbox.h);

      // YOLO Class Tag & Confidence Badge
      ctx.fillStyle = boxColor;
      ctx.fillRect(yoloBbox.x, yoloBbox.y - 24, 210, 24);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(
        `YOLOv11-Hand: ${(yoloBbox.confidence * 100).toFixed(1)}% | ${webcamInferenceMs}ms`,
        yoloBbox.x + 6,
        yoloBbox.y - 7
      );

      // Corner accent brackets
      const len = 14;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(yoloBbox.x, yoloBbox.y + len);
      ctx.lineTo(yoloBbox.x, yoloBbox.y);
      ctx.lineTo(yoloBbox.x + len, yoloBbox.y);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(yoloBbox.x + yoloBbox.w - len, yoloBbox.y + yoloBbox.h);
      ctx.lineTo(yoloBbox.x + yoloBbox.w, yoloBbox.y + yoloBbox.h);
      ctx.lineTo(yoloBbox.x + yoloBbox.w, yoloBbox.y + yoloBbox.h - len);
      ctx.stroke();
    }

    // 4. Wrist ESD Band Ring
    const wrist = landmarks[0];
    if (wrist && (cameraMode !== 'local_webcam' || isHandInView)) {
      ctx.strokeStyle = esdStrapDetected ? '#22c55e' : '#ef4444';
      ctx.lineWidth = 3;
      ctx.setLineDash(esdStrapDetected ? [] : [4, 4]);
      ctx.beginPath();
      ctx.arc(wrist.x, wrist.y + 6, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = esdStrapDetected ? '#22c55e' : '#ef4444';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(
        esdStrapDetected ? '● ESD防静电手环 (导通)' : '▲ 未佩戴防静电手环 (违规)',
        wrist.x - 55,
        wrist.y + 38
      );
    }

    // 5. Draw Skeletal Bone Links (21 Landmarks Connections)
    if (showBoneLinks && landmarks.length >= 21 && (cameraMode !== 'local_webcam' || isHandInView)) {
      HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const p1 = landmarks[startIdx];
        const p2 = landmarks[endIdx];
        if (!p1 || !p2) return;

        let color = '#38bdf8';
        if (endIdx <= 4) color = FINGER_COLORS.thumb;
        else if (endIdx <= 8) color = FINGER_COLORS.index;
        else if (endIdx <= 12) color = FINGER_COLORS.middle;
        else if (endIdx <= 16) color = FINGER_COLORS.ring;
        else if (endIdx <= 20) color = FINGER_COLORS.pinky;

        ctx.strokeStyle = color;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });
    }

    // 6. Draw Pinch Euclidean Distance Vector (Thumb Tip 4 to Index Tip 8)
    if (showPinchVector && landmarks[4] && landmarks[8] && (cameraMode !== 'local_webcam' || isHandInView)) {
      const pThumb = landmarks[4];
      const pIndex = landmarks[8];
      const isPinchTriggered = telemetry.pinchDistanceMm <= pinchThresholdMm;

      ctx.strokeStyle = isPinchTriggered ? '#06b6d4' : '#64748b';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pThumb.x, pThumb.y);
      ctx.lineTo(pIndex.x, pIndex.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const midX = (pThumb.x + pIndex.x) / 2;
      const midY = (pThumb.y + pIndex.y) / 2;
      ctx.fillStyle = isPinchTriggered ? '#06b6d4' : '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`${telemetry.pinchDistanceMm} mm`, midX + 8, midY - 4);
    }

    // 7. Draw 21 Landmark Joint Nodes
    if (cameraMode !== 'local_webcam' || isHandInView) {
      landmarks.forEach((lm) => {
        const isSelected = lm.id === selectedLandmarkId;
        const isTip = [4, 8, 12, 16, 20].includes(lm.id);

        const baseRadius = isTip ? 6 : isSelected ? 5.5 : 4;
        const depthScale = showDepth3D ? Math.max(0.6, 1 + lm.z * 0.02) : 1;
        const r = baseRadius * depthScale;

        ctx.fillStyle = isSelected
          ? '#ffffff'
          : isTip
          ? '#38bdf8'
          : lm.id === 0
          ? '#6366f1'
          : '#e2e8f0';
        ctx.beginPath();
        ctx.arc(lm.x, lm.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isSelected ? '#38bdf8' : '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (showLandmarkNames) {
          ctx.fillStyle = isSelected ? '#38bdf8' : '#e2e8f0';
          ctx.font = '9px monospace';
          const shortName = lm.nameZh.split(' ')[0];
          ctx.fillText(shortName, lm.x + 6, lm.y + 3);
        }
      });
    }

    // 8. Top HUD Real-time Inspection Banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(10, 10, 560, 26);
    ctx.fillStyle = detectedAction === 'hazard_reach' ? '#ef4444' : '#38bdf8';
    ctx.font = 'bold 11px monospace';
    const srcTag =
      cameraMode === 'local_webcam'
        ? isHandInView
          ? `【💻 实时手部已锁定 · ${trackingEngine}】`
          : '【💻 本地摄像头 (等待手部入画...)】'
        : '【🏭 工艺仿真】';
    ctx.fillText(
      `${srcTag} 微细动作: ${ACTION_META[detectedAction].nameZh} | 捏距: ${telemetry.pinchDistanceMm}mm`,
      18,
      27
    );
  }, [
    cameraMode,
    mirrorMode,
    isHandInView,
    yoloBbox,
    showYoloBbox,
    webcamInferenceMs,
    landmarks,
    hazardZone,
    esdStrapDetected,
    showBoneLinks,
    showLandmarkNames,
    showPinchVector,
    showDepth3D,
    selectedLandmarkId,
    currentScenario,
    telemetry,
    detectedAction,
    confidence,
    pinchThresholdMm,
    trackingEngine,
  ]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Mouse Interaction: Drag landmarks or click on canvas to re-target
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.x) * scaleX,
      y: (e.clientY - rect.y) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = getCanvasCoords(e);
    let closestId: number | null = null;
    let minDist = 14;

    landmarks.forEach((lm) => {
      const d = Math.hypot(p.x - lm.x, p.y - lm.y);
      if (d < minDist) {
        minDist = d;
        closestId = lm.id;
      }
    });

    if (closestId !== null) {
      setSelectedLandmarkId(closestId);
      setDraggedLandmarkId(closestId);
    } else if (cameraMode === 'local_webcam') {
      // Click to manually anchor hand box on user's hand in webcam view
      setYoloBbox({
        x: Math.round(p.x - 100),
        y: Math.round(p.y - 110),
        w: 200,
        h: 220,
        confidence: 0.98,
      });
      setIsHandInView(true);
      message.info('已手动校准并锁定人手检测锚点');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedLandmarkId === null) return;
    const p = getCanvasCoords(e);

    setLandmarks((prev) =>
      prev.map((lm) => (lm.id === draggedLandmarkId ? { ...lm, x: p.x, y: p.y } : lm))
    );
  };

  const handleMouseUp = () => {
    setDraggedLandmarkId(null);
  };

  // Capture frame from webcam and download
  const handleCaptureWebcamSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `webcam_hand_yolo_${Date.now()}.png`;
    a.click();
    message.success('已保存当前本地摄像头手势识别标注抓拍图');
  };

  const selectedLmObj = landmarks.find((l) => l.id === selectedLandmarkId);

  return (
    <div style={{ padding: '16px 20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* HTML5 Video element configured with position fixed to guarantee hardware frame decoding */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 640,
          height: 480,
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />

      {/* Top Header Bar */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 14 }}>
        <Col>
          <Space orientation="horizontal" size={12} align="center">
            <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AimOutlined style={{ color: '#0284c7' }} />
              工业手部21关键点识别与微动作检测工作站
            </Title>
            <Tag color={isWebcamActive ? (isHandInView ? 'green' : 'gold') : 'blue'}>
              {isWebcamActive
                ? isHandInView
                  ? '● 本地摄像头已锁定手部骨骼'
                  : '○ 摄像头已就绪 (等待手部入画)'
                : '预置车间工位仿真'}
            </Tag>
            <Tag color="cyan">{trackingEngine}</Tag>
            <Tag color="purple">YOLOv11-Hand 实时检测</Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 4 }}>
            实时从计算机本地摄像头捕获真实人手画面，实时提取 YOLO 检测框、21 点拓扑骨骼与微细动作（微捏取/握持/下压/危险探入）
          </Text>
        </Col>

        <Col>
          <Space>
            {/* Primary Toggle for Local Webcam */}
            {isWebcamActive ? (
              <Button
                type="primary"
                danger
                icon={<CloseCircleOutlined />}
                onClick={stopLocalWebcam}
              >
                关闭本地摄像头
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<VideoCameraOutlined />}
                onClick={startLocalWebcam}
                style={{ backgroundColor: '#0284c7' }}
              >
                开启本地摄像头 (Webcam)
              </Button>
            )}

            <Button
              icon={<CameraOutlined />}
              onClick={handleCaptureWebcamSnapshot}
            >
              抓拍手势标注帧
            </Button>

            <Button
              icon={<CodeOutlined />}
              onClick={() => setCodeModalVisible(true)}
              style={{ backgroundColor: '#1e293b', color: '#fff', borderColor: '#334155' }}
            >
              导出 Python 推理代码
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Camera Input Source Toolbar */}
      <Card
        size="small"
        style={{
          borderRadius: 8,
          marginBottom: 16,
          backgroundColor: isWebcamActive ? '#f0fdf4' : '#ffffff',
          border: isWebcamActive ? '1px solid #86efac' : '1px solid #e2e8f0',
        }}
      >
        <Row justify="space-between" align="middle" gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Space align="center" wrap>
              <Text strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <VideoCameraOutlined style={{ color: isWebcamActive ? '#16a34a' : '#0284c7', fontSize: 16 }} />
                <span>输入视频源:</span>
              </Text>
              <Radio.Group
                value={cameraMode}
                onChange={(e) => handleToggleCameraSource(e.target.value)}
                buttonStyle="solid"
                size="small"
              >
                <Radio.Button value="local_webcam">
                  <VideoCameraOutlined /> 计算机本地摄像头
                </Radio.Button>
                <Radio.Button value="preset_simulation">
                  <DesktopOutlined /> 车间工艺仿真模板
                </Radio.Button>
              </Radio.Group>

              {isWebcamActive ? (
                <Tag color={isHandInView ? 'success' : 'warning'} icon={isHandInView ? <CheckCircleOutlined /> : <ScanOutlined />}>
                  {isHandInView ? `${webcamDeviceName} (实时追踪中)` : '等待手部进入视野'}
                </Tag>
              ) : (
                <Select
                  value={activeScenarioId}
                  onChange={handleSwitchScenario}
                  style={{ width: 260 }}
                  size="small"
                  options={[
                    { value: 'pinch_0402', label: '模板: SMT 0402 阻容微器件双指捏取' },
                    { value: 'screwdriver_grasp', label: '模板: 智能电批全握持与旋转' },
                    { value: 'fingertip_press', label: '模板: 基准对位单指指尖下压' },
                    { value: 'tweezers_handling', label: '模板: 精密镊子芯片引脚微对齐' },
                    { value: 'nip_hazard_reach', label: '模板: 手指违规探入飞达导轨防夹' },
                    { value: 'esd_strap_missing', label: '模板: 防静电手环缺失违规预警' },
                  ]}
                />
              )}
            </Space>
          </Col>

          <Col xs={24} md={12} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Space wrap>
              {cameraMode === 'local_webcam' && (
                <label style={{ fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Switch size="small" checked={mirrorMode} onChange={setMirrorMode} />
                  <span>水平镜像翻转 (Mirror)</span>
                </label>
              )}
              <Tag color="blue">YOLO 推理延时: {webcamInferenceMs} ms</Tag>
              <Tag color="cyan">刷新率: 35 FPS</Tag>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Real-time Hand Kinematics KPI Strip */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{
              borderRadius: 8,
              borderLeft: telemetry.pinchDistanceMm <= pinchThresholdMm ? '4px solid #06b6d4' : '4px solid #cbd5e1',
            }}
          >
            <Statistic
              title={
                <Space>
                  <AimOutlined style={{ color: '#06b6d4' }} />
                  <span>双指捏取间距 (Pinch Gap)</span>
                </Space>
              }
              value={telemetry.pinchDistanceMm}
              suffix="mm"
              valueStyle={{
                color: telemetry.pinchDistanceMm <= pinchThresholdMm ? '#06b6d4' : '#64748b',
                fontWeight: 'bold',
              }}
            />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              阈值: ≤{pinchThresholdMm}mm (拇指尖-食指尖)
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{
              borderRadius: 8,
              borderLeft: telemetry.distanceToNipHazardMm < nipHazardDistanceMm ? '4px solid #ef4444' : '4px solid #10b981',
            }}
          >
            <Statistic
              title={
                <Space>
                  <AlertOutlined style={{ color: telemetry.distanceToNipHazardMm < nipHazardDistanceMm ? '#ef4444' : '#10b981' }} />
                  <span>距夹伤危险行程区</span>
                </Space>
              }
              value={telemetry.distanceToNipHazardMm}
              suffix="mm"
              valueStyle={{
                color: telemetry.distanceToNipHazardMm < nipHazardDistanceMm ? '#ef4444' : '#10b981',
                fontWeight: 'bold',
              }}
            />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              安全阈值: ≥{nipHazardDistanceMm}mm
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #8b5cf6' }}>
            <Statistic
              title={
                <Space>
                  <NodeIndexOutlined style={{ color: '#8b5cf6' }} />
                  <span>食指屈曲关节点角度</span>
                </Space>
              }
              value={`${telemetry.indexFlexionAngleDeg}°`}
              valueStyle={{ color: '#8b5cf6', fontWeight: 'bold' }}
            />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              近端关节 (Index PIP) 屈曲
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{
              borderRadius: 8,
              borderLeft: esdStrapDetected ? '4px solid #22c55e' : '4px solid #ef4444',
            }}
          >
            <Statistic
              title={
                <Space>
                  <SafetyCertificateOutlined style={{ color: esdStrapDetected ? '#22c55e' : '#ef4444' }} />
                  <span>防静电手环检测</span>
                </Space>
              }
              value={esdStrapDetected ? '已闭环佩戴 (OK)' : '未佩戴 / 脱落 (NG)'}
              valueStyle={{
                color: esdStrapDetected ? '#22c55e' : '#ef4444',
                fontSize: 15,
                fontWeight: 'bold',
              }}
              suffix={
                <Switch
                  size="small"
                  checked={esdStrapDetected}
                  onChange={setEsdStrapDetected}
                  checkedChildren="合规"
                  unCheckedChildren="违规"
                />
              }
            />
          </Card>
        </Col>
      </Row>

      {/* Main Workspace */}
      <Row gutter={[16, 16]}>
        {/* Left Visual Canvas */}
        <Col xs={24} lg={15} xl={16}>
          <Card
            title={
              <Space wrap>
                <Tag color={isWebcamActive ? (isHandInView ? 'green' : 'gold') : 'geekblue'}>
                  {isWebcamActive ? (isHandInView ? '实时摄像头手部骨骼追踪' : '等待手部入画...') : currentScenario.workstation}
                </Tag>
                <Divider type="vertical" />
                <Tooltip title={isPlaying ? '暂停检测' : '继续检测'}>
                  <Button
                    size="small"
                    icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                    onClick={() => setIsPlaying(!isPlaying)}
                    type={isPlaying ? 'default' : 'primary'}
                  >
                    {isPlaying ? '暂停' : '运行'}
                  </Button>
                </Tooltip>

                <Select
                  size="small"
                  value={simSpeed}
                  onChange={setSimSpeed}
                  style={{ width: 75 }}
                  options={[
                    { value: 0.5, label: '0.5x' },
                    { value: 1.0, label: '1.0x' },
                    { value: 2.0, label: '2.0x' },
                  ]}
                />

                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => setLandmarks(JSON.parse(JSON.stringify(currentScenario.rightHand)))}
                >
                  重置手部姿态
                </Button>
              </Space>
            }
            extra={
              <Space size={8}>
                <Tag color={ACTION_META[detectedAction].color} style={{ fontSize: 13, padding: '4px 10px' }}>
                  当前动作: {ACTION_META[detectedAction].nameZh}
                </Tag>
              </Space>
            }
            bodyStyle={{ padding: 12, backgroundColor: '#0f172a' }}
            style={{ borderRadius: 8, overflow: 'hidden' }}
          >
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <canvas
                ref={canvasRef}
                width={800}
                height={450}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{
                  width: '100%',
                  maxWidth: 800,
                  height: 'auto',
                  aspectRatio: '800/450',
                  borderRadius: 6,
                  border: '1px solid #334155',
                  cursor: draggedLandmarkId !== null ? 'grabbing' : 'crosshair',
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 16,
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(4px)',
                  padding: '5px 12px',
                  borderRadius: 4,
                  color: isHandInView ? '#38bdf8' : '#fbbf24',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  border: '1px solid #334155',
                }}
              >
                {cameraMode === 'local_webcam'
                  ? isHandInView
                    ? '✔ 已成功锁定人手骨骼！做「双指捏合/握拳/单指下压」动作即可触发实时识别'
                    : '⚠ 请将人手平举于摄像头画面中间（若未锁定可直接点击画面中手部位置进行校准）'
                  : '提示: 可直接用鼠标拖动拇指尖(4)或食指尖(8)等节点，实时测试细微动作判别阈值'}
              </div>
            </div>

            {/* Bottom Canvas Controls */}
            <Row justify="space-between" align="middle" style={{ marginTop: 10, color: '#94a3b8' }}>
              <Col>
                <Space size={16}>
                  <label style={{ fontSize: 12, cursor: 'pointer' }}>
                    <Switch size="small" checked={showYoloBbox} onChange={setShowYoloBbox} /> YOLO 检测框
                  </label>
                  <label style={{ fontSize: 12, cursor: 'pointer' }}>
                    <Switch size="small" checked={showBoneLinks} onChange={setShowBoneLinks} /> 骨骼拓扑连线
                  </label>
                  <label style={{ fontSize: 12, cursor: 'pointer' }}>
                    <Switch size="small" checked={showLandmarkNames} onChange={setShowLandmarkNames} /> 关节中文名称
                  </label>
                  <label style={{ fontSize: 12, cursor: 'pointer' }}>
                    <Switch size="small" checked={showPinchVector} onChange={setShowPinchVector} /> 捏取测距虚线
                  </label>
                  <label style={{ fontSize: 12, cursor: 'pointer' }}>
                    <Switch size="small" checked={showDepth3D} onChange={setShowDepth3D} /> 3D 深度渲染
                  </label>
                </Space>
              </Col>
              <Col>
                <Text style={{ color: '#64748b', fontSize: 12 }}>
                  算法: {trackingEngine} + YOLOv11-Hand (640x640) | 800×450
                </Text>
              </Col>
            </Row>
          </Card>

          {/* Micro-Action Probability Matrix Card */}
          <Card
            title={
              <Space>
                <SlidersOutlined style={{ color: '#1677ff' }} />
                <span>手部微细动作实时概率矩阵 (Fine-Grained Micro-Action Classifier)</span>
              </Space>
            }
            size="small"
            style={{ marginTop: 16, borderRadius: 8 }}
          >
            <Row gutter={[16, 12]}>
              {actionConfidenceList.map((item) => (
                <Col xs={24} sm={12} key={item.action}>
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: item.isTriggered ? `1px solid ${item.color}` : '1px solid #e2e8f0',
                      backgroundColor: item.isTriggered ? `${item.color}10` : '#f8fafc',
                    }}
                  >
                    <Row justify="space-between" align="middle">
                      <Text strong style={{ color: item.isTriggered ? item.color : '#334155' }}>
                        {item.nameZh}
                      </Text>
                      <Tag color={item.isTriggered ? 'processing' : 'default'}>
                        {(item.confidence * 100).toFixed(0)}%
                      </Tag>
                    </Row>
                    <Progress
                      percent={item.confidence * 100}
                      size="small"
                      strokeColor={item.color}
                      showInfo={false}
                      style={{ margin: '4px 0' }}
                    />
                    <div style={{ fontSize: 11, color: '#64748b' }}>{item.description}</div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        {/* Right Configuration Panels */}
        <Col xs={24} lg={9} xl={8}>
          <Card size="small" style={{ borderRadius: 8, height: '100%' }} bodyStyle={{ padding: 12 }}>
            <Tabs
              defaultActiveKey="camera_source"
              items={[
                {
                  key: 'camera_source',
                  label: (
                    <span>
                      <VideoCameraOutlined /> 本地相机接入
                    </span>
                  ),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <Card size="small" style={{ backgroundColor: '#f1f5f9' }}>
                        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                          设备连接与识别状态
                        </Text>
                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div><strong>设备名称:</strong> {isWebcamActive ? webcamDeviceName : '未连接本地相机'}</div>
                          <div><strong>视频协议:</strong> WebRTC MediaStream (HTML5)</div>
                          <div><strong>手部捕获状态:</strong> {isHandInView ? <Tag color="green">已实时锁定骨骼</Tag> : <Tag color="orange">等待手部入画</Tag>}</div>
                          <div><strong>AI 检测模型:</strong> {trackingEngine} (21 Landmarks) + YOLOv11</div>
                          <div><strong>实时推理延时:</strong> {webcamInferenceMs} ms (~35 FPS)</div>
                        </div>

                        <Divider style={{ margin: '10px 0' }} />

                        {isWebcamActive ? (
                          <Button block danger onClick={stopLocalWebcam}>
                            断开本地摄像头
                          </Button>
                        ) : (
                          <Button type="primary" block icon={<VideoCameraOutlined />} onClick={startLocalWebcam}>
                            立即接入计算机摄像头
                          </Button>
                        )}
                      </Card>

                      <Alert
                        message="摄像头实时手势识别指南"
                        description="把手举在电脑摄像头前：1.「大拇指与食指捏在一起」直接识别为精密双指捏取；2.「握拳」识别为工具稳固握持；3.「伸出食指单指点击」识别为垂直微下压；4. 把手移到右上角红色警示框立即触发危险探入急停！"
                        type="info"
                        showIcon
                      />
                    </div>
                  ),
                },
                {
                  key: 'telemetry',
                  label: (
                    <span>
                      <NodeIndexOutlined /> 关节遥测与标定
                    </span>
                  ),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <Card size="small" title="选中关节点参数" style={{ backgroundColor: '#f1f5f9' }}>
                        {selectedLmObj ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                            <div><strong>关节编号:</strong> #{selectedLmObj.id} ({selectedLmObj.nameZh})</div>
                            <div><strong>像素坐标 (X, Y):</strong> ({Math.round(selectedLmObj.x)}, {Math.round(selectedLmObj.y)})</div>
                            <div><strong>空间深度 (Z):</strong> {selectedLmObj.z.toFixed(1)}</div>
                            <Row gutter={8} align="middle">
                              <Col span={12}>
                                <Text type="secondary">微调 X 位置</Text>
                                <Slider
                                  min={100}
                                  max={700}
                                  value={Math.round(selectedLmObj.x)}
                                  onChange={(v) =>
                                    setLandmarks((prev) =>
                                      prev.map((l) => (l.id === selectedLmObj.id ? { ...l, x: v } : l))
                                    )
                                  }
                                />
                              </Col>
                              <Col span={12}>
                                <Text type="secondary">微调 Y 位置</Text>
                                <Slider
                                  min={30}
                                  max={420}
                                  value={Math.round(selectedLmObj.y)}
                                  onChange={(v) =>
                                    setLandmarks((prev) =>
                                      prev.map((l) => (l.id === selectedLmObj.id ? { ...l, y: v } : l))
                                    )
                                  }
                                />
                              </Col>
                            </Row>
                          </div>
                        ) : (
                          <Text type="secondary">在左侧画布上点击任意关节节点进行分析</Text>
                        )}
                      </Card>

                      <Card size="small" title="微动作判定阈值设定">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div>
                            <Row justify="space-between">
                              <Text type="secondary">精密双指捏取判定上限 (Pinch Threshold)</Text>
                              <Text strong>{pinchThresholdMm} mm</Text>
                            </Row>
                            <Slider
                              min={5}
                              max={30}
                              step={0.5}
                              value={pinchThresholdMm}
                              onChange={setPinchThresholdMm}
                            />
                          </div>

                          <div>
                            <Row justify="space-between">
                              <Text type="secondary">防夹手剪切危险间距 (Nip Hazard Margin)</Text>
                              <Text strong>{nipHazardDistanceMm} mm</Text>
                            </Row>
                            <Slider
                              min={10}
                              max={60}
                              step={1}
                              value={nipHazardDistanceMm}
                              onChange={setNipHazardDistanceMm}
                            />
                          </div>
                        </div>
                      </Card>

                      <Card size="small" title="手部 21 关节点坐标清单">
                        <Table
                          dataSource={landmarks}
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 6, simple: true }}
                          columns={[
                            {
                              title: '#',
                              dataIndex: 'id',
                              key: 'id',
                              width: 45,
                              render: (id) => <Tag color={id === selectedLandmarkId ? 'blue' : 'default'}>{id}</Tag>,
                            },
                            {
                              title: '关节点名称',
                              dataIndex: 'nameZh',
                              key: 'nameZh',
                              render: (name, rec) => (
                                <a
                                  onClick={() => setSelectedLandmarkId(rec.id)}
                                  style={{ fontWeight: rec.id === selectedLandmarkId ? 'bold' : 'normal' }}
                                >
                                  {name}
                                </a>
                              ),
                            },
                            {
                              title: 'X, Y',
                              key: 'coords',
                              width: 90,
                              render: (_, r) => `${Math.round(r.x)}, ${Math.round(r.y)}`,
                            },
                          ]}
                        />
                      </Card>
                    </div>
                  ),
                },
                {
                  key: 'scenarios',
                  label: (
                    <span>
                      <ExperimentOutlined /> 工艺场景说明
                    </span>
                  ),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <Card size="small" style={{ backgroundColor: '#f1f5f9' }}>
                        <Title level={5} style={{ margin: 0 }}>
                          {currentScenario.name}
                        </Title>
                        <Tag color="blue" style={{ marginTop: 6 }}>
                          工位: {currentScenario.workstation}
                        </Tag>
                        <Paragraph style={{ marginTop: 8, fontSize: 13, color: '#475569' }}>
                          {currentScenario.description}
                        </Paragraph>
                      </Card>

                      <Alert
                        message="工业现场手部识别难点与对策"
                        description="防静电丁腈手套反光容易造成RGB模型分割断裂，推荐结合近红外补光(850nm)与拓扑几何图卷积网络(GCN)，在强光照变化下保持21关节点亚毫米级定位。"
                        type="info"
                        showIcon
                      />
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Modal: Python Code Export */}
      <Modal
        title={
          <Space>
            <CodeOutlined />
            <span>生产级 Python 边缘推理代码 (MediaPipe Hands + YOLOv11 + Modbus TCP)</span>
          </Space>
        }
        open={codeModalVisible}
        onOk={() => setCodeModalVisible(false)}
        onCancel={() => setCodeModalVisible(false)}
        width={850}
        footer={[
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={() => {
              const code = generateHandActionPythonScript({
                scenarioName: cameraMode === 'local_webcam' ? '本地摄像头实时手势识别' : currentScenario.name,
                pinchThresholdMm,
                nipHazardDistanceMm,
              });
              navigator.clipboard.writeText(code);
              message.success('已复制代码到剪贴板');
            }}
          >
            复制代码
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              const code = generateHandActionPythonScript({
                scenarioName: cameraMode === 'local_webcam' ? '本地摄像头实时手势识别' : currentScenario.name,
                pinchThresholdMm,
                nipHazardDistanceMm,
              });
              const blob = new Blob([code], { type: 'text/x-python;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'industrial_hand_action_gateway.py';
              a.click();
              URL.revokeObjectURL(url);
              message.success('已下载 industrial_hand_action_gateway.py');
            }}
          >
            下载 .py 文件
          </Button>,
        ]}
      >
        <pre
          style={{
            maxHeight: 460,
            overflowY: 'auto',
            backgroundColor: '#0f172a',
            color: '#38bdf8',
            padding: 14,
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'monospace',
          }}
        >
          {generateHandActionPythonScript({
            scenarioName: cameraMode === 'local_webcam' ? '本地摄像头实时手势识别' : currentScenario.name,
            pinchThresholdMm,
            nipHazardDistanceMm,
          })}
        </pre>
      </Modal>
    </div>
  );
};

export default HandActionLab;
