
-- 1) Admin-visible flag: v1 drafts are usable but should be reviewed by counsel.
ALTER TABLE public.legal_agreements
  ADD COLUMN IF NOT EXISTS requires_legal_review boolean NOT NULL DEFAULT true;

-- 2) Replace v1 bodies with substantive draft wording.

UPDATE public.legal_agreements SET
  title = 'StreamVista Creator / Rights Holder Master Agreement',
  summary = 'Master terms governing creators and rights holders who upload content to StreamVista.',
  requires_legal_review = true,
  body =
$$DRAFT v1 — Operationally usable but pending review by qualified legal counsel before commercial launch. Not legal advice.

This Creator / Rights Holder Master Agreement ("Agreement") is entered into between StreamVista OPC Pvt Ltd ("StreamVista", "we", "us") and the individual or entity accepting these terms ("Creator", "you") and governs your use of streamvistacreator.com and related services ("Platform").

1. ELIGIBILITY AND AUTHORITY
1.1 You represent that you are at least 18 years old and have full legal capacity to enter into this Agreement.
1.2 If you are accepting on behalf of a company, studio, or other entity, you represent that you have authority to bind that entity, and "you" refers to that entity.
1.3 You represent and warrant that you are either the sole rights holder of all content you upload, or are duly authorised in writing by every rights holder to upload, store, and make such content available on the Platform.

2. GRANT OF RIGHTS TO STREAMVISTA
2.1 You grant StreamVista a worldwide, non-exclusive, royalty-free, sublicensable (to subprocessors only), and revocable licence to host, store, transcode, encrypt, transmit, cache, back up, and display your content solely as necessary to operate the Platform and deliver the services you have requested.
2.2 You grant StreamVista the right to display title metadata (name, synopsis, cover art, runtime, language, format) to admins, to buyers you authorise (directly or through the admin-managed workflow), and to subprocessors strictly for Platform operations.
2.3 No transfer of ownership. You retain all right, title and interest in and to your content. Nothing in this Agreement transfers copyright or any other intellectual property right to StreamVista.

3. ADMIN-MANAGED COMMERCIAL WORKFLOW (FREE TIER DEFAULT)
3.1 By default, every title is created in admin-managed mode. While a title is admin-managed, StreamVista may receive, triage, decline, or escalate commercial enquiries (acquisition, licensing, distribution, screener access, rights information) relating to that title.
3.2 StreamVista will not enter into any binding commercial agreement on your behalf without your express, written approval recorded through the Platform.
3.3 You may, on eligible paid tiers, switch a title to creator-managed or hybrid mode at any time, subject to acceptance of any additional terms presented at that time.

4. CONTENT STANDARDS AND COMPLIANCE
4.1 You will not upload content that (a) infringes any third-party intellectual property, publicity, or privacy right; (b) is unlawful, defamatory, obscene, or sexually exploitative of minors; (c) violates applicable export, sanctions, or data-protection laws; or (d) contains malware.
4.2 You will obtain and retain all required clearances, releases, and synchronisation/performance licences for music, talent, locations, and third-party footage embedded in your content.
4.3 You will comply with applicable certification and classification rules in any territory in which you authorise the content to be made available.

5. PROTECTION TIERS
5.1 Free tier titles receive baseline protection only: signed URLs, expiring access links, admin-controlled buyer access, and basic view restrictions.
5.2 Enhanced protection features (forensic watermarking, advanced takedown monitoring, encrypted screening rooms) are available as a paid add-on subject to the Anti-Piracy & Enhanced Protection Addendum.
5.3 StreamVista does not warrant immunity from piracy and is not liable for unauthorised reproduction or distribution of your content by third parties beyond the protection tier you have purchased.

6. CONFIDENTIALITY
6.1 Each party will treat the other's non-public information as confidential and use it only to perform this Agreement.
6.2 StreamVista may disclose your information to its subprocessors and to law enforcement or regulators where legally compelled.

7. DATA AND SECURITY
7.1 StreamVista applies industry-standard administrative, technical, and physical safeguards to your content and account data.
7.2 You are responsible for protecting your account credentials and for activity performed under your account.

