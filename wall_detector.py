"""
wall_detector.py
-----------------
Efficient, accurate wall detection for floor-plan images using classic OpenCV
morphology (no ML model / no training data needed).

Core idea
=========
In a floor-plan drawing, walls are rendered as *thick* black strokes while
everything else that is also black/dark (text, dimension lines, arrows,
door-swing arcs, hatching) is *thin*.  That thickness difference is exactly
what morphological opening exploits:

    opening(img, kernel) = dilate(erode(img, kernel), kernel)

Eroding with a kernel a little smaller than the wall thickness wipes out
anything thinner than the kernel (thin lines/text disappear completely),
while thick wall regions merely shrink a bit. Dilating back restores the
wall regions to (approximately) their original size/shape. Net effect:
a clean binary mask containing ONLY the walls.

From that wall mask we derive two complementary representations:
  1. Contours / connected components -> good for filled wall area & masks.
  2. Skeleton (topological thinning) + Probabilistic Hough Transform on the
     skeleton -> individual straight wall *segments* (x1,y1,x2,y2), each with
     a measured thickness (via the distance transform) and length in pixels.

This gives structured, per-segment geometry that's easy to overlay on the
original image and easy to serialize as JSON for a web front-end.
"""

from dataclasses import dataclass, asdict
import cv2
import numpy as np


@dataclass
class WallSegment:
    x1: int
    y1: int
    x2: int
    y2: int
    length_px: float
    thickness_px: float
    orientation: str  # "horizontal" | "vertical" | "diagonal"


def _classify_orientation(x1, y1, x2, y2, tol_deg=8):
    angle = abs(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
    angle = angle % 180
    if angle <= tol_deg or angle >= 180 - tol_deg:
        return "horizontal"
    if abs(angle - 90) <= tol_deg:
        return "vertical"
    return "diagonal"


def _sample_thickness(dist_transform, x1, y1, x2, y2, n=7):
    """Average the distance-transform value along the segment for a
    robust thickness estimate (thickness = 2 * distance-to-nearest-edge)."""
    xs = np.linspace(x1, x2, n).astype(int)
    ys = np.linspace(y1, y2, n).astype(int)
    h, w = dist_transform.shape
    xs = np.clip(xs, 0, w - 1)
    ys = np.clip(ys, 0, h - 1)
    vals = dist_transform[ys, xs]
    vals = vals[vals > 0]
    if len(vals) == 0:
        return 0.0
    return float(np.median(vals) * 2)


def detect_walls(
    image_bgr: np.ndarray,
    dark_thresh: int = 128,
    kernel_size: int = 9,
    min_wall_area: int = 150,
    hough_threshold: int = 20,
    hough_min_len: int = 20,
    hough_max_gap: int = 8,
):
    """
    Detect walls in a floor-plan image.

    Returns a dict with:
      - wall_mask: binary mask (uint8, 0/255) of ONLY the thick wall pixels
      - segments: list[WallSegment]  straight wall segments (centerline geometry)
      - contours: list[list[[x,y]]] polygon contours of merged wall blobs
      - overlay_bgr: original image with detected walls drawn on top (for debugging)
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    # 1. Binary mask of all dark pixels (walls + text + lines), inverted so
    #    foreground (dark ink) = 255.
    _, binary = cv2.threshold(gray, dark_thresh, 255, cv2.THRESH_BINARY_INV)

    # 2. Morphological opening -> keeps only regions >= kernel_size thick.
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
    wall_mask = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
    # small closing to heal any gaps opening introduced at wall corners/joins
    wall_mask = cv2.morphologyEx(wall_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    # 3. Contours of the merged wall blobs (useful for area / fill overlay).
    raw_contours, _ = cv2.findContours(wall_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = [c.reshape(-1, 2).tolist() for c in raw_contours if cv2.contourArea(c) > min_wall_area]

    # 4. Distance transform (for thickness sampling) + skeleton (for centerlines).
    dist = cv2.distanceTransform(wall_mask, cv2.DIST_L2, 5)
    skeleton = cv2.ximgproc.thinning(wall_mask)

    # 5. Probabilistic Hough transform on the skeleton -> straight wall segments.
    lines = cv2.HoughLinesP(
        skeleton, 1, np.pi / 360,
        threshold=hough_threshold,
        minLineLength=hough_min_len,
        maxLineGap=hough_max_gap,
    )

    segments = []
    if lines is not None:
        for l in lines:
            x1, y1, x2, y2 = [int(v) for v in l.flatten()]
            length = float(np.hypot(x2 - x1, y2 - y1))
            thickness = _sample_thickness(dist, x1, y1, x2, y2)
            orientation = _classify_orientation(x1, y1, x2, y2)
            segments.append(WallSegment(x1, y1, x2, y2, round(length, 1), round(thickness, 1), orientation))

    # 6. Debug overlay for quick visual sanity check.
    overlay = image_bgr.copy()
    for c in raw_contours:
        if cv2.contourArea(c) > min_wall_area:
            cv2.drawContours(overlay, [c], -1, (0, 0, 255), 2)
    for s in segments:
        cv2.line(overlay, (s.x1, s.y1), (s.x2, s.y2), (255, 0, 0), 1)

    return {
        "wall_mask": wall_mask,
        "segments": segments,
        "contours": contours,
        "overlay_bgr": overlay,
        "image_size": {"width": image_bgr.shape[1], "height": image_bgr.shape[0]},
    }


def segments_to_json(segments):
    return [asdict(s) for s in segments]


if __name__ == "__main__":
    import sys
    import json

    path = sys.argv[1] if len(sys.argv) > 1 else "floorplan.png"
    img = cv2.imread(path)
    result = detect_walls(img)
    print(f"Found {len(result['segments'])} wall segments, {len(result['contours'])} wall blobs")
    cv2.imwrite("debug_overlay.png", result["overlay_bgr"])
    with open("segments.json", "w") as f:
        json.dump(segments_to_json(result["segments"]), f, indent=2)
