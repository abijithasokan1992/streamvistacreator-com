## Fix Plan — Issues #1–#6

Small, isolated patches. Frontend-only where possible; one RPC widening for #3.

### 1. Submit Content — always fails
File: `src/pages/SubmitContent.tsx`
- Tighten Zod: `rightsOwner` max **120** (was 180), `email` max **254** (was 255).
- Mirror `maxLength` on the `<input>` for rightsOwner (120).
- On DB error, surface `error.message` in the toast instead of a generic "Submission failed" so future RLS/constraint mismatches are visible.

### 2. Revenue Statement Import — mapping empty & mapping lost
Files: `src/components/admin/RevenueStatementImport.tsx`, `src/lib/revenue/importApi.ts`
- **Candidate loading:** gate the mapping screen behind an admin/super_admin check; if not admin, show an inline "Admin role required" alert instead of silently rendering empty selects. Keep the existing queries — RLS will still allow admin reads.
- **Mapping persistence:** in `toRevenueLineRow`, additionally write real FK columns when present on `revenue_lines`:
  - `deal_memo_id` (add column if missing — see migration below)
  - Keep `metadata.workspace_id`, `metadata.buyer_user_id` as-is (no columns exist for them yet).
- Migration (only if `revenue_lines.deal_memo_id` is missing): `ALTER TABLE public.revenue_lines ADD COLUMN IF NOT EXISTS deal_memo_id uuid REFERENCES public.deal_memos(id) ON DELETE SET NULL;` plus index.
- Guarantee `title_id` is set for every mapped row before insert; if any mapped rows have no `titleId`, block Confirm (already partially enforced by `canConfirmImport`) and show which rows are missing.

### 3. "Pass QC & Send to Legal" — always errors
File: `src/components/admin/TitleReviewPanel.tsx` + one migration
- New RPC `admin_fast_pass_to_legal(_title_id)` (SECURITY DEFINER, admin-only) that internally walks whatever intermediate transitions the current status requires (`submitted → in_review → qc_review → legal_review`) in one call, reusing the same guardrails (blocking issues / checklist) as `transition_title_status`.
- `passToLegal` in the panel calls the new RPC. All other buttons stay on `transition_title_status`.

### 4. DIT Ingest — "Upload failed"
File: `src/components/studio/dit/DitIngestProtocol.tsx`
- Ensure the storage upload path is **always** `${user.id}/…` regardless of workspace state (matches `dit_screenshots_owner_write` RLS: `foldername[1] = auth.uid()`).
- If `user.id` is null, block the submit with an explicit "Sign-in required" toast rather than attempting the upload.
- Surface `uploadError.message` in the toast so future 403s are diagnosable.

### 5. Email retry sweeper — always shows Failed
Files: `supabase/functions/retry-failed-emails/index.ts`, `src/components/admin/EmailLogMonitor.tsx`
- Split the response into three orthogonal flags:
  - `sweep_status` (unchanged)
  - `audit_persist_status` — did `admin_audit_log` write succeed?
  - `pending_remaining` — informational count, NOT a failure signal.
- `audit_status` becomes `ok` when `audit_persist_status === "ok"` (drop the `audit.passed` requirement).
- UI banner logic:
  - `sweep === "failed"` → red "Retry failed…"
  - `audit_persist_status === "failed"` → amber "audit persistence unavailable"
  - `pending_remaining > 0` → neutral "Sweep OK — N still pending, will retry next run"
  - else → green "Sweep OK — 0 stuck"

### 6. Intelligence Center — silent Firecrawl errors
Files: the structured-scan view and the custom-search view under `src/components/admin/intelligence/` (exact filenames to be located during build).
- After `functions.invoke(...)`, inspect both the transport `error` and any `payload.error` / `payload.status === "failed"` from the edge function.
- On failure: render a destructive `Alert` above the results area with the upstream error text; do NOT show "No records extracted". Also `toast.error` for parity with other admin surfaces.

---

### Out of scope (deliberately)
- Issue #7 (Creator Revenue workspace scoping): already correct in source; noted as not-reproducing. No change.
- Wider refactors to revenue schema (adding `workspace_id`, `buyer_user_id` columns on `revenue_lines`).
- Any RC/publish/deploy.

### Verification
- #1: submit form with 121-char name → expect "name too long" client error, no silent DB failure.
- #2: sign in as admin, import a statement, confirm mapped rows have `title_id` and `deal_memo_id` set in `revenue_lines`.
- #3: on a `submitted` title, click Pass QC → status advances to `legal_review`; blocking issues still block.
- #4: submit DIT log signed-in with and without active workspace → both succeed.
- #5: run sweeper with pending rows present → banner reads "Sweep OK — N pending", not "audit persistence unavailable".
- #6: force a Firecrawl 401/500 in one intelligence run → error alert shown.