8. FEES, STORAGE, AND OVERAGES
8.1 Free tier limits (storage, bandwidth, title count, lifecycle submissions) are published in the Platform and may change with reasonable notice.
8.2 Overages, paid plans, and add-ons are billed per the active price list at the time of purchase.
8.3 All fees are exclusive of taxes; you are responsible for applicable taxes other than taxes on StreamVista's net income.

9. SUSPENSION AND TERMINATION
9.1 StreamVista may suspend or terminate your account or remove specific content, with or without notice where reasonably necessary, for (a) material breach of this Agreement, (b) suspected illegal activity, (c) a credible third-party rights complaint, or (d) non-payment of fees.
9.2 You may terminate by closing your account; export functionality may be limited to your active plan's capabilities.
9.3 Sections that by their nature should survive (warranties, indemnity, liability, confidentiality, governing law) survive termination.

10. WARRANTIES AND DISCLAIMERS
10.1 You warrant your content does not infringe third-party rights and that all representations in Section 1 and 4 are accurate.
10.2 EXCEPT AS EXPRESSLY STATED, THE PLATFORM IS PROVIDED "AS IS" AND STREAMVISTA DISCLAIMS ALL IMPLIED WARRANTIES TO THE MAXIMUM EXTENT PERMITTED BY LAW.

11. INDEMNITY
11.1 You will defend, indemnify, and hold harmless StreamVista, its officers, employees, and subprocessors from any third-party claim arising out of (a) your content, (b) your breach of this Agreement, or (c) your violation of applicable law.

12. LIMITATION OF LIABILITY
12.1 Neither party will be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, revenue, or data.
12.2 Each party's aggregate liability under this Agreement will not exceed the fees you have paid StreamVista in the twelve (12) months preceding the event giving rise to the claim, or INR 10,000, whichever is greater. Free tier maximum aggregate liability is capped at INR 10,000.

13. CHANGES
13.1 StreamVista may publish updated versions of this Agreement. Continued use after a new version is published and you are notified constitutes acceptance; material changes will require re-acceptance through the in-app acceptance flow.

14. GOVERNING LAW AND DISPUTES
14.1 This Agreement is governed by the laws of the Republic of India.
14.2 Subject to mandatory consumer-protection law, the courts at Kerala, India have exclusive jurisdiction over disputes.

15. MISCELLANEOUS
15.1 This Agreement, together with any add-on terms you accept, is the entire agreement between the parties on its subject.
15.2 If any provision is held unenforceable, the remainder remains in effect.
15.3 You may not assign this Agreement without StreamVista's prior written consent; StreamVista may assign it to an affiliate or successor in connection with a corporate transaction.

By clicking "Accept & continue" you confirm you have read, understood, and agree to be bound by this Agreement.$$
WHERE agreement_type = 'creator_master' AND version = 1;

UPDATE public.legal_agreements SET
  title = 'StreamVista Buyer Request & Confidentiality Terms',
  summary = 'Required terms for buyers, distributors, and acquirers before submitting any commercial request on StreamVista.',
  requires_legal_review = true,
  body =
$$DRAFT v1 — Operationally usable but pending review by qualified legal counsel before commercial launch. Not legal advice.

These Buyer Request & Confidentiality Terms ("Buyer Terms") govern your submission of any acquisition, licensing, distribution, screener, or rights-information request through streamvistacreator.com operated by StreamVista OPC Pvt Ltd ("StreamVista").

1. WHO YOU ARE
1.1 You represent that you are submitting requests in a bona-fide commercial capacity, on your own behalf or on behalf of an entity you are authorised to bind.
1.2 You represent that the information you provide (identity, organisation, contact, intended use) is accurate and will be kept current.

2. ADMIN-BROKERED WORKFLOW
2.1 You acknowledge that requests against titles on the Free tier are reviewed and brokered by StreamVista. You will not bypass the Platform to contact creators or rights holders directly using contact details obtained through StreamVista.
2.2 StreamVista may decline, defer, or escalate any request at its discretion.

