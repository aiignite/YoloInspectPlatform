export interface TensorRTModelProfile {
  id: string;
  name: string;
  engineFileName: string;
  precision: 'FP32' | 'FP16' | 'INT8';
  framework: string;
  latencyMs: number;
  fps: number;
  gpuMemoryMb: number;
  mAP50: number;
  mAP50_95: number;
  pinchErrorMm: number;
  fileSizeBytes: number;
  isActive: boolean;
  fusedLayersCount: number;
  calibrationType: string;
  deployedAt: string | null;
}

export interface CalibrationLayerLog {
  layerName: string;
  layerType: string;
  inputScale: number;
  outputScale: number;
  dynamicRangeMax: number;
  quantizationErrorPct: number;
  fusionStatus: 'Fused_Conv_BN_SiLU' | 'Fused_Residual_Add' | 'Quantized_Linear';
}
