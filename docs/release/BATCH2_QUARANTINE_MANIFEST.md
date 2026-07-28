# Batch 2 Quarantine Manifest — Awaiting Founder Approval

**Status:** DRAFT. No migration executed. No row tagged. No deletion planned.

The drafted `supabase/migrations-pending/20260728_quarantine_demo_titles.sql` will NOT be run until you approve this manifest. If you approve a modified list, I will regenerate a new reversible migration that matches exactly what you sign off.

Classification vocabulary (per your directive):

| Code | Meaning |
|---|---|
| `seed` | Machine-generated seed burst (identical rows, orphan owner, no user activity). |
| `internal_test` | Row owned by a founder/support/review/QA account used to exercise the UI. |
| `system_test` | Row whose title literally contains "TEST" and was clearly used for pipeline testing. |
| `pre_production` | Real-looking creator submission made before public launch; keep but exclude from live counters until you re-classify per row. |
| `demo` | Marketing / walkthrough content (none identified in current 41). |

## 1. All 41 reviewed title records

Ordered by created_at. `Assets` = rows in `title_assets`. `MV` = rows in `title_media_versions`. Every other related table (`buyer_map`, `deals`, `acq`, `comm`, `dist`, `screen`, `revenue`, `removal`) returned **0 for every title** — this is confirmed against the live DB, so quarantining the titles has no cascade impact on buyer / deal / revenue tables.

