"""
validator.py  —  Deterministic geometry sanity checks on Gemini's JSON output.
No AI involved — pure math + OpenCV Hough cross-validation.
"""
import math
import base64
import numpy as np
import cv2
from typing import Optional

CONFIDENCE_THRESHOLD = 0.6
SNAP_ANGLE_TOLERANCE_DEG = 3.0
HOUGH_DISTANCE_TOLERANCE_PX = 15
HOUGH_ANGLE_TOLERANCE_DEG = 5.0


# ─────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────
def validate_and_repair(plan: dict, image_b64: Optional[str] = None) -> dict:
    """
    Takes raw Gemini JSON dict, returns validated + repaired version.
    Adds 'flagged': True to any element below confidence threshold.
    Adds top-level 'validation_warnings': [...] list.
    """
    warnings = []
    img_w = plan.get("image_size", {}).get("width_px", 9999)
    img_h = plan.get("image_size", {}).get("height_px", 9999)

    # ── Walls ─────────────────────────────────────────────────
    hough_lines = _get_hough_lines(image_b64) if image_b64 else []

    for wall in plan.get("walls", []):
        wall_warnings = []

        # Clamp coordinates to image bounds
        wall["start"] = _clamp_point(wall.get("start", [0, 0]), img_w, img_h)
        wall["end"]   = _clamp_point(wall.get("end",   [0, 0]), img_w, img_h)

        # Snap near-cardinal/45° angles
        snapped, snap_msg = _snap_wall_angle(wall["start"], wall["end"])
        if snap_msg:
            wall["end"] = snapped
            wall_warnings.append(snap_msg)

        # Cross-check with Hough lines
        if hough_lines:
            confidence_boost = _hough_cross_check(wall, hough_lines)
            old_conf = wall.get("confidence", 0.5)
            wall["confidence"] = min(1.0, old_conf + confidence_boost)
            if confidence_boost < 0:
                wall_warnings.append(f"Wall {wall['id']}: no matching Hough line found")

        # Thickness sanity
        if wall.get("thickness_px", 0) < 1:
            wall["thickness_px"] = 8
            wall_warnings.append(f"Wall {wall['id']}: thickness fixed to 8px")

        # Flag low-confidence
        if wall.get("confidence", 1.0) < CONFIDENCE_THRESHOLD:
            wall["flagged"] = True
            wall_warnings.append(f"Wall {wall['id']}: low confidence {wall['confidence']:.2f}")

        warnings.extend(wall_warnings)

    # ── Rooms ─────────────────────────────────────────────────
    for room in plan.get("rooms", []):
        room_warnings = []
        polygon = room.get("polygon", [])

        # Clamp polygon points
        polygon = [_clamp_point(p, img_w, img_h) for p in polygon]

        # Auto-close polygon
        if len(polygon) >= 3:
            if polygon[0] != polygon[-1]:
                polygon.append(polygon[0])
                room_warnings.append(f"Room {room['id']}: polygon auto-closed")

        # Validate room type enum
        valid_types = {"bedroom", "bathroom", "kitchen", "living_room",
                       "dining_room", "hallway", "closet", "garage", "other"}
        if room.get("type") not in valid_types:
            room["type"] = "other"
            room_warnings.append(f"Room {room['id']}: unknown type → 'other'")

        room["polygon"] = polygon

        # Flag low-confidence
        if room.get("confidence", 1.0) < CONFIDENCE_THRESHOLD:
            room["flagged"] = True
            room_warnings.append(f"Room {room['id']} ({room.get('name','?')}): low confidence")

        warnings.extend(room_warnings)

    # ── Doors & Windows ───────────────────────────────────────
    wall_ids = {w["id"] for w in plan.get("walls", [])}
    for opening in plan.get("doors", []) + plan.get("windows", []):
        if opening.get("wall_id") not in wall_ids:
            opening["flagged"] = True
            warnings.append(f"Opening {opening['id']}: references unknown wall {opening.get('wall_id')}")

        ratio = opening.get("position_ratio", 0.5)
        if not (0.0 <= ratio <= 1.0):
            opening["position_ratio"] = max(0.0, min(1.0, ratio))
            warnings.append(f"Opening {opening['id']}: position_ratio clamped to [0,1]")

    # ── Scale reference ───────────────────────────────────────
    sr = plan.get("scale_reference", {})
    if sr.get("pixels", 0) <= 0 or sr.get("meters", 0) <= 0:
        plan["scale_reference"] = {"pixels": 100, "meters": 1.0, "confidence": 0.2}
        warnings.append("scale_reference missing or invalid — defaulting to 100px = 1m")

    plan["validation_warnings"] = warnings
    return plan


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────
def _clamp_point(pt: list, w: float, h: float) -> list:
    x = max(0.0, min(float(w), float(pt[0]) if len(pt) > 0 else 0.0))
    y = max(0.0, min(float(h), float(pt[1]) if len(pt) > 1 else 0.0))
    return [x, y]


def _snap_wall_angle(start: list, end: list):
    """Snap wall to nearest 0°/45°/90°/135° if within tolerance."""
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    if dx == 0 and dy == 0:
        return end, None

    angle_deg = math.degrees(math.atan2(dy, dx))
    length = math.hypot(dx, dy)

    snap_targets = [0, 45, 90, 135, 180, -45, -90, -135, -180]
    diffs = [(abs(angle_deg - t), t) for t in snap_targets]
    min_diff, nearest = min(diffs)

    if min_diff <= SNAP_ANGLE_TOLERANCE_DEG:
        snapped_rad = math.radians(nearest)
        new_end = [
            start[0] + length * math.cos(snapped_rad),
            start[1] + length * math.sin(snapped_rad),
        ]
        msg = f"Wall snapped {min_diff:.1f}° → {nearest}°" if min_diff > 0.1 else None
        return new_end, msg

    return end, None


def _hough_cross_check(wall: dict, hough_lines: list) -> float:
    """
    Returns +0.05 if a close Hough line confirms the wall,
    -0.1 if no Hough line is anywhere near it.
    """
    wx1, wy1 = wall["start"]
    wx2, wy2 = wall["end"]
    wall_angle = math.degrees(math.atan2(wy2 - wy1, wx2 - wx1)) % 180

    def seg_midpoint(x1, y1, x2, y2):
        return ((x1 + x2) / 2, (y1 + y2) / 2)

    wmx, wmy = seg_midpoint(wx1, wy1, wx2, wy2)

    for hl in hough_lines:
        hangle = hl["angle"]
        hmx, hmy = seg_midpoint(hl["x1"], hl["y1"], hl["x2"], hl["y2"])
        dist = math.hypot(wmx - hmx, wmy - hmy)
        angle_diff = abs(wall_angle - hangle) % 180
        angle_diff = min(angle_diff, 180 - angle_diff)

        if dist < HOUGH_DISTANCE_TOLERANCE_PX and angle_diff < HOUGH_ANGLE_TOLERANCE_DEG:
            return 0.05  # confirmed

    return -0.1  # not found


def _get_hough_lines(image_b64: str) -> list:
    try:
        img_bytes = base64.b64decode(image_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return []
        edges = cv2.Canny(img, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180,
                                threshold=60,
                                minLineLength=max(img.shape) // 8,
                                maxLineGap=15)
        if lines is None:
            return []
        result = []
        for line in lines:
            x1, y1, x2, y2 = line.flatten()[:4]
            angle = math.degrees(math.atan2(y2 - y1, x2 - x1)) % 180
            result.append({"x1": int(x1), "y1": int(y1),
                            "x2": int(x2), "y2": int(y2),
                            "angle": float(angle)})
        return result
    except Exception:
        return []
