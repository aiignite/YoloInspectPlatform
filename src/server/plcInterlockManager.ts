import { PlcRegisterMap, InterlockEventRecord } from '../types/plc';

class PlcInterlockManager {
  private isConnected: boolean = true;
  private plcBrand: string = 'Siemens S7-1500 (CPU 1515-2 PN)';
  private protocol: 'Modbus_TCP' | 'OPC_UA' | 'Siemens_S7' = 'Modbus_TCP';
  private plcIp: string = '192.168.1.50';
  private port: number = 502;
  private rackSlot: string = 'Rack 0 / Slot 1';
  private busScanCycleMs: number = 10; // PLC scan cycle 10ms
  private busLatencyMs: number = 6.2; // Fieldbus roundtrip 6.2ms

  // Register Bank
  private registers: Record<number, PlcRegisterMap> = {
    40001: {
      address: 40001,
      name: 'VISION_HEARTBEAT',
      type: 'UINT16',
      access: 'W',
      value: 1204,
      description: '视觉看门狗心跳字，每500ms翻转自增一次，PLC超时2s未变则报警停机',
    },
    40002: {
      address: 40002,
      name: 'SOP_STEP_ACTIVE',
      type: 'UINT16',
      access: 'W',
      value: 2,
      description: '当前视觉识别到的合规工步 (1:PCB到位, 2:元件微插装, 3:螺丝锁紧, 4:过站扫描)',
    },
    40003: {
      address: 40003,
      name: 'ANDON_STATE_CMD',
      type: 'UINT16',
      access: 'W',
      value: 1, // 1: Green, 2: Yellow, 3: Red
      description: '三色灯控制字 (1:绿灯常亮, 2:黄灯蜂鸣, 3:红灯警报长鸣)',
    },
    40004: {
      address: 40004,
      name: 'POKA_YOKE_INTERLOCK',
      type: 'UINT16',
      access: 'W',
      value: 0, // 0: Released / OK, 1: INTERLOCK ACTIVE (Cut power to valves & motors)
      description: '物理联锁控制字 (0:正常放行, 1:动作偏差强制锁死下压气缸与出板电机)',
    },
    40005: {
      address: 40005,
      name: 'HAZARD_EMERGENCY_STOP',
      type: 'UINT16',
      access: 'W',
      value: 0, // 0: Normal, 1: Emergency Stop
      description: '安全急停字 (1:手指侵入机械行程区，触发安全继电器立即泄压复位)',
    },
    40010: {
      address: 40010,
      name: 'PLC_STATION_READY',
      type: 'UINT16',
      access: 'R',
      value: 1,
      description: '机台光电信号 (1:治具到位夹紧就绪，允许开始工装作业)',
    },
    40011: {
      address: 40011,
      name: 'MANUAL_RELEASE_KEY',
      type: 'UINT16',
      access: 'R',
      value: 0,
      description: '班组长物理钥匙旋转/刷卡解锁信号 (1:确认放行，复位联锁状态)',
    },
  };

  private eventsHistory: InterlockEventRecord[] = [
    {
      id: 'EVT-INTLK-20261003-01',
      timestamp: '2026-10-03T11:42:15.210Z',
      stationId: 'ST-SMT-A03',
      type: 'POKA_YOKE_INTERLOCK',
      triggerReason: '螺丝锁付工步未完成即试图抓取主板下推 (违规跳步)',
      totalCutoffLatencyMs: 33.4,
      plcStatusBefore: 'RUNNING',
      plcStatusAfter: 'INTERLOCKED_VALVE_CUT',
      physicalOutputCut: ['Y001_PNEUMATIC_VALVE', 'Y002_CONVEYOR_STEPPER'],
      releasedBy: 'TL-8820 (张工/制造班长)',
      releasedAt: '2026-10-03T11:44:02.100Z',
    },
  ];

  constructor() {
    // Heartbeat increment loop every 500ms
    setInterval(() => {
      if (this.registers[40001]) {
        this.registers[40001].value = (this.registers[40001].value + 1) % 65535;
      }
    }, 500);
  }

