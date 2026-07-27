# StreamVista Control Stack — Business Architecture

## Purpose

StreamVista Cloud X is a confidential B2B content licensing, rights-management, deal, payment, secure-delivery, revenue, payout, and renewal platform.

It is not a public movie marketplace and it is not an OTT publication system.

## Commercial authority

StreamVista Admin acts as the Master Distributor and Commercial Controller.

Creator and Buyer commercial activity must remain inside permission-controlled, confidential, audit-logged workflows. Direct bypass between Creator and Buyer is not allowed unless explicitly authorised by StreamVista Admin.

## Target lifecycle

Content Owner
→ Create Title
→ Metadata and Assets
→ Rights and Legal Documents
→ Submit
→ Admin Intake
→ Technical QC
→ Rights and Legal Review
→ Approved
→ Ready for Distribution
→ Commercial Profile
→ Rights, Territory, Window and Pricing Validation
→ Confidential Buyer Marketplace
→ Secure Screener
→ Admin-Managed Deal Room
→ Negotiation
→ Agreement and Signing
→ Invoice and Payment
→ License Activation
→ Secure Cloud Delivery
→ Buyer Acceptance
→ Buyer Platform Release Tracking
→ Revenue Reporting
→ Creator Statement
→ Payout
→ Renewal, Amendment, Expiry or Termination

## Core business rules

1. `ready_for_distribution` is the final StreamVista admin distribution-readiness state.
2. Buyer publication must be tracked per deal or release; it must not be represented as one global title state.
3. `featured_films` is editorial/promotional content only and must not be the buyer marketplace source of truth.
4. Marketplace access is restricted to verified buyers and buyer-safe fields.
5. Marketplace eligibility requires verified rights, active territory/window, complete commercial profile, configured licensing model, and explicit visibility.
6. AI/ML rights must never be inferred from general digital rights.
7. Screener and master-delivery access must be buyer-specific, expiring, revocable and logged.
8. Agreement, payment, license, delivery, revenue and payout transitions require server-side enforcement.
9. Revenue and payout amounts must not be freely editable by unauthorised users.
10. Every sensitive commercial action must produce immutable audit evidence.

## Roles

- Founder / Platform Owner
- Super Admin
- Admin
- QC
- Legal
- Finance
- Operations
- Creator / Rights Owner
- Buyer Organisation User
- Support

All roles follow least privilege, default deny, organisation isolation, title ownership and contract entitlement.

## Source of truth

This document and the machine-readable files under `config/control-stack/` define the intended business architecture. Repository implementation evidence always determines current implementation status.