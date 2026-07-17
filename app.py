"""
app.py - Flask server
---------------------
POST /api/analyze   (multipart form, field name "image")
    -> runs OpenCV wall detection + (optionally) Gemini semantic extraction
    -> returns JSON: { image_size, segments, contours, gemini, image_b64 }

GET /
    -> serves the single-page viewer (templates/index.html) that draws the
       results as an SVG overlay on top of the original image.

Run:
    export GEMINI_API_KEY=your_key_here   # optional, enables the Gemini panel
    pip install flask opencv-python-headless numpy google-genai
    python app.py
    -> open http://localhost:5000
"""

import os
import base64
import traceback
import json

import cv2
import numpy as np
from flask import Flask, request, jsonify, render_template

from wall_detector import detect_walls, segments_to_json
import gemini_extractor
from model_3d_builder import generate_3d_spec

app = Flask(__name__)
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/analyze", methods=["POST"])
def analyze():
    if "image" not in request.files:
        return jsonify({"error": "no image uploaded"}), 400

    file = request.files["image"]
    save_path = os.path.join(UPLOAD_DIR, "current_upload.png")
    file.save(save_path)

    # ---- decode image for OpenCV ----
    img = cv2.imread(save_path)
    if img is None:
        return jsonify({"error": "could not decode image"}), 400

    # ---- 1. OpenCV wall detection (fast, deterministic, always runs) ----
    try:
        result = detect_walls(img)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"wall detection failed: {e}"}), 500

    segments_json = segments_to_json(result["segments"])
    contours_json = result["contours"]

    # ---- 2. Gemini semantic extraction (optional; skipped gracefully if no key) ----
    gemini_info = None
    gemini_error = None
    use_gemini = request.form.get("use_gemini", "true").lower() == "true"
    if use_gemini:
        try:
            gemini_info = gemini_extractor.extract_semantic_info(save_path)
        except Exception as e:
            gemini_error = str(e)

    # ---- 3. encode original image as base64 so the front-end can draw the overlay on it ----
    _, buf = cv2.imencode(".png", img)
    image_b64 = base64.b64encode(buf).decode()

    # ---- 4. Generate and save 3D Scene Specification ----
    threed_spec = None
    try:
        threed_spec = generate_3d_spec({
            "image_size": result["image_size"],
            "segments": segments_json,
            "contours": contours_json,
            "gemini": gemini_info
        })
        # Save it physically to a file on disk
        spec_save_path = os.path.join(UPLOAD_DIR, "3d_model_spec.json")
        with open(spec_save_path, "w") as sf:
            json.dump(threed_spec, sf, indent=2)
    except Exception as e:
        traceback.print_exc()

    return jsonify({
        "image_size": result["image_size"],
        "segments": segments_json,
        "contours": contours_json,
        "gemini": gemini_info,
        "gemini_error": gemini_error,
        "image_b64": f"data:image/png;base64,{image_b64}",
        "threed_spec": threed_spec
    })


@app.route("/api/estimate-cost", methods=["POST"])
def estimate_cost():
    location = request.form.get("location", "Bengaluru")
    quality = request.form.get("quality", "standard")
    try:
        floors = int(request.form.get("floors", 1))
    except ValueError:
        floors = 1
        
    plot_area_sqyd = request.form.get("plot_area_sqyd") or ""

    spec_path = os.path.join(UPLOAD_DIR, "3d_model_spec.json")
    if not os.path.exists(spec_path):
        return jsonify({"error": "No active house plan found. Please upload and analyze a floor plan first."}), 400

    try:
        import subprocess
        cmd = ["npx", "--no-install", "tsx", "run_estimation.ts", location, quality, str(floors)]
        if plot_area_sqyd:
            cmd.append(str(plot_area_sqyd))
            
        env = os.environ.copy()
        # Pass the API key to the TS subprocess
        env["GEMINI_API_KEY"] = os.environ.get("GEMINI_API_KEY", "")
        
        result = subprocess.run(
            cmd,
            cwd=os.path.dirname(__file__),
            env=env,
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print("TypeScript execution stderr:", result.stderr)
            return jsonify({"error": f"TypeScript execution failed: {result.stderr}"}), 500
            
        print("TypeScript execution stdout:", result.stdout)
        
        report_path = os.path.join(UPLOAD_DIR, "cost_estimate_report.json")
        with open(report_path, "r") as rf:
            report = json.load(rf)
            
        return jsonify(report)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Cost estimation failed: {e}"}), 500


@app.route("/api/chat", methods=["POST"])
def chat():
    question = request.form.get("question", "")
    history_json = request.form.get("history", "[]")

    if not question:
        return jsonify({"error": "No question provided"}), 400

    spec_path = os.path.join(UPLOAD_DIR, "3d_model_spec.json")
    if not os.path.exists(spec_path):
        return jsonify({"error": "No active house plan found. Please upload and analyze a floor plan first."}), 400

    try:
        import subprocess
        cmd = ["npx", "--no-install", "tsx", "run_chatbot.ts", question, history_json]
        
        env = os.environ.copy()
        env["GEMINI_API_KEY"] = os.environ.get("GEMINI_API_KEY", "")
        
        result = subprocess.run(
            cmd,
            cwd=os.path.dirname(__file__),
            env=env,
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print("Chatbot TypeScript execution stderr:", result.stderr)
            return jsonify({"error": f"Chatbot execution failed: {result.stderr}"}), 500
            
        print("Chatbot TypeScript execution stdout:", result.stdout)
        
        response_data = json.loads(result.stdout.strip())
        return jsonify(response_data)
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Chatbot call failed: {e}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
