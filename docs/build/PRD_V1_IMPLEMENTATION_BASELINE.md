# StreamVista PRD v1.0 — Implementation Baseline

**Source master:** `StreamVista_Filmhub_Inspired_End_to_End_PRD_v1.0.docx`  
**Reference render:** `StreamVista_Filmhub_Inspired_End_to_End_PRD_v1.0.pdf`  
**Owner:** Abijith Asokan / STREAMVISTA (OPC) PRIVATE LIMITED  
**Baseline date:** 5 August 2026

This repository branch treats the supplied 16-page PRD as the build baseline. Source-confirmed Filmhub facts remain separated from proposed StreamVista implementation and owner-controlled commercial/legal rules.

## Product boundaries

- **StreamVista Creator Cloud:** onboarding, metadata, assets, documents, QC, transcoding, packaging and delivery readiness.
- **Crayons Bridge:** marketplace, buyer access, screener, deal room, agreements and licensing.
- **Crayons Loop:** FAST, AVOD and low-cost SVOD playback, telemetry and watch-time attribution.
- **StreamVista Admin OS:** catalogue, legal/QC, buyer access, deal operations, delivery, finance, payout and audit authority.

## Frontend build sequence

1. Creator shell and catalogue dashboard
2. Title submission and readiness view
3. Rights and availability workspace
4. Asset ingest, QC and delivery tracking
5. Buyer marketplace and screener workflow
6. Deal room and agreement lifecycle
7. Revenue, statements, recoupment and payout status
8. Admin work queues and evidence/audit views
9. Crayons Loop publish and playback analytics surfaces

## First simple frontend release

The first implementation slice must reuse existing routes, components, tables, RPCs and policies. It contains:

- Catalogue list with real title data
- Add/edit/resume title actions
- Per-title readiness summary: metadata, rights, assets, legal, QC, commercial and marketplace
- Clear loading, empty, error and permission states
- Mobile-responsive Creator Portal shell
- Classic dashboard fallback retained

## Non-negotiable rules

- No duplicate backend, marketplace, messaging, rights, revenue or delivery systems.
- No production delete, route removal or feature deferral without explicit owner approval.
- No guaranteed distribution, buyer response, revenue, MG, release or payout claims.
- Rights, legal, commercial acceptance, publishing and payout remain human approval controlled.
- Financial charts are projections of immutable ledger entries, not editable totals.
- Every production pass requires UI, database/storage, audit and negative-access evidence.

## PRD-to-module mapping

| PRD section | Repository workstream |
|---|---|
| 5.1 | Identity, organizations, verification and role gates |
| 5.2 | Catalogue and metadata |
| 5.3 | Rights and availability |
| 5.4–5.5 | Ingest, storage, QC, transcoding and packaging |
| 5.6–5.9 | Marketplace, screener, deals, agreements and licences |
| 5.10 | Delivery and release tracking |
| 5.11 | Crayons Loop |
| 5.12 | Revenue, statements and payouts |
| 5.13–5.14 | Notifications, queues, audit and compliance |
| 6 | State machines and blocking rules |
| 7–10 | Database, API, storage, services and workflow engine |
| 11 | MCP and agent approval boundaries |
| 13–14 | Security, approvals and deployment |

## Current branch

`build/prd-v1-frontend-foundation`

Production `main` remains untouched until the frontend slice passes build, tests and authenticated runtime verification.
