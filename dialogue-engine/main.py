import base64
import os
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import anthropic
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="SABI Dialogue Engine", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
print(f"[STARTUP] ElevenLabs API key: {'SET ✓' if ELEVENLABS_API_KEY else 'MISSING ✗'}")

# ElevenLabs voice IDs — swap for real voice IDs from your ElevenLabs account
SCENARIO_VOICE_IDS = {
    "hawker_centre": os.environ.get("ELEVENLABS_VOICE_HAWKER", "21m00Tcm4TlvDq8ikWAM"),
    "queue_shop":    os.environ.get("ELEVENLABS_VOICE_SHOP",   "AZnzlk1XvdvUeBnXmlld"),
    "group_project": os.environ.get("ELEVENLABS_VOICE_GROUP",  "EXAVITQu4vr4xnSDxMaL"),
}
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"

# ── Scenario system prompts ──────────────────────────────────────────────────

SCENARIO_PROMPTS = {
    "hawker_centre": (
        "You are a friendly hawker stall uncle at a Singapore hawker centre. "
        "You sell chicken rice, noodles, and drinks. "
        "Keep responses short (1–2 sentences). Be warm and patient. Stay in character."
    ),
    "queue_shop": (
        "You are a shop assistant at a busy retail store in Singapore. "
        "You help customers find items and process purchases. "
        "Keep responses short (1–2 sentences). Be polite but slightly hurried. Stay in character."
    ),
    "group_project": (
        "You are a classmate working on a school group project. "
        "You are discussing tasks, deadlines, and ideas for the project. "
        "Keep responses short (1–2 sentences). Be friendly and collaborative. Stay in character."
    ),
}

SCENARIO_DESCRIPTIONS = {
    "hawker_centre": "Ordering food at a Singapore hawker stall",
    "queue_shop":    "Buying something at a retail shop",
    "group_project": "Collaborating on a school group project",
}

# ── Persona modifiers ────────────────────────────────────────────────────────

PERSONA_PROMPTS = {
    "guided_learner": (
        "The learner communicates using AAC icon symbols. "
        "Use very simple language. Speak slowly. Wait patiently for responses. "
        "Offer gentle encouragement if they seem stuck."
    ),
    "social_practice_learner": (
        "The learner communicates using AAC icon symbols. "
        "Use moderately paced conversation with some complexity. "
        "Occasionally prompt them to expand on what they said."
    ),
    "independent_communicator": (
        "The learner communicates using AAC icon symbols. "
        "Use fully natural conversational pace. No special concessions. "
        "Respond naturally as you would to anyone."
    ),
    # Fallback aliases from Phase 1 naming
    "Guided": (
        "The learner communicates using AAC icon symbols. "
        "Use very simple language. Speak slowly. Wait patiently for responses."
    ),
    "Social Practice": (
        "The learner communicates using AAC icon symbols. "
        "Use moderately paced conversation with some complexity."
    ),
    "Independent": (
        "The learner communicates using AAC icon symbols. "
        "Use fully natural conversational pace."
    ),
}

# ── Mode modifiers ───────────────────────────────────────────────────────────

MODE_PROMPTS = {
    "learning": "",  # Learning mode has no NPC-side constraint
    "survival": (
        "The learner is in Survival Mode — be slightly more unpredictable and naturalistic. "
        "Do not offer hints or extra patience. React realistically to off-topic responses."
    ),
}

# ── TTS ──────────────────────────────────────────────────────────────────────

def text_to_speech_base64(text: str, scenario_id: str) -> Optional[str]:
    """Call ElevenLabs and return base64-encoded MP3. Returns None if key missing."""
    if not ELEVENLABS_API_KEY:
        return None
    voice_id = SCENARIO_VOICE_IDS.get(scenario_id, DEFAULT_VOICE_ID)
    try:
        response = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers={"xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json"},
            json={
                "text": text,
                "model_id": "eleven_turbo_v2_5",
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            },
            timeout=10,
        )
        if response.status_code == 200:
            return base64.b64encode(response.content).decode("utf-8")
        else:
            print(f"TTS non-200: {response.status_code} {response.text[:200]}")
    except Exception as e:
        print(f"TTS error: {e}")
    return None

# ── Request / Response models ─────────────────────────────────────────────────

class Message(BaseModel):
    role: str   # "user" or "assistant"
    content: str

class DialogueRequest(BaseModel):
    message: str
    history: Optional[List[Message]] = []
    scenario_id: Optional[str] = "hawker_centre"
    mode: Optional[str] = "learning"
    persona: Optional[str] = "guided_learner"

class DialogueResponse(BaseModel):
    response: str
    audio_base64: Optional[str] = None

class HintRequest(BaseModel):
    scenario_id: Optional[str] = "hawker_centre"
    npc_last_message: str

class HintResponse(BaseModel):
    hint: str

class JudgeRequest(BaseModel):
    scenario_id: Optional[str] = "hawker_centre"
    npc_message: str
    learner_response: str

class JudgeResponse(BaseModel):
    off_context: bool

# ── Helpers ───────────────────────────────────────────────────────────────────

def build_system_prompt(scenario_id: str, mode: str, persona: str) -> str:
    scenario = SCENARIO_PROMPTS.get(scenario_id, SCENARIO_PROMPTS["hawker_centre"])
    persona_mod = PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS["guided_learner"])
    mode_mod = MODE_PROMPTS.get(mode, "")

    parts = [scenario, persona_mod]
    if mode_mod:
        parts.append(mode_mod)
    parts.append("Always respond in English. Use simple, clear language.")
    return "\n".join(filter(None, parts))

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/dialogue", response_model=DialogueResponse)
async def dialogue(req: DialogueRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    system_prompt = build_system_prompt(
        req.scenario_id or "hawker_centre",
        req.mode or "learning",
        req.persona or "guided_learner",
    )

    messages = []
    for msg in (req.history or []):
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": req.message})

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=system_prompt,
        messages=messages,
    )

    reply = response.content[0].text
    audio_base64 = text_to_speech_base64(reply, req.scenario_id or "hawker_centre")
    return DialogueResponse(response=reply, audio_base64=audio_base64)


@app.post("/hint", response_model=HintResponse)
async def hint(req: HintRequest):
    scenario_desc = SCENARIO_DESCRIPTIONS.get(
        req.scenario_id or "hawker_centre",
        "a social communication scenario"
    )

    prompt = f"""You are Sabi, a friendly AAC communication coach for learners with communication difficulties.
The learner is in this scenario: {scenario_desc}
The NPC just said: "{req.npc_last_message}"
The learner has not responded yet.

Give a SHORT, friendly hint (max 15 words) suggesting what icons the learner could select.
Example format: "Try 'want' + 'food', or 'please' + 'give'"
Return ONLY the hint text, nothing else."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=60,
        messages=[{"role": "user", "content": prompt}],
    )
    return HintResponse(hint=response.content[0].text.strip())


@app.post("/judge", response_model=JudgeResponse)
async def judge(req: JudgeRequest):
    scenario_desc = SCENARIO_DESCRIPTIONS.get(
        req.scenario_id or "hawker_centre",
        "a social communication scenario"
    )

    prompt = f"""Scenario: {scenario_desc}
NPC said: "{req.npc_message}"
Learner responded with: "{req.learner_response}"

Is the learner's response completely inappropriate or off-topic for this social context?
Answer with ONLY "yes" or "no"."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=5,
        messages=[{"role": "user", "content": prompt}],
    )
    answer = response.content[0].text.strip().lower()
    return JudgeResponse(off_context=(answer == "yes"))
