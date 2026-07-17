"""
main.py  —  FastAPI backend for Floor Plan 3D
Endpoints:
  POST /preprocess   — OpenCV pipeline → base64 image
  POST /analyze      — Groq Vision API → structured JSON
  POST /validate     — Geometry sanity checks → repaired JSON
  POST /pipeline     — All three steps in sequence
"""
import io
import json
from fastapi import FastAPI, File, UploadFile, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from preprocess import preprocess_image
import gemini_analyze
from validator import validate_and_repair
import verifier as verifier_mod
import ai_verifier

app = FastAPI(title="Floor Plan 3D API", version="1.0.0")

# Allow Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    image_b64: str
    width: int
    height: int
    mime_type: str = "image/jpeg"

class ValidateRequest(BaseModel):
    plan: dict
    image_b64: Optional[str] = None

class VerifyRequest(BaseModel):
    plan_b64: str
    render_b64: str

class AiVerifyRequest(BaseModel):
    plan_b64: str       # base64 of the 2D floor plan image
    plan_json: dict     # the JSON plan data

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/preprocess")
async def preprocess_endpoint(file: UploadFile = File(...)):
    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        result = preprocess_image(content)
        return JSONResponse(content=result)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preprocessing failed: {str(e)}")

@app.post("/analyze")
async def analyze_endpoint(req: AnalyzeRequest):
    try:
        result = gemini_analyze.analyze_floor_plan(
            image_b64=req.image_b64,
            width_px=req.width,
            height_px=req.height,
            mime_type=req.mime_type,
        )
        return JSONResponse(content=result)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/validate")
async def validate_endpoint(req: ValidateRequest):
    try:
        repaired = validate_and_repair(req.plan, req.image_b64)
        return JSONResponse(content=repaired)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@app.post("/verify")
async def verify_endpoint(req: VerifyRequest):
    try:
        result = verifier_mod.compare(req.plan_b64, req.render_b64)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")

@app.post("/ai-verify")
async def ai_verify_endpoint(req: AiVerifyRequest):
    """
    Uses Groq Llama Vision to compare the uploaded floor plan image
    with the JSON plan geometry and return a structured accuracy report.
    """
    try:
        result = ai_verifier.ai_compare(req.plan_b64, req.plan_json)
        return JSONResponse(content=result)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI verification failed: {str(e)}")

@app.post("/pipeline")
async def full_pipeline(file: UploadFile = File(...)):
    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty file")

        preprocessed = preprocess_image(content)
        raw_plan = gemini_analyze.analyze_floor_plan(
            image_b64=preprocessed["image_b64"],
            width_px=preprocessed["width"],
            height_px=preprocessed["height"],
            mime_type=preprocessed["mime_type"],
        )
        validated_plan = validate_and_repair(raw_plan, preprocessed["image_b64"])

        return JSONResponse(content={
            "preprocessed": {
                "width":        preprocessed["width"],
                "height":       preprocessed["height"],
                "scale_factor": preprocessed["scale_factor"],
                "image_b64":    preprocessed["image_b64"],
            },
            "raw_plan":       raw_plan,
            "validated_plan": validated_plan,
        })
    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
