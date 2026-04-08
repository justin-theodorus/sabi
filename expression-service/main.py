import io
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


class EmotionResult(BaseModel):
    dominant_emotion: str
    scores: Dict[str, float]


@app.on_event("startup")
async def warmup():
    """Force DeepFace model weight download at startup so the first real frame is fast."""
    try:
        dummy = np.zeros((48, 48, 3), dtype=np.uint8)
        DeepFace.analyze(
            dummy,
            actions=["emotion"],
            enforce_detection=False,
            detector_backend="opencv",
            silent=True,
        )
        print("[expression-service] DeepFace warmup complete ✓")
    except Exception as e:
        print(f"[expression-service] Warmup error (non-fatal): {e}")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze-frame", response_model=EmotionResult)
async def analyze_frame(file: UploadFile = File(...)):
    """
    Accept a JPEG frame, run DeepFace emotion analysis, return dominant emotion + scores.
    enforce_detection=False ensures a no-face frame returns neutral rather than raising.
    """
    try:
        contents = await file.read()
        arr = np.frombuffer(contents, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Could not decode image")

        result = DeepFace.analyze(
            img,
            actions=["emotion"],
            enforce_detection=False,
            detector_backend="opencv",
            silent=True,
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
        # Return neutral on any unexpected error — never crash the learner session
        return EmotionResult(
            dominant_emotion="neutral",
            scores={e: (100.0 if e == "neutral" else 0.0) for e in EMOTIONS},
        )
