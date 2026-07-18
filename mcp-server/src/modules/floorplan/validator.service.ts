const CONFIDENCE_THRESHOLD = 0.6;
const SNAP_ANGLE_TOLERANCE_DEG = 3.0;

export function validateAndRepair(plan: any, image_w: number, image_h: number): any {
  const warnings: string[] = [];
  const img_w = plan.image_size?.width_px ?? image_w;
  const img_h = plan.image_size?.height_px ?? image_h;

  // -- Walls --
  if (plan.walls) {
    for (const wall of plan.walls) {
      const wall_warnings: string[] = [];

      wall.start = clampPoint(wall.start || [0, 0], img_w, img_h);
      wall.end = clampPoint(wall.end || [0, 0], img_w, img_h);

      const [snappedEnd, snapMsg] = snapWallAngle(wall.start, wall.end);
      if (snapMsg) {
        wall.end = snappedEnd;
        wall_warnings.push(snapMsg);
      }

      if ((wall.thickness_px || 0) < 1) {
        wall.thickness_px = 8;
        wall_warnings.push(`Wall ${wall.id}: thickness fixed to 8px`);
      }

      if ((wall.confidence || 1.0) < CONFIDENCE_THRESHOLD) {
        wall.flagged = true;
        wall_warnings.push(`Wall ${wall.id}: low confidence ${(wall.confidence || 0).toFixed(2)}`);
      }

      warnings.push(...wall_warnings);
    }
  }

  // -- Rooms --
  if (plan.rooms) {
    const validTypes = new Set(["bedroom", "bathroom", "kitchen", "living_room", "dining_room", "hallway", "closet", "garage", "other"]);
    for (const room of plan.rooms) {
      const room_warnings: string[] = [];
      let polygon = room.polygon || [];

      polygon = polygon.map((p: number[]) => clampPoint(p, img_w, img_h));

      if (polygon.length >= 3) {
        if (polygon[0][0] !== polygon[polygon.length - 1][0] || polygon[0][1] !== polygon[polygon.length - 1][1]) {
          polygon.push([...polygon[0]]);
          room_warnings.push(`Room ${room.id}: polygon auto-closed`);
        }
      }

      if (!validTypes.has(room.type)) {
        room.type = "other";
        room_warnings.push(`Room ${room.id}: unknown type → 'other'`);
      }

      room.polygon = polygon;

      if ((room.confidence || 1.0) < CONFIDENCE_THRESHOLD) {
        room.flagged = true;
        room_warnings.push(`Room ${room.id}: low confidence`);
      }

      warnings.push(...room_warnings);
    }
  }

  // -- Doors & Windows --
  const wallIds = new Set((plan.walls || []).map((w: any) => w.id));
  const openings = [...(plan.doors || []), ...(plan.windows || [])];
  for (const opening of openings) {
    if (!wallIds.has(opening.wall_id)) {
      opening.flagged = true;
      warnings.push(`Opening ${opening.id}: references unknown wall ${opening.wall_id}`);
    }
    const ratio = opening.position_ratio ?? 0.5;
    if (ratio < 0.0 || ratio > 1.0) {
      opening.position_ratio = Math.max(0.0, Math.min(1.0, ratio));
      warnings.push(`Opening ${opening.id}: position_ratio clamped to [0,1]`);
    }
  }

  // -- Scale reference --
  const sr = plan.scale_reference || {};
  if ((sr.pixels || 0) <= 0 || (sr.meters || 0) <= 0) {
    plan.scale_reference = { pixels: 100, meters: 1.0, confidence: 0.2 };
    warnings.push("scale_reference missing or invalid — defaulting to 100px = 1m");
  }

  plan.validation_warnings = warnings;
  return plan;
}

function clampPoint(pt: number[], w: number, h: number): number[] {
  const x = Math.max(0.0, Math.min(w, pt.length > 0 ? pt[0] : 0.0));
  const y = Math.max(0.0, Math.min(h, pt.length > 1 ? pt[1] : 0.0));
  return [x, y];
}

function snapWallAngle(start: number[], end: number[]): [number[], string | null] {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return [end, null];

  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const length = Math.hypot(dx, dy);

  const snapTargets = [0, 45, 90, 135, 180, -45, -90, -135, -180];
  let minDiff = Infinity;
  let nearest = 0;

  for (const target of snapTargets) {
    const diff = Math.abs(angleDeg - target);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = target;
    }
  }

  if (minDiff <= SNAP_ANGLE_TOLERANCE_DEG) {
    const snappedRad = (nearest * Math.PI) / 180;
    const newEnd = [
      start[0] + length * Math.cos(snappedRad),
      start[1] + length * Math.sin(snappedRad),
    ];
    const msg = minDiff > 0.1 ? `Wall snapped ${minDiff.toFixed(1)}° → ${nearest}°` : null;
    return [newEnd, msg];
  }

  return [end, null];
}
