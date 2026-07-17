import os
import sys
import json
import base64
import cv2
import numpy as np

from wall_detector import detect_walls
from gemini_extractor import extract_semantic_info
from model_3d_builder import generate_3d_spec

def main():
    try:
        # 1. Read base64 image from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            print(json.dumps({"error": "No input received via stdin"}), file=sys.stderr)
            sys.exit(1)

        # Decode base64 image
        try:
            img_data = base64.b64decode(input_data)
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError("cv2.imdecode returned None")
        except Exception as e:
            print(json.dumps({"error": f"Failed to decode image: {str(e)}"}), file=sys.stderr)
            sys.exit(1)

        # Make uploads folder
        os.makedirs("uploads", exist_ok=True)
        temp_img_path = "uploads/temp_plan.png"
        cv2.imwrite(temp_img_path, img)

        h, w, _ = img.shape
        width, height = w, h

        # 2. Preprocessing & OpenCV Contour detection to extract rooms (from extract_plan.py logic)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 15, 4
        )
        kernel_size = max(5, int(min(w, h) * 0.02))
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
        dilated_walls = cv2.dilate(thresh, kernel, iterations=1)
        rooms_mask = cv2.bitwise_not(dilated_walls)
        contours, hierarchy = cv2.findContours(
            rooms_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE
        )

        detected_rooms = []
        min_room_area = (w * h) * 0.005
        max_room_area = (w * h) * 0.80

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_room_area or area > max_room_area:
                continue

            epsilon = 0.015 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True)

            if len(approx) < 3:
                continue

            points = []
            for pt in approx:
                points.append({"x": float(pt[0][0]), "y": float(pt[0][1])})

            x, y, bw, bh = cv2.boundingRect(cnt)
            if x <= 2 or y <= 2 or (x + bw) >= w - 3 or (y + bh) >= h - 3:
                continue

            detected_rooms.append({
                "raw_points": points,
                "area": area
            })

        if not detected_rooms:
            detected_rooms.append({
                "raw_points": [
                    {"x": w * 0.1, "y": h * 0.1},
                    {"x": w * 0.9, "y": h * 0.1},
                    {"x": w * 0.9, "y": h * 0.9},
                    {"x": w * 0.1, "y": h * 0.9}
                ],
                "area": w * h * 0.64
            })

        # Find global bounding box of all rooms
        all_x = [pt["x"] for r in detected_rooms for pt in r["raw_points"]]
        all_y = [pt["y"] for r in detected_rooms for pt in r["raw_points"]]
        min_x, max_x = min(all_x), max(all_x)
        min_y, max_y = min(all_y), max(all_y)
        span_x = max_x - min_x
        span_y = max_y - min_y
        if span_x == 0: span_x = 1
        if span_y == 0: span_y = 1

        target_width_m = 12.0
        scale = target_width_m / span_x

        # 3. Run CV wall segments detection for 3D builder
        cv_result = detect_walls(img)
        from wall_detector import segments_to_json
        segments = segments_to_json(cv_result["segments"])

        # 4. Run Gemini/Groq semantic extraction
        api_key = os.environ.get("GEMINI_API_KEY")
        gemini_info = None
        try:
            gemini_info = extract_semantic_info(temp_img_path, api_key)
        except Exception as e:
            print(f"Gemini extraction failed: {e}", file=sys.stderr)

        # 5. Generate 3D spec
        analysis_result = {
            "image_size": {"width": width, "height": height},
            "segments": segments,
            "gemini": gemini_info
        }
        threed_spec = generate_3d_spec(analysis_result, api_key)
        
        # Save 3D spec to uploads/3d_model_spec.json
        with open("uploads/3d_model_spec.json", "w") as sf:
            json.dump(threed_spec, sf, indent=2)

        # 6. Geometric matching in 2D space: match OpenCV rooms to LLM room classifications
        mcp_rooms = []
        mcp_room_materials = {}
        llm_rooms = gemini_info.get("rooms", []) if gemini_info else []

        for cv_idx, cv_room in enumerate(detected_rooms):
            pts = cv_room["raw_points"]
            xs = [p["x"] for p in pts]
            ys = [p["y"] for p in pts]
            cv_cx = sum(xs) / len(xs)
            cv_cy = sum(ys) / len(ys)

            best_match = None
            min_dist = float('inf')

            for r in llm_rooms:
                bbox = r.get("approx_bbox_pct", {})
                if not bbox:
                    continue
                llm_cx = (bbox.get("x", 0) + bbox.get("w", 0) / 2.0) * width / 100.0
                llm_cy = (bbox.get("y", 0) + bbox.get("h", 0) / 2.0) * height / 100.0

                dist = np.sqrt((cv_cx - llm_cx)**2 + (cv_cy - llm_cy)**2)
                if dist < min_dist:
                    min_dist = dist
                    best_match = r

            # Scale coordinates and translate min to 0
            scaled_pts = []
            for pt in pts:
                scaled_x = round((pt["x"] - min_x) * scale, 2)
                scaled_y = round((pt["y"] - min_y) * scale, 2)
                scaled_pts.append({"x": scaled_x, "y": scaled_y})

            if best_match:
                room_name = best_match["name"]
            else:
                room_names = ["Living Room", "Master Bedroom", "Kitchen", "Guest Bedroom", "Dining Room", "Bathroom", "Study", "Balcony"]
                room_name = room_names[cv_idx] if cv_idx < len(room_names) else f"Room {cv_idx + 1}"

            room_id = room_name.lower().replace(" ", "_")

            mcp_rooms.append({
                "id": room_id,
                "name": room_name,
                "polygon": scaled_pts,
                "wallHeightM": 3.0
            })

            # Check materials from the 3D spec or default
            matched_spec_room = None
            for sr in threed_spec.get("rooms", []):
                if sr.get("name", "").lower() == room_name.lower():
                    matched_spec_room = sr
                    break

            if matched_spec_room:
                floor_mat = matched_spec_room.get("floor_material", {})
                mcp_room_materials[room_id] = {
                    "wallColor": matched_spec_room.get("wall_paint_color_hex", "#f2f0ea"),
                    "wallTexture": "smooth_plaster",
                    "floorMaterial": floor_mat.get("type", "raw_concrete_floor"),
                    "floorColor": floor_mat.get("color_hex", "#9B9B93")
                }
            else:
                mcp_room_materials[room_id] = {
                    "wallColor": "#f2f0ea",
                    "wallTexture": "smooth_plaster",
                    "floorMaterial": "raw_concrete_floor",
                    "floorColor": "#9B9B93"
                }

        total_floor_area_sq_m = sum(shoelace_area_sq_m(r["polygon"]) for r in mcp_rooms)

        output = {
            "totalFloorAreaSqM": total_floor_area_sq_m,
            "rooms": mcp_rooms,
            "roomMaterials": mcp_room_materials
        }

        print(json.dumps(output))

    except Exception as e:
        print(json.dumps({"error": f"General pipeline error: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

def shoelace_area_sq_m(polygon):
    area = 0.0
    for i in range(len(polygon)):
        x1, y1 = polygon[i]["x"], polygon[i]["y"]
        x2, y2 = polygon[(i + 1) % len(polygon)]["x"], polygon[(i + 1) % len(polygon)]["y"]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0

if __name__ == "__main__":
    main()
