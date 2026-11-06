import asyncio
import numpy as np
import cv2
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict
from deepface import DeepFace

app = FastAPI(title="SABI Expression Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Emotion labels returned by DeepFace
EMOTIONS = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]

# Set by warmup(). A failed warmup means DeepFace never loaded, which v1 reported
# as a non-fatal log line and then served neutral fallbacks over HTTP 200.
MODEL_READY = False
WARMUP_ERROR = ""


class EmotionResult(BaseModel):
    dominant_emotion: str
    scores: Dict[str, float]


@app.on_event("startup")
async def warmup():
    """Force DeepFace model weight download at startup so the first real frame is fast."""
    global MODEL_READY, WARMUP_ERROR
    try:
        dummy = np.zeros((48, 48, 3), dtype=np.uint8)
        DeepFace.analyze(
            dummy,
            actions=["emotion"],
            enforce_detection=False,
            detector_backend="opencv",
            silent=True,
        )
        MODEL_READY = True
        print("[expression-service] DeepFace warmup complete")
    except Exception as e:
        WARMUP_ERROR = str(e)
        print(f"[expression-service] FATAL: DeepFace warmup failed: {e}")


@app.get("/health")
async def health():
    return {
        "status": "ok" if MODEL_READY else "degraded",
        "model_ready": MODEL_READY,
        "warmup_error": WARMUP_ERROR,
    }


@app.post("/analyze-frame", response_model=EmotionResult)
async def analyze_frame(file: UploadFile = File(...)):
    """
    Accept a JPEG frame, run DeepFace emotion analysis, return dominant emotion + scores.
    enforce_detection=False ensures a no-face frame returns neutral rather than raising.
    """
    if not MODEL_READY:
        raise HTTPException(
            status_code=503,
            detail=f"DeepFace unavailable: {WARMUP_ERROR or 'model not loaded'}",
        )

    try:
        contents = await file.read()
        arr = np.frombuffer(contents, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Could not decode image")

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: DeepFace.analyze(
                img,
                actions=["emotion"],
                enforce_detection=False,
                detector_backend="opencv",
                silent=True,
            ),
        )

        # DeepFace returns a list when multiple faces found; take the first
        face = result[0] if isinstance(result, list) else result
        dominant = face["dominant_emotion"]
        # Normalize scores to percentages summing to 100
        raw_scores: dict = face["emotion"]
        total = sum(raw_scores.values()) or 1.0
        scores = {k: round(v / total * 100, 2) for k, v in raw_scores.items()}

        return EmotionResult(dominant_emotion=dominant, scores=scores)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[analyze-frame] Error: {e}")
        # v1 returned neutral/100.0 over HTTP 200 here, which made every failed
        # inference indistinguishable from a real one in the load-test report.
        raise HTTPException(status_code=503, detail=f"Emotion inference failed: {e}")
