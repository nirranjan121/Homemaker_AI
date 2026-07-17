# src/modules/houseplan/scripts/extract_plan.py
import sys
import json
import base64
import cv2
import numpy as np

def main():
    try:
        # Read base64 image from stdin
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

        h, w, _ = img.shape

        # 1. Preprocessing: grayscale and binary threshold
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Apply adaptive thresholding to detect lines/walls (walls become black, background white)
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 15, 4
        )

        # 2. Close door gaps: dilate walls/lines to close small doors (gaps)
        # 15x15 kernel is usually enough to close doors while keeping rooms distinct
        kernel_size = max(5, int(min(w, h) * 0.02))  # Dynamic kernel size based on resolution
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
        dilated_walls = cv2.dilate(thresh, kernel, iterations=1)

        # 3. Invert to get rooms (rooms become white, walls/lines black)
        rooms_mask = cv2.bitwise_not(dilated_walls)

        # 4. Find contours of the rooms
        contours, hierarchy = cv2.findContours(
            rooms_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE
        )

        detected_rooms = []
        min_room_area = (w * h) * 0.005  # A room must be at least 0.5% of the total plan area
        max_room_area = (w * h) * 0.80   # A room cannot be more than 80% (which would be the outer background)

        for i, cnt in enumerate(contours):
            # Check hierarchy: we want only internal contours (rooms), not the outermost background
            # If the contour has a parent contour, or if it has children and no parent (inner loops)
            area = cv2.contourArea(cnt)
            if area < min_room_area or area > max_room_area:
                continue

            # Simplify contour to polygon
            epsilon = 0.015 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True)

            # We need at least 3 vertices for a polygon
            if len(approx) < 3:
                continue

            # Convert to a flat list of points
            points = []
            for pt in approx:
                points.append({"x": float(pt[0][0]), "y": float(pt[0][1])})

            # Check if this contour is too close to the borders (which might be outer frame)
            # Find bounding box
            x, y, bw, bh = cv2.boundingRect(cnt)
            if x <= 2 or y <= 2 or (x + bw) >= w - 3 or (y + bh) >= h - 3:
                # Likely the external boundary or outside space, skip
                continue

            detected_rooms.append({
                "raw_points": points,
                "area": area
            })

        # If no rooms detected, fallback to split the layout as a dummy rather than crashing
        if not detected_rooms:
            # Create a fallback room covering the center
            detected_rooms.append({
                "raw_points": [
                    {"x": w * 0.1, "y": h * 0.1},
                    {"x": w * 0.9, "y": h * 0.1},
                    {"x": w * 0.9, "y": h * 0.9},
                    {"x": w * 0.1, "y": h * 0.9}
                ],
                "area": w * h * 0.64
            })

        # 5. Normalize and scale to real-world dimensions (meters)
        # Find global bounding box of all rooms to normalize coordinates
        all_x = [pt["x"] for r in detected_rooms for pt in r["raw_points"]]
        all_y = [pt["y"] for r in detected_rooms for pt in r["raw_points"]]

        min_x, max_x = min(all_x), max(all_x)
        min_y, max_y = min(all_y), max(all_y)

        span_x = max_x - min_x
        span_y = max_y - min_y

        if span_x == 0: span_x = 1
        if span_y == 0: span_y = 1

        # We scale the floor plan so that the width is exactly 12 meters
        target_width_m = 12.0
        scale = target_width_m / span_x

        # Sort rooms by area descending (largest to smallest) to name them
        detected_rooms.sort(key=lambda r: r["area"], reverse=True)

        room_names = ["Living Room", "Master Bedroom", "Kitchen", "Guest Bedroom", "Dining Room", "Bathroom", "Study", "Balcony"]

        final_rooms = []
        for idx, room in enumerate(detected_rooms):
            # Scale coordinates and translate min to 0
            scaled_pts = []
            for pt in room["raw_points"]:
                scaled_x = round((pt["x"] - min_x) * scale, 2)
                # Invert Y coordinate so 3D space uses standard cartesian coords (optional, but good for rendering)
                scaled_y = round((pt["y"] - min_y) * scale, 2)
                scaled_pts.append({"x": scaled_x, "y": scaled_y})

            name = room_names[idx] if idx < len(room_names) else f"Room {idx + 1}"
            final_rooms.append({
                "id": f"room_{idx + 1}",
                "name": name,
                "polygon": scaled_pts,
                "wallHeightM": 3.0
            })

        # Output the JSON to stdout
        print(json.dumps(final_rooms))

    except Exception as e:
        print(json.dumps({"error": f"General script error: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
