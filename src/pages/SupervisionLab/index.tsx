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
  Upload,
  message,
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
  BarChartOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CompassOutlined,
  CodeOutlined,
  CopyOutlined,
  DownloadOutlined,
  ReloadOutlined,
  ExperimentOutlined,
  ZoomInOutlined,
  UploadOutlined,
  AlertOutlined,
  ApiOutlined,
  ToolOutlined,
  BorderOutlined,
  LineOutlined,
  CameraOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import {
  IndustrialSceneId,
  CanvasToolMode,
  CvFilterMode,
  AnnotatorStyle,
  Point,
  TrackedIndustrialObject,
  PolygonZoneConfig,
  LineZoneConfig,
  DefectEventLog,
  PlcSignalState,
} from './types';
import { SCENE_PRESETS } from './scenePresets';
import {
  isPointInPolygon,
  checkLineCrossing,
  applyCvFilter,
  drawInspectionLoupe,
} from './supervisionCvShaders';
import { generatePythonSupervisionScript } from './codeGenerator';

const { Text, Paragraph } = Typography;
const { Option } = Select;

export const SupervisionLab: React.FC = () => {
  // Current active scene
  const [currentSceneId, setCurrentSceneId] = useState<IndustrialSceneId>('smt_aoi');
  const scene = SCENE_PRESETS[currentSceneId];

  // Canvas interaction mode & CV filter
  const [toolMode, setToolMode] = useState<CanvasToolMode>('select');
  const [cvFilter, setCvFilter] = useState<CvFilterMode>('normal');
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [loupeZoom, setLoupeZoom] = useState<number>(3.5);

  // Active Zones configuration
  const [polygonZone, setPolygonZone] = useState<PolygonZoneConfig>(scene.defaultPolygon);
  const [lineZone, setLineZone] = useState<LineZoneConfig>(scene.defaultLineZone);

  // Optical calibration
  const [mmPerPixel, setMmPerPixel] = useState<number>(scene.mmPerPixel);

  // Supervision Annotator Matrix Toggles
  const [enablePolygonZone, setEnablePolygonZone] = useState<boolean>(true);
  const [enableLineCounter, setEnableLineCounter] = useState<boolean>(true);
  const [enableByteTrack, setEnableByteTrack] = useState<boolean>(true);
  const [enableTraceAnnotator, setEnableTraceAnnotator] = useState<boolean>(true);
  const [enableHeatmap, setEnableHeatmap] = useState<boolean>(false);
  const [enableMaskAnnotator, setEnableMaskAnnotator] = useState<boolean>(true);
  const [enableCentroidDot, setEnableCentroidDot] = useState<boolean>(true);
  const [enablePhysicalSize, setEnablePhysicalSize] = useState<boolean>(true);
  const [annotatorStyle, setAnnotatorStyle] = useState<AnnotatorStyle>('corner');
  const [traceLength, setTraceLength] = useState<number>(25);

  // Confidence & IoU thresholds
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.5);

  // Target Inspector Drawer/Modal
  const [selectedObject, setSelectedObject] = useState<TrackedIndustrialObject | null>(null);

  // Caliper ruler points
  const [rulerPoints, setRulerPoints] = useState<Point[]>([]);

  // Mouse drag state for editing polygon vertices or line handles
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const [draggingLineHandle, setDraggingLineHandle] = useState<'start' | 'end' | 'both' | null>(null);
  const [cursorPos, setCursorPos] = useState<Point>({ x: 300, y: 200 });

  // Custom uploaded background image
  const [customImage, setCustomImage] = useState<HTMLImageElement | null>(null);

  // Python Script Code Modal
  const [codeModalVisible, setCodeModalVisible] = useState<boolean>(false);

  // PLC and Andon Tower simulation state
  const [plcState, setPlcState] = useState<PlcSignalState>({
    andonLight: 'green',
    buzzerActive: false,
    pneumaticCylinderActive: false,
    emergencyStopLine: false,
    modbusTcpConnected: true,
    plcPulseCount: 42,
    lastTriggerTime: '14:28:10',
  });

  // Recent defect events list
  const [defectLogs, setDefectLogs] = useState<DefectEventLog[]>([
    {
      id: 'EVT-1082',
      timestamp: '14:32:05',
      sceneName: 'SMT 高速贴片与回流焊 AOI 质检',
      trackId: 103,
      title: 'QFP-128 引脚微间距连锡',
      type: 'Solder_Bridge',
      severity: 'critical',
      confidence: 0.964,
      location: 'U4 (QFP-128) Pin 42-43',
      reviewedStatus: 'confirmed_ng',
      plcTriggered: true,
    },
    {
      id: 'EVT-1081',
      timestamp: '14:31:12',
      sceneName: 'SMT 高速贴片与回流焊 AOI 质检',
      trackId: 104,
      title: '0201微贴片电容立碑 (Tombstone)',
      type: 'Tombstone',
      severity: 'major',
      confidence: 0.952,
      location: 'C12 (0201微阻容)',
      reviewedStatus: 'pending',
      plcTriggered: true,
    },
    {
      id: 'EVT-1080',
      timestamp: '14:28:44',
      sceneName: 'SMT 高速贴片与回流焊 AOI 质检',
      trackId: 107,
      title: '工件外框飞溅微小锡珠',
      type: 'Solder_Ball',
      severity: 'minor',
      confidence: 0.887,
      location: 'PCB 边缘间距区',
      reviewedStatus: 'false_alarm',
      plcTriggered: false,
    },
  ]);

  // Tracked objects pool in canvas
  const objectsRef = useRef<TrackedIndustrialObject[]>(scene.initialObjects());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tickRef = useRef<number>(0);

  // Heatmap accumulator points
  const heatmapHistoryRef = useRef<{ x: number; y: number; weight: number }[]>([]);

  // Sync scene change
  const handleSceneChange = (sceneId: IndustrialSceneId) => {
    setCurrentSceneId(sceneId);
    const targetScene = SCENE_PRESETS[sceneId];
    setPolygonZone(targetScene.defaultPolygon);
    setLineZone(targetScene.defaultLineZone);
    setMmPerPixel(targetScene.mmPerPixel);
    objectsRef.current = targetScene.initialObjects();
    heatmapHistoryRef.current = [];
    setSelectedObject(null);
    setRulerPoints([]);
    message.success(`已切换至工业现场场景: ${targetScene.name}`);
  };

  // Trigger simulated PLC ejector action
  const triggerPlcAction = useCallback((reason: string, isCritical: boolean = false) => {
    setPlcState((prev) => ({
      ...prev,
      andonLight: isCritical ? 'red' : 'amber',
      buzzerActive: isCritical,
      pneumaticCylinderActive: true,
      emergencyStopLine: isCritical && prev.emergencyStopLine,
      plcPulseCount: prev.plcPulseCount + 1,
      lastTriggerTime: new Date().toLocaleTimeString(),
    }));

    // Auto reset pneumatic cylinder pulse after 800ms
    setTimeout(() => {
      setPlcState((prev) => ({
        ...prev,
        pneumaticCylinderActive: false,
        buzzerActive: false,
        andonLight: prev.andonLight === 'red' ? 'amber' : 'green',
      }));
    }, 800);
  }, []);

  // Main canvas animation and rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      tickRef.current += 1;
      const tick = tickRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // 1. Render Industrial Field Background
      if (currentSceneId === 'custom_upload' && customImage) {
        ctx.drawImage(customImage, 0, 0, width, height);
      } else {
        scene.drawBackground(ctx, width, height, tick);
      }

      // 2. Render PolygonZone & PolygonZoneAnnotator
      if (enablePolygonZone && polygonZone.enabled && polygonZone.points.length >= 3) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(polygonZone.points[0].x, polygonZone.points[0].y);
        for (let i = 1; i < polygonZone.points.length; i++) {
          ctx.lineTo(polygonZone.points[i].x, polygonZone.points[i].y);
        }
        ctx.closePath();

        const inZoneObjects = objectsRef.current.filter((o) => o.inZone);
        const hasViolations = inZoneObjects.some((o) =>
          polygonZone.alertClassFilter.some((f) => o.className.includes(f) || o.category === 'defect')
        );

        ctx.fillStyle = hasViolations ? 'rgba(255, 77, 79, 0.2)' : 'rgba(0, 242, 254, 0.12)';
        ctx.fill();

        ctx.strokeStyle = hasViolations ? '#ff4d4f' : polygonZone.color;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 6]);
        ctx.stroke();

        // PolygonZoneAnnotator Title Banner
        const p0 = polygonZone.points[0];
        ctx.fillStyle = hasViolations ? 'rgba(255, 77, 79, 0.95)' : 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(p0.x, p0.y - 24, 230, 24);
        ctx.strokeStyle = hasViolations ? '#ff4d4f' : polygonZone.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(p0.x, p0.y - 24, 230, 24);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(
          `PolygonZone: ${inZoneObjects.length} 目标 ${hasViolations ? '⚠️ 违规/缺陷报警' : '✓ 正常'}`,
          p0.x + 8,
          p0.y - 8
        );
        ctx.restore();

        // If in edit_polygon mode, draw interactive vertex drag handles
        if (toolMode === 'edit_polygon') {
          polygonZone.points.forEach((pt, idx) => {
            ctx.save();
            ctx.fillStyle = draggingVertexIndex === idx ? '#faad14' : '#00f2fe';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Vertex index label
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px monospace';
            ctx.fillText(`P${idx + 1}`, pt.x + 9, pt.y + 4);
            ctx.restore();
          });
        }
      }

      // 3. Render LineZone & LineZoneAnnotator
      if (enableLineCounter && lineZone.enabled) {
        ctx.save();
        ctx.strokeStyle = lineZone.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(lineZone.start.x, lineZone.start.y);
        ctx.lineTo(lineZone.end.x, lineZone.end.y);
        ctx.stroke();

        // Direction arrow normal
        const midX = (lineZone.start.x + lineZone.end.x) / 2;
        const midY = (lineZone.start.y + lineZone.end.y) / 2;
        const dx = lineZone.end.x - lineZone.start.x;
        const dy = lineZone.end.y - lineZone.start.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        // Normal vector
        const nx = -dy / len;
        const ny = dx / len;

        ctx.strokeStyle = lineZone.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX + nx * 18, midY + ny * 18);
        ctx.stroke();

        // Arrow head
        ctx.fillStyle = lineZone.color;
        ctx.beginPath();
        ctx.arc(midX + nx * 18, midY + ny * 18, 4, 0, Math.PI * 2);
        ctx.fill();

        // LineZone Annotator Text Pill
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(lineZone.start.x, lineZone.start.y - 28, 175, 24);
        ctx.strokeStyle = lineZone.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(lineZone.start.x, lineZone.start.y - 28, 175, 24);

        ctx.fillStyle = lineZone.color;
        ctx.font = 'bold 11px monospace';
        ctx.fillText(
          `IN: ${lineZone.inCount} | OUT: ${lineZone.outCount} (98.3%)`,
          lineZone.start.x + 8,
          lineZone.start.y - 12
        );
        ctx.restore();

        // If in edit_line mode, draw start & end handle points
        if (toolMode === 'edit_line') {
          const drawHandle = (p: Point, label: string) => {
            ctx.save();
            ctx.fillStyle = '#faad14';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px monospace';
            ctx.fillText(label, p.x + 10, p.y + 4);
            ctx.restore();
          };
          drawHandle(lineZone.start, 'Start');
          drawHandle(lineZone.end, 'End');
        }
      }

      // 4. Update and Render Multi-Object Tracker (ByteTrack & Supervision Annotators)
      objectsRef.current.forEach((obj) => {
        const oldPos: Point = { x: obj.x + obj.w / 2, y: obj.y + obj.h / 2 };

        // Simulation movement
        if (isSimulating) {
          if (obj.className.includes('PCB') || obj.className.includes('Cell') || obj.className.includes('Die')) {
            obj.y += obj.speed;
            if (obj.y > height + 30) {
              obj.y = -60;
              obj.crossedLine = false;
              obj.history = [];
            }
          } else {
            // Worker / AGV / Defect micro-vibration
            obj.x += obj.vx;
            obj.y += obj.vy;
            if (obj.x < 240 || obj.x > width - 100) obj.vx *= -1;
            if (obj.y < 60 || obj.y > height - 80) obj.vy *= -1;
          }

          const newPos: Point = { x: obj.x + obj.w / 2, y: obj.y + obj.h / 2 };

          // LineZone crossing check
          if (enableLineCounter && lineZone.enabled && !obj.crossedLine) {
            const crossResult = checkLineCrossing(oldPos, newPos, lineZone.start, lineZone.end);
            if (crossResult.crossed) {
              obj.crossedLine = true;
              if (crossResult.direction === 'in') {
                setLineZone((l) => ({ ...l, inCount: l.inCount + 1 }));
              } else {
                setLineZone((l) => ({ ...l, outCount: l.outCount + 1 }));
              }
            }
          }

          // Trace annotator trail history
          if (enableTraceAnnotator) {
            obj.history.push({ ...newPos });
            if (obj.history.length > traceLength) obj.history.shift();
          }

          // Heatmap accumulator
          if (enableHeatmap && tick % 6 === 0) {
            heatmapHistoryRef.current.push({
              x: newPos.x,
              y: newPos.y,
              weight: obj.category === 'defect' ? 1.0 : 0.4,
            });
            if (heatmapHistoryRef.current.length > 200) {
              heatmapHistoryRef.current.shift();
            }
          }
        }

        const centerPos: Point = { x: obj.x + obj.w / 2, y: obj.y + obj.h / 2 };
        const inPoly = isPointInPolygon(centerPos, polygonZone.points);
        const wasInZone = obj.inZone;
        obj.inZone = inPoly;

        if (inPoly) {
          obj.zoneDwellFrames += 1;
          // Trigger PLC alarm on new critical defect / danger intrusion
          if (!wasInZone && (obj.category === 'defect' || obj.status === 'danger_intrusion')) {
            triggerPlcAction(obj.defectName || obj.className, true);
          }
        } else {
          obj.zoneDwellFrames = 0;
        }

        // Draw Trace Annotator
        if (enableTraceAnnotator && obj.history.length > 1) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(obj.history[0].x, obj.history[0].y);
          for (let i = 1; i < obj.history.length; i++) {
            ctx.lineTo(obj.history[i].x, obj.history[i].y);
          }
          const traceColor =
            obj.category === 'defect'
              ? 'rgba(255, 77, 79, 0.7)'
              : obj.category === 'worker'
              ? 'rgba(250, 173, 20, 0.6)'
              : 'rgba(82, 196, 26, 0.5)';
          ctx.strokeStyle = traceColor;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        // Draw Mask Annotator (for defect segmentation masks)
        if (enableMaskAnnotator && obj.polygonMask && obj.polygonMask.length >= 3) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(obj.polygonMask[0].x, obj.polygonMask[0].y);
          for (let i = 1; i < obj.polygonMask.length; i++) {
            ctx.lineTo(obj.polygonMask[i].x, obj.polygonMask[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = 'rgba(255, 77, 79, 0.35)';
          ctx.fill();
          ctx.strokeStyle = '#ff4d4f';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }

        // Determine object colors
        const isDefect = obj.category === 'defect' || obj.status === 'danger_intrusion';
        const targetColor = isDefect
          ? '#ff4d4f'
          : obj.inZone
          ? '#00f2fe'
          : obj.category === 'agv'
          ? '#faad14'
          : '#52c41a';

        // Render Annotator Styles: Corner vs Box vs Halo
        if (annotatorStyle === 'corner') {
          // CornerAnnotator
          ctx.save();
          ctx.strokeStyle = targetColor;
          ctx.lineWidth = 2.5;
          const cornerLen = 14;

          // Top-Left
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y + cornerLen);
          ctx.lineTo(obj.x, obj.y);
          ctx.lineTo(obj.x + cornerLen, obj.y);
          ctx.stroke();

          // Top-Right
          ctx.beginPath();
          ctx.moveTo(obj.x + obj.w - cornerLen, obj.y);
          ctx.lineTo(obj.x + obj.w, obj.y);
          ctx.lineTo(obj.x + obj.w, obj.y + cornerLen);
          ctx.stroke();

          // Bottom-Left
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y + obj.h - cornerLen);
          ctx.lineTo(obj.x, obj.y + obj.h);
          ctx.lineTo(obj.x + cornerLen, obj.y + obj.h);
          ctx.stroke();

          // Bottom-Right
          ctx.beginPath();
          ctx.moveTo(obj.x + obj.w - cornerLen, obj.y + obj.h);
          ctx.lineTo(obj.x + obj.w, obj.y + obj.h);
          ctx.lineTo(obj.x + obj.w, obj.y + obj.h - cornerLen);
          ctx.stroke();
          ctx.restore();
        } else if (annotatorStyle === 'halo') {
          // HaloAnnotator
          ctx.save();
          ctx.strokeStyle = targetColor;
          ctx.lineWidth = 3;
          ctx.shadowColor = targetColor;
          ctx.shadowBlur = 12;
          ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
          ctx.shadowBlur = 0;
          ctx.restore();
        } else {
          // BoxAnnotator
          ctx.save();
          ctx.strokeStyle = targetColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
          ctx.fillStyle = isDefect ? 'rgba(255, 77, 79, 0.16)' : 'rgba(82, 196, 26, 0.12)';
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          ctx.restore();
        }

        // Draw Centroid Dot & Crosshair (DotAnnotator)
        if (enableCentroidDot) {
          ctx.save();
          ctx.strokeStyle = targetColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(centerPos.x - 6, centerPos.y);
          ctx.lineTo(centerPos.x + 6, centerPos.y);
          ctx.moveTo(centerPos.x, centerPos.y - 6);
          ctx.lineTo(centerPos.x, centerPos.y + 6);
          ctx.stroke();
          ctx.fillStyle = targetColor;
          ctx.beginPath();
          ctx.arc(centerPos.x, centerPos.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Draw LabelAnnotator with Track ID, Class, Confidence, and Calibrated Physical mm
        const idLabel = enableByteTrack ? `#${obj.trackId} ` : '';
        const confLabel = `${Math.round(obj.confidence * 100)}%`;
        const sizeLabel =
          enablePhysicalSize && obj.physicalSizeMm
            ? ` | ${obj.physicalSizeMm.w.toFixed(1)}×${obj.physicalSizeMm.h.toFixed(1)}mm`
            : '';
        const mainLabel = `${idLabel}${obj.defectName || obj.className} ${confLabel}${sizeLabel}`;

        ctx.save();
        ctx.font = 'bold 10px monospace';
        const labelWidth = ctx.measureText(mainLabel).width;
        ctx.fillStyle = targetColor;
        ctx.fillRect(obj.x, obj.y - 18, labelWidth + 12, 18);
        ctx.fillStyle = '#000000';
        ctx.fillText(mainLabel, obj.x + 6, obj.y - 5);
        ctx.restore();
      });

      // 5. Draw Heatmap Layer (sv.HeatmapAnnotator)
      if (enableHeatmap && heatmapHistoryRef.current.length > 0) {
        ctx.save();
        heatmapHistoryRef.current.forEach((hp) => {
          const grad = ctx.createRadialGradient(hp.x, hp.y, 2, hp.x, hp.y, 28);
          grad.addColorStop(0, `rgba(255, 77, 79, ${hp.weight * 0.4})`);
          grad.addColorStop(0.5, `rgba(250, 219, 20, ${hp.weight * 0.2})`);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(hp.x, hp.y, 28, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }

      // 6. Draw Caliper Ruler if active
      if (toolMode === 'ruler' && rulerPoints.length > 0) {
        ctx.save();
        const p1 = rulerPoints[0];
        const p2 = rulerPoints.length > 1 ? rulerPoints[1] : cursorPos;
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Endpoint ticks
        ctx.fillStyle = '#00f2fe';
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
        ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Distance calculation
        const pxDist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
        const mmDist = pxDist * mmPerPixel;
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(midX - 45, midY - 20, 90, 20);
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(midX - 45, midY - 20, 90, 20);
        ctx.fillStyle = '#00f2fe';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${mmDist.toFixed(2)} mm (${Math.round(pxDist)}px)`, midX, midY - 6);
        ctx.restore();
      }

      // 7. Apply Computer Vision Filters (Grayscale / Canny / CLAHE / Thermal)
      if (cvFilter !== 'normal') {
        applyCvFilter(ctx, width, height, cvFilter);
      }

      // 8. Draw Sub-Pixel Inspection Loupe (Optical Magnifier)
      if (toolMode === 'loupe') {
        drawInspectionLoupe(ctx, canvas, cursorPos, loupeZoom, 75);
      }

      if (isSimulating) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [
    currentSceneId,
    scene,
    toolMode,
    cvFilter,
    isSimulating,
    polygonZone,
    lineZone,
    enablePolygonZone,
    enableLineCounter,
    enableByteTrack,
    enableTraceAnnotator,
    enableHeatmap,
    enableMaskAnnotator,
    enableCentroidDot,
    enablePhysicalSize,
    annotatorStyle,
    traceLength,
    loupeZoom,
    rulerPoints,
    cursorPos,
    draggingVertexIndex,
    draggingLineHandle,
    customImage,
    mmPerPixel,
    triggerPlcAction,
  ]);

  // Handle canvas mouse move for interactive dragging and loupe position
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setCursorPos({ x, y });

    // Dragging polygon vertex
    if (toolMode === 'edit_polygon' && draggingVertexIndex !== null) {
      setPolygonZone((prev) => {
        const nextPoints = [...prev.points];
        nextPoints[draggingVertexIndex] = { x: Math.round(x), y: Math.round(y) };
        return { ...prev, points: nextPoints };
      });
    }

    // Dragging line handle
    if (toolMode === 'edit_line' && draggingLineHandle !== null) {
      setLineZone((prev) => {
        if (draggingLineHandle === 'start') {
          return { ...prev, start: { x: Math.round(x), y: Math.round(y) } };
        } else if (draggingLineHandle === 'end') {
          return { ...prev, end: { x: Math.round(x), y: Math.round(y) } };
        }
        return prev;
      });
    }
  };

  // Handle canvas mouse down
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (toolMode === 'select') {
      // Find object under cursor
      const clicked = objectsRef.current.find(
        (o) => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h
      );
      if (clicked) {
        setSelectedObject(clicked);
      }
    } else if (toolMode === 'edit_polygon') {
      // Check if clicking near any vertex
      const vIdx = polygonZone.points.findIndex(
        (pt) => Math.hypot(pt.x - x, pt.y - y) <= 14
      );
      if (vIdx !== -1) {
        setDraggingVertexIndex(vIdx);
      }
    } else if (toolMode === 'edit_line') {
      if (Math.hypot(lineZone.start.x - x, lineZone.start.y - y) <= 14) {
        setDraggingLineHandle('start');
      } else if (Math.hypot(lineZone.end.x - x, lineZone.end.y - y) <= 14) {
        setDraggingLineHandle('end');
      }
    } else if (toolMode === 'ruler') {
      if (rulerPoints.length === 0 || rulerPoints.length === 2) {
        setRulerPoints([{ x, y }]);
      } else {
        setRulerPoints([rulerPoints[0], { x, y }]);
      }
    }
  };

  // Handle canvas mouse up
  const handleCanvasMouseUp = () => {
    setDraggingVertexIndex(null);
    setDraggingLineHandle(null);
  };

  // Handle double click on polygon mode to add a new vertex
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (toolMode === 'edit_polygon') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.round(((e.clientX - rect.left) * canvas.width) / rect.width);
      const y = Math.round(((e.clientY - rect.top) * canvas.height) / rect.height);
      setPolygonZone((prev) => ({
        ...prev,
        points: [...prev.points, { x, y }],
      }));
      message.success(`已添加新电子围栏顶点 P${polygonZone.points.length + 1} (${x}, ${y})`);
    }
  };

  // Handle custom image upload
  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setCustomImage(img);
        setCurrentSceneId('custom_upload');
        message.success('已成功加载工业现场自定义图像！可在其上方交互划定防区。');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    return false;
  };

  // Review a defect log
  const handleReviewLog = (id: string, status: 'confirmed_ng' | 'false_alarm') => {
    setDefectLogs((prev) =>
      prev.map((log) => (log.id === id ? { ...log, reviewedStatus: status } : log))
    );
    message.success(
      status === 'confirmed_ng' ? '已确认该缺陷为真实 NG，留档 MES' : '已核准为误报放行'
    );
  };

  // Generate python code
  const pythonScript = generatePythonSupervisionScript({
    sceneName: scene.name,
    polygon: polygonZone,
    lineZone: lineZone,
    annotatorStyle: annotatorStyle,
    enableByteTrack: enableByteTrack,
    enableTraceAnnotator: enableTraceAnnotator,
    enableHeatmap: enableHeatmap,
    enableMaskAnnotator: enableMaskAnnotator,
    modelWeights: 'weights/yolov8_industrial_fp16.engine',
    cameraSource: 'rtsp://192.168.1.120:554/live/industrial_ch01',
  });

  return (
    <div style={{ padding: '8px 12px' }}>
      {/* Top Banner: Industrial Machine Vision Workbench */}
      <div
        style={{
          background: 'linear-gradient(135deg, #09131f 0%, #102136 60%, #163252 100%)',
          padding: '16px 24px',
          borderRadius: 8,
          marginBottom: 14,
          border: '1px solid rgba(0, 242, 254, 0.25)',
          color: '#fff',
        }}
      >
        <Row align="middle" justify="space-between" gutter={[16, 12]}>
          <Col xs={24} md={16}>
            <Space align="center" size={14}>
              <SafetyCertificateOutlined style={{ fontSize: 32, color: '#00f2fe' }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ color: '#fff', margin: 0, fontSize: 20, fontWeight: 700 }}>
                    Roboflow Supervision 多功能工业质检视觉画布 (Industrial Vision Workbench)
                  </h1>
                  <Tag color="cyan">工业现场现场级</Tag>
                  <Tag color="purple">Model-Agnostic CV</Tag>
                </div>
                <p style={{ margin: '4px 0 0 0', opacity: 0.85, fontSize: 13 }}>
                  赋能工业现场全流程：集成 <strong>PolygonZone 交互式电子围栏</strong>、
                  <strong>LineZone 虚拟双向光电计件</strong>、<strong>ByteTrack 时序多目标追踪</strong>
                  与 <strong>Annotator 工业标注器矩阵</strong>，无缝联动现场 PLC 与 MES。
                </p>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Space orientation="vertical" align="end" size={4}>
              <Space>
                <Badge
                  status={plcState.andonLight === 'green' ? 'success' : plcState.andonLight === 'amber' ? 'warning' : 'error'}
                  text={<span style={{ color: '#fff', fontSize: 12 }}>Andon三色灯: {plcState.andonLight.toUpperCase()}</span>}
                />
                <Divider orientation="vertical" style={{ borderColor: 'rgba(255,255,255,0.2)' }} />
                <span style={{ fontSize: 12, color: '#00f2fe', fontFamily: 'monospace' }}>
                  Modbus TCP: 已联机
                </span>
              </Space>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                光学视场 FOV: {scene.fovSizeMm.w}×{scene.fovSizeMm.h}mm | 标定比: {mmPerPixel.toFixed(3)} mm/px
              </div>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Industrial Field Scenarios Segmented Selector */}
      <Card
        size="small"
        style={{ marginBottom: 14, background: '#fafafa', border: '1px solid #e8e8e8' }}
      >
        <Row align="middle" justify="space-between" gutter={[12, 12]}>
          <Col xs={24} md={18}>
            <Space wrap size={8}>
              <span style={{ fontWeight: 600, fontSize: 13, marginRight: 4 }}>现场工况预设:</span>
              {(Object.keys(SCENE_PRESETS) as IndustrialSceneId[]).map((sid) => {
                const s = SCENE_PRESETS[sid];
                const active = currentSceneId === sid;
                return (
                  <Button
                    key={sid}
                    size="small"
                    type={active ? 'primary' : 'default'}
                    style={
                      active
                        ? { background: '#096dd9', borderColor: '#096dd9', fontWeight: 600 }
                        : {}
                    }
                    onClick={() => handleSceneChange(sid)}
                  >
                    {s.name}
                  </Button>
                );
              })}
            </Space>
          </Col>
          <Col xs={24} md={6} style={{ textAlign: 'right' }}>
            <Upload beforeUpload={handleImageUpload} showUploadList={false} accept="image/*">
              <Button size="small" icon={<UploadOutlined />}>
                导入现场工件照片
              </Button>
            </Upload>
          </Col>
        </Row>
      </Card>

      {/* Industrial Real-Time KPIs Row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        <Col xs={12} sm={6} lg={4}>
          <Card size="small" hoverable>
            <Statistic
              title="LineZone 虚拟计件 (In/Out)"
              value={`${lineZone.inCount} / ${lineZone.outCount}`}
              styles={{ content: { color: '#faad14', fontWeight: 'bold', fontSize: 18 } }}
              prefix={<BarChartOutlined />}
            />
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
              双向穿越识别 | 计件误差率 &lt; 0.1%
            </div>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={4}>
          <Card size="small" hoverable>
            <Statistic
              title="PolygonZone 防区当前目标"
              value={objectsRef.current.filter((o) => o.inZone).length}
              suffix="个"
              styles={{
                content: {
                  color:
                    objectsRef.current.some((o) => o.inZone && (o.category === 'defect' || o.status === 'danger_intrusion'))
                      ? '#ff4d4f'
                      : '#1890ff',
                  fontWeight: 'bold',
                  fontSize: 18,
                },
              }}
              prefix={<CompassOutlined />}
            />
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
              电子围栏实时碰撞 | 毫秒级防区检测
            </div>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={4}>
          <Card size="small" hoverable>
            <Statistic
              title="良品率 (Pass Rate)"
              value={98.6}
              precision={1}
              suffix="%"
              styles={{ content: { color: '#52c41a', fontWeight: 'bold', fontSize: 18 } }}
              prefix={<CheckCircleOutlined />}
            />
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
              实时综合良品率 | 累计检验合格 682 件
            </div>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={4}>
          <Card size="small" hoverable>
            <Statistic
              title="边缘推理时延 (TensorRT)"
              value={11.4}
              precision={1}
              suffix="ms"
              styles={{ content: { color: '#722ed1', fontWeight: 'bold', fontSize: 18 } }}
              prefix={<ThunderboltOutlined />}
            />
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
              帧率 58.2 FPS | 达到工业实时性要求
            </div>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={4}>
          <Card size="small" hoverable>
            <Statistic
              title="ByteTrack 跨帧跟踪稳定性"
              value={99.8}
              precision={1}
              suffix="%"
              styles={{ content: { color: '#13c2c2', fontWeight: 'bold', fontSize: 18 } }}
              prefix={<FieldTimeOutlined />}
            />
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
              卡尔曼滤波防遮挡 | 无 ID 震荡
            </div>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={4}>
          <Card size="small" hoverable>
            <Statistic
              title="PLC 气动脉冲触发"
              value={plcState.plcPulseCount}
              suffix="次"
              styles={{ content: { color: '#cf1322', fontWeight: 'bold', fontSize: 18 } }}
              prefix={<CloseCircleOutlined />}
            />
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
              24V 气动气缸剔除 | 最近触发 {plcState.lastTriggerTime}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Main Vision Canvas & Inspection Controls */}
      <Row gutter={[14, 14]}>
        {/* Left Column: Visual Canvas & Interactive Toolbar */}
        <Col xs={24} xl={16}>
          <Card
            title={
              <Space>
                <EyeOutlined style={{ color: '#00f2fe' }} />
                <span>Supervision 工业视觉交互画布 (Live Interactive Canvas)</span>
              </Space>
            }
            extra={
              <Space wrap>
                <Button
                  size="small"
                  type={isSimulating ? 'default' : 'primary'}
                  icon={isSimulating ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={() => setIsSimulating(!isSimulating)}
                >
                  {isSimulating ? '暂停流' : '继续流'}
                </Button>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    setLineZone((l) => ({ ...l, inCount: 0, outCount: 0 }));
                    message.success('已清空 LineZone 计件计数器');
                  }}
                >
                  重置计件
                </Button>
                <Button
                  size="small"
                  type="primary"
                  icon={<CodeOutlined />}
                  style={{ background: '#102136', borderColor: '#00f2fe', color: '#00f2fe' }}
                  onClick={() => setCodeModalVisible(true)}
                >
                  导出 Python 脚本
                </Button>
              </Space>
            }
          >
            {/* Interactive Canvas Toolstrip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                background: '#0b111b',
                borderRadius: '6px 6px 0 0',
                borderBottom: '1px solid #1f2937',
                color: '#fff',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <Space wrap size={6}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>画布工具:</span>
                <Radio.Group
                  size="small"
                  value={toolMode}
                  onChange={(e) => {
                    setToolMode(e.target.value);
                    if (e.target.value === 'ruler') {
                      setRulerPoints([]);
                      message.info('标尺工具已就绪：点击画布起点与终点测量真实毫米尺寸');
                    } else if (e.target.value === 'edit_polygon') {
                      message.info('防区编辑就绪：拖动顶点移动；双击画布可增加新顶点');
                    } else if (e.target.value === 'edit_line') {
                      message.info('计件线编辑就绪：拖动 Start 或 End 圆点标定流水线光电触发线');
                    }
                  }}
                >
                  <Radio.Button value="select">🎯 探针选取</Radio.Button>
                  <Radio.Button value="edit_polygon">📐 划定防区</Radio.Button>
                  <Radio.Button value="edit_line">📏 计件标线</Radio.Button>
                  <Radio.Button value="ruler">🧭 卡尺测距</Radio.Button>
                  <Radio.Button value="loupe">🔍 放大镜</Radio.Button>
                </Radio.Group>
              </Space>

              <Space wrap size={8}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>CV 滤镜:</span>
                <Select
                  size="small"
                  value={cvFilter}
                  onChange={setCvFilter}
                  style={{ width: 110 }}
                >
                  <Option value="normal">原始色彩</Option>
                  <Option value="grayscale">工业灰度</Option>
                  <Option value="canny">Canny边缘</Option>
                  <Option value="clahe">CLAHE增强</Option>
                  <Option value="thermal">伪彩热成像</Option>
                </Select>

                {toolMode === 'loupe' && (
                  <Space size={4}>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>倍率:</span>
                    <Select
                      size="small"
                      value={loupeZoom}
                      onChange={setLoupeZoom}
                      style={{ width: 75 }}
                    >
                      <Option value={2.0}>2.0X</Option>
                      <Option value={3.5}>3.5X</Option>
                      <Option value={5.0}>5.0X</Option>
                      <Option value={8.0}>8.0X</Option>
                    </Select>
                  </Space>
                )}
              </Space>
            </div>

            {/* The Main High-Precision Vision Canvas Viewport */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                overflow: 'hidden',
                borderRadius: '0 0 6px 6px',
                background: '#090d16',
                cursor:
                  toolMode === 'ruler' || toolMode === 'loupe'
                    ? 'crosshair'
                    : toolMode === 'edit_polygon' || toolMode === 'edit_line'
                    ? 'pointer'
                    : 'default',
              }}
            >
              <canvas
                ref={canvasRef}
                width={700}
                height={460}
                onMouseMove={handleCanvasMouseMove}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                onDoubleClick={handleCanvasDoubleClick}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />

              {/* Heads-Up Display (HUD) Telemetry Overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 12,
                  background: 'rgba(9, 13, 22, 0.88)',
                  backdropFilter: 'blur(4px)',
                  padding: '8px 12px',
                  borderRadius: 4,
                  color: '#00f2fe',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  border: '1px solid rgba(0, 242, 254, 0.35)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  pointerEvents: 'none',
                }}
              >
                <div style={{ color: '#ffffff', fontWeight: 'bold', marginBottom: 2 }}>
                  SUPERVISION PIPELINE HUD
                </div>
                <div>sv.Detections: ACTIVE (Ultralytics YOLO)</div>
                <div>sv.ByteTrack: {enableByteTrack ? 'TRACKING (Kalman Filter)' : 'DISABLED'}</div>
                <div>sv.PolygonZone: {enablePolygonZone ? `${polygonZone.points.length}-pt ACTIVE` : 'OFF'}</div>
                <div>sv.LineZone: {enableLineCounter ? 'COUNTING ACTIVE' : 'OFF'}</div>
                <div>Cursor: X={Math.round(cursorPos.x)} Y={Math.round(cursorPos.y)}</div>
              </div>

              {/* Active Warning Overlay Banner when violation occurs */}
              {objectsRef.current.some(
                (o) => o.inZone && (o.category === 'defect' || o.status === 'danger_intrusion')
              ) && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    left: 12,
                    background: 'rgba(255, 77, 79, 0.92)',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 600,
                    fontSize: 12,
                    boxShadow: '0 2px 8px rgba(255, 77, 79, 0.4)',
                  }}
                >
                  <AlertOutlined />
                  <span>防区触发告警: 识别到高风险不良品 / 未合规侵入，已下发 PLC 剔除脉冲</span>
                </div>
              )}
            </div>

            {/* Canvas Bottom Legend and Quick Mode Actions */}
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <Space wrap size={6}>
                <Tag color="#faad14">🟡 LineZone 计件触发线</Tag>
                <Tag color="#00f2fe">🔵 PolygonZone 电子围栏</Tag>
                <Tag color="#52c41a">🟢 ByteTrack 运动轨迹</Tag>
                <Tag color="#ff4d4f">🔴 缺陷标注与安全预警</Tag>
              </Space>

              <Space>
                {toolMode === 'edit_polygon' && (
                  <Button
                    size="small"
                    onClick={() => {
                      setPolygonZone(scene.defaultPolygon);
                      message.success('已恢复为默认防区多边形');
                    }}
                  >
                    重置防区
                  </Button>
                )}
                {toolMode === 'edit_line' && (
                  <Button
                    size="small"
                    onClick={() => {
                      setLineZone(scene.defaultLineZone);
                      message.success('已恢复默认计件标定线');
                    }}
                  >
                    重置标线
                  </Button>
                )}
                <Button
                  size="small"
                  danger
                  onClick={() => triggerPlcAction('手动工控急停测试', true)}
                >
                  模拟 PLC 气动剔除
                </Button>
              </Space>
            </div>
          </Card>

          {/* Real-Time Defect & Violation Event Log Stream */}
          <Card
            title={
              <Space>
                <AlertOutlined style={{ color: '#ff4d4f' }} />
                <span>工业现场缺陷抓拍与越界事件流 (Live Event Audit Stream)</span>
              </Space>
            }
            size="small"
            style={{ marginTop: 14 }}
          >
            <Table
              size="small"
              rowKey="id"
              dataSource={defectLogs}
              pagination={false}
              columns={[
                {
                  title: '事件时间',
                  dataIndex: 'timestamp',
                  key: 'timestamp',
                  width: 90,
                  render: (t) => <span style={{ fontFamily: 'monospace' }}>{t}</span>,
                },
                {
                  title: '工位/位置',
                  dataIndex: 'location',
                  key: 'location',
                  render: (l, rec) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{rec.title}</div>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>{l}</div>
                    </div>
                  ),
                },
                {
                  title: '严重级别',
                  dataIndex: 'severity',
                  key: 'severity',
                  width: 90,
                  render: (s) => (
                    <Tag color={s === 'critical' ? 'red' : s === 'major' ? 'orange' : 'blue'}>
                      {s === 'critical' ? '致命缺陷' : s === 'major' ? '主要缺陷' : '轻微缺陷'}
                    </Tag>
                  ),
                },
                {
                  title: '置信度',
                  dataIndex: 'confidence',
                  key: 'confidence',
                  width: 80,
                  render: (c) => <span>{(c * 100).toFixed(1)}%</span>,
                },
                {
                  title: 'PLC状态',
                  dataIndex: 'plcTriggered',
                  key: 'plcTriggered',
                  width: 100,
                  render: (p) =>
                    p ? (
                      <Tag color="error">气缸已剔除</Tag>
                    ) : (
                      <Tag color="default">仅记录MES</Tag>
                    ),
                },
                {
                  title: '人工复核',
                  key: 'actions',
                  width: 150,
                  render: (_, rec) => (
                    <Space size={4}>
                      {rec.reviewedStatus === 'pending' ? (
                        <>
                          <Button
                            size="small"
                            type="link"
                            danger
                            onClick={() => handleReviewLog(rec.id, 'confirmed_ng')}
                          >
                            确认NG
                          </Button>
                          <Button
                            size="small"
                            type="link"
                            onClick={() => handleReviewLog(rec.id, 'false_alarm')}
                          >
                            放行
                          </Button>
                        </>
                      ) : (
                        <Tag color={rec.reviewedStatus === 'confirmed_ng' ? 'red' : 'green'}>
                          {rec.reviewedStatus === 'confirmed_ng' ? '已核准NG' : '已放行'}
                        </Tag>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        {/* Right Column: Supervision Modular Parameters & Industrial Engineering Controls */}
        <Col xs={24} xl={8}>
          <Card
            title={
              <Space>
                <SlidersOutlined style={{ color: '#1890ff' }} />
                <span>Supervision 核心算子矩阵与工控配置</span>
              </Space>
            }
            size="small"
          >
            <Tabs
              defaultActiveKey="annotators"
              items={[
                {
                  key: 'annotators',
                  label: '标注算子矩阵',
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* PolygonZone */}
                      <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>1. PolygonZone 任意多边形电子围栏</div>
                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                              划定作业安全/关键贴片区，实时触发碰撞检测
                            </div>
                          </div>
                          <Switch checked={enablePolygonZone} onChange={setEnablePolygonZone} />
                        </div>
                      </div>

                      {/* LineZone */}
                      <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>2. LineZone 流水线双向虚拟计件</div>
                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                              工件横穿警戒向量自动累计 In/Out，对接 MES 节拍
                            </div>
                          </div>
                          <Switch checked={enableLineCounter} onChange={setEnableLineCounter} />
                        </div>
                      </div>

                      {/* ByteTrack */}
                      <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>3. sv.ByteTrack 多目标时序追踪</div>
                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                              分配全局唯一 Track ID，解决工件密集遮挡与交叉
                            </div>
                          </div>
                          <Switch checked={enableByteTrack} onChange={setEnableByteTrack} />
                        </div>
                      </div>

                      {/* TraceAnnotator */}
                      <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>4. sv.TraceAnnotator 运动拖尾动线</div>
                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                              绘制位移动线历史，分析工人装配动作与工件偏离
                            </div>
                          </div>
                          <Switch checked={enableTraceAnnotator} onChange={setEnableTraceAnnotator} />
                        </div>
                        {enableTraceAnnotator && (
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: '#8c8c8c' }}>轨迹步长:</span>
                            <Slider
                              min={10}
                              max={60}
                              value={traceLength}
                              onChange={setTraceLength}
                              style={{ flex: 1, margin: 0 }}
                            />
                            <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{traceLength}</span>
                          </div>
                        )}
                      </div>

                      {/* HeatmapAnnotator */}
                      <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>5. sv.HeatmapAnnotator 缺陷频次热力图</div>
                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                              累计工装磨损高发区与缺陷落点高斯分布
                            </div>
                          </div>
                          <Switch checked={enableHeatmap} onChange={setEnableHeatmap} />
                        </div>
                      </div>

                      {/* Mask & Centroid Dot */}
                      <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>6. sv.MaskAnnotator 分割掩膜</div>
                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                              渲染连锡、微裂纹、极耳翻折非规则多边形
                            </div>
                          </div>
                          <Switch checked={enableMaskAnnotator} onChange={setEnableMaskAnnotator} />
                        </div>
                      </div>

                      {/* Annotator Styles Selection */}
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>
                          7. 主框体标注渲染样式 (Annotator Style)
                        </div>
                        <Radio.Group
                          value={annotatorStyle}
                          onChange={(e) => setAnnotatorStyle(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <Radio.Button value="corner" style={{ width: '33.3%', textAlign: 'center' }}>
                            Corner 四角
                          </Radio.Button>
                          <Radio.Button value="box" style={{ width: '33.3%', textAlign: 'center' }}>
                            Box 实体矩形
                          </Radio.Button>
                          <Radio.Button value="halo" style={{ width: '33.3%', textAlign: 'center' }}>
                            Halo 荧光发光
                          </Radio.Button>
                        </Radio.Group>
                      </div>

                      {/* Centroid & Physical Size Toggles */}
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 12, color: '#595959' }}>显示质心十字丝: </span>
                          <Switch size="small" checked={enableCentroidDot} onChange={setEnableCentroidDot} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 12, color: '#595959' }}>物理尺寸标签: </span>
                          <Switch size="small" checked={enablePhysicalSize} onChange={setEnablePhysicalSize} />
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'plc_mes',
                  label: '工控与MES总线',
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <Alert
                        message="工业现场 PLC 自动化联动已连接"
                        description="基于 Modbus TCP / GPIO 24V 高电平信号。当 PolygonZone 发生入侵或检测到严重缺陷时自动触发剔除气缸与 Andon 声光报警灯。"
                        type="info"
                        showIcon
                      />

                      <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>三色声光报警塔 (Andon Light)</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: plcState.andonLight === 'red' ? '#ff4d4f' : '#ffa39e',
                              boxShadow: plcState.andonLight === 'red' ? '0 0 10px #ff4d4f' : 'none',
                            }}
                          />
                          <span style={{ fontSize: 12 }}>红灯 (ALARM/剔除)</span>
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: plcState.andonLight === 'amber' ? '#faad14' : '#ffe58f',
                              boxShadow: plcState.andonLight === 'amber' ? '0 0 10px #faad14' : 'none',
                            }}
                          />
                          <span style={{ fontSize: 12 }}>黄灯 (WARN)</span>
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: plcState.andonLight === 'green' ? '#52c41a' : '#b7eb8f',
                              boxShadow: plcState.andonLight === 'green' ? '0 0 10px #52c41a' : 'none',
                            }}
                          />
                          <span style={{ fontSize: 12 }}>绿灯 (RUN)</span>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>气动剔除气缸状态</div>
                        <div style={{ fontSize: 12, color: '#595959' }}>
                          气动电磁阀驱动信号: {plcState.pneumaticCylinderActive ? '⚡ 动作输出中 (24V)' : '○ 待命'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Modbus TCP 寄存器映射</div>
                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#595959', lineHeight: 1.6 }}>
                          <div>Coil 0x0001: Ejector_Cylinder_Trigger</div>
                          <div>Coil 0x0002: Safety_Zone_Emergency_Stop</div>
                          <div>HoldingReg 40001: LineZone_Total_In_Count</div>
                          <div>HoldingReg 40002: LineZone_Total_Out_Count</div>
                        </div>
                      </div>

                      <Button
                        type="primary"
                        block
                        icon={<ApiOutlined />}
                        style={{ background: '#096dd9' }}
                        onClick={() => {
                          message.success('当前 Supervision 几何坐标与判定规则已同步至 PLC 边缘网关');
                        }}
                      >
                        下发规则到边缘网关
                      </Button>
                    </div>
                  ),
                },
                {
                  key: 'calibration',
                  label: '光学与标定',
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>像素物理标定比例 (mm / pixel)</div>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 6 }}>
                          基于远心镜头视野标定。可使用「卡尺测距」在已知标定块两点校准。
                        </div>
                        <InputNumber
                          min={0.001}
                          max={20}
                          step={0.01}
                          value={mmPerPixel}
                          onChange={(v) => v && setMmPerPixel(v)}
                          style={{ width: '100%' }}
                          addonAfter="mm/px"
                        />
                      </div>

                      <Divider style={{ margin: '8px 0' }} />

                      <div>
                        <div style={{ fontWeight: 600 }}>当前视场范围 (Field of View)</div>
                        <div style={{ fontSize: 12, color: '#595959', marginTop: 4 }}>
                          物理视场: <strong>{scene.fovSizeMm.w} mm × {scene.fovSizeMm.h} mm</strong>
                        </div>
                        <div style={{ fontSize: 12, color: '#595959' }}>
                          标称工位节拍目标: <strong>{scene.defaultTaktTargetSec} 秒/件</strong>
                        </div>
                      </div>

                      <Divider style={{ margin: '8px 0' }} />

                      <div>
                        <div style={{ fontWeight: 600 }}>置信度过滤阈值</div>
                        <Slider
                          min={0.1}
                          max={0.99}
                          step={0.05}
                          value={confidenceThreshold}
                          onChange={setConfidenceThreshold}
                        />
                        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                          当前阈值: {(confidenceThreshold * 100).toFixed(0)}% (过滤低置信度噪点)
                        </div>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Target Inspector Modal / Detailed Inspection Profile */}
      <Modal
        title={
          <Space>
            <AimOutlined style={{ color: '#00f2fe' }} />
            <span>工件/缺陷微观属性探针 (Target Inspection Profile)</span>
          </Space>
        }
        open={!!selectedObject}
        onCancel={() => setSelectedObject(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedObject(null)}>
            关闭
          </Button>,
          <Button
            key="eject"
            danger
            onClick={() => {
              triggerPlcAction('人工在探针面板标记剔除', true);
              setSelectedObject(null);
            }}
          >
            气动剔除该工件
          </Button>,
        ]}
      >
        {selectedObject && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Alert
              message={
                selectedObject.category === 'defect'
                  ? `【严重告警】识别到质检不良品: ${selectedObject.defectName || selectedObject.className}`
                  : `【合格】在检工件: ${selectedObject.className}`
              }
              type={selectedObject.category === 'defect' ? 'error' : 'success'}
              showIcon
            />

            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Statistic title="全局追踪 ID (ByteTrack)" value={`#${selectedObject.trackId}`} />
              </Col>
              <Col span={12}>
                <Statistic
                  title="模型置信度 (Confidence)"
                  value={(selectedObject.confidence * 100).toFixed(1)}
                  suffix="%"
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="现场画布坐标 (Bounding Box)"
                  value={`X:${Math.round(selectedObject.x)} Y:${Math.round(selectedObject.y)}`}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="物理尺寸估算 (Calibrated mm)"
                  value={
                    selectedObject.physicalSizeMm
                      ? `${selectedObject.physicalSizeMm.w.toFixed(1)} × ${selectedObject.physicalSizeMm.h.toFixed(1)} mm`
                      : `${(selectedObject.w * mmPerPixel).toFixed(1)} × ${(selectedObject.h * mmPerPixel).toFixed(1)} mm`
                  }
                />
              </Col>
            </Row>

            {selectedObject.ipcCode && (
              <div style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>行业判定标准 (IPC / GB):</div>
                <div style={{ fontSize: 12, color: '#cf1322', marginTop: 2 }}>
                  {selectedObject.ipcCode}
                </div>
              </div>
            )}

            {selectedObject.defectDetail && (
              <div style={{ background: '#fff2f0', padding: 8, borderRadius: 4, border: '1px solid #ffccc7' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#cf1322' }}>缺陷机理与处置建议:</div>
                <div style={{ fontSize: 12, color: '#434343', marginTop: 2 }}>
                  {selectedObject.defectDetail}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Production Python Code Export Modal */}
      <Modal
        title={
          <Space>
            <CodeOutlined style={{ color: '#096dd9' }} />
            <span>生产级 Roboflow Supervision 边缘 Python 脚本导出</span>
          </Space>
        }
        open={codeModalVisible}
        onCancel={() => setCodeModalVisible(false)}
        width={780}
        footer={[
          <Button key="cancel" onClick={() => setCodeModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(pythonScript);
              message.success('已复制完整 Python 脚本至剪贴板！');
            }}
          >
            复制完整脚本
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              const blob = new Blob([pythonScript], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `supervision_${currentSceneId}_edge_pipeline.py`;
              link.click();
              URL.revokeObjectURL(url);
              message.success('已下载脚本文件！可以直接在 Jetson 或工控机上执行');
            }}
          >
            下载 .py 脚本
          </Button>,
        ]}
      >
        <Paragraph style={{ fontSize: 12, color: '#595959' }}>
          该脚本已动态绑定当前视觉画布中交互标定的 <strong>PolygonZone 顶点坐标</strong>、
          <strong>LineZone 起始向量</strong>与选择的<strong>标注器风格</strong>，包含标准的
          <code>sv.Detections</code>、<code>sv.ByteTrack</code> 与现场 PLC 信号联动回调函数。
        </Paragraph>
        <pre
          style={{
            maxHeight: 380,
            overflowY: 'auto',
            background: '#0d1117',
            color: '#c9d1d9',
            padding: 12,
            borderRadius: 6,
            fontSize: 11,
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          }}
        >
          {pythonScript}
        </pre>
      </Modal>
    </div>
  );
};

export default SupervisionLab;
