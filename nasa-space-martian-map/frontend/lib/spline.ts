/**
 * Catmull-Rom to Cubic Bezier spline converter for Mars route rendering.
 * Guarantees C1 continuity through every single waypoint without sharp corners,
 * and allows slope-based color segmentation and distance flag placement.
 */

export interface Point2D {
  x: number;
  y: number;
  lat?: number;
  lon?: number;
  slope_deg?: number;
  elev_m?: number;
}

export interface SplineSegment {
  d: string;
  slope_deg: number;
  color: string;
  index: number;
  p0: Point2D;
  p1: Point2D;
}

export interface DistanceFlag {
  km: number;
  x: number;
  y: number;
}

/**
 * Converts a sequence of 2D waypoints into a continuous smooth SVG path string
 * using Catmull-Rom to Cubic Bezier conversion.
 */
export function catmullRomPath(points: Point2D[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  const n = points.length;

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return d;
}

/**
 * Builds individual smooth spline segments colored by actual slope.
 * Gentle (< cautionSlope) = Mars Red (#E5484D)
 * Steep (>= cautionSlope) = Amber (#fbbf24)
 */
export function buildSlopeSegments(
  points: Point2D[],
  cautionSlope = 12.0
): SplineSegment[] {
  if (points.length < 2) return [];
  const segments: SplineSegment[] = [];
  const n = points.length;

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    const segD = `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    const slope = p2.slope_deg ?? p1.slope_deg ?? 0;
    const color = slope >= cautionSlope ? '#fbbf24' : '#E5484D';

    segments.push({
      d: segD,
      slope_deg: slope,
      color,
      index: i,
      p0: p1,
      p1: p2,
    });
  }

  return segments;
}

/**
 * Computes exact positions along the route where cumulative distance
 * crosses 1 km, 2 km, 3 km, etc.
 */
export function calculateDistanceFlags(
  points: Point2D[],
  cumDistances: number[]
): DistanceFlag[] {
  if (!points.length || !cumDistances.length || points.length !== cumDistances.length) return [];
  const total = cumDistances[cumDistances.length - 1];
  const maxKm = Math.floor(total / 1000);
  const flags: DistanceFlag[] = [];

  for (let k = 1; k <= maxKm; k++) {
    const targetM = k * 1000;
    let idx = 1;
    while (idx < cumDistances.length && cumDistances[idx] < targetM) {
      idx++;
    }
    if (idx < cumDistances.length) {
      const prevD = cumDistances[idx - 1];
      const nextD = cumDistances[idx];
      const span = Math.max(nextD - prevD, 1e-4);
      const frac = Math.max(0, Math.min(1, (targetM - prevD) / span));

      const p0 = points[idx - 1];
      const p1 = points[idx];
      const x = p0.x + (p1.x - p0.x) * frac;
      const y = p0.y + (p1.y - p0.y) * frac;
      flags.push({ km: k, x, y });
    }
  }

  return flags;
}

