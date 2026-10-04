export interface IndustrialCameraDevice {
  id: string;
  vendor: string;
  model: string;
  serialNumber: string;
  interfaceType: 'GigE_Vision' | 'USB3_Vision';
  ipAddress: string;
  macAddress: string;
  status: 'connected' | 'disconnected' | 'streaming';
  resolution: { width: number; height: number };
  maxFps: number;
  sensorType: 'Global_Shutter_CMOS';
  sensorSize: '1/2.9"' | '1/1.8"';
}

export interface CameraOpticalParameters {
  exposureTimeUs: number; // 300 ~ 20000 us (default 500us)
  gainDb: number; // 0 ~ 24 dB
  triggerMode: 'Off' | 'On';
  triggerSource: 'Line1' | 'Line2' | 'Software';
  triggerActivation: 'RisingEdge' | 'FallingEdge';
  triggerDebounceUs: number; // 50 ~ 1000 us
  acquisitionFrameRate: number; // 1 ~ 160 FPS
  pixelFormat: 'Mono8' | 'BayerRG8' | 'RGB8';
  // Optics setup
  wavelengthNm: number; // 850 (NIR)
  polarizerAngleDeg: number; // 0 ~ 90 (90 = cross-polarized消光)
  polarizerActive: boolean;
  lensFocalLengthMm: number; // 8mm default
  workingDistanceMm: number; // 450~600mm
  fovWidthMm: number; // 600mm
  fovHeightMm: number; // 450mm
}

export interface TriggerMetrics {
  totalTriggerCount: number;
  missedTriggers: number;
  lastTriggerTimestamp: number;
  triggerJitterUs: number; // < 200 us
  hardwarePulseVoltage: number; // e.g. 24.0V TTL
}

class IndustrialCameraManager {
  private devices: IndustrialCameraDevice[] = [
    {
      id: 'cam_smt_main',
      vendor: 'Hikrobot (海康机器人)',
      model: 'MV-CS020-10GM',
      serialNumber: 'DA28491024',
      interfaceType: 'GigE_Vision',
      ipAddress: '192.168.1.101',
      macAddress: '00:1B:C0:A4:71:01',
      status: 'streaming',
      resolution: { width: 1920, height: 1200 },
      maxFps: 160,
      sensorType: 'Global_Shutter_CMOS',
      sensorSize: '1/1.8"',
    },
    {
      id: 'cam_smt_side',
      vendor: 'Daheng Imaging (大恒图像)',
      model: 'MER2-160-227GM',
      serialNumber: 'DH77291038',
      interfaceType: 'GigE_Vision',
      ipAddress: '192.168.1.102',
      macAddress: '00:1B:C0:A4:71:02',
      status: 'connected',
      resolution: { width: 1440, height: 1080 },
      maxFps: 227,
      sensorType: 'Global_Shutter_CMOS',
      sensorSize: '1/2.9"',
    },
  ];

  private activeDeviceId: string = 'cam_smt_main';

  private parameters: CameraOpticalParameters = {
    exposureTimeUs: 500, // 500μs extreme global shutter to freeze fast human hand motion
    gainDb: 4.5,
    triggerMode: 'On',
    triggerSource: 'Line1', // Opto-isolated Line 1 from photoelectric switch
    triggerActivation: 'RisingEdge',
    triggerDebounceUs: 100,
    acquisitionFrameRate: 35,
    pixelFormat: 'Mono8',
    wavelengthNm: 850,
    polarizerAngleDeg: 90, // Cross-polarization active (extinction of specular reflection)
    polarizerActive: true,
    lensFocalLengthMm: 8.0,
    workingDistanceMm: 520,
    fovWidthMm: 600,
    fovHeightMm: 450,
  };

  private triggerMetrics: TriggerMetrics = {
    totalTriggerCount: 4280,
    missedTriggers: 0,
    lastTriggerTimestamp: Date.now() - 320,
    triggerJitterUs: 120, // 120 μs, well below 200 μs target
    hardwarePulseVoltage: 24.0,
  };

  public getDevices(): IndustrialCameraDevice[] {
    return this.devices;
  }

  public getActiveDevice(): IndustrialCameraDevice {
    return (
      this.devices.find((d) => d.id === this.activeDeviceId) || this.devices[0]
    );
  }

  public getParameters(): CameraOpticalParameters {
    return this.parameters;
  }

  public updateParameters(
    updates: Partial<CameraOpticalParameters>
  ): CameraOpticalParameters {
    this.parameters = { ...this.parameters, ...updates };
    return this.parameters;
  }

  public getTriggerMetrics(): TriggerMetrics {
    return {
      ...this.triggerMetrics,
      lastTriggerTimestamp: Date.now() - Math.floor(Math.random() * 800),
      triggerJitterUs: +(115 + (Math.random() * 20 - 10)).toFixed(0),
    };
  }

  public fireSoftwareTrigger(): { success: boolean; frameId: number; timestamp: number } {
    this.triggerMetrics.totalTriggerCount += 1;
    this.triggerMetrics.lastTriggerTimestamp = Date.now();
    return {
      success: true,
      frameId: this.triggerMetrics.totalTriggerCount,
      timestamp: this.triggerMetrics.lastTriggerTimestamp,
    };
  }

  /**
   * Optical FOV & Focal Length Calculator
   * Formula: FocalLength = (WorkingDistance * SensorDimension) / FOVDimension
   */
  public calculateOptics(
    workingDistanceMm: number,
    fovWidthMm: number,
    sensorSize: '1/2.9"' | '1/1.8"'
  ): {
    recommendedFocalLengthMm: number;
    nearestStandardLensMm: number;
    actualFovWidthMm: number;
    actualFovHeightMm: number;
    magnification: number;
    depthOfFieldMm: number;
  } {
    // Sensor width in mm: 1/1.8" ~ 7.18mm x 5.32mm; 1/2.9" ~ 5.0mm x 3.75mm
    const sensorW = sensorSize === '1/1.8"' ? 7.18 : 5.0;
    const sensorH = sensorSize === '1/1.8"' ? 5.32 : 3.75;

    const fExact = (workingDistanceMm * sensorW) / fovWidthMm;
    const standardLenses = [6, 8, 12, 16, 25, 35, 50];
    const nearest = standardLenses.reduce((prev, curr) =>
      Math.abs(curr - fExact) < Math.abs(prev - fExact) ? curr : prev
    );

    const actualFovW = +( (workingDistanceMm * sensorW) / nearest ).toFixed(1);
    const actualFovH = +( (workingDistanceMm * sensorH) / nearest ).toFixed(1);
    const mag = +( sensorW / actualFovW ).toFixed(4);
    // Depth of field calculation at F/2.8
    const dof = +( (2 * 2.8 * 0.03 * workingDistanceMm * workingDistanceMm) / (nearest * nearest * 1000) * 10 ).toFixed(1);

    return {
      recommendedFocalLengthMm: +fExact.toFixed(2),
      nearestStandardLensMm: nearest,
      actualFovWidthMm: actualFovW,
      actualFovHeightMm: actualFovH,
      magnification: mag,
      depthOfFieldMm: dof,
    };
  }
}

export const industrialCameraManager = new IndustrialCameraManager();