3. CONFIDENTIALITY
3.1 "Confidential Information" includes, without limitation, title metadata, screeners, synopses, financial terms, deal-room communications, creator identities, and any non-public material disclosed to you in connection with a request.
3.2 You will (a) use Confidential Information solely to evaluate a potential commercial relationship; (b) protect it with at least the same degree of care you use for your own confidential information of similar sensitivity, and in any event no less than reasonable care; (c) restrict access to employees and advisors with a need to know who are bound by confidentiality obligations no less protective than these Buyer Terms.
3.3 Exclusions: information that is (a) public other than by your breach, (b) lawfully known by you without confidentiality obligations before disclosure, (c) lawfully received from a third party without confidentiality obligations, or (d) independently developed without reference to disclosed information.

4. NO RECORDING; NO REDISTRIBUTION
4.1 You will not record, screen-capture, re-encode, copy, transmit, post, or otherwise redistribute any screener, asset, or material accessed through StreamVista, except as expressly permitted by an executed written agreement.
4.2 You will not attempt to remove, alter, or obscure watermarks (visible or forensic) or other technical protection measures.

5. AUDIT, LOGGING, AND ENFORCEMENT
5.1 StreamVista logs request, screener, and asset access. You consent to such logging.
5.2 Suspected breach may result in immediate suspension of your access, forensic investigation, and pursuit of legal remedies including injunctive relief and damages.

6. NO OBLIGATION TO TRANSACT
6.1 Submitting a request does not create any binding offer or obligation. No commercial relationship is formed unless and until both parties execute a separate written agreement.

7. GOOD FAITH AND COMPLIANCE
7.1 You will submit requests in good faith and will comply with all applicable export, sanctions, and anti-bribery laws.

8. TERM AND SURVIVAL
8.1 Confidentiality obligations survive for three (3) years from each disclosure or, for trade secrets, for as long as they remain trade secrets under applicable law.
8.2 You may withdraw a pending request at any time; obligations regarding information already received survive.

9. LIABILITY
9.1 Neither party will be liable for indirect, incidental, special, or consequential damages.
9.2 Your aggregate liability for direct damages arising out of a breach is not limited where the breach involves wilful disclosure or redistribution of screeners or confidential commercial terms.

10. GOVERNING LAW
10.1 These Buyer Terms are governed by the laws of the Republic of India. Courts at Kerala, India have exclusive jurisdiction.

By clicking "Accept & continue" you agree to be bound by these Buyer Terms for every commercial request you submit under your account until a superseding version is published.$$
WHERE agreement_type = 'buyer_request_confidentiality' AND version = 1;

UPDATE public.legal_agreements SET
  title = 'StreamVista Free Tier Commercial Workflow Terms',
  summary = 'How commercial workflows are processed while a creator title remains on the Free tier.',
  requires_legal_review = true,
  body =
$$DRAFT v1 — Operationally usable but pending review by qualified legal counsel before commercial launch. Not legal advice.

These Free Tier Commercial Workflow Terms ("Free Tier Terms") apply to all titles operated under the StreamVista Free tier and supplement the Creator / Rights Holder Master Agreement.

1. ADMIN-MANAGED BY DEFAULT
1.1 Every Free tier title is created in admin-managed mode. Acquisition, licensing, distribution, and screener controls are disabled at the title level until explicitly enabled by a StreamVista administrator following the workflow below.
1.2 StreamVista will not unilaterally open commercial channels on a Free tier title without first notifying you through the Platform and, where required by the title's configuration, obtaining your final approval.

2. REQUEST INTAKE AND TRIAGE
2.1 Buyer requests against your title are received in a moderated queue. StreamVista will review each request for plausibility, completeness, and good-faith intent before forwarding it to you.
2.2 StreamVista may decline or close requests that do not meet basic intake criteria without consulting you.

3. CREATOR REVIEW AND APPROVAL
3.1 Where a request passes triage, you will be invited to review it inside the Platform. You may (a) request more information, (b) reject, or (c) approve the request for further negotiation.
3.2 No binding commercial commitment is created by request approval. Final terms must be captured in an executed written agreement.

