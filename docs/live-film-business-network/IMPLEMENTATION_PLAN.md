# StreamVista Live Film Business Network — Implementation Plan

## Goal
Connect creators, content owners, buyers, partners and StreamVista admin through a real-time film licensing workflow. No fake activity, no duplicate messaging system, and no autonomous legal, payment or master-delivery approval.

## Production ownership and direct access
- Founder/owner: Abijith Asokan
- Production Supabase project ref: `hllgmkfqgeuqlmpcirvn`
- Production URL: `https://hllgmkfqgeuqlmpcirvn.supabase.co`
- Founder must retain direct owner-level access to Supabase and GitHub.
- Do not route this project through the Union Auto Spares staging database.

## Existing architecture to reuse
- `src/components/admin/CommunicationCenter.tsx`
- `src/components/admin/PartnerNetworkHub.tsx`
- Existing Supabase Auth and RLS
- Existing `notifications`, `partner_profiles`, `distribution_partners`, `distribution_deliveries`, `distribution_delivery_logs`, `email_send_log`, support/contact inbox and invitation infrastructure

## Founder operating model
The platform is full automation with founder entry only at final control gates.

### Agent-driven by default
1. Detect inbound email/message/activity.
2. Identify buyer, partner or creator.
3. Extract requirements and rights needs.
4. Match rights-cleared titles.
5. Prepare draft replies, proposals and follow-ups.
6. Maintain pipeline, reminders, meetings and status updates.
7. Prepare deal documents and delivery-readiness checks.
8. Synchronize authorized events to Slack, Notion, Linear, Drive and CRM.
9. Record immutable audit events, retries and failures.

### Founder-only gates
- Final commercial terms approval
- Contract/signature authorization
- Payment release, refund or payout approval
- Master delivery release
- Exceptional-risk override

## Phase 1 delivery order
1. Inventory current schemas, routes, event sources and RLS policies.
2. Define the smallest schema addition for presence, connection requests, deal cases, AI draft approvals and auditable events.
3. Add a live network dashboard inside the current admin shell.
4. Add creator/buyer/partner presence with last-seen fallback.
5. Add buyer-title connection requests with automated validation and founder escalation only for exceptions.
6. Detect incoming Hostinger/Gmail messages and normalize them into the existing communication layer.
7. Identify buyer/partner, extract requirements and match rights-cleared titles.
8. Generate and queue reply drafts; auto-run routine follow-up rules while keeping founder approval at final commercial/legal gates.
9. Update deal status live and post approved operational events to Slack.
10. Add Razorpay visibility after invoice/payment-link stage.

## Connected service responsibilities
| Service | Responsibility |
|---|---|
| GitHub | Source code, review and deployment history |
| Supabase | Auth, database, RLS, realtime and Edge Functions |
| Hostinger Mail / Gmail | Inbound partner communication and approved replies |
| Resend | Transactional delivery after verified domain setup |
| Close | CRM leads, contacts, opportunities and follow-up |
| Google Calendar | Meetings and deal deadlines |
| Google Drive | Rights packs, screeners, proposals and delivery documents |
| Notion | Operating decisions and documentation |
| Linear | Build execution and QA tracking |
| Slack | Internal alerts and founder approval notifications |
| Razorpay | Payment and settlement visibility |

## Security rules
- Default-deny RLS.
- Partner contacts, credentials and screener URLs remain private.
- Founder approval is required only at final commercial, contract, payment, payout/refund, master-delivery and exceptional-risk gates.
- No autonomous contract acceptance, legal sign-off, refunds, payouts, payment release or master delivery.
- Every AI extraction, match, draft, follow-up, approval, send and state change must be auditable.
- All jobs must be idempotent, retry-safe and reversible where technically possible.

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
- Routine validation and status progression occur without founder input.
- A real inbound email can produce extracted requirements and a matched-title draft.
- Final commercial/legal actions cannot execute without founder approval.
- Approved status changes appear live for authorized users.
- Private contacts and screener URLs remain inaccessible to unauthorized roles.
- Duplicate events do not create duplicate sends, leads, deals or payments.
- Failed jobs retry safely and surface actionable errors.
- Mobile UI has no horizontal overflow.
- Build and CI pass.

## Remaining external blocker
- Fix and verify the active Resend sending domain before enabling transactional sends.
- Approve paid Twilio numbers or messaging only when Phase 2 begins.
