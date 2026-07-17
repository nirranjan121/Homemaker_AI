"""
gemini_analyze.py  —  Gemini Vision API integration with structured JSON output
Sends preprocessed floor plan image → returns FloorPlanJSON
"""
import base64
import json
import os
import time
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# ─────────────────────────────────────────────────────────────
# JSON Schema (Gemini responseSchema format)
# ─────────────────────────────────────────────────────────────
FLOOR_PLAN_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "image_size": {
            "type": "OBJECT",
            "properties": {
                "width_px":  {"type": "NUMBER"},
                "height_px": {"type": "NUMBER"},
            },
            "required": ["width_px", "height_px"],
        },
        "scale_reference": {
            "type": "OBJECT",
            "properties": {
                "pixels":     {"type": "NUMBER"},
                "meters":     {"type": "NUMBER"},
                "confidence": {"type": "NUMBER"},
            },
            "required": ["pixels", "meters", "confidence"],
        },
        "walls": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "id":           {"type": "STRING"},
                    "start":        {"type": "ARRAY", "items": {"type": "NUMBER"}},
                    "end":          {"type": "ARRAY", "items": {"type": "NUMBER"}},
                    "thickness_px": {"type": "NUMBER"},
                    "confidence":   {"type": "NUMBER"},
                },
                "required": ["id", "start", "end", "thickness_px", "confidence"],
            },
        },
        "rooms": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "id":         {"type": "STRING"},
                    "name":       {"type": "STRING"},
                    "type":       {"type": "STRING"},
                    "polygon":    {
                        "type": "ARRAY",
                        "items": {"type": "ARRAY", "items": {"type": "NUMBER"}},
                    },
                    "confidence": {"type": "NUMBER"},
                },
                "required": ["id", "name", "type", "polygon", "confidence"],
            },
        },
        "doors": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "id":             {"type": "STRING"},
                    "wall_id":        {"type": "STRING"},
                    "position_ratio": {"type": "NUMBER"},
                    "width_px":       {"type": "NUMBER"},
                },
                "required": ["id", "wall_id", "position_ratio", "width_px"],
            },
        },
        "windows": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "id":             {"type": "STRING"},
                    "wall_id":        {"type": "STRING"},
                    "position_ratio": {"type": "NUMBER"},
                    "width_px":       {"type": "NUMBER"},
                },
                "required": ["id", "wall_id", "position_ratio", "width_px"],
            },
        },
    },
    "required": ["image_size", "scale_reference", "walls", "rooms", "doors", "windows"],
}

# ─────────────────────────────────────────────────────────────
# Prompt
# ─────────────────────────────────────────────────────────────
def _build_prompt(width_px: int, height_px: int) -> str:
    return f"""You are a precise architectural floor plan interpreter.
The image provided is a 2D floor plan with pixel dimensions exactly {width_px}×{height_px} px.

Your task: extract all structural elements and return ONLY a JSON object — no prose, no markdown.

Rules:
1. All coordinates must be in pixels relative to the image top-left corner (0,0).
   X increases rightward, Y increases downward.
2. Read room labels printed on the plan directly — do NOT guess room types by shape.
   Room type must be one of: bedroom | bathroom | kitchen | living_room | dining_room | hallway | closet | garage | other
3. For each wall, record start and end points in pixel coordinates plus thickness_px.
4. doors and windows are openings in walls — record which wall_id they belong to,
   their position as a ratio along that wall (0.0 = start, 1.0 = end), and width in pixels.
5. scale_reference: THIS IS CRITICAL. You MUST perfectly calculate the physical scale of the drawing.
   - Look for printed dimensions inside rooms (e.g., "10' x 12'", "3.5m x 4m", "3000 x 4000").
   - Look for dimension lines on the exterior or interior.
   - If you see a room labeled "4.0m" wide, and it spans 200 pixels in the image, then `pixels` = 200 and `meters` = 4.0.
   - You must do this mathematical calculation to ensure the 3D model is built EXACTLY to the written dimensions.
   - If no dimensions are written anywhere, default to 100 pixels = 1 meter (confidence 0.2).
6. Assign confidence 0.0–1.0 per element. Low-quality or partially obscured elements
   should have lower confidence (< 0.6).
7. Polygon for each room should trace the room boundary in pixel coordinates (clockwise or
   counter-clockwise, 4–12 vertices). Polygons should NOT be self-intersecting.
8. Return ONLY the JSON. No explanation text.
"""


# ─────────────────────────────────────────────────────────────
# Main analysis function
# ─────────────────────────────────────────────────────────────
def analyze_floor_plan(image_b64: str, width_px: int, height_px: int,
                       mime_type: str = "image/jpeg") -> dict:
    """
    Calls Gemini Vision with the preprocessed image and returns structured JSON.
    Retries up to 3 times on parse failure.
    """
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set. Please add it to backend/.env")

    model = genai.GenerativeModel(
        model_name="gemini-3.5-flash",
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=FLOOR_PLAN_SCHEMA,
            temperature=0.1,  # low temp for deterministic structured output
        ),
    )

    prompt = _build_prompt(width_px, height_px)
    image_part = {
        "inline_data": {
            "data": image_b64,
            "mime_type": mime_type,
        }
    }

    for attempt in range(3):
        try:
            response = model.generate_content([prompt, image_part])
            result = json.loads(response.text)
            return result
        except json.JSONDecodeError as e:
            if attempt < 2:
                time.sleep(1)
                continue
            raise RuntimeError(f"Gemini returned invalid JSON after 3 attempts: {e}")
        except Exception as e:
            raise RuntimeError(f"Gemini API error: {e}")
