import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
const FLOOR_PLAN_SCHEMA = {
    type: SchemaType.OBJECT,
    properties: {
        image_size: {
            type: SchemaType.OBJECT,
            properties: {
                width_px: { type: SchemaType.NUMBER },
                height_px: { type: SchemaType.NUMBER },
            },
            required: ["width_px", "height_px"],
        },
        scale_reference: {
            type: SchemaType.OBJECT,
            properties: {
                pixels: { type: SchemaType.NUMBER },
                meters: { type: SchemaType.NUMBER },
                confidence: { type: SchemaType.NUMBER },
            },
            required: ["pixels", "meters", "confidence"],
        },
        walls: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    id: { type: SchemaType.STRING },
                    start: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } },
                    end: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } },
                    thickness_px: { type: SchemaType.NUMBER },
                    confidence: { type: SchemaType.NUMBER },
                },
                required: ["id", "start", "end", "thickness_px", "confidence"],
            },
        },
        rooms: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    id: { type: SchemaType.STRING },
                    name: { type: SchemaType.STRING },
                    type: { type: SchemaType.STRING },
                    polygon: {
                        type: SchemaType.ARRAY,
                        items: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } },
                    },
                    confidence: { type: SchemaType.NUMBER },
                },
                required: ["id", "name", "type", "polygon", "confidence"],
            },
        },
        doors: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    id: { type: SchemaType.STRING },
                    wall_id: { type: SchemaType.STRING },
                    position_ratio: { type: SchemaType.NUMBER },
                    width_px: { type: SchemaType.NUMBER },
                },
                required: ["id", "wall_id", "position_ratio", "width_px"],
            },
        },
        windows: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    id: { type: SchemaType.STRING },
                    wall_id: { type: SchemaType.STRING },
                    position_ratio: { type: SchemaType.NUMBER },
                    width_px: { type: SchemaType.NUMBER },
                },
                required: ["id", "wall_id", "position_ratio", "width_px"],
            },
        },
    },
    required: ["image_size", "scale_reference", "walls", "rooms", "doors", "windows"],
};
function buildPrompt(width_px, height_px) {
    return `You are a precise architectural floor plan interpreter.
The image provided is a 2D floor plan with pixel dimensions exactly ${width_px}×${height_px} px.

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
   - If you see a room labeled "4.0m" wide, and it spans 200 pixels in the image, then \`pixels\` = 200 and \`meters\` = 4.0.
   - You must do this mathematical calculation to ensure the 3D model is built EXACTLY to the written dimensions.
   - If no dimensions are written anywhere, default to 100 pixels = 1 meter (confidence 0.2).
6. Assign confidence 0.0–1.0 per element. Low-quality or partially obscured elements
   should have lower confidence (< 0.6).
7. Polygon for each room should trace the room boundary in pixel coordinates (clockwise or
   counter-clockwise, 4–12 vertices). Polygons should NOT be self-intersecting.
8. Return ONLY the JSON. No explanation text.`;
}
export async function analyzeFloorPlan(image_b64, width_px, height_px, mime_type = "image/jpeg") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: FLOOR_PLAN_SCHEMA,
            temperature: 0.1,
        }
    });
    const prompt = buildPrompt(width_px, height_px);
    const imagePart = {
        inlineData: {
            data: image_b64,
            mimeType: mime_type,
        },
    };
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const result = await model.generateContent([prompt, imagePart]);
            return JSON.parse(result.response.text());
        }
        catch (error) {
            if (attempt < 2) {
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }
            throw new Error(`Gemini API error after 3 attempts: ${error}`);
        }
    }
}
//# sourceMappingURL=gemini.service.js.map