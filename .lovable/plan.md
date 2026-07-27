# Combined Safe Migration Batch — approved scope

Single transaction against `hllgmkfqgeuqlmpcirvn`. No app code changes.

## Included
1. **Promote `20260717_000000_title_canonical_backfill.sql`**
   - Adds `content_titles.client_draft_id` (nullable) + owner-scoped partial unique index for idempotent title creation.
   - Creates `public.title_backfill_conflicts` (RLS: SELECT/UPDATE for admin / super_admin / platform_owner / founder; service_role full).
   - Logs conflicts, then backfills NULL/blank canonical fields (`synopsis`, `language`, `genre`, `duration_minutes`) from `metadata` — never overwrites existing canonical values. Guarded with `jsonb_typeof` + bounded regex parses.

2. **Promote `20260718_000000_dit_ingest_screenshots_bucket.sql`**
   - Creates private `dit-ingest-screenshots` bucket (20 MB cap; png/jpeg/webp only).
   - `storage.objects` policies: owner read/insert/update/delete scoped to `auth.uid()` folder; admin/super_admin/platform_owner/founder/qc_reviewer read-only.

3. **New: `trg_prevent_self_approval` on `public.content_approvals`**
   - Verified live schema — `content_approvals` has `title_id` + `actor_user_id` (no submitter column).
   - BEFORE INSERT/UPDATE trigger blocks when `actor_user_id = content_titles.owner_user_id`. Raises `42501`.
   - `service_role` bypasses so trusted edge functions can still record system approvals.
   - `SECURITY DEFINER`, `search_path = public`.

## Explicitly excluded
- `20260717_010000_revenue_statement_import.sql` — deferred until service-role edge function replaces client-side `revenue_imports` writes.

## Post-apply confirmation I will report
- ✅ Part 1 applied — `client_draft_id` column, unique index, and `title_backfill_conflicts` present; row counts for backfilled columns and detected conflicts.
- ✅ Part 2 applied — `dit-ingest-screenshots` bucket exists (private) with 5 policies on `storage.objects`.
- ✅ Part 3 applied — `trg_prevent_self_approval` present on `content_approvals`.
- ✅ Revenue migration NOT applied — verify by absence of `revenue_imports` RLS changes / new policies.
- ✅ Kill-switch status (currently `true` per `mcp_control_flags.kill_switch`) — will re-read after apply to confirm unchanged.

## Rollback (manual, for reference)
```sql
DROP TRIGGER IF EXISTS trg_prevent_self_approval ON public.content_approvals;
DROP FUNCTION IF EXISTS public.prevent_self_approval();
-- Bucket + policies: DROP POLICY x5 on storage.objects; DELETE FROM storage.buckets WHERE id='dit-ingest-screenshots';
-- Backfill: DROP INDEX content_titles_owner_client_draft_idx; ALTER TABLE content_titles DROP COLUMN client_draft_id; DROP TABLE title_backfill_conflicts;
```

Approve to switch to build mode and I will apply the single transaction and return the confirmation checklist.