| # | Record ID | Title | Status | Owner (name / email) | Owner ID | Assets | MV | Current classification | **Proposed classification** | Reason |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `930f6fc4-5253-40aa-9e2d-7748e19ad227` | Kolumittayi | draft | (orphan — no auth user) | `0ba667ef…c376e5` | 0 | 0 | unclassified | **seed** | Part of 13-row identical burst on 2026-06-19 05:49; no auth user. |
| 2 | `05a998eb-230a-480b-afe1-5f2b84b983a9` | Kolumittayi | draft | (orphan) | `0ba667ef…c376e5` | 0 | 0 | unclassified | **seed** | Same burst. |
| 3 | `c3c20c32-dd6a-459b-9733-0b7eaf131696` | Kolumittayi | draft | (orphan) | `0ba667ef…c376e5` | 0 | 0 | unclassified | **seed** | Same burst. |
| 4 | `f0f846f7-2eb9-4a74-bc40-86330e923064` | Kolumittayi | draft | (orphan) | `0ba667ef…c376e5` | 0 | 0 | unclassified | **seed** | Same burst. |
| 5 | `8cb317de-4001-4a62-993c-4ff6437a0987` | Kolumittayi | draft | (orphan) | `0ba667ef…c376e5` | 0 | 0 | unclassified | **seed** | Same burst. |
| 6 | `7c09925b-fec1-4ad6-8bed-6a25fea9f828` | Kolumittayi | draft | (orphan) | `0ba667ef…c376e5` | 0 | 0 | unclassified | **seed** | Same burst. |
| 7 | `7c9ddaa2-e8e6-489b-8461-2fe1c8555896` | Kolumittayi | draft | (orphan) | `0ba667ef…c376e5` | 0 | 0 | unclassified | **seed** | Same burst. |
| 8 | `319fbc52-265c-460c-bdc7-5dfbe92dbf2a` | Kolumittayi | draft | (orphan) | `0ba667ef…c376e5` | 0 | 0 | unclassified | **seed** | Same burst. |
| 9 | `0a1f9ebf-8552-43c4-8d2d-52747c35be7b` | Kolumittayi | draft | (orphan) | `0ba667ef…c376e5` | 0 | 0 | unclassified | **seed** | Same burst. |
| 10 | `57066948-32ee-457c-94b5-1dfc744bdad8` | Kolumittayi | draft | (orphan) | `0ba667ef…c376e5` | 0 | 0 | unclassified | **seed** | Same burst. |
| 11 | `702ecd3d-e703-4f11-8add-f1724bd53bbb` | Kolumittayi | draft | (orphan) | `0ba667ef…c376e5` | 0 | 0 | unclassified | **seed** | Same burst. |
| 12 | `91a614dc-f6f6-4189-9742-b00685f58011` | Kolumittayi | draft | (orphan) | `0ba667ef…c376e5` | 0 | 0 | unclassified | **seed** | Same burst. |
| 13 | `d08d4bf0-8cbe-4908-8794-37fb607b06b6` | Kolumittayi | draft | (orphan) | `0ba667ef…c376e5` | 0 | 0 | unclassified | **seed** | Same burst. |
| 14 | `2f6c2ecc-6de5-4cb4-bbb7-790e012bdd0c` | ARUNA | draft | Aruna Sankar / `arunasankarca@gmail.com` | `6d6680c4…101879` | 5 | 5 | unclassified | **pre_production** | External creator, real name/email, has media versions. Keep, exclude from live counters. |
| 15 | `d2a948b1-e629-4c17-978a-e956686f4fc3` | Kali | draft | Sarin Chandrashekaran / `sarinsumitha1234@gmail.com` | `7ce2a4fa…e86f7c7` | 0 | 0 | unclassified | **pre_production** | External creator draft, no assets yet. |
| 16 | `122b5aba-c592-4c5e-af7a-0fa9e50e659d` | Santhosh | draft | santhoshanima / `santhoshanima@gmail.com` | `8491fcbd…8bc0ef` | 0 | 0 | unclassified | **pre_production** | External creator draft. |
| 17 | `a219579e-a1fc-46ab-816b-f58348506653` | Diaspora | draft | Gokul Krishna / `gokulk2207@gmail.com` | `e244128b…d21a9` | 0 | 0 | unclassified | **pre_production** | External creator draft. |
| 18 | `3f69d1d5-8089-4fbe-99a3-a0ca3ce1f9a8` | Jananam 1947 Pranayam Thudarunnu | draft | Union auto spares / `unionautosparesuzhunnamkalayil@gmail.com` | `5fd4697d…59fcd5` | 0 | 0 | unclassified | **pre_production** — please confirm | Email + name suggest a family/founder-adjacent account for the same "Jananam" title. Flag for founder review. |
| 19 | `a6ff210e-06a4-4ac6-b2b9-bc8c34e9c50a` | IMRAN 3:185 | draft | Original Movies / `originalmoviess@yahoo.com` | `e08b5735…234c71f` | 2 | 2 | unclassified | **pre_production** | External creator with media versions. |
| 20 | `7a989286-6deb-4ffe-a647-ef1263e8c99d` | God Frequency | draft | Muhammed shan / `muhammedshanfilms@gmail.com` | `5eb72d4c…3d493c` | 3 | 3 | unclassified | **pre_production** | External creator with media versions. |
| 21 | `fb90d14f-145e-40c9-a69f-d0460020587c` | CRONUZ | **rejected** | vyshak biju / `vyshakbiju10@gmail.com` | `8ae5514c…f00dd1` | 5 | 5 | unclassified | **pre_production** | External creator, already `rejected` — keep for audit history. |
| 22 | `b13ae56f-086f-4285-a83e-42f35b2bcae4` | Jananam 1947 Pranayam Thudarunnu | draft | **Founder** Abijith U A / `abijithasokan1992@gmail.com` | `7119278d…eea87f` | 0 | 0 | unclassified | **internal_test** | Founder-owned duplicate of the "Jananam" title. |
| 23 | `f6920e2e-a1dc-4397-adec-66cf3a4b8220` | Aandaal | draft | Sarin Chandrashekaran | `7ce2a4fa…e86f7c7` | 0 | 0 | unclassified | **pre_production** | External creator draft. |
| 24 | `dea21096-51dd-4d68-a158-5383894f62d0` | ENNENNUM | draft | Sarin Chandrashekaran | `7ce2a4fa…e86f7c7` | 0 | 0 | unclassified | **pre_production** | |
| 25 | `7e1e117c-f008-4797-9722-e5fb7367f094` | Drishyam 3 | draft | Amal / `c21d7049…bba4e0d` owner | `c21d7049…bba4e0d` | 0 | 0 | unclassified | **pre_production** — please confirm | Uses a canonical Malayalam franchise title; may be third-party test. |
| 26 | `2678351b-3bbd-469a-8389-20e44f5aeff9` | ennennum | draft | Sarin Chandrashekaran | `7ce2a4fa…e86f7c7` | 0 | 0 | unclassified | **pre_production** | Likely duplicate of #24. |
| 27 | `f1852bc3-2cf0-4bc7-9138-ee7c2a8e4e4a` | idukki sambhavam | draft | Sarin Chandrashekaran | `7ce2a4fa…e86f7c7` | 0 | 0 | unclassified | **pre_production** | |
| 28 | `96704994-4fea-4ccf-ae7e-10282504ea3c` | Kolumittayi | draft | Sarin Chandrashekaran | `7ce2a4fa…e86f7c7` | 2 | 2 | unclassified | **pre_production** — please confirm | Real user, canonical title; has media versions. |
| 29 | `c5248869-7f1b-4838-a016-ede6a009425b` | Ancham naal Velliyazhcha | draft | Ajith kumar / `cbb6dfc5…b455b7da` | `cbb6dfc5…b455b7da` | 0 | 0 | unclassified | **pre_production** | External creator draft. |
| 30 | `994c9c48-beed-43d8-874e-dce3aaa3fe8e` | Varathan | draft | Sarin Chandrashekaran | `7ce2a4fa…e86f7c7` | 0 | 0 | unclassified | **pre_production** — please confirm | Canonical released Malayalam film; may not be rights-owned. |
| 31 | `c9ed1a82-5cae-4063-9628-b8368f657954` | Kolumittayi | draft | Arun Viswam / `afa5a5d4…829da4` | `afa5a5d4…829da4` | 0 | 0 | unclassified | **pre_production** — please confirm | Third instance of canonical title from external account. |
| 32 | `d7fdeaff-d2a0-42f1-8786-4f3897c9ab6d` | Draft Title (Review Sample) | draft | **streamvistareview** | `49e14384…5da294` | 0 | 0 | unclassified | **internal_test** | Internal QA review account, literal "Review Sample" title. |
| 33 | `0eef5db2-b64d-4172-ad93-d7808e8d918c` | Dare to dream | draft | bala murugan / `80d4fb06…93ab913` | `80d4fb06…93ab913` | 0 | 0 | unclassified | **pre_production** | External creator draft. |
| 34 | `831594ac-e1f4-40cf-82fb-09123eee4bf4` | Jananam 1947 Pranayam Thudarunnu | draft | ABIJITH UZHUNNUMKALAYIL ASOKAN / `79668938…09007f7` | `79668938…09007f7` | 0 | 0 | unclassified | **internal_test** — please confirm founder-adjacent | Same personal name as founder; treated as internal until you confirm. |
| 35 | `bbff5bf3-2e2b-488f-ad8c-cf0589efa418` | Koodu | draft | **TEST ac** / `89e91625…238e6621` | `89e91625…238e6621` | 0 | 0 | unclassified | **internal_test** | Display name literally "TEST ac". |
| 36 | `b12e11da-fa28-4eef-b490-5a3061e06fd8` | Koodu | draft | **TEST ac** | `89e91625…238e6621` | 0 | 0 | unclassified | **internal_test** | Same account. |
| 37 | `fea58dd6-5204-4846-b4af-b2ab660450c6` | 1947 PRANAYAM THUDARUNNU | draft | Sarin Chandrashekaran | `7ce2a4fa…e86f7c7` | 0 | 0 | unclassified | **pre_production** | |
| 38 | `826acd44-813d-478c-9d10-f3c500aa7305` | Bahumukham - Good, Bad & The Actor | **approved** | HarShiv KarThik / `1479f2fe…a5fa8` | `1479f2fe…9e4a5fa8` | 0 | 0 | unclassified | **pre_production** — please confirm | The only `approved` row. External-looking creator. Confirm before excluding from live catalogue. |
| 39 | `7f792548-b7fe-491a-beae-0a7df1403892` | Cineflow | draft | Tiktok Mashup / `6eccc77a…3bc64de` | `6eccc77a…3bc64de` | 0 | 0 | unclassified | **pre_production** — please confirm | Suspicious display name. |
| 40 | `9bc82d9f-2309-493e-90e5-f19636fc7c8e` | MALAYALAKKARA RESIDENCY | draft | **Streamvista Support Creator** | `48d8dc2f…ee9f1be` | 1 | 1 | unclassified | **internal_test** | Explicitly a support/QA account. |
| 41 | `552734de-ec59-4d67-85d8-4c2f5d3a39e3` | **TEST 1** | **ready_for_distribution** | ABIJITH UZHUNNUMKALAYIL ASOKAN | `79668938…09007f7` | 0 | 0 | unclassified | **system_test** | Literal "TEST 1" title in advanced status; used to exercise the pipeline. |

