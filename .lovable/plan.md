# StreamVista Cloud X — Platform Integrations

Reuse the existing app. Add integration configuration surface, a unified AI Assistant, and per-service wiring on top of the existing backend, RBAC, storage, billing, and workflows. No schema migrations, no duplicate modules, no UI redesign.

## Scope

Nine platform services surfaced under one Settings → Integrations page:

| Service | Purpose | Existing wiring |
| --- | --- | --- |
| Oracle Cloud (OCI) | Primary storage, media, archive | `supabase/functions/_shared/oci.ts`, `oci-upload`, `oci-multipart`, `verify-oci-connection`, `site_config.oracle_*` |
| GPT-5.5 (OpenAI via Lovable AI) | Reasoning, metadata, natural language assistant | Lovable AI Gateway (`LOVABLE_API_KEY`) |
| Gemini Enterprise | Semantic search, grounded assistant answers, content discovery | Standard connector `gemini_enterprise` (gateway) |
| Firecrawl | Film / OTT / festival / market research | Standard connector `firecrawl` (gateway) |
| Razorpay | Subscriptions, storage plans, invoices, billing history | `create-razorpay-*`, `verify-razorpay-payment`, `razorpay-webhook`, `check-razorpay-status` |
| GitHub | Source, CI/CD, releases, deploy status (internal only) | Repo already linked; surface status read-only |
| GatewayAPI | SMS / RCS / OTP / editorial / delivery notifications | Standard connector `gatewayapi` (gateway) |
| Gmail | Verification, invites, password reset, billing, collab | Existing transactional email pipeline (`send-transactional-email`) |
| Sanity (or Contentful) | Homepage, marketing, docs, news, help centre | Standard connector `sanity` (MCP) — public content only |

## Phases

### Phase 1 — Integrations settings page  (this turn)

- Route: `/admin/integrations` (super_admin / admin only, guarded by existing `RoleGate`).
- Server function `integrations-status` returns a single JSON payload with per-service `{ connected, mode, last_sync, latency_ms, note }`.
  - OCI: reuse `verify-oci-connection` result.
  - Razorpay: reuse `check-razorpay-status` result.
  - Lovable AI (GPT-5.5, Gemini via gateway): probe `LOVABLE_API_KEY` presence + one-shot chat ping.
  - Firecrawl / GatewayAPI / Gemini Enterprise / Sanity: presence of connector secret (`FIRECRAWL_API_KEY`, `GATEWAYAPI_API_KEY`, `GEMINI_ENTERPRISE_API_KEY`, `SANITY_API_KEY`).
  - Gmail: presence of transactional email config.
  - GitHub: read-only presence marker (repo connected via Lovable ↔ GitHub sync).
- UI: card grid, each card shows status pill, last checked, and buttons: **Test Connection**, **Configuration** (opens existing admin surface for that service — OCI card links to Storage Governance, Razorpay to Billing, etc.). Never expose secret values.
- No new tables. State comes from `site_config` + environment presence.

### Phase 2 — StreamVista AI Assistant  (shipped)

Command-palette launcher (global ⌘K / floating "Ask StreamVista" button, authenticated users only) that orchestrates existing modules read-only. Never modifies workflows.

- `supabase/functions/assistant-chat/index.ts` — AI SDK `generateText` via Lovable AI Gateway. Default model `openai/gpt-5.5`; users never see model selection. Every tool query uses the caller's bearer token so RLS enforces scope — no admin bypass.
- Tools (read-only): `find_productions`, `list_ingest_jobs`, `list_recent_uploads`, `storage_summary`, `list_invoices`, `research_web` (Firecrawl; disabled with a friendly message when the key is absent).
- `src/components/assistant/AssistantLauncher.tsx` — command-palette dialog with suggested actions, recent-query history (localStorage), and active-production context passed from `sv.activeProjectId`.
- Placeholders (not built): metadata generation, subtitles, reports, AI QC, analytics, workflow automation. Assistant surfaces these as "coming soon" instead of attempting them.

Original Phase 2 plan (kept for reference):

- Single conversational surface at `/assistant` (authenticated).
- Server: `supabase/functions/assistant-chat/index.ts` streaming `streamText` via Lovable AI Gateway.
- Default model `openai/gpt-5.5` with `google/gemini-2.5-pro` fallback (routing decided server-side by task class, never exposed to the user).
- Tools (server-side, gated by caller's RBAC):
  - `find_clips`, `search_productions`, `find_duplicate_media`, `locate_camera_cards` → existing production/media queries.
  - `generate_metadata`, `generate_subtitles`, `summarize_script`, `smart_tag` → Lovable AI.
  - `research_company`, `research_buyer`, `search_ott`, `industry_news` → Firecrawl `search` / `scrape`.
  - `semantic_search` → Gemini Enterprise `streamAssist` / `search`.
  - `generate_report` → existing `chief-report` / `system-report`.
- UI: reuses existing `AgentDock` / `AgentChat` shells; adds a full-page route rendering the same components with the new endpoint. No new chat component library.

### Phase 3 — Per-service wiring passes

Each pass edits only the touchpoints for that service; no module duplication.

1. **Notifications** — extend `send-transactional-email` router so SMS/RCS/OTP flows fan out to a new `send-sms` edge function that calls GatewayAPI `/mobile/single` via the connector gateway. Reuses existing notification triggers (upload status, editorial, delivery).
2. **AI enrichment on ingest** — existing `ingest-preflight` gains an optional post-hook that enqueues metadata/OCR/STT/subtitle jobs on Lovable AI. No new pipeline; jobs written to existing `recent_uploads` / job tables.
3. **Semantic search** — production search UI switches from LIKE query to `assistant-chat` tool `semantic_search` (Gemini Enterprise) when connected; falls back to existing SQL search.
4. **CMS** — public marketing pages read from Sanity via existing `mcp_sanity` connector. Productions / assets / users / billing / rights stay in Lovable Cloud.
5. **GitHub** — read-only badge on Integrations page showing latest workflow status via existing GitHub App connection (no new auth).

## Rules honoured

- No new tables, no schema migration, no RLS changes.
- No duplicate modules (Production / Studio / Ingest / Editorial / Delivery / Licensing / Marketplace / Analytics stay as-is).
- All secrets stay server-side. UI never renders raw keys.
- Existing RBAC (`useAuth().isAdmin`, `RoleGate`, `has_role`) gates every new surface.
- Existing OCI upload pipeline, Razorpay payment workflow, and email/notification workflows are reused verbatim.

## Files (Phase 1)

- Create `.lovable/plan.md` (this file — replaces the prior Production Readiness plan; that plan is now shipped).
- Create `supabase/functions/integrations-status/index.ts`.
- Create `src/pages/AdminIntegrations.tsx`.
- Edit `src/App.tsx` — add `/admin/integrations` route.
- Edit `src/pages/AdminHome.tsx` — add Integrations tile.
