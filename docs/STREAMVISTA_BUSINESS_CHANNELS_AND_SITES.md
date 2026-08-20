# StreamVista Business Channels & Sites Architecture

## Purpose

Create one continuous business operating network that discovers demand, converts opportunities, closes commercial deals, collects payment, delivers content, and measures revenue without fragmenting data across channels.

## Core websites and site surfaces

### 1. Public corporate site

Primary use:
- Search discovery
- Company credibility
- Service discovery
- Lead capture
- Buyer and producer entry points

Required routes:
- `/buyers`
- `/producers`
- `/film-licensing`
- `/distribution`
- `/syndication`
- `/ai-data-licensing`
- `/rights-audit`
- `/qc-delivery`
- `/submit-title`
- `/request-catalogue`
- `/request-quote`
- `/contact`

### 2. Crayons Bridge marketplace

Primary use:
- Rights-ready film catalogue
- Verified buyer discovery
- Buyer requirement intake
- Watermarked screener requests
- Offer and negotiation workflow

### 3. Creator portal

Primary use:
- Film onboarding
- Metadata and asset upload
- Rights declarations
- Legal documents
- QC status
- Deal and delivery tracking
- Revenue and payout visibility

### 4. Buyer portal

Primary use:
- Requirement submission
- Catalogue search
- Rights and territory filters
- Screener request
- Offer submission
- Deal room
- Agreement, payment, delivery, acceptance

### 5. Admin / Founder control centre

Primary use:
- Lead and opportunity review
- Rights and legal approval
- Commercial offer approval
- Communication approval
- Payment and release gate
- Revenue and profit monitoring
- Agent activity and audit logs

## Connected business systems

- GitHub: source control, CI, PR, release evidence
- Close: lead, contact, opportunity and sales pipeline
- Gmail: existing relationship threads and sales communication
- Hostinger Mail: official company email identity
- Twilio: approved WhatsApp, SMS and call follow-up
- Linear: rights audit, delivery, legal and operational tasks
- Razorpay: quotations, payment links, payment status and collection evidence
- Google Drive / Documents / PDF: editable proposals, legal drafts and approved external packs
- Spreadsheets: synchronized control register and fallback operations surface
- Data Analytics: conversion, revenue, profit, title performance and agent performance
- StreamVista database: authoritative film, rights, deal, delivery and revenue records

## Continuous business flow

```text
Market / platform / agent community discovery
→ verified buyer or partner
→ Close lead and opportunity
→ requirement intake
→ film or service matching
→ rights and legal audit
→ revenue score and pricing
→ owner-approved communication
→ proposal / PDF / deal room
→ negotiation
→ agreement approval
→ Razorpay payment gate
→ secure delivery
→ buyer acceptance
→ revenue reconciliation
→ profit analytics
→ renewal / repeat sale
```

## Site-to-agent event model

Every website form or portal action must create a structured event:

- `buyer_requirement_created`
- `producer_submission_created`
- `screener_requested`
- `commercial_offer_requested`
- `rights_audit_required`
- `owner_approval_required`
- `payment_link_created`
- `payment_confirmed`
- `delivery_released`
- `revenue_reconciled`

Each event must include:

- canonical organisation ID
- contact ID
- opportunity ID
- title or service ID
- territory
- rights type
- language
- commercial value
- next action
- owner
- due date
- source channel
- audit timestamp

## Frontend scope

A full public redesign is not a prerequisite for revenue operations.

Priority frontend surfaces:

1. Buyer requirement form
2. Producer / catalogue intake form
3. Internal opportunity queue
4. Rights and legal approval panel
5. Commercial offer approval panel
6. Payment and delivery gate panel
7. Revenue and profit dashboard

## Visualize layer

The visual operating dashboard must show:

- live opportunity funnel
- demand by country, language, rights type and platform
- film-to-buyer matches
- rights-clear vs blocked titles
- expected revenue vs collected cash
- payment pending and overdue deals
- delivery status
- revenue by title, buyer, territory and agent channel
- agent activity, success rate and blocked actions

## Mandatory controls

Agents may:
- discover
- qualify
- match
- draft
- score
- follow up within approved rules
- update status

Agents may not independently:
- grant rights
- approve exclusivity
- reduce price below approved floor
- sign contracts
- issue refunds
- release clean masters
- approve payouts
- make investor commitments

## Source-of-truth rules

- StreamVista DB: film, rights, deals, delivery and revenue
- Close: sales pipeline
- Linear: execution and blockers
- Gmail / Hostinger / Twilio: communication evidence
- Razorpay: payment evidence
- Documents / PDF: approved commercial and legal records
- Analytics: derived intelligence
- Spreadsheets: synchronized operational view, not primary authority

## Definition of done

This architecture is complete only when:

- all priority site forms create canonical opportunity records
- communications remain linked to the opportunity
- rights and legal checks fail closed
- owner approvals are auditable
- payment confirmation controls clean-master release
- delivery acceptance is recorded
- revenue and profit reconcile to evidence
- automated tests pass
- runtime health checks pass
- rollback and recovery procedures exist
