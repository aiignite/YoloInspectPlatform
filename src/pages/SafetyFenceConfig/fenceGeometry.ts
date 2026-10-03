import { Point, TriggerAnchor } from './types';

// Point in polygon using ray casting algorithm
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
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-10) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Distance from point to line segment
export function distanceToSegment(p: Point, v: Point, w: Point): number {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return Math.hypot(p.x - projX, p.y - projY);
}

// Minimum distance from point to polygon perimeter
export function distanceToPolygon(p: Point, polygon: Point[]): number {
  if (polygon.length < 2) return Infinity;
  let minDist = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const next = (i + 1) % polygon.length;
    const d = distanceToSegment(p, polygon[i], polygon[next]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// Calculate target anchor point based on bounding box and chosen anchor mode
export function getTargetAnchorPoint(
  bbox: { x: number; y: number; w: number; h: number },
  anchorMode: TriggerAnchor
): Point {
  switch (anchorMode) {
    case 'bottom_center':
      // Ground contact point (feet of human / wheels of AGV/forklift)
      return { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h };
    case 'center':
      return { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
    case 'bbox_intersect':
      return { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h * 0.75 };
    case 'hands_feet_pose':
      // Hands reach forward or down
      return { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h * 0.4 };
    default:
      return { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h };
  }
}

// Line tripwire crossing test
export function isLineCrossing(
  pOld: Point,
  pNew: Point,
  lineStart: Point,
  lineEnd: Point,
  bufferPx: number = 10
): { crossed: boolean; direction: 'inbound' | 'outbound' | 'none' } {
  // Check if current point is within buffer distance
  const dist = distanceToSegment(pNew, lineStart, lineEnd);
  if (dist > bufferPx) return { crossed: false, direction: 'none' };

  // Determine which side of line: cross product of (B-A) and (P-A)
  const crossOld =
    (lineEnd.x - lineStart.x) * (pOld.y - lineStart.y) -
    (lineEnd.y - lineStart.y) * (pOld.x - lineStart.x);
  const crossNew =
    (lineEnd.x - lineStart.x) * (pNew.y - lineStart.y) -
    (lineEnd.y - lineStart.y) * (pNew.x - lineStart.x);

  if (crossOld * crossNew < 0 || dist <= bufferPx * 0.7) {
    const dir = crossNew >= 0 ? 'inbound' : 'outbound';
    return { crossed: true, direction: dir };
  }
  return { crossed: false, direction: 'none' };
}

// Convert pixel distance to real-world physical millimeters/meters using ground homography scale
export function pxToPhysicalMm(px: number, mmPerPx: number): number {
  return px * mmPerPx;
}

export function formatPhysicalDistance(px: number, mmPerPx: number): string {
  const mm = pxToPhysicalMm(px, mmPerPx);
  if (mm >= 1000) {
    return `${(mm / 1000).toFixed(2)} m`;
  }
  return `${Math.round(mm)} mm`;
}
