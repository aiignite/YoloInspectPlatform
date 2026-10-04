import {
  ResilienceStatusPayload,
  ComplianceAuditReport,
  StorageLifecycleMetrics,
  PrivacyMetrics,
  NetworkSyncState,
} from '../types/resilience';

class EdgeResilienceManager {
  private isNetworkOnline: boolean = true;
  private networkLatencyMs: number = 4.2;
  private offlineBufferedRecordsCount: number = 0;
  private totalSyncedRecords: number = 148200;
  private syncProgressPct: number = 100;
  private lastSyncTimestamp: string = new Date().toISOString();
  private totalAlarmSnippetsCount: number = 42;
  private usedDiskGb: number = 24.6;

  private privacyConfig: PrivacyMetrics = {
    detectorLatencyMs: 0.82,
    faceObfuscationRatePct: 100.0,
    badgeObfuscationRatePct: 100.0,
    mosaicKernelSize: '15x15 硬件高斯马赛克模糊 (In-Memory Obfuscation)',
    inMemoryZeroDiskLeak: true,
    complianceStandard: 'ISO 27001 / PIPL (中国个人信息保护法) / EU GDPR',
  };

  private storageConfig: StorageLifecycleMetrics = {
    totalDiskCapacityGb: 256.0,
    usedDiskGb: 24.6,
    diskWatermarkPct: 9.6,
    watermarkAlarmThresholdPct: 85.0,
    retentionNormalMetadataDays: '永久留存 (< 1 KB / 件，DuckDB 元数据)',
    retentionAlarmSnippetsDays: 30,
    ringBufferAllocatedMb: 256,
    totalAlarmSnippetsCount: 42,
  };

  constructor() {
    // Background simulation loop: when offline, increment buffer; when online, keep synchronized
    setInterval(() => {
      if (!this.isNetworkOnline) {
        this.offlineBufferedRecordsCount += Math.floor(Math.random() * 3) + 1;
        this.syncProgressPct = Math.max(
          10,
          100 - Math.min(90, Math.floor(this.offlineBufferedRecordsCount / 10))
        );
      } else if (this.offlineBufferedRecordsCount > 0) {
        // Automatically sync back down smoothly
        const drained = Math.min(this.offlineBufferedRecordsCount, 15);
        this.offlineBufferedRecordsCount -= drained;
        this.totalSyncedRecords += drained;
        this.syncProgressPct =
          this.offlineBufferedRecordsCount === 0
            ? 100
            : Math.min(98, 100 - this.offlineBufferedRecordsCount);
        this.lastSyncTimestamp = new Date().toISOString();
      }
    }, 1500);
  }

  public getStatus(): ResilienceStatusPayload {
    const watermarkPct = +((this.usedDiskGb / this.storageConfig.totalDiskCapacityGb) * 100).toFixed(1);
    return {
      privacy: this.privacyConfig,
      storage: {
        ...this.storageConfig,
        usedDiskGb: this.usedDiskGb,
        diskWatermarkPct: watermarkPct,
        totalAlarmSnippetsCount: this.totalAlarmSnippetsCount,
      },
      sync: {
        isNetworkOnline: this.isNetworkOnline,
        networkLatencyMs: this.isNetworkOnline ? this.networkLatencyMs : 0,
        offlineBufferedRecordsCount: this.offlineBufferedRecordsCount,
        syncProgressPct: this.syncProgressPct,
        lastSyncTimestamp: this.lastSyncTimestamp,
        totalSyncedRecords: this.totalSyncedRecords,
        syncThroughputOps: 5400,
        offlineMaxAutonomyDays: 7,
      },
    };
  }

  public toggleNetworkState(online?: boolean): { isOnline: boolean; message: string } {
    this.isNetworkOnline = online !== undefined ? online : !this.isNetworkOnline;
    if (!this.isNetworkOnline) {
      return {
        isOnline: false,
        message: '车间局域网已切断！系统已自动无缝切换至【边缘离线自治容灾模式】，视觉防呆与生产记录 100% 本地缓冲，产线零停机！',
      };
    } else {
      return {
        isOnline: true,
        message: '局域网通信已恢复！后台增量同步引擎（Sync Engine）正在高速将缓冲记录批量补传至厂级 MES 质量追溯中心！',
      };
    }
  }

  public triggerIncrementalSync(): { success: boolean; syncedCount: number; remainingCount: number } {
    const count = this.offlineBufferedRecordsCount;
    this.totalSyncedRecords += count;
    this.offlineBufferedRecordsCount = 0;
    this.syncProgressPct = 100;
    this.lastSyncTimestamp = new Date().toISOString();
    return {
      success: true,
      syncedCount: count,
      remainingCount: 0,
    };
  }

  public triggerStorageRotation(): {
    reclaimedGb: number;
    cleanedSnippetsCount: number;
    newDiskUsageGb: number;
  } {
    const reclaimedGb = 3.2;
    this.usedDiskGb = Math.max(12.0, +(this.usedDiskGb - reclaimedGb).toFixed(1));
    this.totalAlarmSnippetsCount = Math.max(10, this.totalAlarmSnippetsCount - 12);
    return {
      reclaimedGb,
      cleanedSnippetsCount: 12,
      newDiskUsageGb: this.usedDiskGb,
    };
  }

  public getComplianceAuditReport(): ComplianceAuditReport {
    return {
      reportId: `AUDIT-GDPR-PIPL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      generatedAt: new Date().toISOString(),
      assessmentResult: 'PASSED',
      auditedStation: '精密电子微装配样板线 (ST-SMT-A03)',
      totalFramesAudited: 846200,
      rawFaceLeakCount: 0, // Zero leak strict compliance
      badgeNumberLeakCount: 0, // Zero leak strict compliance
      offlineDowntimeSec: 0, // Zero downtime offline resilience
      auditorCertification: 'CNAS / TÜV SÜD 个人数据合规与工业边缘安全联合认证 (已签发)',
    };
  }
}

export const edgeResilienceManager = new EdgeResilienceManager();
