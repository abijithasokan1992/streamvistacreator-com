# StreamVista Revenue Launch — Malayalam Checklist

## ഇപ്പോഴത്തെ സ്ഥിതി

Revenue service catalogue code-ൽ ചേർത്തിട്ടുണ്ട്. എന്നാൽ accidental live charge ഒഴിവാക്കാൻ രണ്ട് paid services-വും `enabled: false` ആയി lock ചെയ്തിരിക്കുന്നു.

## Launch ചെയ്യേണ്ട ആദ്യ രണ്ട് services

### 1. Film Onboarding Package
- Base fee: ₹999
- GST 18%: ₹180
- Customer total: ₹1,179
- Deliverables: metadata check, poster/trailer intake, rights checklist, buyer-ready profile

### 2. Licensing Ready Package
- Base fee: ₹2,999
- GST 18%: ₹540
- Customer total: ₹3,539
- Deliverables: metadata review, rights-readiness checklist, QC coordination, watermarked screener preparation, buyer-submission preparation

## Paisa ചെലവാകാതിരിക്കാൻ policy

1. Existing free tiers ആദ്യം ഉപയോഗിക്കുക.
2. Paid plan അല്ലെങ്കിൽ card-based upgrade owner approval ഇല്ലാതെ enable ചെയ്യരുത്.
3. OpenAI/Claude/Gemini/Perplexity paid API calls revenue workflow stable ആകുന്നതുവരെ optional ആയി നിലനിർത്തുക.
4. AppsFlyer, RevenueCat, Firebase Test Lab native mobile build വരുന്നതുവരെ enable ചെയ്യരുത്.
5. HubSpot free CRM, GA4, Clarity, GitHub, Cloudflare free tier എന്നിവ ആദ്യം ഉപയോഗിക്കുക.
6. Real secrets GitHub-ൽ commit ചെയ്യരുത്.

## Revenue live ആക്കുന്നതിന് മുമ്പ് നിർബന്ധമായ checks

- [ ] Razorpay live Key ID server-side configured
- [ ] Razorpay Key Secret server-side configured
- [ ] Razorpay webhook secret configured
- [ ] Order amount server-side catalogue-ൽ നിന്ന് മാത്രം എടുക്കുന്നു
- [ ] ₹1 test/live-approved payment owner നടത്തി verify ചെയ്തു
- [ ] Webhook signature verification passed
- [ ] Payment success database-ൽ record ആയി
- [ ] Failed payment correct status കാണിക്കുന്നു
- [ ] Duplicate webhook duplicate invoice ഉണ്ടാക്കുന്നില്ല
- [ ] GST invoice/receipt generated
- [ ] Customer confirmation email delivered
- [ ] Admin notification delivered
- [ ] Paid service order admin work queue-ൽ കാണുന്നു
- [ ] Refund/manual cancellation procedure documented
- [ ] Privacy policy, terms, refund policy public pages valid

## Immediate customer flow

Customer selects service
→ Login / contact details
→ Server creates Razorpay order
→ Customer pays
→ Razorpay webhook verifies payment
→ Order becomes Paid
→ Invoice generated
→ Customer email sent
→ Admin work item created
→ Service delivery starts

## Owner കാണേണ്ട dashboard result

- Today's paid orders
- Revenue before GST
- GST collected
- Failed payments
- Pending service deliveries
- Completed deliveries
- Refunds
- Buyer/licensing follow-up required

## Final activation rule

മുകളിലെ എല്ലാ payment checks pass ചെയ്തശേഷം മാത്രം `src/config/revenueServices.ts`-ലെ selected service `enabled: true` ആക്കുക. അതിന് മുമ്പ് public checkout button live ആക്കരുത്.
