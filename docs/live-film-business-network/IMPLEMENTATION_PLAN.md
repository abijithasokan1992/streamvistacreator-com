# StreamVista Live Film Business Network — Implementation Plan

## Goal
Connect creators, content owners, buyers, partners and StreamVista admin through a real-time film licensing workflow. No fake activity, no duplicate messaging system, and no autonomous legal or payment approval.

## Existing architecture to reuse
- `src/components/admin/CommunicationCenter.tsx`
- `src/components/admin/PartnerNetworkHub.tsx`
- Existing Supabase Auth and RLS
- Existing `notifications`, `partner_profiles`, `distribution_partners`, `distribution_deliveries`, `distribution_delivery_logs`, `email_send_log`, support/contact inbox and invitation infrastructure

## Phase 1 delivery order
1. Inventory current schemas, routes, event sources and RLS policies.
2. Define the smallest schema addition for presence, connection requests, deal cases, AI draft approvals and auditable events.
3. Add a live network dashboard inside the current admin shell.
4. Add creator/buyer/partner presence with last-seen fallback.
5. Add buyer-title connection requests with admin approval.
6. Detect incoming Hostinger/Gmail messages and normalize them into the existing communication layer.
7. Identify buyer/partner, extract requirements and match rights-cleared titles.
8. Generate a reply draft; require owner approval before any send.
9. Update deal status live and post approved operational events to Slack.
10. Add Razorpay visibility only after invoice/payment-link stage.

## Connected service responsibilities
| Service | Responsibility |
|---|---|
| GitHub | Source code, review and deployment history |
| Supabase | Auth, database, RLS, realtime and Edge Functions |
| Hostinger Mail / Gmail | Inbound partner communication and owner-approved replies |
| Resend | Transactional delivery after verified domain setup |
| Close | CRM leads, contacts, opportunities and follow-up |
| Google Calendar | Meetings and deal deadlines |
| Google Drive | Rights packs, screeners, proposals and delivery documents |
| Notion | Operating decisions and documentation |
| Linear | Build execution and QA tracking |
| Slack | Internal alerts and approvals |
| Razorpay | Payment and settlement visibility |

## Security rules
- Default-deny RLS.
- Partner contacts, credentials and screener URLs remain private.
- Owner approval required before outbound AI-generated messages.
- No autonomous contract acceptance, legal approval, refunds, payouts or payment release.
- Every AI extraction, match, draft, approval and send event must be auditable.

## Initial data model proposal
Final names must be checked against the existing schema before migration.

- `network_presence`
  - user_id, role, status, last_seen_at, current_context
- `connection_requests`
  - requester_id, target_partner_id/target_user_id, title_id, status, reviewed_by, reviewed_at
- `deal_cases`
  - partner_id, title_id, stage, requirements_json, commercial_summary, owner_id
- `deal_messages`
  - deal_case_id, source, external_message_id, direction, raw_metadata, received_at
- `ai_draft_actions`
  - deal_case_id, action_type, model_metadata, input_snapshot, output_snapshot, approval_status, approved_by, approved_at
- `network_events`
  - actor_id, event_type, entity_type, entity_id, visibility_scope, payload, created_at

## Acceptance tests
- Two authenticated users can appear online in the same network view.
- A creator/title can request a buyer/partner connection.
- Admin can approve or reject that request.
- A real inbound email can produce extracted requirements and a matched-title draft.
- Draft cannot send without owner approval.
- Approved status changes appear live for authorized users.
- Private contacts and screener URLs remain inaccessible to unauthorized roles.
- Mobile UI has no horizontal overflow.
- Build and CI pass.

## Blockers requiring owner action
- Confirm the correct StreamVista production Supabase project; do not use Union Auto Spares staging.
- Fix/verify the active Resend sending domain before enabling transactional sends.
- Approve paid Twilio numbers or messaging only when Phase 2 begins.
