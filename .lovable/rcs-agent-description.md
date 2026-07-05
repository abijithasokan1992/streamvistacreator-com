# StreamVista Cloud X — RCS Business Messaging Agent Registration Reference

> **Internal document.** For RCS Business Messaging registration and future updates only.  
> **Do not expose on the public website or include in the app UI.**

---

## Company

**StreamVista OPC Pvt. Ltd.**  
India

## Product

**StreamVista Cloud X** — a secure cloud platform for the media and entertainment industry.

## Purpose of the RCS Agent

This RCS Business Messaging agent communicates directly with registered StreamVista Cloud X users (Creators, Studios, Buyers, and authorized administrators) to deliver timely, secure, and actionable business notifications.

---

## Supported Use Cases

The agent is used exclusively for legitimate business communications:

| Category | Description |
|----------|-------------|
| **Authentication** | User registration and account verification |
| **Security** | One-time passwords (OTP) and login verification |
| **Onboarding** | Studio and creator onboarding updates |
| **Production** | Production status notifications and alerts |
| **Delivery** | Delivery confirmations and screening invitations |
| **Billing** | Billing and payment reminders |
| **Policy** | Security alerts and policy updates |
| **Support** | Customer support and help-desk communications |
| **System** | Service maintenance and feature announcements |

---

## Message Types

| Type | Purpose |
|------|---------|
| **OTP** | Two-factor authentication and login verification codes |
| **Onboarding** | Welcome messages, setup guides, and next-step reminders |
| **Production Updates** | Shoot schedules, review requests, and delivery status |
| **Storage Alerts** | Quota warnings, upload confirmations, and cleanup notices |
| **Billing** | Invoice due reminders, payment confirmations, and renewal alerts |
| **Editorial** | Review feedback, approval requests, and revision notices |
| **Support** | Ticket updates, resolution confirmations, and escalation notices |

---

## Target Audience

Registered users of the StreamVista Cloud X platform, including:

- Filmmakers and independent creators
- Production companies
- Post-production studios
- Content creators
- Distributors and broadcasters
- Media buyers and content commissioners

---

## Opt-In / Opt-Out Policy

- **Opt-In:** Messages are sent only to users who have registered with StreamVista Cloud X or have explicitly opted in to receive communications.
- **Business Communications Only:** The service is intended strictly for transactional and operational business communications.
- **Opt-Out:** Users can opt out of promotional communications at any time. Transactional messages (OTP, billing, security alerts) may still be required for account operation.

---

## Compliance Notes

- All messaging complies with applicable telecom and privacy regulations (TRAI, GDPR where applicable).
- User consent is obtained at registration and managed through account settings.
- Message content is limited to platform-related business matters; no unsolicited marketing or third-party advertising.
- Opt-out requests are honored within 24 hours and reflected in the user communication preferences store.
- Audit logs of consent and message history are maintained per platform policy.

---

## Test Phone Numbers

> Placeholder — replace with actual test numbers before submission.

| Environment | Number | Country | Notes |
|-------------|--------|---------|-------|
| Staging | `+91-XXXXXXXXXX` | India | Internal QA only |
| UAT | `+91-XXXXXXXXXX` | India | Partner validation |

**Action required:** Populate real test numbers and verify with carrier / Google RCS tester before go-live.

---

## Future Maintenance Notes

- Review and update this document before every RCS registration renewal or carrier onboarding.
- When adding new message types, update both the **Supported Use Cases** and **Message Types** tables above.
- If the company legal name or product name changes, update the **Company** and **Product** sections and re-submit to the RCS registry.
- Keep test phone numbers current and valid; expired numbers can cause registration rejection.
- Maintain an internal changelog of edits to this file for audit purposes.

---

## Operator

The platform is owned and operated by **StreamVista OPC Pvt. Ltd.**, India.