## 2. Proposed distribution

| Class | Count | Effect once wired |
|---|---|---|
| seed | 13 | Excluded from Mission Control, Media Office, QC, Legal, Buyer Mapping, Accounts, Revenue, Recent Activity. |
| internal_test | 6 | Same as seed. Visible only in a "Demo & Test" review panel. |
| system_test | 1 | Same as seed. `TEST 1` is the only row currently in `ready_for_distribution` — quarantine will drop the "1 approved / 1 ready" reading to a clean zero. |
| pre_production | 21 | Excluded from live operational counters until you re-classify per row. Owner and history untouched. |
| **Total** | **41** | |

Nothing is deleted. Everything sits in the same table with two additional metadata keys.

## 3. Related-record impact (verified against live DB)

Per-title related-row counts across `buyer_map`, `deals`, `acq_req`, `comm_req`, `dist_offers`, `screen_invites`, `revenue_lines`, `removal_req`: **all zero for all 41 titles**.

Only two tables carry rows tied to these titles:

| Table | Rows | Handling |
|---|---|---|
| `title_assets` | 21 (across 6 titles) | Untouched; kept as history. |
| `title_media_versions` | 21 (across 6 titles) | Untouched; kept as history. |

Owner-cohort side data (not deleted, not quarantined; noted for context):