4. NO DIRECT NEGOTIATION OUTSIDE THE PLATFORM
4.1 While a title is on the Free tier, you agree to handle commercial discussions for buyers introduced to you through StreamVista within the Platform's workflow. You will not solicit, encourage, or accept off-Platform negotiation with such buyers without notifying StreamVista in writing.
4.2 This restriction does not apply to pre-existing relationships you can document as having predated the introduction.

5. PROTECTION POSTURE
5.1 Free tier titles receive baseline protection. Enhanced protection (forensic watermarking, secure screening rooms, takedown monitoring) is available as a paid add-on.
5.2 You acknowledge that the protection posture available to a Free tier title may not be appropriate for high-value, theatrical, or first-window screener distribution and that you should upgrade prior to such use.

6. UPGRADE PATH
6.1 At any time you may upgrade to a paid tier to enable creator-managed or hybrid deal modes, self-serve commercial controls, and enhanced protection. The terms applicable at the time of upgrade will be presented for acceptance.

7. NO GUARANTEE OF OUTCOMES
7.1 StreamVista does not guarantee any particular volume of requests, deals, revenue, or commercial outcome on the Free tier. The admin-managed workflow is provided on a reasonable-efforts basis.

8. CHANGES
8.1 StreamVista may update these Free Tier Terms. Material changes will require re-acceptance through the in-app acceptance flow.

By clicking "Accept & continue" you agree to operate Free tier titles under this admin-managed workflow until you upgrade or until a superseding version is published.$$
WHERE agreement_type = 'free_tier_commercial' AND version = 1;

UPDATE public.legal_agreements SET
  title = 'StreamVista Screener / Asset Access Terms',
  summary = 'Terms governing access to screeners and protected assets distributed through the Platform.',
  requires_legal_review = true,
  body =
$$DRAFT v1 — Operationally usable but pending review by qualified legal counsel before commercial launch. Not legal advice.

These Screener / Asset Access Terms ("Screener Terms") govern any access granted to you, through StreamVista, to a screener, secure stream, download link, or other protected asset ("Protected Asset").

1. AUTHORISED PURPOSE
1.1 Access is granted to you personally, for the sole purpose of bona-fide commercial evaluation, in the capacity disclosed at the time of access.
1.2 You will not use a Protected Asset for any other purpose, including public exhibition, marketing, training of machine-learning models, or onward distribution.

2. NO COPYING; NO RE-TRANSMISSION
2.1 You will not download (unless download is expressly enabled for the specific link), record, screen-capture, re-encode, or otherwise copy any Protected Asset in whole or in part.
2.2 You will not share, forward, post, broadcast, or make available the Protected Asset to any third party, including within your own organisation outside the named recipients explicitly authorised through the Platform.

3. WATERMARKING AND TECHNICAL PROTECTION
3.1 Protected Assets may carry visible and/or forensic watermarks identifying the recipient. You consent to such watermarking.
3.2 You will not remove, alter, obscure, or attempt to defeat any watermark, encryption, DRM, or other technical protection measure.

4. EXPIRY AND REVOCATION
4.1 Access expires per the configuration of the specific link (time-limited and/or view-limited). Continued access after expiry is unauthorised.
4.2 StreamVista or the rights holder may revoke access at any time without notice.

5. LOGGING AND AUDIT
5.1 You acknowledge that StreamVista logs access events (timestamps, IP address, user agent, view duration) and may use these logs for security, abuse detection, and dispute resolution.
5.2 You consent to such logging and to forensic investigation in the event of suspected leakage.

6. RESPONSIBILITY FOR DEVICE AND ENVIRONMENT
6.1 You are responsible for the security of the device, network, and physical environment in which you view a Protected Asset.
6.2 You will not view a Protected Asset on a shared, public, or unsecured device.

7. CONFIDENTIALITY
7.1 All non-public information about the Protected Asset (its existence, content, metadata, and any associated commercial terms) is confidential under the Buyer Request & Confidentiality Terms or any other confidentiality agreement you have accepted.

