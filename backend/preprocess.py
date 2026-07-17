"""
preprocess.py  —  OpenCV image preprocessing pipeline
Grayscale → CLAHE → Bilateral denoise → Deskew → Resize → base64
"""
import cv2
import numpy as np
import base64
from io import BytesIO


MAX_DIM = 1600


def preprocess_image(file_bytes: bytes) -> dict:
    """
    Accepts raw image bytes.
    Returns {image_b64, width, height, scale_factor}
    """
    # Decode bytes → numpy array
    nparr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image — unsupported format")

    # 1. Grayscale + CLAHE contrast normalization
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray_eq = clahe.apply(gray)

    # 2. Bilateral filter denoise (preserves sharp wall edges)
    denoised = cv2.bilateralFilter(gray_eq, d=9, sigmaColor=75, sigmaSpace=75)

    # 3. Deskew via Hough line transform
    deskewed = _deskew(denoised)

    # 4. Resize to MAX_DIM on longest side
    h, w = deskewed.shape[:2]
    scale_factor = 1.0
    if max(h, w) > MAX_DIM:
        scale_factor = MAX_DIM / max(h, w)
        new_w = int(w * scale_factor)
        new_h = int(h * scale_factor)
        deskewed = cv2.resize(deskewed, (new_w, new_h), interpolation=cv2.INTER_AREA)
        h, w = new_h, new_w

    # Convert grayscale back to BGR for JPEG encoding
    output_bgr = cv2.cvtColor(deskewed, cv2.COLOR_GRAY2BGR)

    # Encode to JPEG base64
    success, buffer = cv2.imencode(".jpg", output_bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not success:
        raise RuntimeError("Failed to encode processed image")

    image_b64 = base64.b64encode(buffer).decode("utf-8")

    return {
        "image_b64": image_b64,
        "width": w,
        "height": h,
        "scale_factor": scale_factor,
        "mime_type": "image/jpeg",
    }


def _deskew(gray: np.ndarray) -> np.ndarray:
    """Detect dominant line angle via Hough transform and rotate to correct."""
    # Edge detection
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180,
        threshold=80,
        minLineLength=max(gray.shape) // 6,
        maxLineGap=20,
    )

    if lines is None or len(lines) == 0:
        return gray  # nothing to deskew

    angles = []
    for line in lines:
        x1, y1, x2, y2 = line.flatten()[:4]
        if x2 - x1 == 0:
            continue  # vertical — skip
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
        # Normalize to [-45, 45] — we only correct small skews
        if angle > 45:
            angle -= 90
        elif angle < -45:
            angle += 90
        angles.append(angle)

    if not angles:
        return gray

    median_angle = float(np.median(angles))

    # Only deskew if angle is meaningfully off — ignore if < 0.5°
    if abs(median_angle) < 0.5:
        return gray

    h, w = gray.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    rotated = cv2.warpAffine(
        gray, M, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return rotated


def get_hough_lines(image_b64: str) -> list:
    """
    Run Hough line detection on a base64 image.
    Returns list of {x1,y1,x2,y2,angle} dicts for cross-validation.
    """
    img_bytes = base64.b64decode(image_b64)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return []

    edges = cv2.Canny(img, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180,
        threshold=60,
        minLineLength=max(img.shape) // 8,
        maxLineGap=15,
    )
    if lines is None:
        return []

    result = []
    for line in lines:
        x1, y1, x2, y2 = line.flatten()[:4]
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1)) % 180
        result.append({"x1": int(x1), "y1": int(y1),
                        "x2": int(x2), "y2": int(y2),
                        "angle": float(angle)})
    return result
