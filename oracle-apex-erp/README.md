# College ERP on Oracle Cloud Infrastructure (OCI) & Oracle APEX
### Complete Deployment & Implementation Roadmap

This folder contains the complete, enterprise-grade relational database schema, PL/SQL security policies, Oracle REST Data Services (ORDS) REST APIs configurations, and mock testing dataset scripts to construct a multi-tenant SaaS College Enterprise Resource Planning (ERP) platform on OCI and Oracle APEX.

---

## Architecture Overview

```
                        +---------------------------------------------+
                        |           Oracle APEX UI Platform           |
                        | (Interactive Reports, Forms, Cards, Charts) |
                        +---------------------------------------------+
                                               |
                                               v
+------------------------+      +------------------------------+      +------------------------+
|    OCI IAM Identity    | <---> |   Custom DB Authentication   | <---> |     Row-Level VPD      |
|    APEX User Sync      |      |     (fn_apex_authenticate)   |      |   Security isolation   |
+------------------------+      +------------------------------+      +------------------------+
                                               |
                                               v
                        +---------------------------------------------+
                        |      Oracle Autonomous Database (ATP)       |
                        |          Oracle REST Data Services          |
                        +---------------------------------------------+
                          |                   |                     |
                          v                   v                     v
                +------------------+ +-----------------+ +-------------------+
                | OCI Object Store | |    Razorpay     | |    OpenAI API     |
                | (Photos & Docs)  | | (Tuition Dues)  | | (Chatbot Assistants)
                +------------------+ +-----------------+ +-------------------+
```

---

## Module Roadmap Checklist

- [x] **Phase 1: OCI Setup** (Sign in to OCI, launch Autonomous Database (ATP), provision APEX Workspace and developer accounts).
- [x] **Phase 2: Personnel & Role Plan** (Definition of 9 core personnel personas: Super Admin, College Admin, Admission Officer, Faculty, Student, Parent, Accountant, Librarian, Placement Officer).
- [x] **Phase 3: Relational DB Schema** (Creation of 22 standard tables with constraints, referential indexes, auto-increment keys, and inventory-trigger structures. Ref: [schema.sql](./schema.sql)).
- [x] **Phase 4: APEX Interfaces** (Login forms, dynamic landing grids, Cards directories, and calendars).
- [x] **Phase 5: Tenancy Security & Isolation** (VPD security predicates, APEX authorization contexts, and login hooks. Ref: [security_policies.sql](./security_policies.sql)).
- [x] **Phase 6: Object Storage Uploads** (Linking document records directly with OCI storage buckets. Ref: `documents` table).
- [x] **Phase 7: REST API Endpoints** (Production ORDS PL/SQL endpoint mappings. Ref: [ords_apis.sql](./ords_apis.sql)).
- [x] **Phase 8: Integrations Routing** (Razorpay webhooks schema, email/SMS notify triggers, and search hooks).
- [x] **Phase 9: AI Capabilities Architecture** (OpenAI prompt structures for admissions bot and FAQs summaries).
- [x] **Phase 10: Testing Sandbox Seed** (Sample mock dataset populating all 22 relational entities. Ref: [seed_data.sql](./seed_data.sql)).
- [x] **Phase 11: Production Deployment** (Monitoring, backups, custom domains, and auto-scaling setups).

---

## File Contents & Deployment Order

### Step 1: Schema Setup
Run **[`schema.sql`](./schema.sql)** inside your Oracle Autonomous Database (ATP) SQL Workshop:
* Creates 22 relational tables modeling departments, course schedules, exams, financial dues ledger items, transit channels, library catalogues, and notification logs.
* Sets up automated PL/SQL database triggers to recalculate grade scores and keep book stocks up to date.

### Step 2: Multi-Tenancy & Authorization
Run **[`security_policies.sql`](./security_policies.sql)** to configure security:
* Creates session management packages (`pkg_erp_session`) to host tenant indicators in database contexts.
* Deploys Oracle Virtual Private Database (VPD) policies that restrict SELECT/INSERT/UPDATE queries based on the college tenancy.
* Configures custom APEX authentication schema and role entitlement authorization schemes.

### Step 3: REST API Gateway
Run **[`ords_apis.sql`](./ords_apis.sql)** to deploy REST API endpoints:
* Exposes Secure REST APIs for `students/`, `admissions/`, `fees/`, `attendance/`, `results/`, and `notifications/`.
* Allows seamless payment capture webhook relays (such as Razorpay callbacks) and background automated integrations.

### Step 4: Sandbox Seed Testing
Run **[`seed_data.sql`](./seed_data.sql)** to load seed data:
* Populates mock college structures, course curricula, user profiles, class timetables, grading lists, and billing ledgers.
* Instantly hydrates dashboards inside Oracle APEX to simplify UI/UX feedback.

---

## Advanced Integration Blueprint

### OCI Object Storage Integration
APEX components can upload student photos and assignments directly to OCI Object Storage:
1. Generate an **OCI IAM Web Credential** in APEX Workspace Utilities.
2. Store documents under `documents` table utilizing the `oci_object_name` path.
3. Access files securely within APEX forms using `APEX_WEB_SERVICE.make_rest_request` or direct Pre-Authenticated Requests (PAR) URLs.

### Razorpay Integration
Secure tuition collections are wired using REST APIs:
1. In APEX, trigger Razorpay Order creation using a server-side process calling `APEX_WEB_SERVICE`.
2. Upon user payment success, Razorpay hits our ORDS `/erp/fees/pending/` endpoint with a payment POST trigger.
3. A PL/SQL handler processes the signature check and registers a record inside `fee_payments` table.

### OpenAI AI Assistant Integration
1. Configure an APEX dynamic action targeting user input boxes.
2. Issue a REST POST to `https://api.openai.com/v1/chat/completions` using APEX credentials.
3. Display generated FAQ answers, summaries of notices, or student performance reports instantly in the UI.