8. REMEDIES
8.1 You acknowledge that breach of these Screener Terms may cause irreparable harm and entitle the rights holder and StreamVista to injunctive relief in addition to damages.

9. GOVERNING LAW
9.1 These Screener Terms are governed by the laws of the Republic of India. Courts at Kerala, India have exclusive jurisdiction.

By clicking "Accept & continue" you agree to these Screener Terms for every Protected Asset to which you are granted access until a superseding version is published.$$
WHERE agreement_type = 'screener_access' AND version = 1;

UPDATE public.legal_agreements SET
  title = 'StreamVista Anti-Piracy & Enhanced Protection Addendum',
  summary = 'Optional paid add-on terms for enhanced anti-piracy and forensic protection services.',
  requires_legal_review = true,
  body =
$$DRAFT v1 — Operationally usable but pending review by qualified legal counsel before commercial launch. Not legal advice.

This Anti-Piracy & Enhanced Protection Addendum ("Addendum") applies only where you have purchased an enhanced protection add-on for one or more titles ("Opted-In Titles") and supplements the Creator / Rights Holder Master Agreement.

1. SCOPE OF ENHANCED PROTECTION
1.1 For Opted-In Titles, StreamVista will apply the protection features described in the active add-on, which may include: (a) forensic per-recipient watermarking on screeners and downloads; (b) encrypted screening rooms with device-level controls; (c) link-level access controls and rotating tokens; (d) automated leak monitoring against a defined source set; and (e) takedown notice preparation and submission.
1.2 The specific features included depend on the add-on tier purchased and may evolve over time. StreamVista will provide reasonable notice of material changes.

2. NO GUARANTEE OF IMMUNITY
2.1 Enhanced protection materially reduces, but does not eliminate, piracy risk. StreamVista provides protection on a commercially reasonable best-efforts basis and does not guarantee that any title will not be pirated, leaked, or unlawfully redistributed.
2.2 You acknowledge that no security or watermarking technology is infallible and that the effectiveness of protection depends in part on recipient behaviour and the broader threat landscape.

3. TAKEDOWN AND ENFORCEMENT
3.1 Where leak monitoring identifies a candidate infringing copy, StreamVista will (a) preserve evidence, (b) attempt to identify the leak source through forensic watermark extraction where available, and (c) prepare and submit takedown notices to the relevant intermediaries on a best-efforts basis.
3.2 Legal action against identified infringers, including litigation, remains your responsibility and is not included in this Addendum unless expressly stated in the add-on description.

4. FEES AND BILLING
4.1 Enhanced protection fees are billed per the active price list, on the cadence specified at purchase. Fees are non-refundable except where required by law.
4.2 Non-payment will downgrade the title to baseline protection upon the grace period stated in the price list; leak-monitoring data already collected will be retained per the platform retention policy.

5. CREATOR OBLIGATIONS
5.1 You will not knowingly defeat or instruct any third party to defeat watermarks or protection measures.
5.2 You will provide accurate recipient identification when configuring screening rooms and watermark targets.

6. DATA AND LOGS
6.1 StreamVista may retain protection-related logs (access events, watermark assignments, monitoring hits) for the duration of the add-on plus a reasonable archival period for dispute resolution.

7. LIABILITY
7.1 StreamVista's aggregate liability arising out of this Addendum is capped at the protection fees paid in the twelve (12) months preceding the event giving rise to the claim.
7.2 StreamVista is not liable for damages caused by recipient breach, third-party platform takedown delays, or events outside its reasonable control.

8. TERMINATION
8.1 Either party may terminate this Addendum on thirty (30) days' written notice. Baseline protection under the Master Agreement continues after termination.
8.2 StreamVista may suspend enhanced protection immediately for non-payment or material misuse.

9. RELATIONSHIP TO MASTER AGREEMENT
9.1 In the event of conflict between this Addendum and the Creator / Rights Holder Master Agreement on a subject specific to enhanced protection, this Addendum controls.

By clicking "Accept & continue" you agree to be bound by this Addendum for each Opted-In Title for the duration of the active add-on.$$
WHERE agreement_type = 'antipiracy_addendum' AND version = 1;
