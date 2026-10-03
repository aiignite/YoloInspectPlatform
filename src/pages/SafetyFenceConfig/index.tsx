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
  InputNumber,
  Input,
  message,
  Popconfirm,
  Dropdown,
} from 'antd';
import {
  SafetyCertificateOutlined,
  EyeOutlined,
  AimOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SlidersOutlined,
  ThunderboltOutlined,
  FieldTimeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CompassOutlined,
  CodeOutlined,
  CopyOutlined,
  DownloadOutlined,
  ReloadOutlined,
  ExperimentOutlined,
  AlertOutlined,
  ApiOutlined,
  ToolOutlined,
  BorderOutlined,
  LineOutlined,
  CameraOutlined,
  PlusOutlined,
  DeleteOutlined,
  WarningOutlined,
  SettingOutlined,
  NodeIndexOutlined,
  RadarChartOutlined,
  SaveOutlined,
  PictureOutlined,
  UploadOutlined,
  VideoCameraOutlined,
  HistoryOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import {
  SafetyFenceZone,
  RecognizedObjectCalibration,
  FenceCalibrationScenario,
  Point,
  FenceType,
  DangerLevel,
  TriggerAnchor,
  IntrusionDirection,
  FenceAlarmEvent,
  CameraFenceCalibration,
} from './types';
import {
  RECOGNIZED_OBJECT_CATALOG,
  SAFETY_SCENARIOS,
} from './fencePresets';
import {
  isPointInPolygon,
  distanceToPolygon,
  getTargetAnchorPoint,
  formatPhysicalDistance,
  distanceToSegment,
} from './fenceGeometry';
import { generateSafetyFencePythonScript } from './codeGenerator';
import api from '../../utils/api';

const { Title, Text, Paragraph } = Typography;

export type CanvasTool = 'select' | 'draw_polygon' | 'draw_line' | 'edit_nodes' | 'ground_calib' | 'ruler';

interface SimObject {
  id: number;
  trackId: number;
  code: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  confidence: number;
  inDangerZone: boolean;
  activeAlarms: string[];
}

interface CameraItem {
  id: number;
  camera_id: string;
  name: string;
  location: string;
  rtsp_url: string;
  status: string;
  resolution: string;
  fps: number;
  hasCalibration?: boolean;
  zoneCount?: number;
  lastSavedAt?: string | null;
  savedBy?: string | null;
  version?: number;
}

const DEFAULT_CAMERAS: CameraItem[] = [
  {
    id: 4,
    camera_id: 'cam_safety_01',
    name: '防静电与安全穿戴监控',
    location: '车间入闸口通道',
    rtsp_url: 'rtsp://192.168.1.104:554/live/stream1',
    status: 'online',
    resolution: '1920x1080',
    fps: 25,
    hasCalibration: true,
    zoneCount: 1,
    version: 1,
    lastSavedAt: '2026-09-30T18:00:00Z',
    savedBy: '张工程师 (安全主任)',
  },
  {
    id: 5,
    camera_id: 'cam_logistics_01',
    name: 'AGV仓储物流转运区',
    location: '物流仓储C区',
    rtsp_url: 'rtsp://192.168.1.105:554/live/stream1',
    status: 'online',
    resolution: '1920x1080',
    fps: 25,
    hasCalibration: true,
    zoneCount: 2,
    version: 2,
    lastSavedAt: '2026-09-30T17:00:00Z',
    savedBy: '王主管 (物流自动化)',
  },
  {
    id: 1,
    camera_id: 'cam_smt_01',
    name: 'SMT贴片工位-01',
    location: '车间A区-SMT一号线',
    rtsp_url: 'rtsp://192.168.1.101:554/live/stream1',
    status: 'online',
    resolution: '1920x1080',
    fps: 30,
    hasCalibration: false,
    zoneCount: 0,
    version: 0,
    lastSavedAt: null,
    savedBy: null,
  },
  {
    id: 3,
    camera_id: 'cam_asm_01',
    name: '总装线螺丝锁附工位',
    location: '车间B区-组装线A',
    rtsp_url: 'rtsp://192.168.1.103:554/live/stream1',
    status: 'online',
    resolution: '1280x720',
    fps: 30,
    hasCalibration: false,
    zoneCount: 0,
    version: 0,
    lastSavedAt: null,
    savedBy: null,
  },
  {
    id: 6,
    camera_id: 'cam_pack_01',
    name: '包装质检出货台',
    location: '包装流水线03',
    rtsp_url: 'rtsp://192.168.1.106:554/live/stream1',
    status: 'online',
    resolution: '1280x720',
    fps: 30,
    hasCalibration: false,
    zoneCount: 0,
    version: 0,
    lastSavedAt: null,
    savedBy: null,
  },
];

const SafetyFenceConfig: React.FC = () => {
  // 1. Camera List & Active Camera State
  const [cameras, setCameras] = useState<CameraItem[]>(DEFAULT_CAMERAS);
  const [activeCameraId, setActiveCameraId] = useState<string>('cam_safety_01');
  const [currentCalibrationMeta, setCurrentCalibrationMeta] = useState<{
    version: number;
    lastSavedAt: string | null;
    savedBy: string | null;
    hasUnsavedChanges: boolean;
  }>({
    version: 1,
    lastSavedAt: '2026-09-30 18:00:00',
    savedBy: '张工程师 (安全主任)',
    hasUnsavedChanges: false,
  });

  // 2. Camera Background & Frame Capture State
  const [cameraFrameMode, setCameraFrameMode] = useState<'live_stream' | 'frozen_snapshot' | 'custom_image'>('live_stream');
  const [snapshotImage, setSnapshotImage] = useState<string | null>(null);
  const snapshotImgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSavingCalibration, setIsSavingCalibration] = useState<boolean>(false);

  // 3. Scenario & Presets State
  const [activeScenarioId, setActiveScenarioId] = useState<string>('robot_welding_cell');
  const currentScenario = SAFETY_SCENARIOS[activeScenarioId] || SAFETY_SCENARIOS.robot_welding_cell;

  const [zones, setZones] = useState<SafetyFenceZone[]>(() =>
    JSON.parse(JSON.stringify(currentScenario.defaultFences))
  );

  const [objectCatalog, setObjectCatalog] = useState<RecognizedObjectCalibration[]>(() =>
    JSON.parse(JSON.stringify(RECOGNIZED_OBJECT_CATALOG))
  );

  const [simObjects, setSimObjects] = useState<SimObject[]>(() =>
    currentScenario.defaultObjects.map((obj) => ({
      ...obj,
      activeAlarms: [],
    }))
  );

  // 4. Interactive Canvas State
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(zones[0]?.id || null);
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
  const [draggedNode, setDraggedNode] = useState<{ zoneId: string; nodeIndex: number } | null>(null);
  const [draggedObject, setDraggedObject] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [rulerPoints, setRulerPoints] = useState<Point[]>([]);

  // 5. Ground Perspective Calibration State
  const [groundCalibPoints, setGroundCalibPoints] = useState<Point[]>([
    { x: 120, y: 380 },
    { x: 680, y: 380 },
    { x: 580, y: 120 },
    { x: 220, y: 120 },
  ]);
  const [groundFovWidthMm, setGroundFovWidthMm] = useState<number>(7500); // 7.5 meters
  const [groundFovHeightMm, setGroundFovHeightMm] = useState<number>(5000); // 5.0 meters
  const mmPerPixel = groundFovWidthMm / 800; // ~9.38 mm/px

  // 6. View Toggles
  const [showGroundGrid, setShowGroundGrid] = useState<boolean>(true);
  const [showSafetyBuffer, setShowSafetyBuffer] = useState<boolean>(true);
  const [showAnchors, setShowAnchors] = useState<boolean>(true);
  const [showDistanceLines, setShowDistanceLines] = useState<boolean>(true);
  const [showVelocityVectors, setShowVelocityVectors] = useState<boolean>(true);

  // 7. Hardware Interlock & PLC State
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [estopRelayTripped, setEstopRelayTripped] = useState<boolean>(false);
  const [slowdownActive, setSlowdownActive] = useState<boolean>(false);
  const [andonTowerColor, setAndonTowerColor] = useState<'green' | 'amber' | 'red'>('green');
  const [buzzerActive, setBuzzerActive] = useState<boolean>(false);
  const [alarmHistory, setAlarmHistory] = useState<FenceAlarmEvent[]>([]);

  // 8. UI Modals
  const [isCodeModalVisible, setIsCodeModalVisible] = useState<boolean>(false);
  const [isJsonModalVisible, setIsJsonModalVisible] = useState<boolean>(false);
  const [newZoneModalVisible, setNewZoneModalVisible] = useState<boolean>(false);
  const [newObjectModalVisible, setNewObjectModalVisible] = useState<boolean>(false);

  // Form states for adding new zone
  const [newZoneName, setNewZoneName] = useState<string>('高危禁入防区 (Cat-4 E-Stop)');
  const [newZoneType, setNewZoneType] = useState<FenceType>('polygon');
  const [newZoneDanger, setNewZoneDanger] = useState<DangerLevel>('cat4_estop');

  // Form state for adding new target object
  const [newObjName, setNewObjName] = useState<string>('');
  const [newObjCode, setNewObjCode] = useState<string>('');
  const [newObjCategory, setNewObjCategory] = useState<'personnel' | 'ppe' | 'vehicle' | 'equipment' | 'foreign_hazard'>('foreign_hazard');
  const [newObjColor, setNewObjColor] = useState<string>('#eb2f96');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load cameras list from backend
  const fetchCamerasList = useCallback(async () => {
    try {
      const res = await api.get('/safety-fence/cameras');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setCameras(res.data);
      }
    } catch {
      // Keep DEFAULT_CAMERAS if request fails
    }
  }, []);

  useEffect(() => {
    fetchCamerasList();
  }, [fetchCamerasList]);

  // Load calibration for specific camera
  const loadCameraCalibration = useCallback(async (camId: string) => {
    try {
      const res = await api.get(`/safety-fence/cameras/${camId}/calibration`);
      const calib = res.data;
      if (calib) {
        if (Array.isArray(calib.zones) && calib.zones.length > 0) {
          setZones(calib.zones);
          setSelectedZoneId(calib.zones[0]?.id || null);
        } else {
          // Fallback to scenario default
          setZones(JSON.parse(JSON.stringify(currentScenario.defaultFences)));
          setSelectedZoneId(currentScenario.defaultFences[0]?.id || null);
        }

        if (Array.isArray(calib.groundCalibPoints) && calib.groundCalibPoints.length === 4) {
          setGroundCalibPoints(calib.groundCalibPoints);
        }
        if (calib.groundFovWidthMm) setGroundFovWidthMm(calib.groundFovWidthMm);
        if (calib.groundFovHeightMm) setGroundFovHeightMm(calib.groundFovHeightMm);

        if (calib.snapshotImage) {
          setSnapshotImage(calib.snapshotImage);
          setCameraFrameMode('frozen_snapshot');
          const img = new Image();
          img.src = calib.snapshotImage;
          img.onload = () => {
            snapshotImgRef.current = img;
          };
        } else {
          setSnapshotImage(null);
          snapshotImgRef.current = null;
          setCameraFrameMode('live_stream');
        }

        setCurrentCalibrationMeta({
          version: calib.version || 0,
          lastSavedAt: calib.lastSavedAt ? new Date(calib.lastSavedAt).toLocaleString('zh-CN') : '未保存',
          savedBy: calib.savedBy || '未标定',
          hasUnsavedChanges: false,
        });
      }
    } catch (e) {
      console.warn('Load camera calibration error:', e);
    }
  }, [currentScenario]);

  // Handle switching camera
  const handleSelectCamera = (camId: string) => {
    setActiveCameraId(camId);
    loadCameraCalibration(camId);
    const targetCam = cameras.find((c) => c.camera_id === camId);
    if (targetCam) {
      message.info(`已切换至摄像头: ${targetCam.name} (${targetCam.camera_id})`);
    }
  };

  // Switch scenario preset
  const handleSwitchScenario = (scenarioId: string) => {
    setActiveScenarioId(scenarioId);
    const scen = SAFETY_SCENARIOS[scenarioId];
    if (scen) {
      setZones(JSON.parse(JSON.stringify(scen.defaultFences)));
      setSelectedZoneId(scen.defaultFences[0]?.id || null);
      setSimObjects(
        scen.defaultObjects.map((o) => ({
          ...o,
          activeAlarms: [],
        }))
      );
      setSnapshotImage(null);
      snapshotImgRef.current = null;
      setCameraFrameMode('live_stream');
      setEstopRelayTripped(false);
      setSlowdownActive(false);
      setAndonTowerColor('green');
      setBuzzerActive(false);
      setCurrentCalibrationMeta((prev) => ({ ...prev, hasUnsavedChanges: true }));
      message.success(`已载入工业防区场景: ${scen.name}`);
    }
  };

  // -------------------------------------------------------------
  // Camera Frame Capture, Upload, and Save Handlers
  // -------------------------------------------------------------

  // 1. Capture current live canvas/camera frame to freeze for precision calibration
  const handleCaptureFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setSnapshotImage(dataUrl);
    setCameraFrameMode('frozen_snapshot');
    setIsPlaying(false); // Pause motion to allow steady drawing

    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      snapshotImgRef.current = img;
    };
    setCurrentCalibrationMeta((prev) => ({ ...prev, hasUnsavedChanges: true }));
    message.success('已抓取当前摄像头清晰工作帧，可作为底图进行高精几何防区标定');
  };

  // 2. Resume live video stream
  const handleResumeLiveStream = () => {
    setCameraFrameMode('live_stream');
    setSnapshotImage(null);
    snapshotImgRef.current = null;
    setIsPlaying(true);
    message.info('已切回实时视频流/仿真模式');
  };

  // 3. Upload custom camera snapshot from user disk
  const handleTriggerUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setSnapshotImage(dataUrl);
        setCameraFrameMode('custom_image');
        setIsPlaying(false);

        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
          snapshotImgRef.current = img;
        };
        setCurrentCalibrationMeta((prev) => ({ ...prev, hasUnsavedChanges: true }));
        message.success(`已成功载入现场相机抓拍图片: ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 4. Save Calibration to Backend Camera DB (保存标定)
  const handleSaveCalibration = async () => {
    const targetCam = cameras.find((c) => c.camera_id === activeCameraId);
    setIsSavingCalibration(true);
    try {
      const payload: Partial<CameraFenceCalibration> = {
        cameraId: activeCameraId,
        cameraName: targetCam?.name || `摄像头 ${activeCameraId}`,
        location: targetCam?.location || '生产车间',
        rtspUrl: targetCam?.rtsp_url,
        resolution: targetCam?.resolution || '1920x1080',
        fps: targetCam?.fps || 25,
        zones,
        groundCalibPoints,
        groundFovWidthMm,
        groundFovHeightMm,
        snapshotImage: snapshotImage || undefined,
        savedBy: '张工程师 (安全主任)',
      };

      const res = await api.post(`/safety-fence/cameras/${activeCameraId}/calibration`, payload);
      if (res.data?.success) {
        const calib = res.data.calibration;
        setCurrentCalibrationMeta({
          version: calib.version,
          lastSavedAt: new Date(calib.lastSavedAt).toLocaleString('zh-CN'),
          savedBy: calib.savedBy,
          hasUnsavedChanges: false,
        });

        // Update local cameras list state
        setCameras((prev) =>
          prev.map((c) =>
            c.camera_id === activeCameraId
              ? {
                  ...c,
                  hasCalibration: true,
                  zoneCount: zones.length,
                  version: calib.version,
                  lastSavedAt: calib.lastSavedAt,
                  savedBy: calib.savedBy,
                }
              : c
          )
        );

        message.success(
          `已成功保存摄像头 [${targetCam?.name || activeCameraId}] 的电子围栏标定 (版本 v${calib.version})！已持久化至工控网关数据库。`
        );
      }
    } catch (e: any) {
      message.error(`保存标定失败: ${e.message || '网络通讯异常'}`);
    } finally {
      setIsSavingCalibration(false);
    }
  };

  // 5. Export annotated snapshot image with geofences drawn on it
  const handleExportAnnotatedImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCameraId}_geofence_calibration_v${currentCalibrationMeta.version}.png`;
    a.click();
    message.success(`已导出标定底图快照: ${a.download}`);
  };

  // E-Stop Safety Reset action
  const handleResetEstop = () => {
    setEstopRelayTripped(false);
    setSlowdownActive(false);
    setAndonTowerColor('green');
    setBuzzerActive(false);
    message.success('已复位工控安全回路 (PLe安全继电器重合闸，伺服供电恢复)');
  };

  // Trigger manual test relay
  const handleTestRelay = () => {
    setEstopRelayTripped(true);
    setAndonTowerColor('red');
    setBuzzerActive(true);
    message.warning('测试脉冲注入: Cat-4 急停继电器跳闸，PLC Modbus Coil 0x0010 已置位');
  };

  // Spawn test intruder
  const handleSpawnIntruder = (type: 'unprotected_worker' | 'foreign_tool' | 'overspeed_agv') => {
    let newObj: SimObject;
    const baseId = Date.now();
    if (type === 'unprotected_worker') {
      newObj = {
        id: baseId,
        trackId: Math.floor(Math.random() * 800) + 100,
        code: 'WORKER_NO_PPE',
        label: '未戴安全帽人员 (高危)',
        x: 350 + Math.random() * 50,
        y: 200 + Math.random() * 40,
        w: 60,
        h: 100,
        vx: 0.6,
        vy: 0.4,
        confidence: 0.952,
        inDangerZone: true,
        activeAlarms: ['ZONE_ROBOT_WORKCELL'],
      };
    } else if (type === 'foreign_tool') {
      newObj = {
        id: baseId,
        trackId: Math.floor(Math.random() * 800) + 100,
        code: 'FOREIGN_OBJECT',
        label: '遗留工具箱 (外来异物)',
        x: 420,
        y: 250,
        w: 50,
        h: 40,
        vx: 0,
        vy: 0,
        confidence: 0.912,
        inDangerZone: true,
        activeAlarms: ['ZONE_ROBOT_WORKCELL'],
      };
    } else {
      newObj = {
        id: baseId,
        trackId: Math.floor(Math.random() * 800) + 100,
        code: 'AGV_TUGGER',
        label: 'AGV-09 偏航侵入',
        x: 200,
        y: 230,
        w: 75,
        h: 60,
        vx: 1.5,
        vy: 0.8,
        confidence: 0.978,
        inDangerZone: true,
        activeAlarms: [],
      };
    }
    setSimObjects((prev) => [...prev, newObj]);
    message.warning(`已向画布注入测试目标: ${newObj.label}`);
  };

  // Add new zone
  const handleAddZone = () => {
    const newId = `fence_custom_${Date.now()}`;
    const newZone: SafetyFenceZone = {
      id: newId,
      name: newZoneName,
      code: `ZONE_${Date.now().toString().slice(-4)}`,
      fenceType: newZoneType,
      dangerLevel: newZoneDanger,
      color: newZoneDanger === 'cat4_estop' ? '#ff4d4f' : newZoneDanger === 'cat2_slowdown' ? '#faad14' : '#52c41a',
      enabled: true,
      points:
        newZoneType === 'polygon'
          ? [
              { x: 300, y: 150 },
              { x: 500, y: 150 },
              { x: 500, y: 320 },
              { x: 300, y: 320 },
            ]
          : [
              { x: 250, y: 220 },
              { x: 550, y: 220 },
            ],
      triggerAnchor: 'bottom_center',
      direction: 'bidirectional',
      dwellTimeSec: 0.2,
      safetyBufferPx: 25,
      allowedClassCodes: [],
      blockedClassCodes: ['WORKER_NO_PPE', 'WORKER_CERTIFIED', 'FOREIGN_OBJECT'],
      hardwareAction: {
        estopRelay: newZoneDanger === 'cat4_estop',
        slowdownSignal: newZoneDanger === 'cat2_slowdown',
        andonColor: newZoneDanger === 'cat4_estop' ? 'red' : 'amber',
        buzzerSound: newZoneDanger === 'cat4_estop',
        plcModbusCoil: newZoneDanger === 'cat4_estop' ? '0x0010 (Emergency Relay)' : '0x0011 (Slowdown)',
      },
    };
    setZones((prev) => [...prev, newZone]);
    setSelectedZoneId(newId);
    setNewZoneModalVisible(false);
    setCurrentCalibrationMeta((prev) => ({ ...prev, hasUnsavedChanges: true }));
    message.success('已新建电子安全防区');
  };

  // Delete zone
  const handleDeleteZone = (zoneId: string) => {
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
    if (selectedZoneId === zoneId) {
      setSelectedZoneId(zones.find((z) => z.id !== zoneId)?.id || null);
    }
    setCurrentCalibrationMeta((prev) => ({ ...prev, hasUnsavedChanges: true }));
    message.info('已移除防区');
  };

  // Add new recognized object to catalog
  const handleAddObject = () => {
    if (!newObjName || !newObjCode) {
      message.error('请填写完整对象名称与编码');
      return;
    }
    const newObj: RecognizedObjectCalibration = {
      id: `obj_${newObjCode.toLowerCase()}`,
      name: newObjName,
      code: newObjCode.toUpperCase(),
      category: newObjCategory,
      color: newObjColor,
      description: '现场自定义标定对象',
      defaultAllowedZones: [],
      riskLevel: newObjCategory === 'foreign_hazard' ? 'high' : 'medium',
    };
    setObjectCatalog((prev) => [...prev, newObj]);
    setNewObjectModalVisible(false);
    setNewObjName('');
    setNewObjCode('');
    message.success(`已添加目标标定对象: ${newObj.name}`);
  };

  // -------------------------------------------------------------
  // Real-time Physics & Simulation Loop
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setSimObjects((prev) => {
        let hasEstop = false;
        let hasSlowdown = false;

        const updated = prev.map((obj) => {
          let nx = obj.x + obj.vx * simSpeed;
          let ny = obj.y + obj.vy * simSpeed;
          let nvx = obj.vx;
          let nvy = obj.vy;

          if (nx < 20 || nx + obj.w > 780) nvx = -nvx;
          if (ny < 30 || ny + obj.h > 420) nvy = -nvy;

          nx = Math.max(20, Math.min(780 - obj.w, nx));
          ny = Math.max(30, Math.min(420 - obj.h, ny));

          const activeAlarms: string[] = [];
          let isInAnyDanger = false;

          zones.forEach((zone) => {
            if (!zone.enabled) return;

            const isBlocked = zone.blockedClassCodes.includes(obj.code);
            if (!isBlocked) return;

            const anchor = getTargetAnchorPoint(
              { x: nx, y: ny, w: obj.w, h: obj.h },
              zone.triggerAnchor
            );

            let triggered = false;
            if (zone.fenceType === 'polygon' && zone.points.length >= 3) {
              triggered = isPointInPolygon(anchor, zone.points);
            } else if (zone.fenceType === 'line_tripwire' && zone.points.length >= 2) {
              const dist = distanceToSegment(anchor, zone.points[0], zone.points[1]);
              triggered = dist <= zone.safetyBufferPx;
            }

            if (triggered) {
              activeAlarms.push(zone.name);
              isInAnyDanger = true;
              if (zone.dangerLevel === 'cat4_estop') {
                hasEstop = true;
              } else if (zone.dangerLevel === 'cat2_slowdown') {
                hasSlowdown = true;
              }
            }
          });

          return {
            ...obj,
            x: nx,
            y: ny,
            vx: nvx,
            vy: nvy,
            inDangerZone: isInAnyDanger,
            activeAlarms,
          };
        });

        // Update hardware interlock state
        if (hasEstop) {
          setEstopRelayTripped(true);
          setAndonTowerColor('red');
          setBuzzerActive(true);
        } else if (hasSlowdown) {
          setSlowdownActive(true);
          setAndonTowerColor('amber');
          setBuzzerActive(false);
        } else {
          setSlowdownActive(false);
          if (!estopRelayTripped) {
            setAndonTowerColor('green');
            setBuzzerActive(false);
          }
        }

        return updated;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [isPlaying, simSpeed, zones, estopRelayTripped]);

  // Record alarm history when new intrusion occurs
  useEffect(() => {
    simObjects.forEach((obj) => {
      if (obj.inDangerZone && obj.activeAlarms.length > 0) {
        const zoneName = obj.activeAlarms[0];
        const matchingZone = zones.find((z) => z.name === zoneName);
        const danger = matchingZone?.dangerLevel || 'cat4_estop';

        setAlarmHistory((prev) => {
          const recent = prev[0];
          if (recent && recent.targetObject === obj.label && Date.now() - new Date(recent.timestamp).getTime() < 3000) {
            return prev;
          }
          const newAlarm: FenceAlarmEvent = {
            id: `ALM-${Date.now().toString().slice(-4)}`,
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
            fenceId: matchingZone?.id || 'zone_unknown',
            fenceName: zoneName,
            targetObject: `${obj.label} (#${obj.trackId})`,
            dangerLevel: danger,
            hardwareOutput:
              danger === 'cat4_estop'
                ? 'PL-e 安全继电器跳闸，伺服切断 (0x0010=1)'
                : 'PLC 减速降频指令 (0x0011=1)',
            status: 'active',
          };
          return [newAlarm, ...prev.slice(0, 19)];
        });
      }
    });
  }, [simObjects, zones]);

  // -------------------------------------------------------------
  // Canvas Rendering Pipeline (Supports Camera Snapshot & Live Feed)
  // -------------------------------------------------------------
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Render Background: Camera Snapshot OR Procedural Industrial Scenario
    if (snapshotImgRef.current && (cameraFrameMode === 'frozen_snapshot' || cameraFrameMode === 'custom_image')) {
      // Draw Real Camera Snapshot as background
      ctx.drawImage(snapshotImgRef.current, 0, 0, width, height);
      // Dark semi-transparent scrim to enhance fence contrast
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.fillRect(0, 0, width, height);
    } else {
      // Dark Industrial Visual Theme Background
      ctx.fillStyle = '#0f172a'; // Deep slate
      ctx.fillRect(0, 0, width, height);

      // Subtle Industrial Grid Pattern
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

      // Realistic Scenario Floor Markings
      if (activeScenarioId === 'robot_welding_cell') {
        // Robot base pedestal in center
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(420, 220, 55, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)';
        ctx.lineWidth = 8;
        ctx.strokeRect(170, 30, 500, 380);

        ctx.fillStyle = '#64748b';
        ctx.font = '11px monospace';
        ctx.fillText('六轴点焊工作站基座 (Kuka KR210)', 340, 225);
      } else if (activeScenarioId === 'agv_shared_corridor') {
        ctx.fillStyle = 'rgba(2, 132, 199, 0.08)';
        ctx.fillRect(180, 20, 300, 410);

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(330, 20);
        ctx.lineTo(330, 430);
        ctx.stroke();
        ctx.setLineDash([]);

        for (let y = 200; y <= 250; y += 12) {
          ctx.fillStyle = 'rgba(241, 245, 249, 0.15)';
          ctx.fillRect(140, y, 380, 6);
        }
      } else if (activeScenarioId === 'smt_feeder_safety') {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(200, 50, 400, 80);
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(200, 50, 400, 80);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.fillText('高速贴片机飞达供料平台 (High-Speed Feeder Carriage)', 240, 95);
      }
    }

    // 2. Ground Homography Perspective Grid
    if (showGroundGrid) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      const pts = groundCalibPoints;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.lineTo(pts[3].x, pts[3].y);
      ctx.closePath();
      ctx.stroke();

      if (activeTool === 'ground_calib') {
        pts.forEach((p, idx) => {
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px monospace';
          ctx.fillText(`P${idx + 1}(${p.x},${p.y})`, p.x + 8, p.y - 4);
        });
      }
    }

    // 3. Render Configured Safety Fence Zones
    zones.forEach((zone) => {
      if (!zone.enabled) return;
      const isSelected = zone.id === selectedZoneId;
      const color = zone.color;

      // Draw Buffer Outline if enabled
      if (showSafetyBuffer && zone.safetyBufferPx > 0 && zone.points.length >= 3) {
        ctx.strokeStyle = `${color}33`;
        ctx.lineWidth = zone.safetyBufferPx * 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        zone.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();
      }

      // Draw Main Zone Geometry
      if (zone.fenceType === 'polygon' && zone.points.length >= 3) {
        ctx.beginPath();
        zone.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();

        ctx.fillStyle = isSelected ? `${color}44` : `${color}25`;
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 3 : 2;
        if (zone.dangerLevel === 'cat4_estop') {
          ctx.setLineDash([8, 4]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        const centerPoint = zone.points[0];
        ctx.fillStyle = color;
        ctx.fillRect(centerPoint.x + 4, centerPoint.y + 4, 185, 24);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        const dangerText =
          zone.dangerLevel === 'cat4_estop'
            ? 'Cat-4 急停禁区'
            : zone.dangerLevel === 'cat2_slowdown'
            ? 'Cat-2 减速缓冲区'
            : 'Cat-1 预警区';
        ctx.fillText(`${zone.name} [${dangerText}]`, centerPoint.x + 8, centerPoint.y + 20);

        if (activeTool === 'edit_nodes' || isSelected) {
          zone.points.forEach((p) => {
            ctx.fillStyle = isSelected ? '#ffffff' : color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
          });
        }
      } else if (zone.fenceType === 'line_tripwire' && zone.points.length >= 2) {
        const [p1, p2] = zone.points;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);

        [p1, p2].forEach((p) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        });

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`▲ 虚拟光幕: ${zone.name}`, midX - 40, midY - 8);
      }
    });

    // 4. Draw In-Progress Drawing Points
    if (isDrawing && drawingPoints.length > 0) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      drawingPoints.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      drawingPoints.forEach((p) => {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 5. Draw Distance Ruler
    if (activeTool === 'ruler' && rulerPoints.length === 2) {
      const [r1, r2] = rulerPoints;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(r1.x, r1.y);
      ctx.lineTo(r2.x, r2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const pxDist = Math.hypot(r2.x - r1.x, r2.y - r1.y);
      const metricDist = formatPhysicalDistance(pxDist, mmPerPixel);
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`实测距离: ${metricDist} (${Math.round(pxDist)}px)`, (r1.x + r2.x) / 2, (r1.y + r2.y) / 2 - 8);
    }

    // 6. Render Detected & Simulated Objects (if not frozen custom photo or if motion is enabled)
    if (cameraFrameMode !== 'custom_image' || isPlaying) {
      simObjects.forEach((obj) => {
        const isSelected = obj.id === selectedObjectId;
        const isDanger = obj.inDangerZone;
        const catalogItem = objectCatalog.find((c) => c.code === obj.code);
        const baseColor = isDanger ? '#ef4444' : catalogItem?.color || '#3b82f6';

        if (isDanger) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
          ctx.fillRect(obj.x - 4, obj.y - 4, obj.w + 8, obj.h + 8);
        }

        ctx.strokeStyle = baseColor;
        ctx.lineWidth = isSelected ? 3 : isDanger ? 2.5 : 1.5;
        ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);

        ctx.fillStyle = baseColor;
        ctx.fillRect(obj.x, obj.y - 20, Math.max(obj.w, 140), 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(
          `#${obj.trackId} ${obj.code} ${(obj.confidence * 100).toFixed(0)}%`,
          obj.x + 4,
          obj.y - 6
        );

        if (showAnchors) {
          const anchor = getTargetAnchorPoint(
            { x: obj.x, y: obj.y, w: obj.w, h: obj.h },
            'bottom_center'
          );
          ctx.fillStyle = isDanger ? '#ef4444' : '#22c55e';
          ctx.beginPath();
          ctx.arc(anchor.x, anchor.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.strokeStyle = isDanger ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 197, 94, 0.6)';
          ctx.beginPath();
          ctx.arc(anchor.x, anchor.y, 8, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (showVelocityVectors && (Math.abs(obj.vx) > 0.05 || Math.abs(obj.vy) > 0.05)) {
          const cx = obj.x + obj.w / 2;
          const cy = obj.y + obj.h / 2;
          const arrowX = cx + obj.vx * 20;
          const arrowY = cy + obj.vy * 20;
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(arrowX, arrowY);
          ctx.stroke();
        }

        if (showDistanceLines && zones.length > 0) {
          const anchor = getTargetAnchorPoint(
            { x: obj.x, y: obj.y, w: obj.w, h: obj.h },
            'bottom_center'
          );
          const cat4Zone = zones.find((z) => z.dangerLevel === 'cat4_estop' && z.enabled);
          if (cat4Zone && cat4Zone.points.length >= 3) {
            const distPx = distanceToPolygon(anchor, cat4Zone.points);
            const physicalDist = formatPhysicalDistance(distPx, mmPerPixel);

            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(obj.x, obj.y + obj.h + 4, 120, 16);
            ctx.fillStyle = distPx < 30 ? '#ef4444' : '#94a3b8';
            ctx.font = '9px monospace';
            ctx.fillText(`距危险区: ${physicalDist}`, obj.x + 4, obj.y + obj.h + 15);
          }
        }
      });
    }

    // 7. Top-Left HUD Status Bar
    const activeCam = cameras.find((c) => c.camera_id === activeCameraId);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(10, 10, 360, 26);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px monospace';
    const modeTag =
      cameraFrameMode === 'frozen_snapshot'
        ? '[已抓拍静态帧]'
        : cameraFrameMode === 'custom_image'
        ? '[现场上传底图]'
        : '[实时视频流]';
    ctx.fillText(
      `${modeTag} ${activeCam?.camera_id || 'CAM'} | FOV: ${groundFovWidthMm}×${groundFovHeightMm}mm | ${mmPerPixel.toFixed(1)}mm/px`,
      18,
      27
    );
  }, [
    snapshotImgRef,
    cameraFrameMode,
    activeScenarioId,
    zones,
    simObjects,
    objectCatalog,
    selectedZoneId,
    selectedObjectId,
    activeTool,
    isDrawing,
    drawingPoints,
    rulerPoints,
    showGroundGrid,
    showSafetyBuffer,
    showAnchors,
    showDistanceLines,
    showVelocityVectors,
    groundCalibPoints,
    groundFovWidthMm,
    groundFovHeightMm,
    mmPerPixel,
    isPlaying,
    activeCameraId,
    cameras,
  ]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // -------------------------------------------------------------
  // Mouse Interaction Handlers
  // -------------------------------------------------------------
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
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

    if (activeTool === 'select') {
      const clickedObj = simObjects.find(
        (o) => p.x >= o.x && p.x <= o.x + o.w && p.y >= o.y && p.y <= o.y + o.h
      );
      if (clickedObj) {
        setSelectedObjectId(clickedObj.id);
        setDraggedObject(clickedObj.id);
        return;
      }
      setSelectedObjectId(null);

      const clickedZone = zones.find((z) => {
        if (z.fenceType === 'polygon') return isPointInPolygon(p, z.points);
        return false;
      });
      if (clickedZone) {
        setSelectedZoneId(clickedZone.id);
      }
    } else if (activeTool === 'edit_nodes') {
      for (const z of zones) {
        for (let i = 0; i < z.points.length; i++) {
          const node = z.points[i];
          if (Math.hypot(p.x - node.x, p.y - node.y) <= 8) {
            setDraggedNode({ zoneId: z.id, nodeIndex: i });
            setSelectedZoneId(z.id);
            setCurrentCalibrationMeta((prev) => ({ ...prev, hasUnsavedChanges: true }));
            return;
          }
        }
      }
    } else if (activeTool === 'draw_polygon') {
      setIsDrawing(true);
      if (drawingPoints.length >= 3) {
        const first = drawingPoints[0];
        if (Math.hypot(p.x - first.x, p.y - first.y) <= 12) {
          const newId = `zone_poly_${Date.now()}`;
          const newZ: SafetyFenceZone = {
            id: newId,
            name: `自定义多边形防区 ${zones.length + 1}`,
            code: `ZONE_${Date.now().toString().slice(-4)}`,
            fenceType: 'polygon',
            dangerLevel: 'cat4_estop',
            color: '#ff4d4f',
            enabled: true,
            points: [...drawingPoints],
            triggerAnchor: 'bottom_center',
            direction: 'bidirectional',
            dwellTimeSec: 0.1,
            safetyBufferPx: 20,
            allowedClassCodes: [],
            blockedClassCodes: ['WORKER_NO_PPE', 'WORKER_CERTIFIED', 'FOREIGN_OBJECT'],
            hardwareAction: {
              estopRelay: true,
              slowdownSignal: false,
              andonColor: 'red',
              buzzerSound: true,
              plcModbusCoil: '0x0010 (Emergency Relay)',
            },
          };
          setZones((prev) => [...prev, newZ]);
          setSelectedZoneId(newId);
          setIsDrawing(false);
          setDrawingPoints([]);
          setActiveTool('select');
          setCurrentCalibrationMeta((prev) => ({ ...prev, hasUnsavedChanges: true }));
          message.success('已闭合并创建新多边形电子防区');
          return;
        }
      }
      setDrawingPoints((prev) => [...prev, p]);
    } else if (activeTool === 'draw_line') {
      if (!isDrawing) {
        setIsDrawing(true);
        setDrawingPoints([p]);
      } else {
        const startPoint = drawingPoints[0];
        const newId = `line_curtain_${Date.now()}`;
        const newZ: SafetyFenceZone = {
          id: newId,
          name: `虚拟安全光幕 ${zones.length + 1}`,
          code: `LINE_${Date.now().toString().slice(-4)}`,
          fenceType: 'line_tripwire',
          dangerLevel: 'cat4_estop',
          color: '#ff4d4f',
          enabled: true,
          points: [startPoint, p],
          triggerAnchor: 'center',
          direction: 'bidirectional',
          dwellTimeSec: 0.05,
          safetyBufferPx: 15,
          allowedClassCodes: [],
          blockedClassCodes: ['WORKER_NO_PPE', 'WORKER_CERTIFIED'],
          hardwareAction: {
            estopRelay: true,
            slowdownSignal: false,
            andonColor: 'red',
            buzzerSound: true,
            plcModbusCoil: '0x0014 (Safety Light Relay)',
          },
        };
        setZones((prev) => [...prev, newZ]);
        setSelectedZoneId(newId);
        setIsDrawing(false);
        setDrawingPoints([]);
        setActiveTool('select');
        setCurrentCalibrationMeta((prev) => ({ ...prev, hasUnsavedChanges: true }));
        message.success('已创建虚拟安全光幕/绊线');
      }
    } else if (activeTool === 'ruler') {
      if (rulerPoints.length === 0 || rulerPoints.length === 2) {
        setRulerPoints([p]);
      } else {
        setRulerPoints([rulerPoints[0], p]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = getCanvasCoords(e);

    if (draggedObject !== null) {
      setSimObjects((prev) =>
        prev.map((obj) => {
          if (obj.id === draggedObject) {
            return {
              ...obj,
              x: p.x - obj.w / 2,
              y: p.y - obj.h / 2,
            };
          }
          return obj;
        })
      );
    }

    if (draggedNode !== null) {
      setZones((prev) =>
        prev.map((z) => {
          if (z.id === draggedNode.zoneId) {
            const newPoints = [...z.points];
            newPoints[draggedNode.nodeIndex] = p;
            return { ...z, points: newPoints };
          }
          return z;
        })
      );
    }
  };

  const handleMouseUp = () => {
    setDraggedObject(null);
    setDraggedNode(null);
  };

  // -------------------------------------------------------------
  // Selected Zone Mutation Handlers
  // -------------------------------------------------------------
  const currentSelectedZone = zones.find((z) => z.id === selectedZoneId);

  const updateSelectedZone = (updates: Partial<SafetyFenceZone>) => {
    if (!selectedZoneId) return;
    setZones((prev) =>
      prev.map((z) => (z.id === selectedZoneId ? { ...z, ...updates } : z))
    );
    setCurrentCalibrationMeta((prev) => ({ ...prev, hasUnsavedChanges: true }));
  };

  const activeCamObj = cameras.find((c) => c.camera_id === activeCameraId);

  return (
    <div style={{ padding: '16px 20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Hidden File Input for uploading camera snapshot images */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Top Header Bar */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 14 }}>
        <Col>
          <Space orientation="horizontal" size={12} align="center">
            <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <RadarChartOutlined style={{ color: '#1a73e8' }} />
              电子安全围栏与摄像头内容标定平台
            </Title>
            <Tag color="blue" icon={<SafetyCertificateOutlined />}>
              ISO 13849-1 PL-e 合规
            </Tag>
            <Tag color="cyan">ISO 10218-1 协作机器人防护</Tag>
            {currentCalibrationMeta.hasUnsavedChanges && (
              <Badge count="标定已修改未保存" style={{ backgroundColor: '#faad14' }} />
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 4 }}>
            支持切换车间摄像头画面、抓取实时工作帧与上传实拍图像；在摄像头内容上完成毫米级防区标定并持久化保存至工控网关
          </Text>
        </Col>

        <Col>
          <Space>
            {/* Primary Save Calibration Button */}
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={isSavingCalibration}
              onClick={handleSaveCalibration}
              style={{ backgroundColor: '#1677ff', fontWeight: 'bold' }}
            >
              保存摄像头标定 (Save)
            </Button>
            <Button icon={<PictureOutlined />} onClick={handleExportAnnotatedImage}>
              导出标定快照图
            </Button>
            <Button
              icon={<CodeOutlined />}
              onClick={() => setIsCodeModalVisible(true)}
              style={{ backgroundColor: '#1e293b', color: '#fff', borderColor: '#334155' }}
            >
              导出生产 Python 脚本
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => setIsJsonModalVisible(true)}>
              配置 JSON 规范
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Camera Selection & Snapshot Control Toolbar */}
      <Card
        size="small"
        style={{
          borderRadius: 8,
          marginBottom: 16,
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
        }}
      >
        <Row justify="space-between" align="middle" gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Space align="center" wrap>
              <Text strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CameraOutlined style={{ color: '#1a73e8', fontSize: 16 }} />
                <span>目标摄像头:</span>
              </Text>
              <Select
                value={activeCameraId}
                onChange={handleSelectCamera}
                style={{ width: 280 }}
                options={cameras.map((c) => ({
                  value: c.camera_id,
                  label: (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{c.name}</span>
                      <Tag color={c.hasCalibration ? 'green' : 'default'} style={{ fontSize: 10, marginLeft: 6 }}>
                        {c.hasCalibration ? `已标定 v${c.version}` : '未标定'}
                      </Tag>
                    </div>
                  ),
                }))}
              />
              <Tag color="geekblue">{activeCamObj?.location || '生产车间'}</Tag>
              <Tag color="cyan">{activeCamObj?.resolution || '1080P'} @ {activeCamObj?.fps || 25}fps</Tag>
            </Space>
          </Col>

          <Col xs={24} md={12} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Space wrap>
              {/* Capture Snapshot Frame Button */}
              <Tooltip title="截取当前摄像机清晰帧作为静态底图，方便精准拉框标定">
                <Button
                  icon={<CameraOutlined />}
                  onClick={handleCaptureFrame}
                  type={cameraFrameMode === 'frozen_snapshot' ? 'primary' : 'default'}
                >
                  📸 抓拍当前帧标定
                </Button>
              </Tooltip>

              {/* Upload Snapshot Button */}
              <Tooltip title="上传车间现场相机拍摄的实景高分辨率图片作为底图标定">
                <Button icon={<UploadOutlined />} onClick={handleTriggerUpload}>
                  📁 上传现场相机快照
                </Button>
              </Tooltip>

              {/* Resume Live Stream */}
              {cameraFrameMode !== 'live_stream' && (
                <Button icon={<VideoCameraOutlined />} onClick={handleResumeLiveStream}>
                  切回实时视频流
                </Button>
              )}

              {/* Scenario Preset Switcher */}
              <Divider type="vertical" />
              <Select
                value={activeScenarioId}
                onChange={handleSwitchScenario}
                style={{ width: 200 }}
                options={[
                  { value: 'robot_welding_cell', label: '模板: 机器人焊接安全岛' },
                  { value: 'agv_shared_corridor', label: '模板: AGV人车混行通廊' },
                  { value: 'smt_feeder_safety', label: '模板: SMT飞达防夹伤' },
                ]}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Industrial Safety KPI Telemetry Banner */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{
              borderRadius: 8,
              borderLeft: estopRelayTripped ? '4px solid #ff4d4f' : '4px solid #52c41a',
              backgroundColor: estopRelayTripped ? '#fff1f0' : '#ffffff',
            }}
          >
            <Statistic
              title={
                <Space>
                  <ThunderboltOutlined style={{ color: estopRelayTripped ? '#ff4d4f' : '#52c41a' }} />
                  <span>PL-e 安全继电器状态</span>
                </Space>
              }
              value={estopRelayTripped ? 'TRIPPED 急停切断' : 'NORMAL 正常吸合'}
              valueStyle={{
                color: estopRelayTripped ? '#ff4d4f' : '#52c41a',
                fontSize: 16,
                fontWeight: 'bold',
              }}
              suffix={
                estopRelayTripped ? (
                  <Button size="small" type="primary" danger onClick={handleResetEstop} style={{ marginLeft: 8 }}>
                    复位联锁
                  </Button>
                ) : null
              }
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #1a73e8' }}>
            <Statistic
              title={
                <Space>
                  <AlertOutlined />
                  <span>现场 Andon 警报灯塔</span>
                </Space>
              }
              value={
                andonTowerColor === 'red'
                  ? '🔴 RED (急停中)'
                  : andonTowerColor === 'amber'
                  ? '🟡 AMBER (减速预警)'
                  : '🟢 GREEN (全域安全)'
              }
              valueStyle={{
                color:
                  andonTowerColor === 'red'
                    ? '#ff4d4f'
                    : andonTowerColor === 'amber'
                    ? '#faad14'
                    : '#52c41a',
                fontSize: 16,
                fontWeight: 'bold',
              }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #722ed1' }}>
            <Statistic
              title={
                <Space>
                  <BorderOutlined />
                  <span>已使能电子防区</span>
                </Space>
              }
              value={`${zones.filter((z) => z.enabled).length} 个防区`}
              valueStyle={{ fontSize: 16, fontWeight: 'bold' }}
              suffix={`/ 目标池 ${objectCatalog.length} 类`}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #fa8c16' }}>
            <Statistic
              title={
                <Space>
                  <SaveOutlined />
                  <span>当前标定版本</span>
                </Space>
              }
              value={`v${currentCalibrationMeta.version}`}
              valueStyle={{ color: '#1a73e8', fontSize: 16, fontWeight: 'bold' }}
              suffix={
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                  {currentCalibrationMeta.lastSavedAt || '未保存'}
                </Text>
              }
            />
          </Card>
        </Col>
      </Row>

      {/* Main Workspace: Left Canvas & Right Configuration Panels */}
      <Row gutter={[16, 16]}>
        {/* Left Column: Interactive Visual Canvas */}
        <Col xs={24} lg={15} xl={16}>
          <Card
            title={
              <Space wrap>
                <Radio.Group
                  value={activeTool}
                  onChange={(e) => setActiveTool(e.target.value)}
                  buttonStyle="solid"
                  size="small"
                >
                  <Radio.Button value="select">
                    <AimOutlined /> 选择/检查
                  </Radio.Button>
                  <Radio.Button value="edit_nodes">
                    <NodeIndexOutlined /> 拖拽节点
                  </Radio.Button>
                  <Radio.Button value="draw_polygon">
                    <BorderOutlined /> 绘制多边形
                  </Radio.Button>
                  <Radio.Button value="draw_line">
                    <LineOutlined /> 绘制虚拟光幕
                  </Radio.Button>
                  <Radio.Button value="ground_calib">
                    <CompassOutlined /> 地坪透视标定
                  </Radio.Button>
                  <Radio.Button value="ruler">
                    <ToolOutlined /> 物理测距标尺
                  </Radio.Button>
                </Radio.Group>

                <Divider type="vertical" />

                <Tooltip title={isPlaying ? '暂停仿真/定格画面' : '恢复动态仿真视频流'}>
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
              </Space>
            }
            extra={
              <Space size={8}>
                <Button
                  size="small"
                  danger
                  icon={<PlusOutlined />}
                  onClick={() => handleSpawnIntruder('unprotected_worker')}
                >
                  注入违规人员
                </Button>
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => handleSpawnIntruder('foreign_tool')}
                >
                  注入异物
                </Button>
              </Space>
            }
            bodyStyle={{ padding: 12, backgroundColor: '#0f172a' }}
            style={{ borderRadius: 8, overflow: 'hidden' }}
          >
            {/* Visual Canvas Container */}
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
                  cursor:
                    activeTool === 'draw_polygon' || activeTool === 'draw_line'
                      ? 'crosshair'
                      : activeTool === 'edit_nodes'
                      ? 'grab'
                      : activeTool === 'ruler'
                      ? 'cell'
                      : 'default',
                  border: '1px solid #334155',
                }}
              />

              {/* Floating Canvas Mode Indicator Badge */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 16,
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(4px)',
                  padding: '4px 10px',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  border: '1px solid #334155',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: cameraFrameMode === 'live_stream' ? '#22c55e' : '#f59e0b',
                  }}
                />
                <Text style={{ color: '#f1f5f9', fontSize: 11, fontFamily: 'monospace' }}>
                  {cameraFrameMode === 'frozen_snapshot'
                    ? '已定格快照 (精确标定中)'
                    : cameraFrameMode === 'custom_image'
                    ? '实拍底图 (精确标定中)'
                    : '实时视频流 (60 FPS)'}
                </Text>
              </div>

              {/* Floating Canvas Tooltip */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 16,
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(4px)',
                  padding: '4px 10px',
                  borderRadius: 4,
                  color: '#94a3b8',
                  fontSize: 11,
                  fontFamily: 'monospace',
                }}
              >
                提示: 点击上方「📸 抓拍当前帧标定」定格画面后，在实际场景边缘绘制防区即可精准匹配
              </div>
            </div>

            {/* Bottom Canvas View Toggles */}
            <Row justify="space-between" align="middle" style={{ marginTop: 10, color: '#94a3b8' }}>
              <Col>
                <Space size={16}>
                  <label style={{ fontSize: 12, cursor: 'pointer' }}>
                    <Switch size="small" checked={showGroundGrid} onChange={setShowGroundGrid} /> 地坪透视网格
                  </label>
                  <label style={{ fontSize: 12, cursor: 'pointer' }}>
                    <Switch size="small" checked={showSafetyBuffer} onChange={setShowSafetyBuffer} /> 安全缓冲扩展区
                  </label>
                  <label style={{ fontSize: 12, cursor: 'pointer' }}>
                    <Switch size="small" checked={showAnchors} onChange={setShowAnchors} /> 触地点锚点
                  </label>
                  <label style={{ fontSize: 12, cursor: 'pointer' }}>
                    <Switch size="small" checked={showDistanceLines} onChange={setShowDistanceLines} /> 危险距离标定线
                  </label>
                  <label style={{ fontSize: 12, cursor: 'pointer' }}>
                    <Switch size="small" checked={showVelocityVectors} onChange={setShowVelocityVectors} /> 速度矢量
                  </label>
                </Space>
              </Col>
              <Col>
                <Text style={{ color: '#64748b', fontSize: 12 }}>
                  分辨率: {activeCamObj?.resolution || '1920x1080'} | RTSP: {activeCamObj?.rtsp_url || 'rtsp://...'}
                </Text>
              </Col>
            </Row>
          </Card>

          {/* Bottom Alarm Stream Log Table */}
          <Card
            title={
              <Space>
                <AlertOutlined style={{ color: '#ff4d4f' }} />
                <span>实时电子围栏入侵与工控触发流水 (Intrusion Event Audit)</span>
                <Badge count={alarmHistory.length} overflowCount={99} />
              </Space>
            }
            extra={
              <Button size="small" onClick={() => setAlarmHistory([])}>
                清空日志
              </Button>
            }
            size="small"
            style={{ marginTop: 16, borderRadius: 8 }}
          >
            <Table
              dataSource={alarmHistory}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 4, simple: true }}
              columns={[
                {
                  title: '触发时刻',
                  dataIndex: 'timestamp',
                  key: 'timestamp',
                  width: 90,
                  render: (t) => <Text style={{ fontFamily: 'monospace' }}>{t}</Text>,
                },
                {
                  title: '入侵目标',
                  dataIndex: 'targetObject',
                  key: 'targetObject',
                  render: (obj) => <Text strong>{obj}</Text>,
                },
                {
                  title: '触发防区',
                  dataIndex: 'fenceName',
                  key: 'fenceName',
                  render: (fn) => <Tag color="blue">{fn}</Tag>,
                },
                {
                  title: '安全等级',
                  dataIndex: 'dangerLevel',
                  key: 'dangerLevel',
                  width: 120,
                  render: (lvl: DangerLevel) => (
                    <Tag color={lvl === 'cat4_estop' ? 'error' : lvl === 'cat2_slowdown' ? 'warning' : 'green'}>
                      {lvl === 'cat4_estop' ? 'Cat-4 急停' : lvl === 'cat2_slowdown' ? 'Cat-2 减速' : 'Cat-1 预警'}
                    </Tag>
                  ),
                },
                {
                  title: '工控硬件输出动作',
                  dataIndex: 'hardwareOutput',
                  key: 'hardwareOutput',
                  render: (out) => (
                    <Text code style={{ fontSize: 12 }}>
                      {out}
                    </Text>
                  ),
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  width: 90,
                  render: () => <Badge status="error" text="已联锁" />,
                },
              ]}
            />
          </Card>
        </Col>

        {/* Right Column: Detailed Configuration Panels */}
        <Col xs={24} lg={9} xl={8}>
          <Card
            size="small"
            style={{ borderRadius: 8, height: '100%' }}
            bodyStyle={{ padding: 12 }}
          >
            <Tabs
              defaultActiveKey="camera_manage"
              items={[
                {
                  key: 'camera_manage',
                  label: (
                    <span>
                      <CameraOutlined /> 摄像头标定与保存
                    </span>
                  ),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Active Camera Card */}
                      <Card
                        size="small"
                        style={{
                          backgroundColor: '#f1f5f9',
                          border: currentCalibrationMeta.hasUnsavedChanges ? '1px solid #faad14' : '1px solid #cbd5e1',
                        }}
                      >
                        <Row justify="space-between" align="middle" style={{ marginBottom: 6 }}>
                          <Text strong style={{ fontSize: 14 }}>
                            {activeCamObj?.name}
                          </Text>
                          <Tag color={currentCalibrationMeta.hasUnsavedChanges ? 'warning' : 'success'}>
                            {currentCalibrationMeta.hasUnsavedChanges ? '未保存变更' : `已保存 v${currentCalibrationMeta.version}`}
                          </Tag>
                        </Row>

                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div><strong>设备编码:</strong> <Text code>{activeCamObj?.camera_id}</Text></div>
                          <div><strong>安装位置:</strong> {activeCamObj?.location}</div>
                          <div><strong>视频流:</strong> <Text code style={{ fontSize: 11 }}>{activeCamObj?.rtsp_url}</Text></div>
                          <div><strong>防区数量:</strong> {zones.length} 个防区配置</div>
                          <div><strong>最后保存:</strong> {currentCalibrationMeta.lastSavedAt || '未标定'}</div>
                          <div><strong>标定人员:</strong> {currentCalibrationMeta.savedBy || '系统管理员'}</div>
                        </div>

                        <Divider style={{ margin: '10px 0' }} />

                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            loading={isSavingCalibration}
                            onClick={handleSaveCalibration}
                          >
                            保存当前标定
                          </Button>
                          <Popconfirm
                            title="确定重新从服务端加载该摄像头的标定方案吗？未保存修改将丢失。"
                            onConfirm={() => loadCameraCalibration(activeCameraId)}
                          >
                            <Button size="small" icon={<ReloadOutlined />}>
                              重新载入
                            </Button>
                          </Popconfirm>
                        </Space>
                      </Card>

                      {/* Camera Calibration Snapshot Preview */}
                      <Card size="small" title="当前标定底图快照">
                        {snapshotImage ? (
                          <div style={{ textAlign: 'center' }}>
                            <img
                              src={snapshotImage}
                              alt="Camera Snapshot"
                              style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 4, border: '1px solid #cbd5e1' }}
                            />
                            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                              <Button size="small" icon={<PictureOutlined />} onClick={handleExportAnnotatedImage}>
                                导出快照
                              </Button>
                              <Button size="small" danger onClick={handleResumeLiveStream}>
                                清除快照底图
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8' }}>
                            <VideoCameraOutlined style={{ fontSize: 24, marginBottom: 6, display: 'block' }} />
                            <span>当前使用实时流/仿真背景</span>
                            <div style={{ marginTop: 8 }}>
                              <Button size="small" icon={<CameraOutlined />} onClick={handleCaptureFrame}>
                                立即抓拍一帧作为底图
                              </Button>
                            </div>
                          </div>
                        )}
                      </Card>

                      {/* All Cameras Calibration List */}
                      <Card size="small" title="车间全网摄像头标定状态库">
                        <Table
                          dataSource={cameras}
                          rowKey="camera_id"
                          size="small"
                          pagination={false}
                          columns={[
                            {
                              title: '摄像头',
                              dataIndex: 'name',
                              key: 'name',
                              render: (text, rec) => (
                                <a
                                  onClick={() => handleSelectCamera(rec.camera_id)}
                                  style={{ fontWeight: rec.camera_id === activeCameraId ? 'bold' : 'normal' }}
                                >
                                  {text} {rec.camera_id === activeCameraId && '👈'}
                                </a>
                              ),
                            },
                            {
                              title: '状态',
                              dataIndex: 'hasCalibration',
                              key: 'hasCalibration',
                              width: 80,
                              render: (has, rec) =>
                                has ? <Tag color="green">v{rec.version || 1}</Tag> : <Tag color="default">未标定</Tag>,
                            },
                            {
                              title: '防区',
                              dataIndex: 'zoneCount',
                              key: 'zoneCount',
                              width: 60,
                              render: (cnt) => `${cnt || 0} 个`,
                            },
                          ]}
                        />
                      </Card>
                    </div>
                  ),
                },
                {
                  key: 'zones',
                  label: (
                    <span>
                      <BorderOutlined /> 围栏防区配置
                    </span>
                  ),
                  children: (
                    <div>
                      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                        <Text strong>已配置安全防区 ({zones.length})</Text>
                        <Button
                          size="small"
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => setNewZoneModalVisible(true)}
                        >
                          新建防区
                        </Button>
                      </Row>

                      {/* Zone Selector Chips */}
                      <Space wrap style={{ marginBottom: 12 }}>
                        {zones.map((z) => (
                          <Tag.CheckableTag
                            key={z.id}
                            checked={z.id === selectedZoneId}
                            onChange={() => setSelectedZoneId(z.id)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              border: `1px solid ${z.color}`,
                            }}
                          >
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: z.color, marginRight: 6 }} />
                            {z.name}
                          </Tag.CheckableTag>
                        ))}
                      </Space>

                      {/* Current Selected Zone Detail Editor */}
                      {currentSelectedZone ? (
                        <div
                          style={{
                            padding: 12,
                            backgroundColor: '#f1f5f9',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                            <Text strong style={{ fontSize: 14 }}>
                              防区属性: {currentSelectedZone.name}
                            </Text>
                            <Space>
                              <Switch
                                checkedChildren="启用"
                                unCheckedChildren="停用"
                                checked={currentSelectedZone.enabled}
                                onChange={(chk) => updateSelectedZone({ enabled: chk })}
                              />
                              <Popconfirm
                                title="确定删除该防区吗？"
                                onConfirm={() => handleDeleteZone(currentSelectedZone.id)}
                              >
                                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                              </Popconfirm>
                            </Space>
                          </Row>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div>
                              <Text type="secondary" style={{ fontSize: 12 }}>防区名称与编码</Text>
                              <Input
                                size="small"
                                value={currentSelectedZone.name}
                                onChange={(e) => updateSelectedZone({ name: e.target.value })}
                                style={{ marginTop: 2 }}
                              />
                            </div>

                            <Row gutter={8}>
                              <Col span={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>安全等级 (ISO 13849)</Text>
                                <Select
                                  size="small"
                                  style={{ width: '100%', marginTop: 2 }}
                                  value={currentSelectedZone.dangerLevel}
                                  onChange={(val) => {
                                    updateSelectedZone({
                                      dangerLevel: val,
                                      color: val === 'cat4_estop' ? '#ff4d4f' : val === 'cat2_slowdown' ? '#faad14' : '#52c41a',
                                      hardwareAction: {
                                        ...currentSelectedZone.hardwareAction,
                                        estopRelay: val === 'cat4_estop',
                                        slowdownSignal: val === 'cat2_slowdown',
                                        andonColor: val === 'cat4_estop' ? 'red' : 'amber',
                                      },
                                    });
                                  }}
                                  options={[
                                    { value: 'cat4_estop', label: 'Cat-4 极限急停断电' },
                                    { value: 'cat2_slowdown', label: 'Cat-2 减速运行' },
                                    { value: 'cat1_warning', label: 'Cat-1 警示语音' },
                                  ]}
                                />
                              </Col>
                              <Col span={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>触发锚点模式</Text>
                                <Select
                                  size="small"
                                  style={{ width: '100%', marginTop: 2 }}
                                  value={currentSelectedZone.triggerAnchor}
                                  onChange={(val) => updateSelectedZone({ triggerAnchor: val })}
                                  options={[
                                    { value: 'bottom_center', label: '双脚触地点 (推荐)' },
                                    { value: 'center', label: '目标几何中心' },
                                    { value: 'bbox_intersect', label: '外接矩形相交' },
                                    { value: 'hands_feet_pose', label: '手部/四肢关键点' },
                                  ]}
                                />
                              </Col>
                            </Row>

                            <div>
                              <Row justify="space-between">
                                <Text type="secondary" style={{ fontSize: 12 }}>外扩安全缓冲量 (Buffer)</Text>
                                <Text strong style={{ fontSize: 12 }}>{currentSelectedZone.safetyBufferPx} px (~{Math.round(currentSelectedZone.safetyBufferPx * mmPerPixel)}mm)</Text>
                              </Row>
                              <Slider
                                min={0}
                                max={60}
                                value={currentSelectedZone.safetyBufferPx}
                                onChange={(val) => updateSelectedZone({ safetyBufferPx: val })}
                                style={{ margin: '4px 0' }}
                              />
                            </div>

                            <div>
                              <Row justify="space-between">
                                <Text type="secondary" style={{ fontSize: 12 }}>驻留消抖延时 (Dwell Time)</Text>
                                <Text strong style={{ fontSize: 12 }}>{currentSelectedZone.dwellTimeSec.toFixed(2)} 秒</Text>
                              </Row>
                              <Slider
                                min={0.05}
                                max={1.5}
                                step={0.05}
                                value={currentSelectedZone.dwellTimeSec}
                                onChange={(val) => updateSelectedZone({ dwellTimeSec: val })}
                                style={{ margin: '4px 0' }}
                              />
                            </div>

                            {/* Blacklist: Blocked Objects Selection */}
                            <div>
                              <Text type="secondary" style={{ fontSize: 12 }}>阻拦入侵目标黑名单 (Blocked Objects)</Text>
                              <Select
                                mode="multiple"
                                size="small"
                                style={{ width: '100%', marginTop: 2 }}
                                value={currentSelectedZone.blockedClassCodes}
                                onChange={(vals) => updateSelectedZone({ blockedClassCodes: vals })}
                                options={objectCatalog.map((obj) => ({
                                  value: obj.code,
                                  label: obj.name,
                                }))}
                              />
                            </div>

                            {/* Hardware Modbus Coil Mapping */}
                            <div>
                              <Text type="secondary" style={{ fontSize: 12 }}>PLC Modbus TCP 继电器线圈映射</Text>
                              <Input
                                size="small"
                                value={currentSelectedZone.hardwareAction.plcModbusCoil}
                                onChange={(e) =>
                                  updateSelectedZone({
                                    hardwareAction: {
                                      ...currentSelectedZone.hardwareAction,
                                      plcModbusCoil: e.target.value,
                                    },
                                  })
                                }
                                style={{ marginTop: 2, fontFamily: 'monospace' }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Alert message="请选择或添加防区进行编辑" type="info" showIcon />
                      )}
                    </div>
                  ),
                },
                {
                  key: 'objects',
                  label: (
                    <span>
                      <AimOutlined /> 目标识别与标定
                    </span>
                  ),
                  children: (
                    <div>
                      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                        <Text strong>目标识别与分类库 ({objectCatalog.length})</Text>
                        <Button
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => setNewObjectModalVisible(true)}
                        >
                          添加自定义对象
                        </Button>
                      </Row>

                      <Table
                        dataSource={objectCatalog}
                        rowKey="id"
                        size="small"
                        pagination={false}
                        columns={[
                          {
                            title: '对象名称',
                            dataIndex: 'name',
                            key: 'name',
                            render: (name, rec) => (
                              <div>
                                <Space>
                                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: rec.color }} />
                                  <Text strong style={{ fontSize: 13 }}>{name}</Text>
                                </Space>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{rec.description}</div>
                              </div>
                            ),
                          },
                          {
                            title: '类别代码',
                            dataIndex: 'code',
                            key: 'code',
                            width: 100,
                            render: (c) => <Tag color="blue">{c}</Tag>,
                          },
                          {
                            title: '风险等级',
                            dataIndex: 'riskLevel',
                            key: 'riskLevel',
                            width: 80,
                            render: (lvl) => (
                              <Tag color={lvl === 'high' ? 'red' : lvl === 'medium' ? 'orange' : 'green'}>
                                {lvl === 'high' ? '高危' : lvl === 'medium' ? '中等' : '合规'}
                              </Tag>
                            ),
                          },
                        ]}
                      />
                    </div>
                  ),
                },
                {
                  key: 'calib',
                  label: (
                    <span>
                      <CompassOutlined /> 地坪透视标定
                    </span>
                  ),
                  children: (
                    <div>
                      <Paragraph style={{ fontSize: 12, color: '#64748b' }}>
                        通过 4 点地坪单应性矩阵 (Homography)，建立工业摄像机像素坐标系与地面实际物理毫米/米制坐标的透视映射。
                      </Paragraph>

                      <Row gutter={8} style={{ marginBottom: 12 }}>
                        <Col span={12}>
                          <Text type="secondary" style={{ fontSize: 12 }}>现场横向跨度 (X FOV)</Text>
                          <InputNumber
                            size="small"
                            addonAfter="mm"
                            value={groundFovWidthMm}
                            onChange={(val) => {
                              setGroundFovWidthMm(val || 7500);
                              setCurrentCalibrationMeta((prev) => ({ ...prev, hasUnsavedChanges: true }));
                            }}
                            style={{ width: '100%', marginTop: 2 }}
                          />
                        </Col>
                        <Col span={12}>
                          <Text type="secondary" style={{ fontSize: 12 }}>现场纵向进深 (Y FOV)</Text>
                          <InputNumber
                            size="small"
                            addonAfter="mm"
                            value={groundFovHeightMm}
                            onChange={(val) => {
                              setGroundFovHeightMm(val || 5000);
                              setCurrentCalibrationMeta((prev) => ({ ...prev, hasUnsavedChanges: true }));
                            }}
                            style={{ width: '100%', marginTop: 2 }}
                          />
                        </Col>
                      </Row>

                      <Card size="small" style={{ backgroundColor: '#f8fafc', marginBottom: 12 }}>
                        <Statistic
                          title="当前地坪比例尺系数"
                          value={mmPerPixel.toFixed(2)}
                          suffix="mm / 像素"
                          valueStyle={{ color: '#1a73e8', fontSize: 16, fontWeight: 'bold' }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          100 像素目标相当于地面实际物理宽度约 {(mmPerPixel * 100 / 10).toFixed(1)} cm
                        </Text>
                      </Card>

                      <Button
                        type={activeTool === 'ground_calib' ? 'primary' : 'default'}
                        icon={<CompassOutlined />}
                        block
                        onClick={() => {
                          setActiveTool('ground_calib');
                          message.info('已开启地坪 4 点标定模式，可在左侧画布中拖动 4 个蓝色角点');
                        }}
                      >
                        {activeTool === 'ground_calib' ? '正在标定地坪点' : '启动 4 点地坪透视标定'}
                      </Button>
                    </div>
                  ),
                },
                {
                  key: 'hardware',
                  label: (
                    <span>
                      <ApiOutlined /> 工控PLC联动
                    </span>
                  ),
                  children: (
                    <div>
                      <Paragraph style={{ fontSize: 12, color: '#64748b' }}>
                        硬件联锁接口驱动。支持西门子 S7-1200 / 1500、三菱 FX5U、欧姆龙 NX 系列安全 PLC 协议集成。
                      </Paragraph>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <Card size="small" style={{ backgroundColor: '#f1f5f9' }}>
                          <Row justify="space-between" align="middle">
                            <Text strong style={{ fontSize: 13 }}>PL-e 安全干接点跳闸继电器</Text>
                            <Badge
                              status={estopRelayTripped ? 'error' : 'success'}
                              text={estopRelayTripped ? '已跳开 (E-Stop)' : '闭合运行'}
                            />
                          </Row>
                        </Card>

                        <Card size="small" style={{ backgroundColor: '#f1f5f9' }}>
                          <Row justify="space-between" align="middle">
                            <Text strong style={{ fontSize: 13 }}>PLC 20% 减速降频超频指令</Text>
                            <Badge
                              status={slowdownActive ? 'warning' : 'default'}
                              text={slowdownActive ? '减速生效中' : '全速'}
                            />
                          </Row>
                        </Card>

                        <Card size="small" style={{ backgroundColor: '#f1f5f9' }}>
                          <Row justify="space-between" align="middle">
                            <Text strong style={{ fontSize: 13 }}>Modbus TCP 通讯主机</Text>
                            <Text code>192.168.1.200:502</Text>
                          </Row>
                        </Card>

                        <Button type="primary" block danger={estopRelayTripped} onClick={handleResetEstop}>
                          复位现场工控安全回路
                        </Button>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Modal: Python Supervision Code Export */}
      <Modal
        title={
          <Space>
            <CodeOutlined />
            <span>生产级 Python 边缘监控部署代码 (YOLOv11 + Supervision + Modbus TCP)</span>
          </Space>
        }
        open={isCodeModalVisible}
        onOk={() => setIsCodeModalVisible(false)}
        onCancel={() => setIsCodeModalVisible(false)}
        width={850}
        footer={[
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={() => {
              const code = generateSafetyFencePythonScript({
                scenarioName: currentScenario.name,
                zones,
                objects: objectCatalog,
                cameraRtspUrl: activeCamObj?.rtsp_url,
                mmPerPixel,
              });
              navigator.clipboard.writeText(code);
              message.success('已复制 Python 部署代码到剪贴板');
            }}
          >
            复制代码
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              const code = generateSafetyFencePythonScript({
                scenarioName: currentScenario.name,
                zones,
                objects: objectCatalog,
                cameraRtspUrl: activeCamObj?.rtsp_url,
                mmPerPixel,
              });
              const blob = new Blob([code], { type: 'text/x-python;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `industrial_safety_fence_${activeCameraId}.py`;
              a.click();
              URL.revokeObjectURL(url);
              message.success(`已下载 industrial_safety_fence_${activeCameraId}.py`);
            }}
          >
            下载 .py 文件
          </Button>,
        ]}
      >
        <Paragraph style={{ fontSize: 13, color: '#64748b' }}>
          本脚本已自动嵌入针对摄像头 <strong>{activeCamObj?.name} ({activeCamObj?.camera_id})</strong> 当前实时标定的多边形顶点坐标、虚拟光幕线、安全等级、触发锚点与 PLC Modbus TCP 继电器控制逻辑，可直接部署在现场工控机 (IPC) 或 NVIDIA Jetson 边缘计算盒上。
        </Paragraph>
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
          {generateSafetyFencePythonScript({
            scenarioName: currentScenario.name,
            zones,
            objects: objectCatalog,
            cameraRtspUrl: activeCamObj?.rtsp_url,
            mmPerPixel,
          })}
        </pre>
      </Modal>

      {/* Modal: JSON Configuration Export */}
      <Modal
        title={
          <Space>
            <DownloadOutlined />
            <span>标准电子围栏配置规范 (JSON Schema)</span>
          </Space>
        }
        open={isJsonModalVisible}
        onOk={() => setIsJsonModalVisible(false)}
        onCancel={() => setIsJsonModalVisible(false)}
        width={750}
        footer={[
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(zones, null, 2));
              message.success('已复制配置 JSON');
            }}
          >
            复制 JSON
          </Button>,
          <Button key="close" type="primary" onClick={() => setIsJsonModalVisible(false)}>
            完成
          </Button>,
        ]}
      >
        <pre
          style={{
            maxHeight: 420,
            overflowY: 'auto',
            backgroundColor: '#0f172a',
            color: '#a7f3d0',
            padding: 14,
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'monospace',
          }}
        >
          {JSON.stringify(
            {
              cameraId: activeCameraId,
              cameraName: activeCamObj?.name,
              zones,
              groundCalibPoints,
              groundFovWidthMm,
              groundFovHeightMm,
              version: currentCalibrationMeta.version,
              lastSavedAt: currentCalibrationMeta.lastSavedAt,
            },
            null,
            2
          )}
        </pre>
      </Modal>

      {/* Modal: New Zone Creation */}
      <Modal
        title="新建电子安全防区"
        open={newZoneModalVisible}
        onOk={handleAddZone}
        onCancel={() => setNewZoneModalVisible(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Text type="secondary">防区名称</Text>
            <Input
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              placeholder="例如: 冲压机行程危险禁区"
              style={{ marginTop: 4 }}
            />
          </div>

          <div>
            <Text type="secondary">几何类型</Text>
            <Radio.Group
              value={newZoneType}
              onChange={(e) => setNewZoneType(e.target.value)}
              style={{ marginTop: 4, display: 'flex', gap: 8 }}
            >
              <Radio.Button value="polygon">任意多边形防区</Radio.Button>
              <Radio.Button value="line_tripwire">虚拟光幕绊线</Radio.Button>
            </Radio.Group>
          </div>

          <div>
            <Text type="secondary">安全防护等级 (ISO 13849-1)</Text>
            <Select
              value={newZoneDanger}
              onChange={setNewZoneDanger}
              style={{ width: '100%', marginTop: 4 }}
              options={[
                { value: 'cat4_estop', label: 'Cat-4 极限急停断电 (PL-e 安全继电器跳闸)' },
                { value: 'cat2_slowdown', label: 'Cat-2 人机混行减速预警 (PLC 限速 20%)' },
                { value: 'cat1_warning', label: 'Cat-1 通行预警语音播报' },
              ]}
            />
          </div>
        </div>
      </Modal>

      {/* Modal: New Target Object Creation */}
      <Modal
        title="添加自定义识别标定对象"
        open={newObjectModalVisible}
        onOk={handleAddObject}
        onCancel={() => setNewObjectModalVisible(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Text type="secondary">对象中文名称</Text>
            <Input
              value={newObjName}
              onChange={(e) => setNewObjName(e.target.value)}
              placeholder="例如: 物料搬运托盘车"
              style={{ marginTop: 4 }}
            />
          </div>

          <div>
            <Text type="secondary">对象大写代码 (Code)</Text>
            <Input
              value={newObjCode}
              onChange={(e) => setNewObjCode(e.target.value)}
              placeholder="例如: PALLET_CARRIER"
              style={{ marginTop: 4 }}
            />
          </div>

          <div>
            <Text type="secondary">对象类别</Text>
            <Select
              value={newObjCategory}
              onChange={setNewObjCategory}
              style={{ width: '100%', marginTop: 4 }}
              options={[
                { value: 'personnel', label: '人员与操作工' },
                { value: 'vehicle', label: 'AGV / 叉车 / 车辆' },
                { value: 'equipment', label: '机械臂 / 运动机构' },
                { value: 'foreign_hazard', label: '外来异物 / 工具遗留' },
              ]}
            />
          </div>

          <div>
            <Text type="secondary">标注色标</Text>
            <Input
              type="color"
              value={newObjColor}
              onChange={(e) => setNewObjColor(e.target.value)}
              style={{ width: 80, height: 36, marginTop: 4, padding: 0 }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SafetyFenceConfig;
