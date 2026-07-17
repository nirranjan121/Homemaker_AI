"""
model_3d_builder.py
-------------------
Gathers 2D geometry outputs (OpenCV wall segments) and semantic data (rooms, fixtures, doors)
to generate a detailed 3D Scene Specification. This JSON can be directly consumed by a 3D engine
(e.g., Three.js, BabylonJS, or Blender) to reconstruct the floor plan in 3D.

Features:
- Scales coordinates from pixels and percentages into meters.
- Uses LLM (Gemini, OpenRouter, or Groq) to enrich the scene with 3D details (materials, colors, lights, camera walkthrough path).
- Provides a robust deterministic Python fallback in case the API key is unavailable or the LLM call fails.
"""

import os
import json
import base64
import traceback

SCALE_PX_TO_METERS = 0.03  # Default: 1 pixel = 3cm (e.g. 1000px = 30m)
DEFAULT_WALL_HEIGHT = 2.8   # 2.8 meters (~9 feet)

THREED_PROMPT_TEMPLATE = """You are a 3D architectural rendering and modeling expert.
We have analyzed a 2D floor plan image. We have raw wall segments (in pixels) and semantic annotations.
Your job is to generate a comprehensive, detailed 3D Scene Specification in JSON format to reconstruct this house in 3D.

Here is the source data:
- Image Dimensions: {width}x{height} pixels
- Scale: 1 pixel = {scale} meters
- Wall segments:
{walls_list}
- Rooms:
{rooms_list}
- Openings (Doors/Windows):
{openings_list}
- Fixtures:
{fixtures_list}

Translate these 2D coordinates into a 3D coordinate system (assume y=0 is floor, y goes UP for height, and x, z are floor coordinates).
Use the scale factor to convert pixel values to meters:
- x_meters = x_px * {scale}
- z_meters = y_px * {scale}

Return ONLY a valid JSON object matching this schema. You MUST include all top-level keys: "metadata", "walls", "rooms", "openings", "fixtures_furniture", "lighting", and "walkthrough_camera". Do not omit or truncate any sections. No markdown wrapping, no explanation.

{{
  "metadata": {{
    "scale_px_to_meters": {scale},
    "default_wall_height_meters": {default_wall_height},
    "coordinate_system": "y_up_x_z_floor"
  }},
  "walls": [
    {{
      "id": string,
      "x1": number, "z1": number, "x2": number, "z2": number,
      "height": number,
      "thickness": number,
      "material": {{
        "name": string,
        "color_hex": string,
        "roughness": number
      }}
    }}
  ],
  "rooms": [
    {{
      "name": string,
      "area_sq_ft": number,
      "center": {{"x": number, "z": number}},
      "floor_material": {{
        "type": "hardwood"|"tile"|"carpet"|"concrete",
        "color_hex": string,
        "texture_description": string
      }},
      "wall_paint_color_hex": string
    }}
  ],
  "openings": [
    {{
      "type": "door"|"window",
      "position": {{"x": number, "z": number}},
      "width": number,
      "height": number,
      "sill_height": number,
      "associated_wall_id": string
    }}
  ],
  "fixtures_furniture": [
    {{
      "type": string,
      "room": string,
      "position": {{"x": number, "y": number, "z": number}},
      "rotation_y_deg": number,
      "bounding_box": {{"w": number, "h": number, "d": number}}
    }}
  ],
  "lighting": [
    {{
      "type": "ambient"|"point"|"directional"|"spot",
      "position": {{"x": number, "y": number, "z": number}},
      "color_hex": string,
      "intensity": number
    }}
  ],
  "walkthrough_camera": {{
    "start_position": {{"x": number, "y": number, "z": number}},
    "target_position": {{"x": number, "y": number, "z": number}},
    "fov": number
  }}
}}
"""

