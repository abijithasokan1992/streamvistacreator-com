# StreamVista Live Film Business Network — Schema and Route Inventory

## Confirmed production backend

- Supabase project ref: `hllgmkfqgeuqlmpcirvn`
- Frontend client: `src/integrations/supabase/client.ts`
- Existing auth/session handling is reused.

## Existing admin orchestration surfaces

### Communication Center

File: `src/components/admin/CommunicationCenter.tsx`

Confirmed responsibilities already present:

- Support inbox
- Contact inbox
- Notifications
- Invitations
- Broadcasts
- Email delivery log
- Communication activity

Implementation rule: extend this surface with deal-agent review and founder approval queues. Do not create a second messaging system.

### Partner Network Hub

File: `src/components/admin/PartnerNetworkHub.tsx`

Confirmed data sources already in use:

- `distribution_partners`
- `distribution_metadata_mappings`
- `distribution_deliveries`
- `distribution_delivery_logs`
- `partner_profiles`

Implementation rule: reuse partner identities, contacts, requirements, connector configuration and delivery history.

## Existing tables and services to reuse

- `notifications`
- `email_send_log`
- `partner_profiles`
- `distribution_partners`
- `distribution_metadata_mappings`
- `distribution_deliveries`
- `distribution_delivery_logs`
- Existing support/contact inbox data
- Existing invitation infrastructure
- Existing admin audit log
- Existing email queue, retry and suppression functions

## Smallest safe schema addition

The following tables are the only new Phase 1 workflow records proposed. Final migration names must be checked against existing generated Supabase types before application.

### `deal_cases`

Canonical deal record linking partner, title, extracted requirements and current stage.

Required fields:

- `id`
- `partner_id`
- `title_id`
- `stage`
- `requirements_json`
- `commercial_summary`
- `risk_level`
- `created_at`
- `updated_at`

### `deal_messages`

Normalized inbound and outbound communication references. Raw mailbox content remains in the source system where appropriate.

Required fields:

- `id`
- `deal_case_id`
- `source`
- `external_message_id`
- `direction`
- `sender`
- `recipient`
- `subject`
- `received_at`
- `metadata_json`

### `ai_draft_actions`

Auditable AI work queue for extraction, matching, drafting and final founder approval.

Required fields:

- `id`
- `deal_case_id`
- `action_type`
- `input_snapshot`
- `output_snapshot`
- `model_metadata`
- `approval_status`
- `approved_by`
- `approved_at`
- `created_at`

### `network_events`

Realtime event stream for authorized dashboards and system synchronization.

Required fields:

- `id`
- `actor_id`
- `event_type`
- `entity_type`
- `entity_id`
- `visibility_scope`
- `payload`
- `created_at`

## Founder direct-control rule

Founder has direct owner-level visibility and appears only at these approval gates:

1. Final commercial terms
2. Contract/signature authorization
3. Payment release, refund or payout
4. Master delivery release
5. Exceptional-risk override

Detection, identification, extraction, title matching, draft creation, follow-up, reminders, pipeline updates, document preparation and monitoring remain agent-driven.

## RLS boundary

- Default deny on all new tables.
- Founder/admin can read all deal workflow records.
- Creators can only read records tied to their own titles.
- Buyers/partners can only read explicitly shared deal records.
- Service-role writes are limited to verified ingestion and automation functions.
- Private contacts, credentials, screeners and master-delivery URLs are never exposed through public views.

## Implementation sequence

1. Add migration with the smallest tables above.
2. Regenerate Supabase types.
3. Add repository layer under the existing communication/distribution modules.
4. Add founder approval queue inside Communication Center.
5. Add realtime subscriptions for authorized status updates.
6. Add tests for RLS, idempotency, duplicate-message prevention and approval enforcement.
7. Enable transactional sending only after Resend DNS verification passes.
