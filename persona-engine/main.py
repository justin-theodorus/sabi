import os
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="SABI Persona Engine", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"]

SUPABASE_HEADERS = {
    "apikey": SUPABASE_SECRET_KEY,
    "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

PERSONA_GUIDED = "guided_learner"
PERSONA_SOCIAL = "social_practice_learner"
PERSONA_INDEPENDENT = "independent_communicator"


class SessionMetrics(BaseModel):
    avg_response_latency_ms: float
    re_prompt_count: int
    avg_icons_per_message: float


class ClassifyResponse(BaseModel):
    persona: str
    reason: str


class ProfileUpdateRequest(BaseModel):
    persona: str
    avg_response_latency_ms: Optional[float] = None


def classify_persona(metrics: SessionMetrics) -> tuple[str, str]:
    latency = metrics.avg_response_latency_ms
    re_prompts = metrics.re_prompt_count
    avg_icons = metrics.avg_icons_per_message

    if latency > 20000 or re_prompts > 3 or avg_icons < 2:
        return PERSONA_GUIDED, "High latency, frequent re-prompts, or simple icon combos"

    if latency < 10000 and re_prompts <= 1 and avg_icons >= 3:
        return PERSONA_INDEPENDENT, "Fast response, minimal re-prompts, rich icon combos"

    return PERSONA_SOCIAL, "Moderate pace and engagement"


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/classify", response_model=ClassifyResponse)
async def classify(metrics: SessionMetrics):
    persona, reason = classify_persona(metrics)
    return ClassifyResponse(persona=persona, reason=reason)


@app.get("/profile/{user_id}")
async def get_profile(user_id: str):
    url = f"{SUPABASE_URL}/rest/v1/learner_profiles"
    resp = requests.get(
        url,
        headers=SUPABASE_HEADERS,
        params={"user_id": f"eq.{user_id}", "limit": "1"},
    )
    data = resp.json()
    if not data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return data[0]


@app.put("/profile/{user_id}")
async def update_profile(user_id: str, req: ProfileUpdateRequest):
    valid_personas = {PERSONA_GUIDED, PERSONA_SOCIAL, PERSONA_INDEPENDENT}
    if req.persona not in valid_personas:
        raise HTTPException(status_code=400, detail=f"Invalid persona. Must be one of: {valid_personas}")

    payload = {"user_id": user_id, "persona": req.persona}
    if req.avg_response_latency_ms is not None:
        payload["persona_confidence"] = max(0.0, min(1.0, 1.0 - (req.avg_response_latency_ms / 60000)))

    # ?on_conflict=user_id tells PostgREST which column to use for upsert resolution
    url = f"{SUPABASE_URL}/rest/v1/learner_profiles?on_conflict=user_id"
    headers = {**SUPABASE_HEADERS, "Prefer": "resolution=merge-duplicates,return=representation"}
    resp = requests.post(url, headers=headers, json=payload)

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail=f"Supabase error: {resp.text}")

    return {"ok": True, "persona": req.persona}
