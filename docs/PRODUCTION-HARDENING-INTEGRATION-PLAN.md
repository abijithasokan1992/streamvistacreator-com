# StreamVista Production Hardening & Integration Plan

## Source of truth

Repository: `abijithasokan1992/streamvistacreator-com`

This repository remains the production application. Lovable, Antigravity and Codex should contribute through GitHub branches and pull requests rather than creating replacement applications.

## Operating rule

Do not add a new service unless it closes a verified gap. For every capability use the following classification:

- GREEN — implemented and verified: preserve
- YELLOW — implemented but incomplete or unreliable: modify
- RED — missing and commercially necessary: build/connect
- BLACK — duplicate or obsolete: remove
- BLUE — repetitive workflow suitable for automation: automate

## Phase 1 — Validate immediately

- Signup and login
- Creator onboarding
- Content upload and resumable upload
- Rights verification
- QC workflow
- Buyer search
- Licensing requests
- Watermarked screener
- Razorpay payment and webhook flow
- Transaction and billing records
- Email notifications and queues
- Admin approval
- Audit logs
- Role-based access and RLS
- Production deployment and rollback

No growth feature is released until these workflows pass end-to-end tests.

## Phase 2 — Improve

- Mobile UX and accessibility
- Loading speed and bundle size
- Search relevance and filtering
- Creator, buyer and admin dashboards
- Reports and exports
- Notification reliability
- Error states and recovery paths

## Phase 3 — Automate

- AI metadata generation
- AI QC assistance
- Email queue and assisted replies
- Invoice and GST document generation
- Contract preparation workflows
- Royalty calculations
- Scheduled reminders and background jobs
- Error monitoring and incident alerts

## Phase 4 — Grow

- GA4 and Search Console
- Microsoft Clarity
- Mixpanel or PostHog — select one primary product analytics system
- SEO and conversion tracking
- HubSpot CRM
- Brevo campaigns and transactional mail
- Referral and partner workflows
- Partner portal
- Investor reporting only after operational data is reliable

## Integration architecture

### Existing core

- Lovable
- GitHub
- React, TypeScript, Vite
- Tailwind and shadcn/Radix UI
- Supabase Auth, PostgreSQL, Storage, Edge Functions and RLS
- Razorpay functions and payment webhooks
- MCP tool layer
- Vercel deployment target

### Connect only after verification

- Antigravity through the same GitHub repository
- OpenAI, Claude and Gemini through server-side Edge Functions
- Perplexity only for external research use cases
- Firebase Crashlytics/Test Lab only for native mobile builds
- GA4 plus Clarity for web analytics
- Mixpanel only when event taxonomy is approved
- AppsFlyer only when paid mobile acquisition begins
- OneSignal for push notification orchestration
- Brevo for email delivery and campaigns
- HubSpot for CRM and deal pipeline
- n8n for approved cross-system automations

## Security rules

- No secret keys in React or committed files
- Browser receives only publishable/public identifiers
- Private credentials stay in Supabase secrets, Vercel environment variables or GitHub Actions secrets
- Payment and AI provider calls must pass through server-side functions
- Webhooks require signature verification and idempotency
- Production and staging must use separate credentials

## Immediate acceptance gates

1. Production build, lint and tests pass.
2. Signup/login works for each supported role.
3. Creator can submit one title without admin intervention.
4. Admin can review rights, QC and content assets.
5. Buyer can search, request and view an authorized watermarked screener.
6. Razorpay test payment creates exactly one verified transaction.
7. Email and in-app notification status is recorded.
8. RLS prevents cross-user and cross-workspace access.
9. Failed workflows produce readable errors and audit records.
10. Deployment can be rolled back safely.

## Duplication controls

- One production repository
- One authoritative Supabase project per application/environment
- One primary analytics event specification
- One CRM source of truth
- One notification orchestration layer
- Separate database and webhook boundaries for Bridge, Creator Cloud and Loop where business isolation is required
