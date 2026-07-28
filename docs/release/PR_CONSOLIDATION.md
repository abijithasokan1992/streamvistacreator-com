# PR Consolidation — Phase 0 / Checkpoint 0

**Scope:** read-only. No PR created, closed, merged, labelled, or commented on.

## Accessibility of the GitHub source of truth

The Founder-facing GitHub repo `abijithasokan1992/streamvistacreator-com` is **not directly reachable from this sandbox**:

| Signal | Result |
|---|---|
| `standard_connectors--list_connections` | No connection with `connector_id: github` exists in the workspace. |
| Unauthenticated `GET https://api.github.com/repos/abijithasokan1992/streamvistacreator-com/pulls?state=open` | HTTP `404 Not Found` (repo is private, or path is different, or requires auth). |
| Git `origin` remote | Points at Lovable's managed git storage (`git.private.lovable-gcp.code.storage`), not at GitHub. |

**Consequence:** authoritative PR-level facts (numbers, base/head, mergeable state, CI status, reviewer sign-off) **cannot be enumerated in Phase 0.** All PR classifications below are inferred from local git branches and Lovable backup branches, and must be re-confirmed on GitHub before Phase 1 acts on them.

## Local branch surface (indirect proxy for PR state)

Branches visible on `origin` that are not `main` or ephemeral edit branches:

| Branch | Interpretation |
|---|---|
| `origin/2-integrate-razorpay-payment-gateway-for-subscriptions-and-payments-streamvista-cloud-x-v2` | Feature branch — Razorpay integration. Almost certainly **already-on-main** given Razorpay is live in the codebase; verify on GitHub. |
| `origin/copilot/84693796128-fix-action-step-error` | GitHub Copilot-generated fix. Age and CI unknown. Classification: **needs review**. |
| `origin/copilot/approve` | GitHub Copilot-generated. Classification: **needs review**. |
| `origin/copilot/main` | Copilot working copy of main. Classification: **stale-do-not-merge** (working copy, not intended for merge). |
| `origin/lovable-backup-main-1781087304` | Lovable-managed backup — **stale-do-not-merge**. |
| `origin/lovable-backup-main-1782231040` | Lovable-managed backup — **stale-do-not-merge**. |
| `origin/lovable-backup-main-1782231117` | Lovable-managed backup — **stale-do-not-merge**. |

Ephemeral `edit/edt-…` branches (23 present) are per-session workspaces, not merge candidates. Classification: **stale-do-not-merge** as a class.

## Preliminary classification (must be re-verified against GitHub)

| Category | Branches |
|---|---|
| retain | (none identifiable without GitHub PR metadata) |
| duplicate | (unknown) |
| stale-do-not-merge | all 3 `lovable-backup-main-*`, `copilot/main`, all 23 `edit/edt-*` |
| already-on-main | probably `2-integrate-razorpay-…-v2` — verify |
| still-required | (unknown — cannot be determined without PR metadata) |
| needs-review | `copilot/84693796128-fix-action-step-error`, `copilot/approve` |

## Recommended action before Phase 1

1. **Authorize the GitHub connector** for `abijithasokan1992/streamvistacreator-com` so PR enumeration and CI status become authoritative.
2. Re-run this document with true PR numbers, base/head SHAs, mergeable state, CI status, and Founder reviewer status.
3. Until (1) and (2) are done, treat every non-`main` branch as **do-not-merge** by default.

## Confirmed / Unconfirmed / Contradicted

- **Confirmed:** the list of remote branches visible on the Lovable-managed origin; the absence of a GitHub connector in this workspace; the 404 from unauthenticated GitHub REST.
- **Unconfirmed:** everything PR-specific (numbers, status, CI, reviewers, mergeable state).
- **Contradicted:** none.