  public getStatus() {
    const isInterlocked =
      this.registers[40004].value === 1 || this.registers[40005].value === 1;
    return {
      isConnected: this.isConnected,
      plcBrand: this.plcBrand,
      protocol: this.protocol,
      plcIp: this.plcIp,
      port: this.port,
      rackSlot: this.rackSlot,
      busScanCycleMs: this.busScanCycleMs,
      busLatencyMs: this.busLatencyMs,
      isInterlocked,
      interlockMode:
        this.registers[40005].value === 1
          ? 'EMERGENCY_STOP'
          : this.registers[40004].value === 1
          ? 'POKA_YOKE_LOCK'
          : 'NORMAL_RUNNING',
      registers: Object.values(this.registers),
      activeRelayOutputs: {
        Y001_Cylinder_Down: !isInterlocked,
        Y002_Outfeed_Conveyor: !isInterlocked,
        Y003_Safety_Gate_Lock: true,
        Y004_Andon_Red_Siren: isInterlocked,
      },
      iso13849LatencyBreakdown: {
        tInferMs: 2.1,
        tBusMs: this.busLatencyMs,
        tPlcScanMs: this.busScanCycleMs,
        tValveCutoffMs: 15.0,
        totalCutoffLatencyMs: +(2.1 + this.busLatencyMs + this.busScanCycleMs + 15.0).toFixed(1),
        safetyLevel: 'ISO 13849-1 PLd (Category 3)',
      },
    };
  }

  public writeRegister(address: number, value: number) {
    if (!this.registers[address]) {
      throw new Error(`Register ${address} not found`);
    }
    this.registers[address].value = value;
    return this.registers[address];
  }

  public triggerInterlock(type: 'POKA_YOKE' | 'EMERGENCY_STOP', reason: string): InterlockEventRecord {
    if (type === 'EMERGENCY_STOP') {
      this.registers[40005].value = 1; // E-Stop
      this.registers[40003].value = 3; // Red light
    } else {
      this.registers[40004].value = 1; // Poka-yoke lock
      this.registers[40003].value = 3; // Red light
    }

    const event: InterlockEventRecord = {
      id: `EVT-INTLK-${Date.now()}`,
      timestamp: new Date().toISOString(),
      stationId: 'ST-SMT-A03',
      type: type === 'EMERGENCY_STOP' ? 'HAZARD_EMERGENCY_STOP' : 'POKA_YOKE_INTERLOCK',
      triggerReason: reason,
      totalCutoffLatencyMs: +(2.1 + this.busLatencyMs + this.busScanCycleMs + 15.0).toFixed(1),
      plcStatusBefore: 'RUNNING',
      plcStatusAfter: type === 'EMERGENCY_STOP' ? 'ESTOP_PRESSURE_DUMP' : 'INTERLOCKED_VALVE_CUT',
      physicalOutputCut: ['Y001_PNEUMATIC_VALVE', 'Y002_CONVEYOR_STEPPER'],
      releasedBy: null,
      releasedAt: null,
    };

    this.eventsHistory.unshift(event);
    if (this.eventsHistory.length > 20) {
      this.eventsHistory.pop();
    }

    return event;
  }

  public releaseInterlock(badgeId: string, operatorName: string) {
    this.registers[40011].value = 1; // Manual key release
    this.registers[40004].value = 0; // Clear interlock
    this.registers[40005].value = 0; // Clear E-stop
    this.registers[40003].value = 1; // Reset to green light

    if (this.eventsHistory.length > 0 && !this.eventsHistory[0].releasedAt) {
      this.eventsHistory[0].releasedBy = `${badgeId} (${operatorName})`;
      this.eventsHistory[0].releasedAt = new Date().toISOString();
    }

    setTimeout(() => {
      this.registers[40011].value = 0; // Reset key after release
    }, 1000);

    return {
      success: true,
      message: `班组长 ${operatorName} [${badgeId}] 已刷卡确认，物理联锁已解除并恢复供电！`,
    };
  }

  public getEventsHistory(): InterlockEventRecord[] {
    return this.eventsHistory;
  }
}

export const plcInterlockManager = new PlcInterlockManager();
