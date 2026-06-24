
# StreamVista AI Agent Network — Build Plan

Goal: ship 5 communicating AI agents across StreamVista, with a Chief AI in the Admin Panel that speaks audio reports to Abijith Asokan (Founder / MD / Architect). All four surface agents (Home, Creator, Studio, Buyer/Licensing) report up to the Chief.

## Architecture

```text
                         ┌─────────────────────────────┐
                         │  CHIEF AI (Admin Panel)     │
                         │  • Voice reports → Abijith  │
                         │  • Reads agent_events       │
                         │  • Realtime subscribe       │
                         └──────────────┬──────────────┘
                                        │ summarize + speak
                  ┌─────────────────────┼─────────────────────┐
                  │                     │                     │
       ┌──────────┴──────┐   ┌──────────┴──────┐   ┌──────────┴──────┐   ┌──────────────┐
       │ HOME AGENT      │   │ CREATOR AGENT   │   │ STUDIO AGENT    │   │ BUYER AGENT  │
       │ public concierge│   │ creator dash    │   │ studio dash     │   │ licensing    │
       └─────────┬───────┘   └────────┬────────┘   └────────┬────────┘   └──────┬───────┘
                 │                    │                     │                   │
                 └────────────────────┴──── agent_events ───┴───────────────────┘
                                  (persisted + realtime)
```

## Scope (this pass)

### 1. Backend — Lovable Cloud
- **Migration**: new tables (with GRANTs + RLS)
  - `agent_events` — id, agent (enum: home/creator/studio/buyer/chief), severity (info/warn/critical), title, summary, payload jsonb, workspace_id?, created_by?, created_at
  - `agent_reports` — Chief-generated digests (text + audio_url + created_at)
  - `app_role` enum: add `founder` value (keep existing admin/etc).
- **Realtime**: `ALTER PUBLICATION supabase_realtime ADD TABLE agent_events`
- **Auth gating**: `has_role(uid, 'founder')` security-definer used by Chief-only RLS. Seed Abijith's user with `founder` role (we'll prompt for his email/uid post-plan if not already assigned).

### 2. Edge functions
- `agent-chat` — generic chat endpoint. Body: `{ surface, messages }`. Calls Lovable AI (`google/gemini-2.5-flash`) with surface-specific system prompt. Logs structured events to `agent_events` when the model emits a `report:` tag.
- `chief-report` — founder-only. Reads recent `agent_events`, asks `google/gemini-2.5-pro` to synthesize a briefing, persists row in `agent_reports`, returns text.
- `chief-voice` — founder-only. Takes `text` (or report_id), calls **ElevenLabs TTS** (`eleven_turbo_v2_5`, voice George `JBFqnCBsd6RMkjVDRZzb`), returns MP3 stream. Requires ElevenLabs connector (we'll trigger connect flow during build).

### 3. Frontend
- `src/components/agents/AgentChat.tsx` — reusable chat panel (markdown render, streaming-style UI, tied to `agent-chat` with a `surface` prop).
- `src/components/agents/AgentDock.tsx` — floating launcher used on Home, Creator dashboard, Studio dashboard, Buyer/Licensing pages with surface-specific persona + greeting.
- `src/components/admin/ChiefBriefing.tsx` — Admin-only widget:
  - "Generate briefing" → calls `chief-report`
  - "🔊 Speak to Abijith" → plays returned MP3
  - Live feed of `agent_events` via realtime subscription
  - Severity filter + agent filter
- Mount AgentDock on `/` (home), `/creator/*`, `/studio/*`, `/licensing/*` (detect existing routes; gracefully fallback).
- Mount ChiefBriefing in the existing admin panel route (will identify exact path during build).

### 4. Personas (system prompts, locked in code)
- **Home Agent — "Vista"**: friendly concierge, explains 3 surfaces, routes user to Creator/Studio/Licensing CTAs.
- **Creator Agent — "Aria"**: helps filmmakers with intake, metadata, storage upgrades.
- **Studio Agent — "Orion"**: post-ops assistant — ingest, mastering, QC, delivery.
- **Buyer Agent — "Atlas"**: NDA-gated; helps acquisitions, screener requests, deal status.
- **Chief AI — "Sovereign"**: reports only to Abijith Asokan, Founder / MD / Architect & top decision maker. Synthesizes activity from the other 4 agents, flags risks, speaks aloud.

### 5. Security
- `agent_events` RLS: agents (via edge functions w/ service_role) write; founders read all; surface users read only their own events.
- `agent_reports` & `chief-voice` / `chief-report` edge functions: verify JWT → check `has_role(uid,'founder')`. Reject otherwise.
- Hardcoded email allowlist explicitly rejected; we use the `founder` role.

## Out of scope (this pass)
- Two-way live voice (user speaking back to Chief) — Lovable AI + ElevenLabs TTS is one-way per your choice. Can upgrade to ElevenLabs Conversational later.
- Per-agent fine-tuned tool calling beyond reading/writing `agent_events`.
- Dashboard redesigns — agents drop into existing dashboards.

## Sequence
1. ElevenLabs connector check/link (will prompt if missing).
2. Migration: enum + 2 tables + GRANTs + RLS + realtime publication.
3. Edge functions: `agent-chat`, `chief-report`, `chief-voice`.
4. Frontend components: `AgentChat`, `AgentDock`, `ChiefBriefing`.
5. Wire mounts on Home / Creator / Studio / Licensing / Admin.
6. Grant Abijith the `founder` role (need his auth user id/email).

## What I need from you to finish wiring
- **Abijith's login email** (the email he uses to sign into StreamVista) so we can grant the `founder` role on first run. If he hasn't signed up yet, sign in once and tell me the email.
- Confirm I should trigger the **ElevenLabs connector** link flow when we start (required for Chief voice).
