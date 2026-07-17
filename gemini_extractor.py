"""
gemini_extractor.py
--------------------
Uses Google's Gemini multimodal model to pull the *semantic* information out
of a floor-plan image that pure pixel/geometry analysis (OpenCV) can't give
you: room names, room areas as printed, dimension-line text, door/window
positions, and a plain-English description of the layout.

OpenCV gives you WHERE the thick black wall pixels are.
Gemini gives you WHAT the drawing means.
Combining both is the point of this project.

Requires: pip install google-genai
Auth: set environment variable GEMINI_API_KEY (https://aistudio.google.com/apikey)
"""

import os
import json
import base64

MODEL_NAME = "gemini-2.5-flash"

EXTRACTION_PROMPT = """You are analyzing an architectural floor-plan image.
Return ONLY valid JSON (no markdown fences, no commentary) matching this schema:

{
  "rooms": [
    {"name": string, "area_sq_ft": number|null, "approx_bbox_pct": {"x": number, "y": number, "w": number, "h": number}}
  ],
  "dimensions": [
    {"label": string, "value_text": string, "approx_location_pct": {"x": number, "y": number}}
  ],
  "doors": [
    {"room": string|null, "approx_location_pct": {"x": number, "y": number}}
  ],
  "windows": [
    {"room": string|null, "approx_location_pct": {"x": number, "y": number}}
  ],
  "fixtures": [
    {"type": string, "room": string, "approx_location_pct": {"x": number, "y": number}}
  ],
  "total_area_sq_ft": number|null,
  "summary": string
}

Notes:
- approx_location_pct / approx_bbox_pct values are percentages (0-100) of image width/height,
  measured from the top-left corner, so a caller can convert them to pixel coordinates
  once it knows the image dimensions.
- If a value truly isn't present in the image, use null.
- "fixtures" means things like stove, sink, dishwasher, fridge, tub, toilet, shower.
"""


def _lazy_import_genai():
    from google import genai
    return genai


def extract_semantic_info(image_path: str, api_key: str | None = None) -> dict:
    """
    Calls Gemini with the floor-plan image and returns the parsed JSON dict
    described in EXTRACTION_PROMPT. Raises RuntimeError with a readable
    message if the API key is missing or the call fails.
    """
    api_key = api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "No Gemini API key found. Set the GEMINI_API_KEY environment variable "
            "(get one at https://aistudio.google.com/apikey)."
        )

    if api_key.startswith("gsk_"):
        import requests
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        mime_type = "image/png" if image_path.lower().endswith("png") else "image/jpeg"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "meta-llama/llama-4-scout-17b-16e-instruct",
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": EXTRACTION_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode()}"
                            }
                        }
                    ]
                }
            ]
        }
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload
        )
        if response.status_code != 200:
            raise RuntimeError(f"Groq API error ({response.status_code}): {response.text}")
        response.raise_for_status()
        res_json = response.json()
        if "choices" not in res_json or not res_json["choices"]:
            raise RuntimeError(f"Groq returned empty choices: {res_json}")
        text = res_json["choices"][0]["message"]["content"].strip()
    elif api_key.startswith("sk-or-v1-"):
        import requests
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        mime_type = "image/png" if image_path.lower().endswith("png") else "image/jpeg"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "google/gemini-2.5-flash",
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": EXTRACTION_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode()}"
                            }
                        }
                    ]
                }
            ]
        }
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        res_json = response.json()
        if "choices" not in res_json or not res_json["choices"]:
            raise RuntimeError(f"OpenRouter returned empty choices: {res_json}")
        text = res_json["choices"][0]["message"]["content"].strip()
    else:
        genai = _lazy_import_genai()
        client = genai.Client(api_key=api_key)

        with open(image_path, "rb") as f:
            image_bytes = f.read()

        mime_type = "image/png" if image_path.lower().endswith("png") else "image/jpeg"

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[
                {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(image_bytes).decode()}},
                EXTRACTION_PROMPT,
            ],
            config={"response_mime_type": "application/json"},
        )

        text = response.text.strip()
    # Defensive cleanup in case the model wraps output in ``` fences anyway.
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


if __name__ == "__main__":
    import sys

    path = sys.argv[1] if len(sys.argv) > 1 else "floorplan.png"
    info = extract_semantic_info(path)
    print(json.dumps(info, indent=2))