def generate_3d_spec(analysis_result: dict, api_key: str | None = None) -> dict:
    """
    Main entry point to build the 3D scene specification.
    """
    api_key = api_key or os.environ.get("GEMINI_API_KEY")
    
    # 1. extract sizes and data
    img_size = analysis_result.get("image_size", {"width": 800, "height": 600})
    width = img_size.get("width", 800)
    height = img_size.get("height", 600)
    segments = analysis_result.get("segments", [])
    gemini_data = analysis_result.get("gemini")

    # If no LLM data or API key, build heuristically right away
    if not api_key:
        return build_spec_heuristically(segments, gemini_data, width, height)

    # 2. Format source details for LLM prompt
    walls_list = []
    for i, s in enumerate(segments):
        walls_list.append(f"  - Wall {i}: from ({s['x1']},{s['y1']}) to ({s['x2']},{s['y2']}), thickness={s['thickness_px']}px")
    
    rooms_list = []
    openings_list = []
    fixtures_list = []
    
    if gemini_data:
        for r in gemini_data.get("rooms", []):
            bbox = r.get("approx_bbox_pct", {})
            rooms_list.append(f"  - {r['name']}: area={r.get('area_sq_ft')} sqft, bounding box pct: x={bbox.get('x')}%, y={bbox.get('y')}%, w={bbox.get('w')}%, h={bbox.get('h')}%")
        
        for d in gemini_data.get("doors", []):
            loc = d.get("approx_location_pct", {})
            openings_list.append(f"  - Door: near room {d.get('room')}, position pct: x={loc.get('x')}%, y={loc.get('y')}%")
            
        for w in gemini_data.get("windows", []):
            loc = w.get("approx_location_pct", {})
            openings_list.append(f"  - Window: near room {w.get('room')}, position pct: x={loc.get('x')}%, y={loc.get('y')}%")

        for f in gemini_data.get("fixtures", []):
            loc = f.get("approx_location_pct", {})
            fixtures_list.append(f"  - Fixture: {f['type']} in {f['room']}, position pct: x={loc.get('x')}%, y={loc.get('y')}%")

    prompt = THREED_PROMPT_TEMPLATE.format(
        width=width,
        height=height,
        scale=SCALE_PX_TO_METERS,
        default_wall_height=DEFAULT_WALL_HEIGHT,
        walls_list="\n".join(walls_list) if walls_list else "None",
        rooms_list="\n".join(rooms_list) if rooms_list else "None",
        openings_list="\n".join(openings_list) if openings_list else "None",
        fixtures_list="\n".join(fixtures_list) if fixtures_list else "None"
    )

    # 3. Call the configured LLM API
    try:
        text = None
        if api_key.startswith("gsk_"):
            import requests
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                "response_format": {"type": "json_object"},
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 4096
            }
            res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
            res.raise_for_status()
            text = res.json()["choices"][0]["message"]["content"].strip()
            
        elif api_key.startswith("sk-or-v1-"):
            import requests
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": "google/gemini-2.5-flash",
                "response_format": {"type": "json_object"},
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 4096
            }
            res = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
            res.raise_for_status()
            text = res.json()["choices"][0]["message"]["content"].strip()
            
        else:
            from google import genai
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"}
            )
            text = response.text.strip()

        # Clean text wrap if any
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:]
        
        return json.loads(text)

    except Exception as e:
        print("Error generating 3D Scene via LLM, falling back to heuristics:")
        traceback.print_exc()
        return build_spec_heuristically(segments, gemini_data, width, height)


