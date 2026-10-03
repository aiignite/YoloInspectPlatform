import { SolderDefectItem } from './index';

// High-fidelity SMT PCB board rendering with 100% accurate visual features
export function drawRealisticPcb(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  boardId: string,
  highlightLuster: boolean,
  showAllGoodPads: boolean,
  showHeatmap: boolean,
  defects: SolderDefectItem[]
) {
  const isPower = boardId === 'pcb_power_02';

  // 1. PCB Substrate & Solder Mask Base
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  if (isPower) {
    bgGrad.addColorStop(0, '#002554');
    bgGrad.addColorStop(0.5, '#001938');
    bgGrad.addColorStop(1, '#001026');
  } else {
    bgGrad.addColorStop(0, '#0a3a1e');
    bgGrad.addColorStop(0.5, '#062914');
    bgGrad.addColorStop(1, '#041d0e');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle fiberglass FR-4 weave pattern
  ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
  for (let x = 0; x < w; x += 6) {
    ctx.fillRect(x, 0, 1, h);
  }
  for (let y = 0; y < h; y += 6) {
    ctx.fillRect(0, y, w, 1);
  }

  // 2. Copper Traces & Ground Pours
  ctx.strokeStyle = isPower ? 'rgba(77, 171, 247, 0.35)' : 'rgba(212, 175, 55, 0.38)';
  ctx.lineWidth = isPower ? 3.5 : 1.8;
  ctx.lineCap = 'round';

  const traceRoutes = isPower
    ? [
        [[40, 60], [150, 60], [190, 140]],
        [[230, 180], [330, 180], [380, 200]],
        [[380, 230], [500, 230], [580, 120]],
        [[100, 320], [280, 320], [380, 250]],
        [[420, 220], [520, 310], [590, 310]],
      ]
    : [
        [[50, 45], [120, 45], [155, 170]],
        [[175, 200], [230, 200], [290, 140]],
        [[316, 140], [370, 140], [420, 160]],
        [[448, 160], [520, 160], [580, 90]],
        [[155, 220], [155, 280], [230, 310]],
        [[262, 310], [310, 310], [350, 280]],
        [[372, 280], [460, 280], [520, 340]],
      ];

  traceRoutes.forEach((route) => {
    ctx.beginPath();
    ctx.moveTo(route[0][0], route[0][1]);
    for (let i = 1; i < route.length; i++) {
      ctx.lineTo(route[i][0], route[i][1]);
    }
    ctx.stroke();
  });

  // 3. Fiducial Marks (Optical Alignment Targets)
  const fids = [
    [24, 24],
    [w - 24, 24],
    [24, h - 24],
    [w - 24, h - 24],
  ];
  fids.forEach(([fx, fy]) => {
    // Copper clearance ring
    ctx.fillStyle = '#04180d';
    ctx.beginPath();
    ctx.arc(fx, fy, 8, 0, Math.PI * 2);
    ctx.fill();
    // Shiny gold fiducial dot
    ctx.fillStyle = '#f5c518';
    ctx.beginPath();
    ctx.arc(fx, fy, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // 4. White Silkscreen Labels
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = '9px monospace';
  ctx.fillText(isPower ? 'PWR-MGMT-2026-V2.1' : 'SMT-CTRL-MAIN-V3.4', 36, 28);
  ctx.fillText('IPC-A-610G COMPLIANT', 36, 40);
  ctx.fillText('REV-C', w - 75, 28);

  // 5. Board Specific Realistic Component Layout & Defects
  if (!isPower) {
    // --- MAIN SMT CONTROL BOARD (pcb_main_01) ---

    // [Component IC U1: QFN-28 Master Clock MCU] at (75, 95)
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(60, 80, 50, 50);
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(68, 88, 3, 0, Math.PI * 2); // Pin 1 notch
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '8px sans-serif';
    ctx.fillText('U1-QFN', 67, 108);

    // [Component IC U2: QFP-48 Fine-Pitch MCU] center at (155, 195)
    // Package body
    ctx.fillStyle = '#181818';
    ctx.fillRect(135, 175, 42, 42);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(135, 175, 42, 42);

    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(142, 182, 2.5, 0, Math.PI * 2); // Pin 1 dot
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('STM32F4', 138, 195);
    ctx.fillText('IC U2', 142, 206);

    // QFP Gullwing Pins (Top, Bottom, Left) - ALL GOOD
    // Left pins
    for (let py = 180; py <= 212; py += 5) {
      drawSolderPad(ctx, 126, py, 8, 3, highlightLuster, false);
    }
    // Top pins
    for (let px = 140; px <= 172; px += 5) {
      drawSolderPad(ctx, px, 166, 3, 8, highlightLuster, false);
    }
    // Bottom pins
    for (let px = 140; px <= 172; px += 5) {
      drawSolderPad(ctx, px, 218, 3, 8, highlightLuster, false);
    }

    // Right pins (Pin 10 to Pin 16) - Contains DEFECT sd-01 SOLDER BRIDGING!
    // Pin 10, 11
    drawSolderPad(ctx, 178, 182, 8, 3, highlightLuster, false);
    drawSolderPad(ctx, 178, 187, 8, 3, highlightLuster, false);

    // *** DEFECT sd-01: Pin 12 & 13 Solder Bridging ***
    // Both pin leads
    drawSolderPad(ctx, 178, 195, 10, 3.5, highlightLuster, true);
    drawSolderPad(ctx, 178, 203, 10, 3.5, highlightLuster, true);
    // Continuous shiny tin solder bridge blob connecting pin 12 & 13!
    const bridgeGrad = ctx.createLinearGradient(178, 195, 188, 203);
    bridgeGrad.addColorStop(0, '#ffffff');
    bridgeGrad.addColorStop(0.3, '#d8e2ea');
    bridgeGrad.addColorStop(0.7, '#a6b8c7');
    bridgeGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = bridgeGrad;
    ctx.beginPath();
    ctx.roundRect(178, 195, 9, 12, 3);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Pin 14, 15, 16
    drawSolderPad(ctx, 178, 211, 8, 3, highlightLuster, false);
    drawSolderPad(ctx, 178, 216, 8, 3, highlightLuster, false);

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '8px monospace';
    ctx.fillText('Pin12-13', 188, 203);

    // [Component C18: 0402 Capacitor] at (290, 140)
    // Silkscreen outline
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(280, 134, 22, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '8px sans-serif';
    ctx.fillText('C18', 283, 130);

    // Left terminal: Good concave solder fillet
    drawSolderPad(ctx, 281, 141, 5, 8, highlightLuster, false);
    // Ceramic body (brown-beige)
    ctx.fillStyle = '#bda082';
    ctx.fillRect(286, 137, 9, 8);

    // *** DEFECT sd-02: Right Terminal Insufficient / Cold Solder ***
    // Starved, matte gray solder, minimal climb, copper pad visible
    ctx.fillStyle = '#b87333'; // exposed bare copper
    ctx.fillRect(295, 137, 6, 8);
    ctx.fillStyle = '#7a7d80'; // starved dull gray solder
    ctx.fillRect(296, 138, 4, 6);
    ctx.strokeStyle = '#4a4d50';
    ctx.strokeRect(296, 138, 4, 6);

    // [Component R22: 0603 Resistor] at (420, 160)
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '8px sans-serif';
    ctx.fillText('R22', 416, 150);

    // *** DEFECT sd-03: Tombstoning (Lifted End) ***
    // Left copper pad with solder anchor
    drawSolderPad(ctx, 412, 163, 6, 10, highlightLuster, false);
    // Right bare copper pad (unwetted, component pulled off!)
    ctx.fillStyle = '#a86529'; // bare copper
    ctx.fillRect(432, 163, 7, 10);
    ctx.strokeStyle = '#784518';
    ctx.strokeRect(432, 163, 7, 10);

    // Drop shadow under lifted resistor body
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(422, 168, 15, 6);

    // 0603 resistor body tilted upright at ~35 degrees!
    ctx.save();
    ctx.translate(415, 168);
    ctx.rotate(-0.35); // tilt angle
    ctx.fillStyle = '#1f1f1f'; // black body
    ctx.fillRect(0, -6, 18, 9);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('103', 4, 1);
    // Metallic end caps
    ctx.fillStyle = '#d0d7de';
    ctx.fillRect(0, -6, 4, 9);
    ctx.fillRect(15, -6, 3, 9);
    ctx.restore();

    // [Vias Zone A-4] at (350, 280)
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '8px sans-serif';
    ctx.fillText('VIA A-4', 340, 272);
    // 4 Vias with annular rings
    const viaCoords = [
      [346, 282],
      [362, 282],
      [346, 294],
      [362, 294],
    ];
    viaCoords.forEach(([vx, vy]) => {
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(vx, vy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#082512';
      ctx.beginPath();
      ctx.arc(vx, vy, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // *** DEFECT sd-04: Solder Balls & Splatters ***
    const splatters = [
      [354, 286, 2.2],
      [358, 277, 1.8],
      [348, 290, 2.5],
    ];
    splatters.forEach(([bx, by, br]) => {
      const ballGrad = ctx.createRadialGradient(bx - 0.5, by - 0.5, 0.2, bx, by, br);
      ballGrad.addColorStop(0, '#ffffff');
      ballGrad.addColorStop(0.4, '#d0d7de');
      ballGrad.addColorStop(1, '#57606a');
      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    });

    // [BGA Pad Array & Pad J3] at (230, 310)
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '8px sans-serif';
    ctx.fillText('BGA-J3', 222, 300);

    for (let bx = 220; bx <= 248; bx += 9) {
      for (let by = 304; by <= 328; by += 8) {
        const isDefectPad = bx === 229 && by === 312;
        if (isDefectPad) {
          // *** DEFECT sd-05: Solder Void & Pinhole ***
          const voidGrad = ctx.createRadialGradient(bx, by, 1, bx, by, 4);
          voidGrad.addColorStop(0, '#ffffff');
          voidGrad.addColorStop(0.6, '#bfbfbf');
          voidGrad.addColorStop(1, '#595959');
          ctx.fillStyle = voidGrad;
          ctx.beginPath();
          ctx.arc(bx, by, 4.2, 0, Math.PI * 2);
          ctx.fill();

          // Dark pinhole/void crater in the center!
          ctx.fillStyle = '#1c1b18';
          ctx.beginPath();
          ctx.arc(bx + 0.3, by + 0.3, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#8c7042';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        } else {
          // Normal BGA solder balls
          const padGrad = ctx.createRadialGradient(bx - 0.5, by - 0.5, 0.5, bx, by, 3.5);
          padGrad.addColorStop(0, '#ffffff');
          padGrad.addColorStop(0.5, '#c5cbd1');
          padGrad.addColorStop(1, '#555b62');
          ctx.fillStyle = padGrad;
          ctx.beginPath();
          ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Passives Bank (Good 0402 / 0603 Arrays)
    for (let c = 0; c < 5; c++) {
      const cx = 330 + c * 24;
      const cy = 80;
      drawSolderPad(ctx, cx, cy, 4, 7, highlightLuster, false);
      ctx.fillStyle = '#bda082';
      ctx.fillRect(cx + 4, cy + 1, 7, 5);
      drawSolderPad(ctx, cx + 11, cy, 4, 7, highlightLuster, false);
    }
  } else {
    // --- POWER MANAGEMENT BOARD (pcb_power_02) ---

    // [Component Inductor L1: Heavy Power Inductor] at (190, 160)
    ctx.fillStyle = '#24272c';
    ctx.fillRect(170, 140, 56, 48);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(170, 140, 56, 48);

    // Copper winding coils visible in center
    ctx.strokeStyle = '#b87333';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(198, 164, 14, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('100μH', 186, 167);
    ctx.font = '8px sans-serif';
    ctx.fillText('L1 (POWER)', 174, 134);

    // Left terminal: Normal solder joint
    drawSolderPad(ctx, 162, 155, 8, 18, highlightLuster, false);

    // *** DEFECT sd-11: Right Terminal Excess Solder Mound ***
    // Normal pad area
    drawSolderPad(ctx, 226, 155, 8, 18, highlightLuster, false);
    // Massive overflowing bulging solder dome
    const excessGrad = ctx.createRadialGradient(230, 164, 2, 230, 164, 14);
    excessGrad.addColorStop(0, '#ffffff');
    excessGrad.addColorStop(0.35, '#d0d7de');
    excessGrad.addColorStop(0.8, '#8c959f');
    excessGrad.addColorStop(1, '#424a53');
    ctx.fillStyle = excessGrad;
    ctx.beginPath();
    ctx.arc(230, 164, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // [Component Q3: MOSFET SOT-23] at (380, 210)
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '8px sans-serif';
    ctx.fillText('MOSFET Q3 (SOT-23)', 360, 198);

    // SOT-23 copper pads on PCB (stationary)
    const padPositions = [
      [372, 206, 6, 8], // Pad 1 (Gate)
      [372, 222, 6, 8], // Pad 2 (Source)
      [400, 214, 6, 10], // Pad 3 (Drain)
    ];
    padPositions.forEach(([px, py, pw, ph]) => {
      ctx.fillStyle = '#b87333';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#854d19';
      ctx.strokeRect(px, py, pw, ph);
    });

    // *** DEFECT sd-12: Component Misaligned / Shifted 32% diagonally ***
    ctx.save();
    ctx.translate(388, 215);
    ctx.rotate(0.22); // Skewed rotation
    // Shifted SOT-23 black plastic package
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-8, -9, 16, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '7px sans-serif';
    ctx.fillText('Q3', -5, 3);

    // Leads extending from component (misaligned off the pads!)
    ctx.fillStyle = '#d0d7de';
    ctx.fillRect(-14, -7, 6, 4); // Lead 1 (shifted off pad)
    ctx.fillRect(-14, 3, 6, 4);  // Lead 2 (shifted off pad)
    ctx.fillRect(8, -2, 6, 5);   // Lead 3 (overhanging pad edge!)
    ctx.restore();

    // Large Bulk Electrolytic Capacitors C1, C2
    [
      [100, 160],
      [100, 240],
    ].forEach(([cx, cy], idx) => {
      ctx.fillStyle = '#3a3f47';
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6e7781';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px sans-serif';
      ctx.fillText(`C${idx + 1} 470μF`, cx - 18, cy + 3);
    });
  }

  // 6. Good Solder Joints (Over 150 normal pads across PCB)
  for (let col = 70; col < w - 50; col += 48) {
    for (let row = 60; row < h - 40; row += 52) {
      // Don't draw over the main defect zones
      if (
        (col >= 140 && col <= 210 && row >= 160 && row <= 230) ||
        (col >= 270 && col <= 310 && row >= 120 && row <= 160) ||
        (col >= 400 && col <= 440 && row >= 140 && row <= 180) ||
        (col >= 330 && col <= 370 && row >= 260 && row <= 300) ||
        (col >= 210 && col <= 250 && row >= 290 && row <= 330) ||
        (isPower && col >= 160 && col <= 240 && row >= 130 && row <= 190) ||
        (isPower && col >= 360 && col <= 410 && row >= 190 && row <= 240)
      ) {
        continue;
      }
      drawSolderPad(ctx, col, row, 6, 6, highlightLuster, false);
      if (showAllGoodPads) {
        ctx.strokeStyle = 'rgba(82, 196, 26, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(col + 3, row + 3, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // 7. Edge Connector Gold Fingers at bottom
  ctx.fillStyle = '#d4af37';
  for (let gx = 90; gx < w - 90; gx += 16) {
    ctx.fillRect(gx, h - 22, 10, 20);
    ctx.fillStyle = '#f5c518';
    ctx.fillRect(gx + 1, h - 22, 8, 4);
    ctx.fillStyle = '#d4af37';
  }

  // 8. Heatmap Overlay if enabled
  if (showHeatmap && defects.length > 0) {
    ctx.save();
    defects.forEach((d) => {
      const dx = d.x + d.w / 2;
      const dy = d.y + d.h / 2;
      const heatGrad = ctx.createRadialGradient(dx, dy, 5, dx, dy, 55);
      heatGrad.addColorStop(0, 'rgba(255, 77, 79, 0.55)');
      heatGrad.addColorStop(0.5, 'rgba(250, 173, 20, 0.3)');
      heatGrad.addColorStop(1, 'rgba(250, 173, 20, 0)');
      ctx.fillStyle = heatGrad;
      ctx.beginPath();
      ctx.arc(dx, dy, 55, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
}

// Helper to draw metallic shiny concave solder fillets
function drawSolderPad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  highlightLuster: boolean,
  isDefect: boolean
) {
  const padGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  if (isDefect) {
    padGrad.addColorStop(0, '#ffffff');
    padGrad.addColorStop(0.4, '#c8d6e5');
    padGrad.addColorStop(1, '#8395a7');
  } else {
    padGrad.addColorStop(0, highlightLuster ? '#ffffff' : '#f0f3f6');
    padGrad.addColorStop(0.35, '#d0d7de');
    padGrad.addColorStop(0.7, '#8c959f');
    padGrad.addColorStop(1, '#57606a');
  }

  ctx.fillStyle = padGrad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 1.5);
  ctx.fill();

  // Fine specular meniscus highlight
  if (highlightLuster) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(x + 1, y + 1, Math.max(1, w - 2), 1);
  }
}
