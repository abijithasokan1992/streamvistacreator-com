BEGIN;

-- Transaction-scoped only: bypass the content_titles owner-write-scope
-- trigger so this admin-level metadata tag can run in a migration
-- (which has no auth.uid()). Nothing outside this transaction is affected.
SET LOCAL session_replication_role = replica;

UPDATE public.content_titles SET metadata = COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object('is_test', true, 'data_classification', 'seed',
     'quarantined_at', to_jsonb(now()), 'quarantined_batch', 'batch2_2026-07-28',
     'quarantined_reason', 'Orphan-owned Kolumittayi seed burst 2026-06-19')
WHERE id IN (
  '930f6fc4-5253-40aa-9e2d-7748e19ad227'::uuid,
  '05a998eb-230a-480b-afe1-5f2b84b983a9'::uuid,
  'c3c20c32-dd6a-459b-9733-0b7eaf131696'::uuid,
  'f0f846f7-2eb9-4a74-bc40-86330e923064'::uuid,
  '8cb317de-4001-4a62-993c-4ff6437a0987'::uuid,
  '7c09925b-fec1-4ad6-8bed-6a25fea9f828'::uuid,
  '7c9ddaa2-e8e6-489b-8461-2fe1c8555896'::uuid,
  '319fbc52-265c-460c-bdc7-5dfbe92dbf2a'::uuid,
  '0a1f9ebf-8552-43c4-8d2d-52747c35be7b'::uuid,
  '57066948-32ee-457c-94b5-1dfc744bdad8'::uuid,
  '702ecd3d-e703-4f11-8add-f1724bd53bbb'::uuid,
  '91a614dc-f6f6-4189-9742-b00685f58011'::uuid,
  'd08d4bf0-8cbe-4908-8794-37fb607b06b6'::uuid
);

UPDATE public.content_titles SET metadata = COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object('is_test', true, 'data_classification', 'internal_test',
     'quarantined_at', to_jsonb(now()), 'quarantined_batch', 'batch2_2026-07-28',
     'quarantined_reason', 'Founder / support / QA internal-test account')
WHERE id IN (
  'b13ae56f-086f-4285-a83e-42f35b2bcae4'::uuid,
  'd7fdeaff-d2a0-42f1-8786-4f3897c9ab6d'::uuid,
  '831594ac-e1f4-40cf-82fb-09123eee4bf4'::uuid,
  'bbff5bf3-2e2b-488f-ad8c-cf0589efa418'::uuid,
  'b12e11da-fa28-4eef-b490-5a3061e06fd8'::uuid,
  '9bc82d9f-2309-493e-90e5-f19636fc7c8e'::uuid
);

UPDATE public.content_titles SET metadata = COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object('is_test', true, 'data_classification', 'system_test',
     'quarantined_at', to_jsonb(now()), 'quarantined_batch', 'batch2_2026-07-28',
     'quarantined_reason', 'Literal TEST 1 pushed to ready_for_distribution to exercise pipeline')
WHERE id = '552734de-ec59-4d67-85d8-4c2f5d3a39e3'::uuid;

UPDATE public.content_titles SET metadata = COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object('is_test', true, 'data_classification', 'pre_production',
     'quarantined_at', to_jsonb(now()), 'quarantined_batch', 'batch2_2026-07-28',
     'quarantined_reason', 'External creator pre-launch draft; exclude from live counters until reclassified')
WHERE id IN (
  '2f6c2ecc-6de5-4cb4-bbb7-790e012bdd0c'::uuid,
  'd2a948b1-e629-4c17-978a-e956686f4fc3'::uuid,
  '122b5aba-c592-4c5e-af7a-0fa9e50e659d'::uuid,
  'a219579e-a1fc-46ab-816b-f58348506653'::uuid,
  '3f69d1d5-8089-4fbe-99a3-a0ca3ce1f9a8'::uuid,
  'a6ff210e-06a4-4ac6-b2b9-bc8c34e9c50a'::uuid,
  '7a989286-6deb-4ffe-a647-ef1263e8c99d'::uuid,
  'fb90d14f-145e-40c9-a69f-d0460020587c'::uuid,
  'f6920e2e-a1dc-4397-adec-66cf3a4b8220'::uuid,
  'dea21096-51dd-4d68-a158-5383894f62d0'::uuid,
  '7e1e117c-f008-4797-9722-e5fb7367f094'::uuid,
  '2678351b-3bbd-469a-8389-20e44f5aeff9'::uuid,
  'f1852bc3-2cf0-4bc7-9138-ee7c2a8e4e4a'::uuid,
  '96704994-4fea-4ccf-ae7e-10282504ea3c'::uuid,
  'c5248869-7f1b-4838-a016-ede6a009425b'::uuid,
  '994c9c48-beed-43d8-874e-dce3aaa3fe8e'::uuid,
  'c9ed1a82-5cae-4063-9628-b8368f657954'::uuid,
  '0eef5db2-b64d-4172-ad93-d7808e8d918c'::uuid,
  'fea58dd6-5204-4846-b4af-b2ab660450c6'::uuid,
  '826acd44-813d-478c-9d10-f3c500aa7305'::uuid,
  '7f792548-b7fe-491a-beae-0a7df1403892'::uuid
);

DO $verify$
DECLARE
  n_seed int; n_internal int; n_system int; n_pre int; n_total int;
BEGIN
  SELECT COUNT(*) INTO n_seed     FROM public.content_titles
    WHERE metadata->>'quarantined_batch' = 'batch2_2026-07-28' AND metadata->>'data_classification' = 'seed';
  SELECT COUNT(*) INTO n_internal FROM public.content_titles
    WHERE metadata->>'quarantined_batch' = 'batch2_2026-07-28' AND metadata->>'data_classification' = 'internal_test';
  SELECT COUNT(*) INTO n_system   FROM public.content_titles
    WHERE metadata->>'quarantined_batch' = 'batch2_2026-07-28' AND metadata->>'data_classification' = 'system_test';
  SELECT COUNT(*) INTO n_pre      FROM public.content_titles
    WHERE metadata->>'quarantined_batch' = 'batch2_2026-07-28' AND metadata->>'data_classification' = 'pre_production';
  n_total := n_seed + n_internal + n_system + n_pre;

  IF n_seed <> 13 OR n_internal <> 6 OR n_system <> 1 OR n_pre <> 21 OR n_total <> 41 THEN
    RAISE EXCEPTION 'Batch 2 quarantine verification failed: seed=%, internal=%, system=%, pre=%, total=% (expected 13/6/1/21/41)',
      n_seed, n_internal, n_system, n_pre, n_total;
  END IF;
END
$verify$;

COMMIT;