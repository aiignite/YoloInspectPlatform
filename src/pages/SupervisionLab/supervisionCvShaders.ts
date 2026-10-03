import { Point } from './types';

// Point in polygon (Ray casting algorithm)
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Line crossing detection between two consecutive trajectory points and a trigger line
export function checkLineCrossing(
  pOld: Point,
  pNew: Point,
  lineStart: Point,
  lineEnd: Point
): { crossed: boolean; direction: 'in' | 'out' | null } {
  const ccw = (A: Point, B: Point, C: Point) => {
    return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  };

  const intersect = (A: Point, B: Point, C: Point, D: Point) => {
    return ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);
  };

  const isCrossed = intersect(pOld, pNew, lineStart, lineEnd);
  if (!isCrossed) {
    return { crossed: false, direction: null };
  }

  // Determine direction using 2D cross product with line normal
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  // Vector of object motion
  const mx = pNew.x - pOld.x;
  const my = pNew.y - pOld.y;

  // Cross product
  const cross = dx * my - dy * mx;
  return {
    crossed: true,
    direction: cross > 0 ? 'in' : 'out',
  };
}

// Computer Vision Filter implementations for Canvas 2D
export function applyCvFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  filter: 'normal' | 'grayscale' | 'canny' | 'clahe' | 'thermal'
) {
  if (filter === 'normal') return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const len = data.length;

  if (filter === 'grayscale') {
    for (let i = 0; i < len; i += 4) {
      const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = avg;
      data[i + 1] = avg;
      data[i + 2] = avg;
    }
  } else if (filter === 'clahe') {
    // High-contrast industrial local contrast enhancement (CLAHE simulation)
    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // S-curve contrast boost for metallic reflection highlights
      r = Math.min(255, Math.max(0, 128 + 1.45 * (r - 128)));
      g = Math.min(255, Math.max(0, 128 + 1.45 * (g - 128)));
      b = Math.min(255, Math.max(0, 128 + 1.45 * (b - 128)));

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  } else if (filter === 'thermal') {
    // Pseudo-color infrared thermal mapping (Ironbow palette)
    for (let i = 0; i < len; i += 4) {
      const lum = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      const t = lum / 255;

      // Ironbow colormap approximation
      let tr = 0, tg = 0, tb = 0;
      if (t < 0.25) {
        tr = 0;
        tg = Math.round(t * 4 * 128);
        tb = Math.round(128 + t * 4 * 127);
      } else if (t < 0.5) {
        tr = Math.round((t - 0.25) * 4 * 220);
        tg = Math.round(128 + (t - 0.25) * 4 * 100);
        tb = Math.round(255 * (1 - (t - 0.25) * 4));
      } else if (t < 0.75) {
        tr = 255;
        tg = Math.round(228 * (1 - (t - 0.5) * 4 * 0.5));
        tb = 0;
      } else {
        tr = 255;
        tg = Math.round(114 + (t - 0.75) * 4 * 141);
        tb = Math.round((t - 0.75) * 4 * 255);
      }

      data[i] = tr;
      data[i + 1] = tg;
      data[i + 2] = tb;
    }
  } else if (filter === 'canny') {
    // Sobel/Canny gradient edge detection
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0, j = 0; i < len; i += 4, j++) {
      gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    const output = new Uint8ClampedArray(len);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        // 3x3 Sobel kernels
        const gx =
          -gray[idx - width - 1] +
          gray[idx - width + 1] -
          2 * gray[idx - 1] +
          2 * gray[idx + 1] -
          gray[idx + width - 1] +
          gray[idx + width + 1];

        const gy =
          -gray[idx - width - 1] -
          2 * gray[idx - width] -
          gray[idx - width + 1] +
          gray[idx + width - 1] +
          2 * gray[idx + width] +
          gray[idx + width + 1];

        const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy) * 1.8);
        const pIdx = (y * width + x) * 4;

        if (mag > 60) {
          output[pIdx] = 30; // Neon teal/cyan industrial edge line
          output[pIdx + 1] = 240;
          output[pIdx + 2] = 220;
          output[pIdx + 3] = 255;
        } else {
          output[pIdx] = 16;
          output[pIdx + 1] = 20;
          output[pIdx + 2] = 28;
          output[pIdx + 3] = 255;
        }
      }
    }
    imageData.data.set(output);
  }

  ctx.putImageData(imageData, 0, 0);
}

// Draw sub-pixel optical magnifier loupe at cursor point
export function drawInspectionLoupe(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  cursor: Point,
  zoom: number = 3.5,
  radius: number = 70
) {
  const { x, y } = cursor;
  if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) return;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();

  // Draw magnified portion of canvas
  const srcW = (radius * 2) / zoom;
  const srcH = (radius * 2) / zoom;
  const srcX = Math.max(0, Math.min(canvas.width - srcW, x - srcW / 2));
  const srcY = Math.max(0, Math.min(canvas.height - srcH, y - srcH / 2));

  ctx.drawImage(canvas, srcX, srcY, srcW, srcH, x - radius, y - radius, radius * 2, radius * 2);

  // Optical reticle grid & crosshair inside loupe
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - radius, y);
  ctx.lineTo(x + radius, y);
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x, y + radius);
  ctx.stroke();

  // Sub-pixel concentric circles
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.arc(x, y, 35, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // Lens brass rim & glass reflection
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#00f2fe';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(0, 242, 254, 0.8)';
  ctx.shadowBlur = 8;
  ctx.stroke();

  // Badge label
  ctx.fillStyle = 'rgba(10, 18, 30, 0.9)';
  ctx.fillRect(x - 36, y + radius - 20, 72, 18);
  ctx.strokeStyle = '#00f2fe';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 36, y + radius - 20, 72, 18);
  ctx.fillStyle = '#00f2fe';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`LOUPE ${zoom}X`, x, y + radius - 7);
  ctx.restore();
}
