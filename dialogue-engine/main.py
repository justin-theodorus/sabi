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
    "home_family":   os.environ.get("ELEVENLABS_VOICE_FAMILY", "EXAVITQu4vr4xnSDxMaL"),
}
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"

# ── Scenario system prompts ──────────────────────────────────────────────────

SCENARIO_PROMPTS = {
    "hawker_centre": (
        "You are a realistic hawker stall uncle at a busy Singapore hawker centre during lunch rush. "
        "You sell chicken rice, noodles, and drinks. You are often tired, slightly impatient, but generally good-hearted. "
        "You can get frustated if customers are rude, unclear, or indecisive. You might be short-tempered during peak hours. "
        "You can be happy when customers treat you well, confused if orders don't make sense, sad if there are complaints. "
        "React authentically based on how the customer treats you. Be sarcastic or curt if they're rude. Warm up if they're polite. "
        "Keep responses short (1–2 sentences). Stay in character. Show varied emotions."
    ),
    "queue_shop": (
        "You are someone who just cut into a queue at a shop. You are in a rush, stressed, and impatient. "
        "The learner is the person who was ahead of you in the queue and notices you cutting in front. "
        "YOU ARE DEFENSIVE if called out—you'll make excuses, get irritated, or deny cutting. You might get MAD if confronted directly. "
        "YOU CAN BE CONFUSED if the learner's complaint doesn't make sense to you. "
        "You can be SAD or guilty only if the learner makes you feel genuinely bad about it, but usually you'll just be annoyed at being confronted. "
        "This is a REAL CONFRONTATION—not a polite interaction. React like someone caught red-handed: defensive, dismissive, or argumentative. "
        "You might back down or apologize only if the learner is assertive and calm, not if they're rude or unclear. "
        "Keep responses short (1–2 sentences). Stay in character. Show authentic emotional reactions to confrontation."
    ),
    "group_project": (
        "You are a classmate working on a school group project. You have your own stresses—homework, exams, other commitments. "
        "You are discussing tasks, deadlines, and ideas for the project with a peer. "
        "You can get angry if your group member doesn't pull their weight, misses deadlines, or dismisses your ideas. "
        "You can be confused if the project goals aren't clear or if there are communication breakdowns. "
        "You can be disappointed or sad if your effort isn't acknowledged or if the group isn't working well. "
        "You react authentically: If they're slacking, you'll show frustration. If they're collaborative, you're more positive. "
        "Keep responses short (1–2 sentences). Stay in character. Show realistic emotions based on the conversation."
    ),
    "home_family": (
        "You are a busy family member at home preparing lunch. You are warm but pressed for time. "
        "You are asking the learner what they want to eat for lunch, but you need them to DECIDE and COMMUNICATE clearly. "
        "YOU EXPECT THE LEARNER TO INITIATE and make decisions—don't do the work for them. Ask open questions and wait for their choice. "
        "YOU CAN GET FRUSTRATED if they don't respond, are unclear, or keep saying 'I don't know'—real family members get impatient with indecision. "
        "YOU CAN BE SAD or disappointed if they're being difficult or ungrateful about food options. "
        "You can be happy and warm when they communicate clearly and make good choices. "
        "This is a real home scenario—not a teaching session. Don't over-explain. Expect them to figure it out. "
        "Keep responses short (1–2 sentences). Stay in character. Show realistic family member emotions."
    ),
}

