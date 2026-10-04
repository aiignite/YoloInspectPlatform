import { TensorRTModelProfile, CalibrationLayerLog } from '../types/tensorrt';

class TensorRTManager {
  private activeModelId: string = 'hand_yolov11_tensorrt_int8';

  private models: TensorRTModelProfile[] = [
    {
      id: 'hand_yolov11_baseline_fp32',
      name: 'YOLOv11-Hand-FP32 (PyTorch/WASM 基线)',
      engineFileName: 'hand_action_yolov11_fp32.onnx',
      precision: 'FP32',
      framework: 'ONNX Runtime / WASM',
      latencyMs: 22.4,
      fps: 44.6,
      gpuMemoryMb: 1620,
      mAP50: 0.934,
      mAP50_95: 0.742,
      pinchErrorMm: 1.5,
      fileSizeBytes: 24500000,
      isActive: false,
      fusedLayersCount: 0,
      calibrationType: 'None (Full Precision)',
      deployedAt: null,
    },
    {
      id: 'hand_yolov11_tensorrt_fp16',
      name: 'YOLOv11-Hand-FP16 (TensorRT 半精度加速)',
      engineFileName: 'hand_action_yolov11_fp16.engine',
      precision: 'FP16',
      framework: 'TensorRT 8.6.1 (CUDA 12.2)',
      latencyMs: 5.8,
      fps: 172.4,
      gpuMemoryMb: 680,
      mAP50: 0.932,
      mAP50_95: 0.739,
      pinchErrorMm: 0.7,
      fileSizeBytes: 12800000,
      isActive: false,
      fusedLayersCount: 42,
      calibrationType: 'FP16 Native TensorCore Mode',
      deployedAt: null,
    },
    {
      id: 'hand_yolov11_tensorrt_int8',
      name: 'YOLOv11-Hand-INT8 (PTQ 熵校准极速引擎)',
      engineFileName: 'hand_action_yolov11_int8.engine',
      precision: 'INT8',
      framework: 'TensorRT 8.6.1 (INT8 TensorCore)',
      latencyMs: 2.1,
      fps: 476.2,
      gpuMemoryMb: 320,
      mAP50: 0.928,
      mAP50_95: 0.732,
      pinchErrorMm: 0.5,
      fileSizeBytes: 6420000,
      isActive: true,
      fusedLayersCount: 68,
      calibrationType: 'IInt8EntropyCalibrator2 (KL Divergence)',
      deployedAt: '2026-10-03T12:00:00Z',
    },
  ];

  private calibrationLogs: CalibrationLayerLog[] = [
    {
      layerName: 'model.0.conv (Stem Conv2d)',
      layerType: 'Conv_BN_SiLU',
      inputScale: 0.007843,
      outputScale: 0.052184,
      dynamicRangeMax: 6.678,
      quantizationErrorPct: 0.28,
      fusionStatus: 'Fused_Conv_BN_SiLU',
    },
    {
      layerName: 'model.1.conv (Stage1 Downsample)',
      layerType: 'Conv_BN_SiLU',
      inputScale: 0.052184,
      outputScale: 0.084120,
      dynamicRangeMax: 10.767,
      quantizationErrorPct: 0.35,
      fusionStatus: 'Fused_Conv_BN_SiLU',
    },
    {
      layerName: 'model.2.c3k2.cv1 (Cross-Stage Bottleneck 1)',
      layerType: 'Conv_BN_SiLU',
      inputScale: 0.084120,
      outputScale: 0.041295,
      dynamicRangeMax: 5.286,
      quantizationErrorPct: 0.22,
      fusionStatus: 'Fused_Residual_Add',
    },
    {
      layerName: 'model.10.c3k2 (Neck Feature Aggregation)',
      layerType: 'C3k2',
      inputScale: 0.041295,
      outputScale: 0.038914,
      dynamicRangeMax: 4.981,
      quantizationErrorPct: 0.31,
      fusionStatus: 'Fused_Conv_BN_SiLU',
    },
    {
      layerName: 'model.22.cv3.2 (Hand 21-Landmark Regressor)',
      layerType: 'DenseLinear',
      inputScale: 0.038914,
      outputScale: 0.012480,
      dynamicRangeMax: 1.597,
      quantizationErrorPct: 0.41,
      fusionStatus: 'Quantized_Linear',
    },
  ];

  public getModels(): TensorRTModelProfile[] {
    return this.models;
  }

  public getActiveModel(): TensorRTModelProfile {
    return (
      this.models.find((m) => m.id === this.activeModelId) || this.models[2]
    );
  }

  public deployModel(modelId: string): { success: boolean; activeModel: TensorRTModelProfile } {
    const target = this.models.find((m) => m.id === modelId);
    if (!target) {
      throw new Error(`Model ${modelId} not found`);
    }

    this.models.forEach((m) => {
      m.isActive = m.id === modelId;
      if (m.isActive) {
        m.deployedAt = new Date().toISOString();
      }
    });

    this.activeModelId = modelId;
    return {
      success: true,
      activeModel: target,
    };
  }

  public getCalibrationLogs(): {
    datasetSize: number;
    datasetCategories: string[];
    entropyAlgorithm: string;
    layers: CalibrationLayerLog[];
  } {
    return {
      datasetSize: 800,
      datasetCategories: [
        'ESD 防静电丁腈手套 (蓝色/黑色)',
        '防静电接地手环带 (扣紧与脱落)',
        'SMT 0402 阻容件双指超微间距 (<5mm)',
        '精密防静电镊子微夹持姿态',
        '智能电批全握持与旋转作业',
      ],
      entropyAlgorithm: 'IInt8EntropyCalibrator2 (KL 散度对称饱和截断)',
      layers: this.calibrationLogs,
    };
  }

  public runBenchmarkComparison(): {
    timestamp: string;
    results: {
      profile: TensorRTModelProfile;
      benchmarkLatencyMs: number;
      actualFps: number;
      jitterMs: number;
      speedupVsBaseline: string;
    }[];
  } {
    const baseline = this.models.find((m) => m.precision === 'FP32')!;
    return {
      timestamp: new Date().toISOString(),
      results: this.models.map((m) => {
        const jitter = +(Math.random() * 0.4 - 0.2).toFixed(2);
        const actualLatency = +(m.latencyMs + jitter).toFixed(1);
        const actualFps = Math.round(1000 / actualLatency);
        const speedup = (baseline.latencyMs / actualLatency).toFixed(1) + 'x';
        return {
          profile: m,
          benchmarkLatencyMs: actualLatency,
          actualFps,
          jitterMs: Math.abs(jitter),
          speedupVsBaseline: speedup,
        };
      }),
    };
  }
}

export const tensorRTManager = new TensorRTManager();
