from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import anthropic
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="SABI Dialogue Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

SYSTEM_PROMPT = """You are a friendly hawker stall uncle in a Singapore hawker centre.
The person you are talking to uses AAC (Augmentative and Alternative Communication) — they communicate by selecting icon symbols.
Keep responses short (1–2 sentences). Be warm and patient. Stay in character.
Always respond in English. Use simple, clear language appropriate for someone learning to communicate."""

class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class DialogueRequest(BaseModel):
    message: str
    history: Optional[List[Message]] = []

class DialogueResponse(BaseModel):
    response: str
    audio_url: Optional[str] = None

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/dialogue", response_model=DialogueResponse)
async def dialogue(req: DialogueRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    messages = []
    for msg in (req.history or []):
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": req.message})

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=SYSTEM_PROMPT,
        messages=messages,
    )

    reply = response.content[0].text
    return DialogueResponse(response=reply, audio_url=None)