| Table | Rows tied to the 41 owners | Note |
|---|---|---|
| `recent_uploads` | 954 | Left as-is. Their visibility will be filtered by the shared production filter in Batch 2 code wiring, not by mutating rows. |
| `notifications` | 43 | Same. |
| `invoices` | 0 | Nothing to touch. |
| `review_links` (created_by) | 0 | Nothing to touch. |

Storage objects in `smart-uploads` are addressed by `${user_id}/…` prefix, so they remain fully accessible to their owners; no object will be moved, renamed, or deleted.

## 4. What the new migration will do (only after your approval)

For each approved row it will run one idempotent statement:

```sql
UPDATE public.content_titles
SET metadata = COALESCE(metadata, '{}'::jsonb)
             || jsonb_build_object(
                  'is_test', true,
                  'data_classification', '<approved class>',
                  'quarantined_at', now(),
                  'quarantined_reason', '<one-line reason>'
                )
WHERE id = '<uuid>'::uuid;
```

Reversal SQL will be shipped in the same file as commented-out `-- ROLLBACK:` blocks that strip only those metadata keys and touch nothing else:

```sql
-- ROLLBACK:
-- UPDATE public.content_titles
-- SET metadata = metadata - 'is_test' - 'data_classification' - 'quarantined_at' - 'quarantined_reason'
-- WHERE id = '<uuid>'::uuid;
```

No `DELETE`. No `ALTER TABLE`. No trigger change. No storage change. Founder roles untouched.

## 5. What I need from you

Please reply with one of:

- **"Approve all as proposed"** — I will regenerate the migration for all 41 rows exactly as above (still not executed; you approve execution separately after review of the migration file).
- **"Approve with edits: …"** — list the row numbers whose proposed classification you want changed, and the new class. I will regenerate accordingly.
- **"Hold row #N pending investigation"** — I will exclude those rows from the migration and note them in a follow-up list.

Nothing runs until you say so.
