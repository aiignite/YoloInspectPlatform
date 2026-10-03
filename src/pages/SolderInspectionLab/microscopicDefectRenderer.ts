import { SolderDefectItem } from './index';

// High-power microscopic rendering of specific SMT defects
export function drawMicroscopicPresetDefect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  defect: SolderDefectItem,
  zoomLevel: number,
  presetBg: string
) {
  // 1. Dark Soldermask Micro Background
  const isBlue = presetBg === 'blue';
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, isBlue ? '#001a40' : '#062612');
  bgGrad.addColorStop(1, '#020d06');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. Ring-light coaxial microscope illumination
  const ringLight = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 105);
  ringLight.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
  ringLight.addColorStop(0.6, 'rgba(255, 255, 255, 0.04)');
  ringLight.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
  ctx.fillStyle = ringLight;
  ctx.fillRect(0, 0, w, h);

  // 3. Render specific defect geometry under high power magnification
  const dId = defect.id;
  const dName = defect.name;

  if (dId === 'sd-01' || dName.includes('桥接')) {
    // === QFP PINS SOLDER BRIDGING ===
    // Solder pads on PCB (copper lands)
    ctx.fillStyle = '#b87333';
    ctx.fillRect(45, 18, 50, 184);
    ctx.fillRect(125, 18, 50, 184);

    // Two QFP gull-wing leads (Pin 12 & Pin 13)
    const leadGrad1 = ctx.createLinearGradient(55, 0, 85, 0);
    leadGrad1.addColorStop(0, '#57606a');
    leadGrad1.addColorStop(0.3, '#d0d7de');
    leadGrad1.addColorStop(0.7, '#ffffff');
    leadGrad1.addColorStop(1, '#8c959f');

    ctx.fillStyle = leadGrad1;
    ctx.fillRect(52, 25, 36, 170);
    ctx.fillRect(132, 25, 36, 170);

    // Continuous shiny silver solder bridge spanning between Pin 12 and 13
    const bridgeGrad = ctx.createLinearGradient(70, 70, 150, 150);
    bridgeGrad.addColorStop(0, '#d0d7de');
    bridgeGrad.addColorStop(0.3, '#ffffff');
    bridgeGrad.addColorStop(0.7, '#8c959f');
    bridgeGrad.addColorStop(1, '#c5cbd1');

    ctx.fillStyle = bridgeGrad;
    ctx.beginPath();
    ctx.moveTo(85, 78);
    ctx.bezierCurveTo(95, 70, 120, 70, 135, 76);
    ctx.lineTo(135, 142);
    ctx.bezierCurveTo(120, 150, 95, 150, 85, 144);
    ctx.closePath();
    ctx.fill();

    // Solder meniscus specular highlights
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(90, 84);
    ctx.bezierCurveTo(105, 88, 115, 88, 130, 84);
    ctx.stroke();

    // Red caliper measurement across bridge
    ctx.strokeStyle = '#ff4d4f';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(88, 110);
    ctx.lineTo(132, 110);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ff4d4f';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('间隙: 0.00mm', 78, 105);
    ctx.fillText('IPC 绝缘短路', 76, 124);
  } else if (dId === 'sd-02' || dName.includes('不足') || dName.includes('虚焊')) {
    // === 0402 COLD SOLDER / INSUFFICIENT FILLET ===
    // PCB Copper land
    ctx.fillStyle = '#b87333';
    ctx.fillRect(25, 40, 170, 140);
    ctx.strokeStyle = '#854d19';
    ctx.lineWidth = 2;
    ctx.strokeRect(25, 40, 170, 140);

    // Ceramic component body on left
    ctx.fillStyle = '#a68261';
    ctx.fillRect(25, 55, 65, 110);
    ctx.fillStyle = '#7a5a3a';
    ctx.fillRect(80, 55, 10, 110);

    // Component metal end-cap (nickel/tin)
    ctx.fillStyle = '#d0d7de';
    ctx.fillRect(85, 55, 25, 110);

    // Starved, matte gray solder fillet (almost no climb, dry crystalline look)
    ctx.fillStyle = '#6e7681';
    ctx.beginPath();
    ctx.moveTo(110, 165);
    ctx.lineTo(155, 165);
    ctx.lineTo(110, 145);
    ctx.closePath();
    ctx.fill();

    // Unwetted bare copper area on pad
    ctx.fillStyle = 'rgba(184, 115, 51, 0.7)';
    ctx.fillRect(155, 55, 35, 110);

    // Wetting angle arc θ = 88°
    ctx.strokeStyle = '#ff4d4f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(155, 165, 28, Math.PI, Math.PI * 1.5);
    ctx.stroke();

    ctx.fillStyle = '#ff4d4f';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('爬升: 12% (<25%)', 105, 130);
    ctx.fillText('θ接触角: 88° 钝角', 105, 144);
  } else if (dId === 'sd-03' || dName.includes('立碑')) {
    // === TOMBSTONING (CHIP COMPONENT STANDING UPRIGHT) ===
    // Left copper pad with anchored solder base
    ctx.fillStyle = '#b87333';
    ctx.fillRect(30, 145, 60, 45);
    ctx.fillStyle = '#8c959f';
    ctx.fillRect(35, 135, 50, 45);

    // Right empty copper pad (open circuit!)
    ctx.fillStyle = '#b87333';
    ctx.fillRect(130, 145, 60, 45);
    ctx.strokeStyle = '#ff4d4f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(130, 145, 60, 45);

    // Drop shadow under lifted resistor body
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(75, 150, 65, 20);

    // Resistor ceramic body standing tilted upward at ~38 degrees!
    ctx.save();
    ctx.translate(65, 145);
    ctx.rotate(-0.55); // 32 degrees up

    // 0603 resistor body
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(0, -32, 95, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('103', 38, -12);

    // Left anchored terminal
    ctx.fillStyle = '#d0d7de';
    ctx.fillRect(0, -32, 18, 32);

    // Right lifted terminal hanging in air
    ctx.fillStyle = '#d0d7de';
    ctx.fillRect(77, -32, 18, 32);
    ctx.restore();

    // Measurement indicator
    ctx.fillStyle = '#ff4d4f';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('立碑仰角: 38°', 125, 75);
    ctx.fillText('开路脱焊 (REJECT)', 115, 90);
  } else if (dId === 'sd-04' || dName.includes('焊料球') || dName.includes('溅落')) {
    // === SOLDER BALLS / SPLATTERS ===
    // PCB Soldermask texture with copper track passing nearby
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(25, 35, 35, 150);

    // Annular ring plated via
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(170, 70, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#062612';
    ctx.beginPath();
    ctx.arc(170, 70, 12, 0, Math.PI * 2);
    ctx.fill();

    // 3 Spherical Solder Beads
    const balls = [
      [100, 105, 16],
      [125, 140, 11],
      [80, 150, 9],
    ];

    balls.forEach(([bx, by, br]) => {
      const sGrad = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.35, br * 0.1, bx, by, br);
      sGrad.addColorStop(0, '#ffffff');
      sGrad.addColorStop(0.3, '#d0d7de');
      sGrad.addColorStop(0.7, '#8c959f');
      sGrad.addColorStop(1, '#343a40');
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Distance caliper to track
    ctx.strokeStyle = '#faad14';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(60, 105);
    ctx.lineTo(84, 105);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#faad14';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('锡珠直径: 0.12mm', 65, 88);
    ctx.fillText('导电间距过近隐患', 65, 125);
  } else if (dId === 'sd-05' || dName.includes('气孔') || dName.includes('针孔') || dName.includes('空洞')) {
    // === BGA PAD VOIDS & PINHOLES ===
    // Circular pad
    const padGrad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, 75);
    padGrad.addColorStop(0, '#ffffff');
    padGrad.addColorStop(0.4, '#d0d7de');
    padGrad.addColorStop(0.8, '#8c959f');
    padGrad.addColorStop(1, '#57606a');
    ctx.fillStyle = padGrad;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 75, 0, Math.PI * 2);
    ctx.fill();

    // Central flux outgassing crater void
    const voidGrad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, 28);
    voidGrad.addColorStop(0, '#0a0a0a');
    voidGrad.addColorStop(0.7, '#1f1f1f');
    voidGrad.addColorStop(1, '#5c4d32'); // flux residue rim
    ctx.fillStyle = voidGrad;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ff4d4f';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ff4d4f';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('空洞率: 18.2%', w / 2 - 36, h / 2 - 36);
    ctx.fillText('(Class 3 限额 <15%)', w / 2 - 55, h / 2 + 48);
  } else if (dId === 'sd-11' || dName.includes('过多') || dName.includes('起堆')) {
    // === EXCESS SOLDER BULGING ===
    // Copper pad
    ctx.fillStyle = '#b87333';
    ctx.fillRect(40, 50, 140, 120);

    // Bulging convex dome
    const domeGrad = ctx.createRadialGradient(w / 2 - 15, h / 2 - 15, 8, w / 2, h / 2, 70);
    domeGrad.addColorStop(0, '#ffffff');
    domeGrad.addColorStop(0.3, '#d0d7de');
    domeGrad.addColorStop(0.75, '#8c959f');
    domeGrad.addColorStop(1, '#343a40');
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 68, 0, Math.PI * 2);
    ctx.fill();

    // Overflow boundary
    ctx.strokeStyle = '#faad14';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 50, 140, 120);

    ctx.fillStyle = '#faad14';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('凸面溢出: +42%', w / 2 - 42, h / 2 - 38);
    ctx.fillText('θ接触角: 96° 凸球', w / 2 - 48, h / 2 + 50);
  } else if (dId === 'sd-12' || dName.includes('错位') || dName.includes('偏位')) {
    // === PAD MISALIGNMENT ===
    // Copper pad on PCB
    ctx.fillStyle = '#b87333';
    ctx.fillRect(40, 60, 80, 100);
    ctx.strokeStyle = '#854d19';
    ctx.strokeRect(40, 60, 80, 100);

    // SOT-23 pin shifted diagonally off the pad by 32%
    const pinGrad = ctx.createLinearGradient(70, 0, 150, 0);
    pinGrad.addColorStop(0, '#8c959f');
    pinGrad.addColorStop(0.5, '#ffffff');
    pinGrad.addColorStop(1, '#57606a');
    ctx.fillStyle = pinGrad;
    ctx.fillRect(72, 75, 85, 70);

    // Measurement arrow
    ctx.strokeStyle = '#ff4d4f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(120, 110);
    ctx.lineTo(157, 110);
    ctx.stroke();

    ctx.fillStyle = '#ff4d4f';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('偏移搭接: 32%', 85, 52);
    ctx.fillText('> 25% Class 3 拒收', 78, 168);
  }
}
