-- QUARANTINED — DO NOT EXECUTE WITHOUT FOUNDER APPROVAL.
--
-- Purpose: mark the 18 confirmed demo / synthetic / internal-test
-- content_titles rows from the 2026-07-28 Media Office audit as
-- non-production so the shared operational counter filter
-- (src/lib/operations/productionFilters.ts) excludes them.
--
-- This migration performs NO deletion. It only sets
-- `metadata.is_test = true` and `metadata.data_classification` on
-- rows whose IDs appear in /mnt/documents/media_office_classification.csv
-- with classification in {CONFIRMED_DEMO, CONFIRMED_TEST, INTERNAL_TEST}.
--
-- Reversal: `UPDATE content_titles SET metadata = metadata - 'is_test'
--            - 'data_classification' - 'archived_at' WHERE id = ANY($1)`.
--
-- Genuine creator rows (23 GENUINE + 5 UNCERTAIN) are intentionally
-- untouched. The 5 UNCERTAIN rows require manual founder review.

WITH tagged AS (
  SELECT unnest(ARRAY[
    -- 13 orphan-owned 'Kolumittayi' seed rows (2026-06-19 burst)
    '930f6fc4-5253-40aa-9e2d-7748e19ad227',
    '05a998eb-230a-480b-afe1-5f2b84b983a9',
    'c3c20c32-dd6a-459b-9733-0b7eaf131696',
    '8cb317de-4001-4a62-993c-4ff6437a0987',
    'f0f846f7-2eb9-4a74-bc40-86330e923064',
    '7c09925b-fec1-4ad6-8bed-6a25fea9f828',
    '7c9ddaa2-e8e6-489b-8461-2fe1c8555896',
    '319fbc52-265c-460c-bdc7-5dfbe92dbf2a',
    '0a1f9ebf-8552-43c4-8d2d-52747c35be7b',
    '57066948-32ee-457c-94b5-1dfc744bdad8',
    '702ecd3d-e703-4f11-8add-f1724bd53bbb',
    '91a614dc-f6f6-4189-9742-b00685f58011',
    'd08d4bf0-8cbe-4908-8794-37fb607b06b6',
    -- CONFIRMED_TEST (literal 'TEST' titles or 'TEST ac' owner)
    '552734de-ec59-4d67-85d8-4c2f5d3a39e3', -- TEST 1
    'bbff5bf3-2e2b-488f-ad8c-cf0589efa418', -- Koodu / TEST ac
    'b12e11da-fa28-4eef-b490-5a3061e06fd8', -- Koodu / TEST ac
    -- INTERNAL_TEST (internal review / support-bridge accounts)
    'd7fdeaff-d2a0-42f1-8786-4f3897c9ab6d', -- Draft Title (Review Sample)
    '9bc82d9f-2309-493e-90e5-f19636fc7c8e'  -- MALAYALAKKARA RESIDENCY / support-bridge
  ]::uuid[]) AS id
)
UPDATE public.content_titles ct
SET metadata = COALESCE(ct.metadata, '{}'::jsonb)
             || jsonb_build_object(
                  'is_test', true,
                  'data_classification', 'demo',
                  'archived_at', to_jsonb(now())
                )
FROM tagged
WHERE ct.id = tagged.id;
