export interface PlcRegisterMap {
  address: number;
  name: string;
  type: 'UINT16';
  access: 'R' | 'W';
  value: number;
  description: string;
}

export interface InterlockEventRecord {
  id: string;
  timestamp: string;
  stationId: string;
  type: 'POKA_YOKE_INTERLOCK' | 'HAZARD_EMERGENCY_STOP' | 'WATCHDOG_TIMEOUT';
  triggerReason: string;
  totalCutoffLatencyMs: number;
  plcStatusBefore: string;
  plcStatusAfter: string;
  physicalOutputCut: string[];
  releasedBy: string | null;
  releasedAt: string | null;
}

export interface PlcStatusPayload {
  isConnected: boolean;
  plcBrand: string;
  protocol: 'Modbus_TCP' | 'OPC_UA' | 'Siemens_S7';
  plcIp: string;
  port: number;
  rackSlot: string;
  busScanCycleMs: number;
  busLatencyMs: number;
  isInterlocked: boolean;
  interlockMode: 'EMERGENCY_STOP' | 'POKA_YOKE_LOCK' | 'NORMAL_RUNNING';
  registers: PlcRegisterMap[];
  activeRelayOutputs: {
    Y001_Cylinder_Down: boolean;
    Y002_Outfeed_Conveyor: boolean;
    Y003_Safety_Gate_Lock: boolean;
    Y004_Andon_Red_Siren: boolean;
  };
  iso13849LatencyBreakdown: {
    tInferMs: number;
    tBusMs: number;
    tPlcScanMs: number;
    tValveCutoffMs: number;
    totalCutoffLatencyMs: number;
    safetyLevel: string;
  };
}
