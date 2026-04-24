# SABI — AI-Powered AAC Communication Training Platform

SABI is an AI-driven communication training platform for individuals with communication difficulties (AAC users, children with autism, speech-language delays). Learners practice social scenarios by selecting pictogram icons; a large language model generates dynamic, persona-adaptive NPC dialogue in real time. Therapists review session recordings, emotion timelines, and communication competence scores.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Services](#services)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [User Roles & Flows](#user-roles--flows)
- [Key Features](#key-features)
- [Figma Design Reference](#figma-design-reference)
- [Development Guide](#development-guide)
- [Phased Build Plan](#phased-build-plan)

---

## Overview

### Problem

Individuals using Augmentative and Alternative Communication (AAC) devices lack access to realistic, adaptive training environments. Existing tools rely on fixed scripts and pre-defined dialogue flows — they don't reflect the unpredictable nature of real social interactions.

### Solution

SABI simulates realistic social scenarios with an LLM-powered NPC that responds dynamically to the learner's icon selections. A rules-based persona engine classifies each learner's communication style and injects persona modifiers into every LLM prompt, making dialogue adaptive and personalised.

### Target Users

| Role | Description |
|---|---|
| **Learner** | Individuals with communication difficulties practising social scenarios |
| **Therapist / Caregiver** | Speech-language therapists who assign scenarios, monitor progress, and review session reports |

---

## Architecture

Microservices orchestrated via Docker Compose. Auth and database are hosted on Supabase (no local Postgres or auth containers). All client traffic routes through a Kong API Gateway.

```
┌─────────────────────────────────────────────────────────┐
│                        Frontend                         │
│                  Next.js PWA  :3000                     │
└───────────────────────┬─────────────────────────────────┘
                        │
                   Kong Gateway :8000
                        │
        ┌───────────────┼───────────────────────┐
        │               │               │       │
  dialogue-queue   session-service  persona-  aac-icon-
     :8006           :8004         engine     service
        │                            :8002      :8005
  dialogue-engine
     :8001 (internal)
        │
   expression-service
        :8003
        │
┌───────┴───────┐
│     Redis     │   MinIO (S3)
│    :6379      │   :9000 / :9001
└───────────────┘
        │
   Supabase (hosted)
   PostgreSQL + Auth
```

---

## Services

| Service | Tech | Port | Responsibility |
|---|---|---|---|
| `frontend` | Next.js PWA | 3000 | Learner scenario UI, AAC board, therapist dashboard |
| `kong` | Kong Gateway 3.6 | 8000 | Single API entry point for all client traffic |
| `dialogue-engine` | Python / FastAPI | 8001 (internal) | Claude API orchestration, ElevenLabs TTS |
| `dialogue-queue-api` | Node.js | 8006 | Queues Claude calls; returns `request_id` for polling |
| `dialogue-queue-worker` | Node.js | — | Consumes queue, calls dialogue-engine concurrently |
| `persona-engine` | Python / FastAPI | 8002 | Rules-based learner persona classification |
| `expression-service` | Python / FastAPI | 8003 | DeepFace emotion detection from webcam JPEG frames |
| `session-service` | Node.js / Express | 8004 | Session event logging, MinIO video upload |
| `aac-icon-service` | Node.js / Express | 8005 | Icon-to-natural-language translation before LLM call |
| `redis` | Redis 7 | 6379 | Real-time session state shared across services |
| `minio` | MinIO | 9000/9001 | Local S3-compatible storage for session WebM videos |

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for running scripts outside Docker)
- A `.env` file at the project root (see [Environment Variables](#environment-variables))

### 1. Clone and configure

```bash
git clone <repo-url> sabi
cd sabi
cp .env.example .env   # fill in your secrets
```

### 2. Pre-fetch AAC icons (run once)

Icons are fetched from ARASAAC at build time and stored locally. They are **never** loaded at runtime.

```bash
node scripts/fetch-icons.js
```

Icons are written to `frontend/public/icons/`.

### 3. Start all services

```bash
docker-compose up --build
```

| URL | Service |
|---|---|
| http://localhost:3000 | Frontend (learner & therapist UI) |
| http://localhost:8000 | Kong API Gateway |
| http://localhost:9001 | MinIO Console (minioadmin / minioadmin) |

### 4. Start a specific service

```bash
docker-compose up frontend dialogue-engine
```

---

## Environment Variables

Create a `.env` file at the project root:

```env
# Claude API — dialogue-engine
ANTHROPIC_API_KEY=

# ElevenLabs TTS — dialogue-engine
ELEVENLABS_API_KEY=

# Supabase — all services
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=   # safe to expose via NEXT_PUBLIC_*
SUPABASE_SECRET_KEY=        # backend only — never expose to frontend
```

MinIO credentials for local dev: `minioadmin` / `minioadmin` (hardcoded in `docker-compose.yml`).

---

## User Roles & Flows

### Learner Flow

```
1. Open PWA on iPad / browser → log in
2. First session only: 3–5 min preliminary phase
   └─ Persona Engine classifies communication style
3. Load assigned scenario (background + NPC introduction)
4. NPC asks opening question
5. Learner taps icons on AAC grid → submits combination
6. aac-icon-service translates icons to natural language
7. dialogue-queue-api enqueues Claude call → worker calls dialogue-engine
8. dialogue-engine constructs prompt (scenario + persona + history) → Claude API
9. NPC response rendered on screen (+ optional ElevenLabs TTS)
10. Repeat until scenario wrap-up → session logged
```

### Therapist Flow

```
1. Log in with therapist credentials
2. View list of assigned learners
3. Review past session transcripts, icon selections, emotion timeline
4. View learner's persona classification and competence radar chart
5. Assign a scenario for the learner's next session
6. Watch session replay with emotion emoji overlay synced to video
```

---

## Key Features

### AAC Icon Grid

- Categories: Core Words (white), Social (green), Emotions (pink/red), Actions (orange), People (blue), Descriptors (yellow)
- Icons are filtered per scenario — not all icons shown in all contexts
- Selected icons accumulate in a message bar before submission

### Persona Engine (Rules-Based)

Classifies learners into one of three types based on response latency, re-prompt count, and icon combo complexity:

| Persona | Description |
|---|---|
| **Guided Learner** | Slow responses, frequent re-prompts, simple icon combos |
| **Social Practice Learner** | Average speed, varied icon usage |
| **Independent Communicator** | Fast, complex combos, minimal re-prompts |

Persona is stored in `LearnerProfile` and injected as a system prompt modifier on all subsequent sessions.

### Learning Mode vs Survival Mode

| | Learning Mode | Survival Mode |
|---|---|---|
| Hint bar | Visible (separate Claude call) | Hidden |
| Hearts | N/A | 5 hearts — deducted on 30s timeout or off-context response |
| NPC behaviour | Structured, supportive | Unpredictable, naturalistic |

### Dialogue Engine

Every Claude API call is structured as:

```
[scenario context] + [persona modifier] + [conversation history] + [translated icon input]
```

Icon translation happens in `aac-icon-service` before the prompt is built — the LLM never receives raw icon IDs.

### Emotion Detection (Two-Layer)

| Layer | Where | What |
|---|---|---|
| DeepFace | Server-side (`expression-service`) | Classifies 7 emotions from JPEG frames POSTed every 500ms |
| MediaPipe Face Mesh | Client-side (browser JS) | Renders 468-point dot overlay on canvas — visual only, no data |

Emotion events are timestamped in Supabase. Therapist replay drives emoji overlays from stored timestamps — no ML runs during playback.

### Communication Competence Scoring

Post-session: full transcript + emotion summary → Claude API → JSON scores across 5 dimensions:

- Operational, Linguistic, Social, Strategic, Confidence

Rendered as a Recharts radar chart in the therapist dashboard.

### Session Recording

`MediaRecorder` captures the learner's webcam as WebM. On session end, the blob uploads to MinIO. Therapist view replays the video with emotion overlay synced to stored timestamps.

---

## Figma Design Reference

Design file: [SABI Figma](https://www.figma.com/design/40cH7cHFTR92K0LK9zoHoI/SABI?node-id=25-305)

Key screens:
- **Learner scenario view:** background photo + NPC photo + speech bubble + AAC grid + hint bar (Learning) or hearts bar (Survival)
- **Therapist session report:** radar chart (5 competence dimensions) + emotion timeline + session transcript
- **Therapist view recording:** video player + emotion emoji/face mesh overlay synced to playback

NPC CSS z-index stack: speech bubble (4) → NPC photo (3) → background photo (2) → black fallback (1)

---

## Development Guide

### Frontend (outside Docker)

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

### Python services (outside Docker)

```bash
cd dialogue-engine
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### Scale dialogue workers

```bash
docker-compose up --scale dialogue-queue-worker=3
```

Total concurrent Claude calls = replicas × `WORKER_CONCURRENCY` (default: 2). Keep within your Anthropic tier limit.

### MinIO console

```
http://localhost:9001
Login: minioadmin / minioadmin
```

---

## Phased Build Plan

| Phase | Days | Scope |
|---|---|---|
| **Phase 1** | 1–3 | Next.js routing, icon pre-fetch, static scenario stage, AAC board UI, Claude API (hardcoded prompt), Supabase tables + auth, Docker Compose skeleton |
| **Phase 2** | 4–7 | Icon-to-text translation, ElevenLabs TTS, Learning/Survival modes, Sabi hint bar, Persona Engine, session logging |
| **Phase 3** | 8–11 | Expression Service (DeepFace), MediaPipe overlay, session video recording, MinIO upload, Therapist Dashboard, emotion timeline |
| **Phase 4** | 12–14 | View Recording with emotion playback, scenario builder, competence scoring, therapist PiP webcam, E2E demo testing |

Post-MVP features (native apps, offline mode, Kubernetes, Kong gateway, pgvector icon search, ML persona classifier) are explicitly deferred.

---

## Database Schema (Supabase)

| Table | Description |
|---|---|
| `User` | Auth users with role (`learner` / `therapist`) |
| `LearnerProfile` | Persona classification, assigned therapist |
| `Scenario` | Available scenarios with stage definitions |
| `Session` | Session records (start, end, scenario, mode, persona) |
| `SessionEvent` | Timestamped icon selections, NPC responses, emotion readings |

Schema is managed via the Supabase dashboard or the `mcp__supabase__*` MCP tools.
