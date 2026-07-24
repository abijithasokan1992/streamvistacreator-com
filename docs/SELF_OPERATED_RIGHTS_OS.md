# StreamVista Self-Operated Rights OS

## Goal

Seller uploads once. The system verifies readiness, matches relevant buyers, opens a controlled deal room, records offers and approvals, delivers approved assets securely, and tracks revenue and settlement.

This document describes the source-only foundation. Nothing in this branch deploys, publishes, migrates production data, creates users, or executes pending migrations.

## Roles

- `platform_owner` / `founder` / `super_admin`: system governance and exception approval.
- `admin`: seller and buyer verification, title access mapping, workflow exceptions.
- `seller`: own organization, titles, rights declarations, assets, offers and settlements only.
- `buyer`: verified catalog and explicitly assigned deal rooms only.
- `legal`: mandate, chain-of-title, territory, term and conflict review only.
- `qc`: metadata, artwork, video, audio and subtitle review only.
- `finance`: invoices, receipts, commissions and settlements only.
- `support`: operational assistance without rights, payout or role-change authority.

All access is default-deny and must be enforced server-side through RLS or privileged functions.

## Seller workflow

1. Account and organization registration.
2. Email verification.
3. KYC/KYB submission.
4. Rights mandate and chain-of-title submission.
5. Title metadata and category-specific rights declaration.
6. Poster, trailer, screener, master and supporting-document upload.
7. Automated completeness and overlap checks.
8. Legal and QC review.
9. Buyer-ready publication after every required gate passes.
10. Offer review, seller approval, contract, delivery and settlement tracking.

## Buyer workflow

1. Company registration and email verification.
2. Admin verification of organization and acquisition contact.
3. Acquisition preferences: languages, genres, territories, rights and budgets.
4. Access to verified catalog fields only.
5. Explicit buyer-title mapping before screener or deal-room access.
6. Watermarked screener with expiring signed access.
7. Offer submission and negotiation.
8. Contract execution and approved delivery.
9. Revenue statement, invoice and payment reporting.

## Buyer-ready rule

A title is buyer-ready only when all of these are true:

- seller organization verified;
- mandate signed and valid;
- chain-of-title or representation authority verified;
- each offered right has category, language, territory, exclusivity and term;
- no unresolved overlap or conflict;
- legal review verified;
- QC review verified;
- approved buyer-visible poster;
- approved trailer or teaser;
- secure screener available where required.

Anything else must be `conditional`, `needs_documents`, `legal_hold`, `qc_hold`, or `internal_only`.

## Asset protection

- Draft posters and masters remain seller/admin only.
- Buyer-visible assets require explicit approval.
- Screeners use short-lived signed URLs and buyer-specific watermark data.
- Downloads remain disabled unless explicitly approved.
- Buyer access expires and can be revoked immediately.
- Every request, view, play, download and denial creates an immutable audit event.
- Public TMDb or web artwork may be used as metadata reference only; it must never be labelled licensed artwork without producer/rightsholder approval.

## Automation

- duplicate-title checks;
- missing-document checks;
- mandate and contract expiry alerts;
- rights overlap checks by category, language, territory and date;
- poster/trailer/screener readiness alerts;
- legal and QC task routing;
- buyer matching from verified preferences;
- deal-room creation after approval;
- screener expiry and revoke jobs;
- contract and payment reminders;
- settlement calculation with human payout approval;
- email and in-app notifications;
- audit-log creation for every privileged action.

## Implementation phases

### Phase 1 — Safe foundation

- Pending schema only.
- Workflow domain types and readiness evaluator.
- Default-deny RLS.
- No production execution.

### Phase 2 — Seller and buyer onboarding

- Organization registration.
- Seller KYC/KYB and mandate checklist.
- Buyer company verification and acquisition preferences.
- Admin exception queues.

### Phase 3 — Rights and assets

- Rights inventory editor with independent digital, satellite, dubbing, remake, music, theatrical, AVOD, FAST and ancillary rows.
- Asset approval states for posters, trailers, screeners, masters and documents.
- Automated overlap and missing-item checks.

### Phase 4 — Deal rooms and secure screener

- Buyer-title mapping.
- Expiring access levels.
- Signed screener access and watermark envelope.
- Access audit events.

### Phase 5 — Offers, contracts and delivery

- Offer workflow.
- Seller approval.
- Contract records and e-sign provider adapter.
- Delivery package and acceptance evidence.

### Phase 6 — Revenue and settlement

- Buyer statements.
- Invoice and receipt reconciliation.
- Commission and seller-share formulas.
- Human-approved payout execution.

## Approval gates

Explicit approval is required before:

- running any pending migration;
- connecting new production storage or identity providers;
- importing real seller, buyer, title, contract, media or payment data;
- creating real accounts;
- enabling signed-media delivery in production;
- deploying or publishing;
- enabling payout execution.
