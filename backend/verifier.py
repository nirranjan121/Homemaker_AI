"""
verifier.py  —  OpenCV-based comparison between a 2D floor plan drawing
                and a top-down render of the 3D model.

Returns:
  - overall_score (0-100)
  - wall_edge_score
  - room_coverage_score
  - overlay_b64: the blended comparison image (for display)
  - diff_b64: the diff heat-map image
"""
import base64
import math
import cv2
import numpy as np


def _b64_to_cv2(b64_str: str) -> np.ndarray:
    """Decode base64 → BGR numpy array."""
    # Strip data URL prefix if present
    if ',' in b64_str:
        b64_str = b64_str.split(',', 1)[1]
    buf = base64.b64decode(b64_str)
    arr = np.frombuffer(buf, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image from base64")
    return img


def _cv2_to_b64(img: np.ndarray, ext=".png") -> str:
    """Encode BGR numpy array → base64 PNG."""
    ok, buf = cv2.imencode(ext, img)
    if not ok:
        raise ValueError("Could not encode image")
    return base64.b64encode(buf.tobytes()).decode("utf-8")


def _extract_edges(img: np.ndarray) -> np.ndarray:
    """Convert image to grayscale edges using Canny."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Normalize brightness so both images are comparable
    gray = cv2.equalizeHist(gray)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 30, 100)
    return edges


def _align_images(ref: np.ndarray, cmp: np.ndarray) -> np.ndarray:
    """Resize cmp to match ref dimensions."""
    if ref.shape[:2] == cmp.shape[:2]:
        return cmp
    h, w = ref.shape[:2]
    return cv2.resize(cmp, (w, h), interpolation=cv2.INTER_AREA)


def _edge_similarity(edges_a: np.ndarray, edges_b: np.ndarray) -> float:
    """
    Compute wall-edge similarity score (0-100).
    Uses dilation so near-misses still count.
    """
    # Dilate both edge maps so nearby lines score well
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    dilated_a = cv2.dilate(edges_a, kernel)
    dilated_b = cv2.dilate(edges_b, kernel)

    # Intersection / Union (IoU)
    inter = np.count_nonzero(np.logical_and(dilated_a > 0, dilated_b > 0))
    union = np.count_nonzero(np.logical_or(dilated_a > 0, dilated_b > 0))
    if union == 0:
        return 0.0
    iou = inter / union
    return round(min(iou * 100 * 1.4, 100), 1)   # scale since floor plan edges are sparse


def _coverage_similarity(plan_img: np.ndarray, render_img: np.ndarray) -> float:
    """
    Compare room fill areas by contour area ratio.
    """
    def filled_ratio(img):
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 30, 255, cv2.THRESH_BINARY)
        return np.count_nonzero(thresh) / (thresh.size + 1e-6)

    r1 = filled_ratio(plan_img)
    r2 = filled_ratio(render_img)
    diff = abs(r1 - r2)
    score = max(0.0, 1.0 - diff * 3) * 100
    return round(score, 1)


def _build_overlay(plan: np.ndarray, render: np.ndarray) -> np.ndarray:
    """
    Side-by-side layout: [floor plan | 3D top view | overlay blend]
    Each panel 400x400, combined 1200x400.
    """
    SIZE = 400
    plan_r   = cv2.resize(plan,   (SIZE, SIZE))
    render_r = cv2.resize(render, (SIZE, SIZE))

    # Blend: plan at 50% + render at 50%, tinted for differentiation
    plan_tinted   = plan_r.copy()
    render_tinted = render_r.copy()

    # Colour-code: walls of plan → cyan tint, render → magenta tint
    plan_tinted[:, :, 0] = (plan_r[:, :, 0].astype(np.float32) * 0.4).clip(0, 255)   # blue ch down
    plan_tinted[:, :, 1] = (plan_r[:, :, 1].astype(np.float32) * 0.9).clip(0, 255)   # green
    render_tinted[:, :, 1] = (render_r[:, :, 1].astype(np.float32) * 0.4).clip(0, 255)  # green ch down

    overlay = cv2.addWeighted(plan_tinted, 0.5, render_tinted, 0.5, 0)

    # Add thin separator lines
    sep = np.full((SIZE, 4, 3), 30, dtype=np.uint8)
    composite = np.concatenate([plan_r, sep, render_r, sep, overlay], axis=1)

    # Labels
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(composite, "Floor Plan (Input)", (10, 22), font, 0.55, (200, 200, 200), 1)
    cv2.putText(composite, "3D Top View", (SIZE + 14, 22), font, 0.55, (200, 200, 200), 1)
    cv2.putText(composite, "Overlap (Cyan=Plan, Magenta=3D)", (SIZE * 2 + 18, 22), font, 0.42, (200, 200, 200), 1)

    return composite


def _build_diff(plan: np.ndarray, render: np.ndarray) -> np.ndarray:
    """
    Per-pixel absolute difference heat-map (green = match, red = mismatch).
    """
    SIZE = 600
    plan_r   = cv2.resize(plan,   (SIZE, SIZE))
    render_r = cv2.resize(render, (SIZE, SIZE))

    plan_gray   = cv2.cvtColor(plan_r,   cv2.COLOR_BGR2GRAY).astype(np.float32)
    render_gray = cv2.cvtColor(render_r, cv2.COLOR_BGR2GRAY).astype(np.float32)

    diff = cv2.absdiff(plan_gray, render_gray)
    # Normalize to 0-255
    diff_norm = cv2.normalize(diff, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    # Apply color map: COLORMAP_RdYlGn (green=similar, red=different)
    heatmap = cv2.applyColorMap(diff_norm, cv2.COLORMAP_RdYlGn)

    # Label
    cv2.putText(heatmap, "Difference Heat Map  (Green=Match  Red=Mismatch)",
                (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    return heatmap


def compare(plan_b64: str, render_b64: str) -> dict:
    """
    Main entry point.
    plan_b64   — base64 of the original 2D floor plan image
    render_b64 — base64 of the Three.js top-down render (canvas screenshot)

    Returns dict with scores + overlay + diff images as base64 PNG strings.
    """
    plan_img   = _b64_to_cv2(plan_b64)
    render_img = _b64_to_cv2(render_b64)

    # Align sizes
    render_img = _align_images(plan_img, render_img)

    # Extract edges for wall comparison
    plan_edges   = _extract_edges(plan_img)
    render_edges = _extract_edges(render_img)

    wall_score     = _edge_similarity(plan_edges, render_edges)
    coverage_score = _coverage_similarity(plan_img, render_img)

    # Weighted overall
    overall = round(wall_score * 0.65 + coverage_score * 0.35, 1)

    # Build visuals
    overlay_img = _build_overlay(plan_img, render_img)
    diff_img    = _build_diff(plan_img, render_img)

    # Edge overlay (white on black)
    plan_edge_rgb   = cv2.cvtColor(cv2.resize(plan_edges,   (400, 400)), cv2.COLOR_GRAY2BGR)
    render_edge_rgb = cv2.cvtColor(cv2.resize(render_edges, (400, 400)), cv2.COLOR_GRAY2BGR)

    return {
        "overall_score":    overall,
        "wall_edge_score":  wall_score,
        "room_coverage_score": coverage_score,
        "overlay_b64":      _cv2_to_b64(overlay_img),
        "diff_b64":         _cv2_to_b64(diff_img),
        "plan_edges_b64":   _cv2_to_b64(plan_edge_rgb),
        "render_edges_b64": _cv2_to_b64(render_edge_rgb),
    }
