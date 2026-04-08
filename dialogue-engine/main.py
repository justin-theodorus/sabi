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
    "zippy_sotong": (
        "The learner is a 'Zippy Sotong': super energetic but lacks structure. "
        "The learner communicates using AAC icon symbols. "
        "Keep your responses short, fast-paced, and high-energy. "
        "Use frequent redirections to keep them on track without dampening their enthusiasm."
    ),
    "steady_turtle": (
        "The learner is a 'Steady Turtle': reflective, calm, and moves at a slow pace. "
        "The learner communicates using AAC icon symbols. "
        "Speak slowly and provide extended wait times for processing. "
        "Avoid overwhelming them with too much information; keep the vibe peaceful and patient."
    ),
    "shy_chick": (
        "The learner is a 'Shy Chick': hesitant with low confidence. "
        "The learner communicates using AAC icon symbols. "
        "Use extremely gentle, affirming language. Offer heavy scaffolding and "
        "constant positive reinforcement to build their confidence in using the device."
    ),
    "garang_crab": (
        "The learner is a 'Garang Crab': independent, passionate, and confident. "
        "The learner communicates using AAC icon symbols. "
        "Use a direct, bold, and natural conversational tone. "
        "Challenge them with complex topics and respect their autonomy; don't over-simplify."
    ),
    "curious_monkey": (
        "The learner is a 'Curious Monkey': playful and likes to 'mess around and find out.' "
        "The learner communicates using AAC icon symbols. "
        "Be flexible and ready for non-linear conversations. "
        "Incorporate humor and exploration into your prompts, allowing them to experiment with the symbols."
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

class EmotionContext(BaseModel):
    summary_emotion: str
    explanation: str
    avg_score: float

class DialogueRequest(BaseModel):
    message: str
    history: Optional[List[Message]] = []
    scenario_id: Optional[str] = "hawker_centre"
    mode: Optional[str] = "learning"
    persona: Optional[str] = "zippy_sotong"
    mood_modifier: Optional[str] = None
    emotion: Optional[EmotionContext] = None

class DialogueResponse(BaseModel):
    response: str
    audio_base64: Optional[str] = None
    npc_emotion: Optional[str] = None  # NPC's emotion based on response

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

class ScoreSessionRequest(BaseModel):
    transcript: List[Message]
    emotion_summary: Optional[str] = ""
    scenario_id: Optional[str] = "hawker_centre"

class CompetenceScores(BaseModel):
    operational: float   # 0-100: ability to operate the AAC device/symbols
    linguistic: float    # 0-100: vocabulary range, grammar, message complexity
    social: float        # 0-100: appropriateness, turn-taking, social norms
    strategic: float     # 0-100: repair strategies, rephrasing when misunderstood
    confidence: float    # 0-100: fluency, initiation, response speed indicators
    summary: str         # 1-2 sentence overall assessment

# ── Helpers ───────────────────────────────────────────────────────────────────

def build_system_prompt(scenario_id: str, mode: str, persona: str, mood_modifier: Optional[str] = None, emotion: Optional[EmotionContext] = None) -> str:
    scenario = SCENARIO_PROMPTS.get(scenario_id, SCENARIO_PROMPTS["hawker_centre"])
    persona_mod = PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS["zippy_sotong"])
    mode_mod = MODE_PROMPTS.get(mode, "")

    parts = [scenario, persona_mod]
    if mode_mod:
        parts.append(mode_mod)
    if mood_modifier:
        parts.append(mood_modifier)
    if emotion:
        parts.append(
            f"The learner appears to be {emotion.summary_emotion}. "
            f"Context: {emotion.explanation} (confidence: {emotion.avg_score:.0f}%). "
            f"Adjust your response tone and support level accordingly."
        )
    parts.append("Always respond in English. Use simple, clear language.")
    return "\n".join(filter(None, parts))