def build_spec_heuristically(segments: list, gemini_data: dict | None, width: int, height: int) -> dict:
    """
    Deterministic mathematical fallback to build 3D specification.
    """
    scale = SCALE_PX_TO_METERS
    
    # 1. Convert walls
    walls_3d = []
    for i, s in enumerate(segments):
        thickness_m = max(0.1, s.get("thickness_px", 20) * scale)
        walls_3d.append({
            "id": f"wall_{i}",
            "x1": round(s["x1"] * scale, 3),
            "z1": round(s["y1"] * scale, 3),
            "x2": round(s["x2"] * scale, 3),
            "z2": round(s["y2"] * scale, 3),
            "height": DEFAULT_WALL_HEIGHT,
            "thickness": round(thickness_m, 3),
            "material": {
                "name": "Drywall",
                "color_hex": "#eaeaea",
                "roughness": 0.8
            }
        })

    # 2. Convert rooms
    rooms_3d = []
    if gemini_data and gemini_data.get("rooms"):
        for i, r in enumerate(gemini_data["rooms"]):
            bbox = r.get("approx_bbox_pct", {"x": 20, "y": 20, "w": 30, "h": 30})
            # Convert percentage coordinates to meters
            cx_pct = bbox["x"] + bbox["w"] / 2
            cy_pct = bbox["y"] + bbox["h"] / 2
            cx_m = (cx_pct / 100.0) * width * scale
            cz_m = (cy_pct / 100.0) * height * scale
            
            # Simple heuristic coloring
            floor_type = "hardwood"
            color_hex = "#a05a2c"
            if "bath" in r["name"].lower():
                floor_type = "tile"
                color_hex = "#cbd5e1"
            elif "kitchen" in r["name"].lower():
                floor_type = "tile"
                color_hex = "#94a3b8"
            elif "bed" in r["name"].lower():
                floor_type = "carpet"
                color_hex = "#d8b4fe"

            rooms_3d.append({
                "name": r["name"],
                "area_sq_ft": r.get("area_sq_ft", 100),
                "center": {"x": round(cx_m, 3), "z": round(cz_m, 3)},
                "floor_material": {
                    "type": floor_type,
                    "color_hex": color_hex,
                    "texture_description": f"standard {floor_type} flooring"
                },
                "wall_paint_color_hex": "#f8fafc"
            })
    else:
        # Default single room representing whole plan
        rooms_3d.append({
            "name": "Main Floor",
            "area_sq_ft": round((width * scale * height * scale) * 10.764, 1),
            "center": {"x": round((width * scale) / 2, 3), "z": round((height * scale) / 2, 3)},
            "floor_material": {
                "type": "hardwood",
                "color_hex": "#a05a2c",
                "texture_description": "standard hardwood flooring"
            },
            "wall_paint_color_hex": "#f8fafc"
        })

    # 3. Convert openings
    openings_3d = []
    if gemini_data:
        # Doors
        for i, d in enumerate(gemini_data.get("doors", [])):
            loc = d.get("approx_location_pct", {"x": 50, "y": 50})
            x_m = (loc["x"] / 100.0) * width * scale
            z_m = (loc["y"] / 100.0) * height * scale
            openings_3d.append({
                "type": "door",
                "position": {"x": round(x_m, 3), "z": round(z_m, 3)},
                "width": 0.9,
                "height": 2.1,
                "sill_height": 0.0,
                "associated_wall_id": "wall_0"
            })
        # Windows
        for i, w in enumerate(gemini_data.get("windows", [])):
            loc = w.get("approx_location_pct", {"x": 50, "y": 50})
            x_m = (loc["x"] / 100.0) * width * scale
            z_m = (loc["y"] / 100.0) * height * scale
            openings_3d.append({
                "type": "window",
                "position": {"x": round(x_m, 3), "z": round(z_m, 3)},
                "width": 1.2,
                "height": 1.5,
                "sill_height": 0.8,
                "associated_wall_id": "wall_0"
            })

    # 4. Convert fixtures
    fixtures_3d = []
    if gemini_data and gemini_data.get("fixtures"):
        for i, f in enumerate(gemini_data["fixtures"]):
            loc = f.get("approx_location_pct", {"x": 50, "y": 50})
            x_m = (loc["x"] / 100.0) * width * scale
            z_m = (loc["y"] / 100.0) * height * scale
            
            # Default bounding box sizes in meters
            w, h, d = 0.6, 0.8, 0.6
            if "toilet" in f["type"].lower():
                w, h, d = 0.5, 0.8, 0.7
            elif "tub" in f["type"].lower() or "shower" in f["type"].lower():
                w, h, d = 1.6, 0.6, 0.8
                
            fixtures_3d.append({
                "type": f["type"],
                "room": f.get("room", "Unknown"),
                "position": {"x": round(x_m, 3), "y": round(h/2, 3), "z": round(z_m, 3)},
                "rotation_y_deg": 0.0,
                "bounding_box": {"w": w, "h": h, "d": d}
            })

    # 5. Default lighting
    lighting_3d = [
        {
            "type": "ambient",
            "position": {"x": 0.0, "y": 4.0, "z": 0.0},
            "color_hex": "#ffffff",
            "intensity": 0.4
        },
        {
            "type": "point",
            "position": {"x": round((width * scale) / 2, 3), "y": 2.5, "z": round((height * scale) / 2, 3)},
            "color_hex": "#fffaed",
            "intensity": 0.8
        }
    ]

    # 6. Default camera walkthrough path
    walkthrough = {
        "start_position": {"x": round((width * scale) / 2, 3), "y": 15.0, "z": round((height * scale) * 1.2, 3)},
        "target_position": {"x": round((width * scale) / 2, 3), "y": 0.0, "z": round((height * scale) / 2, 3)},
        "fov": 45
    }

    return {
        "metadata": {
            "scale_px_to_meters": scale,
            "default_wall_height_meters": DEFAULT_WALL_HEIGHT,
            "coordinate_system": "y_up_x_z_floor"
        },
        "walls": walls_3d,
        "rooms": rooms_3d,
        "openings": openings_3d,
        "fixtures_furniture": fixtures_3d,
        "lighting": lighting_3d,
        "walkthrough_camera": walkthrough
    }