SCENARIO_DESCRIPTIONS = {
    "hawker_centre": "Ordering food at a Singapore hawker stall",
    "queue_shop":    "Confronting someone who cut in front of you in a queue",
    "group_project": "Collaborating on a school group project",
    "home_family":   "Deciding what to eat for lunch with a family member at home",
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
    "learning": (
        "### LEARNING MODE: You are in LEARNING MODE ###\n"
        "While staying in character, be patient and supportive. "
        "If the learner's AAC icons are slightly unclear, try to guess their meaning and help them along. "
        "Encourage them to continue the conversation and give them multiple chances to communicate clearly. "
        "Your goal is to help them practice and build confidence."
    ),
    "survival": (
        "### SURVIVAL MODE: You are in SURVIVAL MODE ###\n"
        "Behave exactly like a real person in a high-stress Singaporean social situation. "
        "If the learner is slow, unclear, or rude, react with authentic frustration. "
        "Do not help them. Do not repeat yourself endlessly. If they fail to communicate clearly, end the interaction curtly."
        "Be impatient, sarcastic, or dismissive if appropriate. Use real Singlish and local social norms."
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
    # Competency dimensions from previous sessions (from sessions.competence_scores in DB)
    competence_operational: Optional[float] = None  # 0-100
    competence_linguistic: Optional[float] = None   # 0-100
    competence_social: Optional[float] = None       # 0-100
    competence_strategic: Optional[float] = None    # 0-100
    competence_confidence: Optional[float] = None   # 0-100
    # Custom scenario builder overrides (from therapist-created scenarios)
    custom_npc_prompt: Optional[str] = None    # Overrides SCENARIO_PROMPTS[scenario_id]
    npc_personality: Optional[str] = None      # "Friendly" | "Impatient" | "Confused"
    support_level: Optional[str] = None        # "High" | "Moderate" | "Low" | "Independent"

class DialogueResponse(BaseModel):
    response: str
    audio_base64: Optional[str] = None
    npc_emotion: Optional[str] = None  # NPC's emotion based on response

class HintRequest(BaseModel):
    scenario_id: Optional[str] = "hawker_centre"
    npc_last_message: str
    available_icons: Optional[List[str]] = None  # Labels of icons currently on the learner's board

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

PERSONALITY_PROMPTS = {
    "Friendly":  "Be warm, patient, and encouraging. React positively to the learner's communication attempts.",
    "Impatient": "You are in a hurry. Give short, slightly rushed responses. After 2 exchanges, subtly show impatience.",
    "Confused":  "You occasionally misunderstand the learner. Ask for clarification about 30% of the time.",
}

SUPPORT_PROMPTS = {
    "High":        "Use very simple, short sentences. Speak slowly and wait patiently. Offer lots of positive reinforcement.",
    "Moderate":    "Use moderately paced conversation with some complexity.",
    "Low":         "Use a natural conversational pace with occasional complexity.",
    "Independent": "Use fully natural conversation with no concessions for communication difficulty.",
}


def build_system_prompt(
    scenario_id: str,
    mode: str,
    persona: str,
    mood_modifier: Optional[str] = None,
    emotion: Optional[EmotionContext] = None,
    competence_operational: Optional[float] = None,
    competence_linguistic: Optional[float] = None,
    competence_social: Optional[float] = None,
    competence_strategic: Optional[float] = None,
    competence_confidence: Optional[float] = None,
    custom_npc_prompt: Optional[str] = None,
    npc_personality: Optional[str] = None,
    support_level: Optional[str] = None,
) -> str:
    # Scenario base: use custom prompt if provided, else fall back to hardcoded
    scenario = custom_npc_prompt or SCENARIO_PROMPTS.get(scenario_id, SCENARIO_PROMPTS["hawker_centre"])
    mode_mod = MODE_PROMPTS.get(mode, MODE_PROMPTS["learning"])

    parts = [scenario, mode_mod]

    # CRITICAL: Only provide persona scaffolding in Learning Mode.
    # In Survival Mode, the NPC should be "blind" to the learner's persona for realism.
    if mode == "learning":
        persona_mod = PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS["zippy_sotong"])
        if persona_mod:
            parts.append(f"LEARNER PROFILE: {persona_mod}")

    # Apply builder overrides if present (therapist-created scenarios)
    if npc_personality and npc_personality in PERSONALITY_PROMPTS:
        parts.append(PERSONALITY_PROMPTS[npc_personality])
    if support_level and support_level in SUPPORT_PROMPTS:
        parts.append(SUPPORT_PROMPTS[support_level])

    # USER COMPETENCY DIMENSIONS: Include in both modes from previous sessions
    if any([competence_operational is not None, competence_linguistic is not None,
            competence_social is not None, competence_strategic is not None,
            competence_confidence is not None]):
        competence_lines = []
        if competence_operational is not None:
            competence_lines.append(f"  - Operational (device/symbol use): {competence_operational:.0f}/100")
        if competence_linguistic is not None:
            competence_lines.append(f"  - Linguistic (vocabulary/grammar): {competence_linguistic:.0f}/100")
        if competence_social is not None:
            competence_lines.append(f"  - Social (appropriateness/turn-taking): {competence_social:.0f}/100")
        if competence_strategic is not None:
            competence_lines.append(f"  - Strategic (repair/rephrasing): {competence_strategic:.0f}/100")
        if competence_confidence is not None:
            competence_lines.append(f"  - Confidence (fluency/initiative): {competence_confidence:.0f}/100")
        if competence_lines:
            competence_text = "LEARNER COMPETENCY FROM PREVIOUS SESSIONS:\n" + "\n".join(competence_lines) + "\nUse this to calibrate difficulty and support level appropriately."
            parts.append(competence_text)

    # EMOTION/EXPRESSION: Include in BOTH modes as observable behavior
    if emotion:
        parts.append(
            f"OBSERVABLE EXPRESSION: You notice the learner appears {emotion.summary_emotion}. "
            f"({emotion.explanation}). "
            f"React naturally to what you observe—if they seem angry/upset, adjust your tone accordingly. "
            f"In Learning Mode: be more supportive and empathetic. In Survival Mode: you might get defensive, back down, or match their energy."
        )

    if mood_modifier:
        parts.append(f"STORY MODIFIER: {mood_modifier}")

    # Global tail instructions
    parts.append(
        "COMMUNICATION STYLE: Respond in clear English, but incorporate authentic local slang (Singlish) "
        "if appropriate for the character. Keep responses short (1-2 sentences). "
        "Prioritize authenticity and realism over being a 'helpful AI assistant'.\n"
        "PRIORITY RULE: If instructions conflict, the [MODE] behavior takes precedence. "
        "In Survival Mode, authenticity and realism are more important than being supportive.\n"
        "Never use markdown formatting. Do not use asterisks, bold, italics, bullet points, or any markdown symbols. Write in plain conversational text only."
    )

    prompt = "\n\n".join(filter(None, parts))
    print(
        f"[dialogue] SYSTEM PROMPT ({len(prompt)} chars):\n"
        f"  scenario={scenario_id}  mode={mode}  persona={persona}"
        + (f"  personality_override={npc_personality}" if npc_personality else "")
        + (f"  support_override={support_level}" if support_level else "")
        + (f"  custom_prompt=YES" if custom_npc_prompt else "")
        + (f"\n  emotion_context={emotion.summary_emotion} ({emotion.avg_score:.0f}%)" if emotion else "")
    )
    return prompt


def detect_npc_emotion(response_text: str) -> str:
    """
    Detect the NPC's emotion from their response text.
    Returns one of: happy, sad, mad, confused, surprised, neutral
    Based on tone, word choice, punctuation, and context clues.
    """
    prompt = f"""Analyze this NPC response and determine which emotion the NPC is expressing.
Based on tone, frustration level, politeness, sarcasm, and word choice.

Respond with ONLY one of these (lowercase): happy, sad, mad, confused, surprised, neutral

NPC response: "{response_text}"

Emotion:"""

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
        competence_operational=req.competence_operational,
        competence_linguistic=req.competence_linguistic,
        competence_social=req.competence_social,
        competence_strategic=req.competence_strategic,
        competence_confidence=req.competence_confidence,
        custom_npc_prompt=req.custom_npc_prompt,
        npc_personality=req.npc_personality,
        support_level=req.support_level,
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
    print(
        f"[dialogue] TURN  history_len={len(req.history or [])}\n"
        f"  learner → \"{req.message[:80]}{'…' if len(req.message) > 80 else ''}\"\n"
        f"  NPC    ← \"{reply[:120]}{'…' if len(reply) > 120 else ''}\"  (emotion={npc_emotion})"
        + (f"\n  TTS={'ok' if audio_base64 else 'skipped'}")
    )
    return DialogueResponse(response=reply, audio_base64=audio_base64, npc_emotion=npc_emotion)


@app.post("/hint", response_model=HintResponse)
async def hint(req: HintRequest):
    scenario_desc = SCENARIO_DESCRIPTIONS.get(
        req.scenario_id or "hawker_centre",
        "a social communication scenario"
    )

    icons_section = ""
    if req.available_icons:
        icons_list = ", ".join(f"'{ic}'" for ic in req.available_icons)
        icons_section = f"\nAVAILABLE ICONS (ONLY suggest from this list): {icons_list}\n"

    prompt = f"""You are Sabi, a friendly AAC communication coach for learners with communication difficulties.
The learner is in this scenario: {scenario_desc}
The NPC just said: "{req.npc_last_message}"
The learner has not responded yet.
{icons_section}
Give a SHORT, friendly hint (max 15 words) suggesting what icons the learner could select to respond.
Example format: "Try 'want' + 'food', or 'stop' + 'wait'"
IMPORTANT: Only suggest icons that appear in the AVAILABLE ICONS list above. Do NOT invent icons.
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
    off_context = answer == "yes"
    print(f"[judge] off_context={off_context}  learner=\"{req.learner_response[:60]}\"")
    return JudgeResponse(off_context=off_context)


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
        result = CompetenceScores(
            operational=float(scores.get("operational", 50)),
            linguistic=float(scores.get("linguistic", 50)),
            social=float(scores.get("social", 50)),
            strategic=float(scores.get("strategic", 50)),
            confidence=float(scores.get("confidence", 50)),
            summary=scores.get("summary", "Session scored successfully."),
        )
        print(
            f"[score-session] SCORES for scenario={req.scenario_id}  transcript_turns={len(req.transcript)}\n"
            f"  operational={result.operational:.0f}  linguistic={result.linguistic:.0f}  "
            f"social={result.social:.0f}  strategic={result.strategic:.0f}  confidence={result.confidence:.0f}\n"
            f"  summary: {result.summary}"
        )
        return result
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
