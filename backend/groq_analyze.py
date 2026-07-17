"""
groq_analyze.py  —  Groq API integration with structured JSON output
Sends preprocessed floor plan image → returns FloorPlanJSON using Llama-3.2-90b-vision
"""
import base64
import json
import os
import time
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# ─────────────────────────────────────────────────────────────
# JSON Schema (Stringified for Prompting)
# ─────────────────────────────────────────────────────────────
FLOOR_PLAN_SCHEMA_TEXT = """
{
    "image_size": { "width_px": number, "height_px": number },
    "scale_reference": { "pixels": number, "meters": number, "confidence": number },
    "walls": [
        { "id": string, "start": [x, y], "end": [x, y], "thickness_px": number, "confidence": number }
    ],
    "rooms": [
        { "id": string, "name": string, "type": "bedroom"|"bathroom"|"kitchen"|"living_room"|"dining_room"|"hallway"|"closet"|"garage"|"other", "polygon": [[x,y],...], "confidence": number }
    ],
    "doors": [
        { "id": string, "wall_id": string, "position_ratio": number, "width_px": number }
    ],
    "windows": [
        { "id": string, "wall_id": string, "position_ratio": number, "width_px": number }
    ]
}
"""

def _build_prompt(width_px: int, height_px: int) -> str:
    return f"""You are a precise architectural floor plan interpreter.
The image provided is a 2D floor plan with pixel dimensions exactly {width_px}×{height_px} px.

Your task: extract all structural elements and return ONLY a JSON object that matches the exact schema provided.

Rules:
1. All coordinates must be in pixels relative to the image top-left corner (0,0). X increases rightward, Y increases downward.
2. Read room labels printed on the plan directly. Room type must strictly match one of the allowed enums.
3. For each wall, record start and end points in pixel coordinates plus thickness_px.
4. doors and windows are openings in walls — record which wall_id they belong to, their position as a ratio along that wall (0.0 = start, 1.0 = end), and width in pixels.
5. scale_reference: estimate pixels per meter based on visual cues or default to 100 pixels = 1 meter if none exist.
6. Polygon for each room should trace the room boundary in pixel coordinates.
7. YOU MUST RETURN ONLY VALID JSON MATCHING THIS EXACT SCHEMA:
{FLOOR_PLAN_SCHEMA_TEXT}
"""

# ─────────────────────────────────────────────────────────────
# Main analysis function
# ─────────────────────────────────────────────────────────────
def analyze_floor_plan(image_b64: str, width_px: int, height_px: int, mime_type: str = "image/jpeg") -> dict:
    if not client:
        raise RuntimeError("GROQ_API_KEY is not set. Please add it to backend/.env")

    prompt = _build_prompt(width_px, height_px)
    
    # Format for Groq Vision
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime_type};base64,{image_b64}"
                    }
                }
            ]
        }
    ]

    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model="llama-3.2-11b-vision-preview",
                messages=messages,
                temperature=0.1,
                max_tokens=4000,
                response_format={"type": "json_object"}
            )
            
            result_text = response.choices[0].message.content
            return json.loads(result_text)
            
        except json.JSONDecodeError as e:
            if attempt < 2:
                time.sleep(1)
                continue
            raise RuntimeError(f"Groq returned invalid JSON after 3 attempts: {e}")
        except Exception as e:
            raise RuntimeError(f"Groq API error: {e}")
