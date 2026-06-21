
# Stream 11.4 — StreamVista Design OS

A staged refactor of the visual & UX layer of the existing StreamVista app. No payment, security, routing, or auth rewrites. Working Razorpay / Studio Vault / billing flows remain untouched — only the chrome and theming around them change.

This is a multi-phase stream. Each phase is independently shippable. I will execute them sequentially in subsequent turns, not all in one giant patch (it would be unsafe and unreviewable across the existing ~50+ pages).

---

## Phase A — Theme Token Foundation + Dark/Light/System

Goal: a single semantic token system that works in both modes, with a runtime ThemeProvider.

1. Rewrite `src/index.css`:
   - Keep current dark palette as `.dark` (default).
   - Add a new `:root` light palette tuned for "operational comfort" (warm off-white canvas, near-black ink, restrained primary, no neon glows).
   - Introduce semantic layer tokens beyond shadcn defaults:
     - `--surface`, `--surface-elevated`, `--surface-sunken`
     - `--border-subtle`, `--border-strong`
     - `--text-secondary`, `--text-tertiary`
     - `--state-success / warning / danger / info` (+ `-foreground`, `-soft`)
     - `--row-hover`, `--row-selected`
     - `--chart-1..6`
   - Demote glow/gradient utilities so they only fire in cinematic surfaces, not on every page.
2. Extend `tailwind.config.ts` to expose the new tokens as utilities (`bg-surface`, `bg-surface-elevated`, `text-secondary`, `border-subtle`, etc.).
3. Add `src/components/theme/ThemeProvider.tsx` + `useTheme()` hook:
   - Modes: `dark` | `light` | `system`.
   - Persists to `localStorage` (`sv.theme`).
   - Reacts to `prefers-color-scheme` when `system`.
   - Mounts class on `<html>`.
4. Add `ThemeToggle` (segmented Sun / Moon / Monitor) and wire into the app header + admin header.
5. Default mode by surface family:
   - Marketing, Creator home, Vault library, Review = `dark` (cinematic).
   - Admin, Billing, Invoices, Settings, Account = follows user preference, default `system`.

---

## Phase B — Primitive Component Audit

Goal: every shared primitive reads from semantic tokens, not literals.

1. Sweep `src/components/ui/*` for hardcoded `bg-white`, `bg-black`, `text-white`, `bg-[#...]`, neon glow defaults; replace with tokens.
2. Normalize variants on: `Button`, `Card`, `Input`, `Select`, `Textarea`, `Badge`, `Table`, `Dialog`, `Sheet`, `Tabs`, `Tooltip`, `Alert`, `Skeleton`.
3. Add missing primitives we keep re-inventing across pages:
   - `PageHeader` (title, eyebrow, description, actions slot)
   - `StatTile` (label, value, delta, icon)
   - `SectionCard` (header + body + footer)
   - `EmptyState`
   - `DataTable` density variants (`comfortable` | `compact`)
   - `SegmentedControl`

---

## Phase C — App Shells

Goal: one shell per surface family, OS-consistent.

1. `AppShell` (creator/studio): cinematic top bar + collapsible sidebar, dark by default.
2. `AdminShell`: operational layout — fixed sidebar, breadcrumbs, search, density toggle. Honors theme.
3. `BillingShell` / `AccountShell`: light-mode-first, generous whitespace, no glows.
4. Consistent route header pattern using `PageHeader` everywhere.

---

## Phase D — Surface Refits (page-by-page, additive)

In order of business value:
1. Index / marketing landing — polish without redesign.
2. Creator dashboard (`pages/dashboards/*`) — token sweep + `StatTile` / `SectionCard`.
3. Vault — keep cinematic, tighten density.
4. Admin — biggest cleanup; tables, filters, modals, finance views.
5. Invoice / Receipt / Checkout return — operational light surfaces.
6. Auth / Reset / Onboarding — calmer hierarchy.

Each page change is a token + layout swap; no behavioral changes to data fetching, mutations, or payments.

---

## Phase E — Email Presentation Layer

1. Shared HTML email layout under `supabase/functions/_shared/email/layout.ts` (header bar, logo, body card, footer, dual light/dark friendly).
2. Refactor existing transactional templates to use it (invoice, receipt, manual-payment-received, welcome, password reset).
3. No deliverability changes — same `from`, same routes, same triggers.

---

## Phase F — QA Pass

1. Visual sweep of every route in both themes via the preview.
2. Verify Studio Vault checkout flow still completes in both themes.
3. Verify admin tables render correctly with new density.
4. Lighthouse contrast spot-check on critical light-mode pages.

---

## Technical notes

- No new dependencies required; theming via class + CSS vars (already wired through shadcn).
- `next-themes` is NOT used (Vite project) — custom 60-line provider is enough.
- Migrations: none. This is presentation-only.
- Edge functions touched only in Phase E (email layout) — no signature or invocation changes.
- Types: `src/integrations/supabase/types.ts` untouched (auto-gen).

---

## Out of scope (explicit)

- Razorpay / billing core / entitlements logic
- RLS, security posture, scanner findings
- Routing tree changes
- Auth provider changes
- New product features

---

## Execution order in this stream

I will start with **Phase A** in the next turn (tokens + ThemeProvider + toggle), confirm the preview renders both modes cleanly, then proceed phase by phase. Each phase ends with a short status note so you can pause or redirect the stream.
