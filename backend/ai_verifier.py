"""
ai_verifier.py  —  Groq Vision AI comparison between a 2D floor plan image
                   and the JSON plan geometry.
Returns structured accuracy report.
"""
import base64
import json
import os
import time
from dotenv import load_dotenv
from groq import Groq

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY")) if os.getenv("GROQ_API_KEY") else None


SYSTEM_PROMPT = """You are an expert architectural floor plan verification AI.
You will receive a 2D floor plan image and a JSON description of a 3D model built from it.
Your job is to compare them and return a structured JSON verification report.

Respond ONLY with a valid JSON object in this exact format:
{
  "overall_match_score": <number 0-100>,
  "wall_accuracy_score": <number 0-100>,
  "room_count_match": <boolean>,
  "door_accuracy_score": <number 0-100>,
  "issues": [
    { "severity": "high|medium|low", "description": "<what is wrong>", "location": "<where in plan>" }
  ],
  "matches": [
    { "element": "<what matched well>", "description": "<details>" }
  ],
  "summary": "<one paragraph summary of the comparison>",
  "recommendation": "<what to fix to improve accuracy>"
}
"""


def ai_compare(plan_b64: str, plan_json: dict) -> dict:
    """
    Compare a floor plan image with the JSON plan using Groq Llama Vision.
    plan_b64  — base64 encoded floor plan image (JPEG/PNG)
    plan_json — the JSON plan dict (walls, rooms, openings)
    """
    if not client:
        raise RuntimeError("GROQ_API_KEY not set in .env")

    # Summarise JSON for the prompt (don't overwhelm with all data)
    summary = {
        "wall_count": len(plan_json.get("walls", [])),
        "room_count": len(plan_json.get("rooms", [])),
        "rooms": [{"name": r["name"], "area_sq_ft": r.get("area_sq_ft"), "center": r.get("center")} 
                  for r in plan_json.get("rooms", [])],
        "opening_count": len(plan_json.get("openings", [])),
        "openings": plan_json.get("openings", []),
        "building_bounds": _get_bounds(plan_json),
    }

    prompt = f"""I am verifying a 3D architectural model against a 2D floor plan drawing.

The 3D model was built from this JSON schema:
{json.dumps(summary, indent=2)}

Please examine the attached floor plan image carefully and compare it with the JSON data above.
Check:
1. Do the number of rooms match what you see in the drawing?
2. Do the wall positions roughly correspond to the walls visible in the image?
3. Are the door positions plausible?
4. Are room sizes proportional to what's shown in the drawing?
5. Is anything missing or incorrectly placed?

Return your analysis as a JSON verification report."""

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{plan_b64}"},
                },
            ],
        },
    ]

    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model="llama-3.2-90b-vision-preview",
                messages=messages,
                temperature=0.1,
                max_tokens=1500,
                response_format={"type": "json_object"},
            )
            return json.loads(response.choices[0].message.content)
        except json.JSONDecodeError:
            if attempt < 2:
                time.sleep(1)
                continue
            raise RuntimeError("AI returned invalid JSON")
        except Exception as e:
            raise RuntimeError(f"Groq AI error: {e}")


def _get_bounds(plan_json):
    walls = plan_json.get("walls", [])
    if not walls:
        return {}
    xs = [w["x1"] for w in walls] + [w["x2"] for w in walls]
    zs = [w["z1"] for w in walls] + [w["z2"] for w in walls]
    return {
        "min_x": min(xs), "max_x": max(xs),
        "min_z": min(zs), "max_z": max(zs),
        "width_m": round(max(xs) - min(xs), 2),
        "depth_m": round(max(zs) - min(zs), 2),
    }
