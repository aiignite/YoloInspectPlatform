export interface PrivacyMetrics {
  detectorLatencyMs: number; // e.g. 0.85 ms
  faceObfuscationRatePct: number; // e.g. 100%
  badgeObfuscationRatePct: number; // e.g. 100%
  mosaicKernelSize: string; // "15x15 Gaussian Mosaic"
  inMemoryZeroDiskLeak: boolean;
  complianceStandard: string; // "PIPL (个人信息保护法) & GDPR"
}

export interface StorageLifecycleMetrics {
  totalDiskCapacityGb: number; // e.g. 256 GB
  usedDiskGb: number; // e.g. 24.6 GB
  diskWatermarkPct: number; // e.g. 9.6%
  watermarkAlarmThresholdPct: number; // 85%
  retentionNormalMetadataDays: string; // "永久 (元数据 <1KB)"
  retentionAlarmSnippetsDays: number; // 30 days local
  ringBufferAllocatedMb: number; // 256 MB RAM
  totalAlarmSnippetsCount: number;
}

export interface NetworkSyncState {
  isNetworkOnline: boolean;
  networkLatencyMs: number;
  offlineBufferedRecordsCount: number;
  syncProgressPct: number;
  lastSyncTimestamp: string;
  totalSyncedRecords: number;
  syncThroughputOps: number; // e.g. 5200 ops/s
  offlineMaxAutonomyDays: number; // e.g. 7 days
}

export interface ResilienceStatusPayload {
  privacy: PrivacyMetrics;
  storage: StorageLifecycleMetrics;
  sync: NetworkSyncState;
}

export interface ComplianceAuditReport {
  reportId: string;
  generatedAt: string;
  assessmentResult: 'PASSED' | 'WARNING' | 'FAILED';
  auditedStation: string;
  totalFramesAudited: number;
  rawFaceLeakCount: number; // MUST be 0
  badgeNumberLeakCount: number; // MUST be 0
  offlineDowntimeSec: number; // MUST be 0
  auditorCertification: string;
}
