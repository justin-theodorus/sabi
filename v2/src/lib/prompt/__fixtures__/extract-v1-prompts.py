"""Exec only the constants + build_system_prompt out of v1 main.py, no anthropic import."""
import json, sys, types
from dataclasses import dataclass

SRC = "/Users/justin/Documents/workspace/sabi/dialogue-engine/main.py"
lines = open(SRC).read().split("\n")

# 1-indexed inclusive ranges: constants block, then build_system_prompt
chunks = ["from __future__ import annotations",
          "from typing import Optional, List",
          "class BaseModel:\n    pass"]
chunks.append("\n".join(lines[135:511]))   # 136..511 constants incl FAREWELL_MARKERS
ns = {}
exec("\n".join(chunks), ns)

# build_system_prompt is at 353-484, already inside that range
assert "build_system_prompt" in ns, sorted(k for k in ns if not k.startswith("_"))

@dataclass
class Emotion:
    summary_emotion: str
    explanation: str
    avg_score: float

cases = {
  "minimal_learning": dict(args=("hawker_centre","learning","steady_turtle"), kw={}),
  "survival_no_persona": dict(args=("hawker_centre","survival","steady_turtle"), kw={}),
  "all_branches": dict(
     args=("hawker_centre","learning","steady_turtle", "rainy day"),
     kw=dict(emotion=Emotion("calm","steady",0.5),
             competence_operational=50, competence_linguistic=60, competence_social=70,
             competence_strategic=80, competence_confidence=90,
             npc_personality="Confused", support_level="Moderate",
             available_icons=["rice"], turn_index=8, npc_initiated=True,
             active_event="no more chicken")),
  "turn4": dict(args=("hawker_centre","learning","steady_turtle"), kw=dict(turn_index=4)),
  "competence_zero": dict(args=("hawker_centre","learning","steady_turtle"),
                          kw=dict(competence_operational=0)),
}
out = {k: ns["build_system_prompt"](*v["args"], **v["kw"]) for k, v in cases.items()}
json.dump(out, open("v1_prompts.json","w"), indent=0)
print("wrote", len(out), "prompts")