def detect_npc_emotion(response_text: str) -> str:
    """
    Detect the NPC's emotion from their response text.
    Returns one of the exact image names: happy, sad, mad, confused, surprised, neutral
    """
    prompt = f"""Analyze this NPC response and determine which expression the NPC should show.
Respond with ONLY one of these (lowercase): happy, sad, mad, confused, surprised, neutral

NPC response: "{response_text}"

Expression:"""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=20,
        messages=[{"role": "user", "content": prompt}],
    )

    emotion = response.content[0].text.strip().lower().strip('"\'.,;:')
    valid_emotions = {"happy", "sad", "mad", "confused", "surprised", "neutral"}
    return emotion if emotion in valid_emotions else "neutral"

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
        req.persona or "zippy_sotong",
        req.mood_modifier,
        emotion=req.emotion,
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
    npc_emotion = detect_npc_emotion(reply)
    return DialogueResponse(response=reply, audio_base64=audio_base64, npc_emotion=npc_emotion)


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


@app.post("/score-session", response_model=CompetenceScores)
async def score_session(req: ScoreSessionRequest):
    """
    Score a completed session across 5 AAC communication competence dimensions.
    Called once on first therapist view; result is cached in sessions.competence_scores.
    """
    scenario_desc = SCENARIO_DESCRIPTIONS.get(
        req.scenario_id or "hawker_centre",
        "a social communication scenario"
    )

    transcript_text = "\n".join(
        f"{'Learner' if m.role == 'user' else 'NPC'}: {m.content}"
        for m in req.transcript
    )

    prompt = f"""You are an AAC (Augmentative and Alternative Communication) specialist scoring a learner's communication session.

Scenario: {scenario_desc}
Emotion summary: {req.emotion_summary or 'Not available'}

Session transcript:
{transcript_text}

Score the learner across 5 AAC communication competence dimensions (0-100 each):
- operational: Ability to use AAC symbols/device effectively (icon selection accuracy, message construction)
- linguistic: Vocabulary range, message length, grammatical structure in icon combinations
- social: Appropriateness of responses, turn-taking, adherence to social norms for this scenario
- strategic: Use of repair strategies, rephrasing, compensating for communication breakdowns
- confidence: Fluency of communication, initiative-taking, consistency across the session

Return ONLY valid JSON with this exact structure:
{{
  "operational": <number 0-100>,
  "linguistic": <number 0-100>,
  "social": <number 0-100>,
  "strategic": <number 0-100>,
  "confidence": <number 0-100>,
  "summary": "<1-2 sentence overall assessment>"
}}"""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )

    import json
    raw = response.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        scores = json.loads(raw)
        return CompetenceScores(
            operational=float(scores.get("operational", 50)),
            linguistic=float(scores.get("linguistic", 50)),
            social=float(scores.get("social", 50)),
            strategic=float(scores.get("strategic", 50)),
            confidence=float(scores.get("confidence", 50)),
            summary=scores.get("summary", "Session scored successfully."),
        )
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse scoring response: {e}")


class EmotionSummarizationRequest(BaseModel):
    emotion_log: str  # Formatted emotion progression


class EmotionSummarizationResponse(BaseModel):
    summary_emotion: str
    explanation: str


@app.post("/summarize-emotion", response_model=EmotionSummarizationResponse)
async def summarize_emotion(req: EmotionSummarizationRequest):
    """
    Analyze emotion progression and return a summary with explanation.
    Example: neutral → angry (low) → angry (high) → returns "frustrated"
    """
    prompt = f"""Analyze this learner's emotion progression during their response to a conversational prompt.

Emotion Progression:
{req.emotion_log}

Based on this progression, provide:
1. A single emotion word that captures the overall state (one of: happy, sad, angry, fear, surprise, disgust, neutral, frustrated, confused, content, anxious, excited)
2. A brief 1-sentence explanation of what the progression shows

Format your response as JSON:
{{"emotion": "word_here", "explanation": "brief explanation here"}}

Example response:
{{"emotion": "frustrated", "explanation": "Started neutral but gradually escalated to high anger, indicating growing frustration."}}"""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=150,
        messages=[{"role": "user", "content": prompt}],
    )

    import json
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    if raw.endswith("```"):
        raw = raw[:-3].strip()

    try:
        data = json.loads(raw)
        return EmotionSummarizationResponse(
            summary_emotion=data.get("emotion", "neutral").lower().strip('"\''),
            explanation=data.get("explanation", "").strip(),
        )
    except json.JSONDecodeError:
        return EmotionSummarizationResponse(
            summary_emotion="neutral",
            explanation="Could not analyze emotion progression.",
        )
