import { useEffect, useState } from "react";
import { BookOpen, Search, ChevronDown, ChevronRight, ExternalLink, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * In-app Admin Runbook.
 *
 * Every entry is a structural playbook. Domain-specific values (custom domain,
 * sender domain, storage bucket, cron cadence) are read from `site_config` at
 * render time — no hardcoded values.
 */

type RunbookEntry = {
  id: string;
  area: string;
  title: string;
  symptoms: string[];
  causes: string[];
  verify: string[];
  resolve: string[];
  escalate: string[];
  commands?: string[];
  links: { label: string; href: string }[];
};

function buildRunbook(ctx: { primaryDomain: string | null; senderDomain: string | null }): RunbookEntry[] {
  const DOMAIN = ctx.primaryDomain ?? "<your custom domain>";
  const EMAIL = ctx.senderDomain ?? "<your sender domain>";
  return [
    {
      id: "dns",
      area: "DNS",
      title: "Custom domain not resolving or verification stuck",
      symptoms: ["Domain shows Verifying / Action Required for >72h", "Public URL returns NXDOMAIN"],
      causes: [
        "A record for @ / www not pointing to 185.158.133.1",
        "TXT _lovable verification record missing",
        "Cloudflare proxy enabled without CNAME mode",
      ],
      verify: [
        `Resolve A record: dig +short ${DOMAIN}`,
        `Resolve TXT record: dig +short TXT _lovable.${DOMAIN}`,
        `Check propagation via dnschecker.org for ${DOMAIN}`,
      ],
      resolve: [
        "In registrar DNS: A @ → 185.158.133.1, A www → 185.158.133.1",
        "Add TXT _lovable with the value shown in Project → Domains",
        "If using Cloudflare proxy, enable Advanced → 'Domain uses Cloudflare' before adding",
      ],
      escalate: ["If DNS is correct and status is Failed after 24h, contact Lovable support with the domain name."],
      links: [{ label: "Custom domain docs", href: "https://docs.lovable.dev/features/custom-domain" }],
    },
    {
      id: "ssl",
      area: "SSL",
      title: "SSL certificate not provisioning / TLS handshake fails",
      symptoms: ["Browser shows ERR_CERT_AUTHORITY_INVALID", "Curl returns SSL_ERROR"],
      causes: [
        "DNS not verified — SSL cannot issue until A/TXT records confirm ownership",
        "CAA record blocks Let's Encrypt",
        "Domain moved between projects without re-verification",
      ],
      verify: [
        `openssl s_client -connect ${DOMAIN}:443 -servername ${DOMAIN} </dev/null | openssl x509 -noout -dates`,
        `dig CAA ${DOMAIN}`,
      ],
      resolve: [
        "Ensure DNS is verified in Project → Domains",
        "Remove or update CAA to allow letsencrypt.org",
        "Click Retry in Project → Domains if status is Failed",
      ],
      escalate: ["After 72h with correct DNS + CAA, contact Lovable support."],
      links: [],
    },
    {
      id: "routing",
      area: "Routing",
      title: "HTTP → HTTPS redirect or www vs apex mismatch",
      symptoms: ["Mixed content warnings", "www.domain resolves but apex 404s (or vice versa)"],
      causes: ["Only one of apex/www is added in Project → Domains", "Cloudflare page rule intercepts before origin"],
      verify: [
        `curl -I http://${DOMAIN}`,
        `curl -I https://www.${DOMAIN}`,
      ],
      resolve: [
        "Add BOTH apex and www in Project → Domains",
        "Select one as Primary — the other will redirect automatically",
      ],
      escalate: [],
      links: [],
    },
    {
      id: "oci",
      area: "OCI Storage",
      title: "Uploads fail with NotAuthenticated / NotAuthorized from OCI",
      symptoms: ["Failed Uploads Inspector shows category = Auth / Token Rejected"],
      causes: [
        "Tenancy OCID / User OCID / Fingerprint mismatch with the uploaded public key",
        "Private key in wrong format (PKCS#1 instead of PKCS#8)",
      ],
      verify: [
        "Open Admin → Cloud → OCI Advanced — run Self-diagnostic",
        "Verify fingerprint in OCI Console → Identity → Users → API Keys matches the stored fingerprint",
      ],
      resolve: [
        "Re-upload the key as PKCS#8: openssl pkcs8 -topk8 -nocrypt -in key.pem -out key-pkcs8.pem",
        "Regenerate fingerprint via Auto-format key in OCI Advanced",
      ],
      escalate: ["If keys match and 401 persists, rotate the OCI API signing key in OCI Console and re-upload."],
      links: [],
    },
    {
      id: "uploads",
      area: "Uploads",
      title: "Uploads stuck / silently failing",
      symptoms: ["Mission Control shows Failed Uploads > 0", "Users report progress bar stops mid-transfer"],
      causes: [
        "Signed URL expired (session > 24h)",
        "CSP blocks OCI endpoint (connect-src)",
        "Network drop / timeout on user's side",
      ],
      verify: [
        "Open Admin → Cloud → Failed Uploads — every failure is categorized (CSP / Signed URL / Auth / Network / Other)",
        "The retry-failed-uploads cron requeues stale failures every 5 minutes",
      ],
      resolve: [
        "CSP violations: extend connect-src to include the OCI namespace URL",
        "Signed URL expired: user just needs to retry — session mints fresh",
        "Network drops: putChunkWithRetry now retries 6× with backoff and waits for navigator.onLine",
      ],
      escalate: ["If failures spike >20/24h in the same category, open a support request from the Inspector."],
      links: [],
    },
    {
      id: "email",
      area: "Email",
      title: "Emails not arriving",
      symptoms: ["User reports missing signup / password / notification email"],
      causes: [
        `Sender domain ${EMAIL} DNS not verified (NS delegation pending)`,
        "Recipient in suppressed_emails (bounce/complaint)",
        "Email in DLQ after 5 attempts",
        "Live cron missing after publish (Live vs Test/dev drift)",
      ],
      verify: [
        `Open Admin → Platform → Email Log — filter by recipient`,
        `Check status: pending / sent / dlq / suppressed / bounced`,
        "Verify sender_domain is the delegated subdomain, not the root",
      ],
      resolve: [
        "DLQ items: the retry-failed-emails cron drains DLQ every 5 minutes and re-enqueues up to 3 times",
        "Suppressed: user must re-subscribe; check suppressed_emails table for reason",
        "If Live cron missing after publish, re-publish the app to reinstall prod cron",
      ],
      escalate: ["If 429 rate limits from provider, tune email_send_state.batch_size and send_delay_ms."],
      links: [],
    },
    {
      id: "auth",
      area: "Authentication",
      title: "Users stuck at sign-in / OAuth callback errors",
      symptoms: ["Unsupported provider errors", "redirect_uri mismatch", "JWT expired mid-session"],
      causes: [
        "Google provider not configured in Cloud → Users → Auth Settings",
        "redirect_uri points at protected route instead of /auth/callback",
        "Session TTL too short vs long-running uploads",
      ],
      verify: [
        "Cloud → Users → Auth Settings — verify enabled providers",
        "Check network tab for the exact redirect_uri sent to Google/Apple",
      ],
      resolve: [
        "Set redirect_uri to `${window.location.origin}/auth/callback` in social auth config",
        "Increase JWT expiry in Auth Settings if uploads > 1h are common",
      ],
      escalate: [],
      links: [],
    },
    {
      id: "billing",
      area: "Billing",
      title: "Payment failures / webhook not received",
      symptoms: ["billing_payment_attempts.status = failed with high volume"],
      causes: ["Webhook secret mismatch", "Razorpay/Paddle key rotated", "Idempotency collision"],
      verify: [
        "Admin → Business → Billing Operations — inspect payment_traces for the failing order",
        "Verify webhook signing secret matches provider dashboard",
      ],
      resolve: [
        "Rotate provider webhook secret and update via Cloud → Secrets",
        "Replay the missed webhook from provider dashboard",
      ],
      escalate: ["If provider is down, mark orders as manual reconciliation."],
      links: [],
    },
    {
      id: "ai",
      area: "AI / MCP",
      title: "AI Gateway or MCP endpoint returning 401/5xx",
      symptoms: ["Assistant chat empty responses", "MCP tools list fails"],
      causes: ["LOVABLE_API_KEY missing/rotated", "Rate limit exhausted", "Edge function cold-start timeout"],
      verify: [
        "Infrastructure Health → AI Gateway + MCP tiles",
        "Cloud → Secrets — confirm LOVABLE_API_KEY exists",
      ],
      resolve: [
        "Rotate LOVABLE_API_KEY if the error is 401/403",
        "Reduce concurrent AI calls or tune rate limit budgets",
      ],
      escalate: [],
      links: [],
    },
  ];
}

export default function AdminRunbook() {
  const [ctx, setCtx] = useState<{ primaryDomain: string | null; senderDomain: string | null }>({ primaryDomain: null, senderDomain: null });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("site_config").select("primary_domain, sender_domain").maybeSingle();
      setCtx({
        primaryDomain: (data?.primary_domain as string | null) ?? null,
        senderDomain: (data?.sender_domain as string | null) ?? null,
      });
    })();
  }, []);

  const entries = buildRunbook(ctx);
  const filtered = q.trim()
    ? entries.filter((e) => JSON.stringify(e).toLowerCase().includes(q.toLowerCase()))
    : entries;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-display font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent" /> Admin Runbook
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Structural playbooks · domain values resolved dynamically from configuration.
          </p>
          {ctx.primaryDomain && (
            <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Domain: <span className="font-mono">{ctx.primaryDomain}</span>
              {ctx.senderDomain && <>&nbsp;·&nbsp;Email: <span className="font-mono">{ctx.senderDomain}</span></>}
            </div>
          )}
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search symptoms / causes / commands…"
            className="pl-7 pr-2 py-1.5 rounded-md bg-secondary/30 border border-border/40 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
        </div>
      </header>

      <ul className="space-y-2">
        {filtered.map((e) => {
          const isOpen = open.has(e.id) || Boolean(q.trim());
          return (
            <li key={e.id} className="rounded-lg border border-border/40 bg-card/40">
              <button
                onClick={() => setOpen((s) => { const n = new Set(s); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n; })}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/30"
              >
                {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-16">{e.area}</span>
                <span className="text-sm font-medium">{e.title}</span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 space-y-3 text-xs">
                  <Section title="Symptoms" items={e.symptoms} />
                  <Section title="Possible causes" items={e.causes} />
                  <Section title="Verification steps" items={e.verify} mono />
                  <Section title="Resolution" items={e.resolve} />
                  {e.escalate.length > 0 && <Section title="Escalation" items={e.escalate} />}
                  {e.commands && e.commands.length > 0 && <Section title="Useful commands" items={e.commands} mono />}
                  {e.links.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Links</div>
                      <ul className="space-y-0.5">
                        {e.links.map((l) => (
                          <li key={l.href}>
                            <a href={l.href} target="_blank" rel="noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">
                              {l.label} <ExternalLink className="w-3 h-3" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="rounded-lg border border-border/40 p-6 text-sm text-muted-foreground text-center">
            No runbook entries match "{q}".
          </li>
        )}
      </ul>
    </div>
  );
}

function Section({ title, items, mono }: { title: string; items: string[]; mono?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{title}</div>
      <ul className={`space-y-1 ${mono ? "font-mono text-[11px]" : ""}`}>
        {items.map((it, i) => (
          <li key={i} className={mono ? "bg-black/25 rounded px-2 py-1 break-all" : "leading-relaxed"}>
            {mono ? it : `• ${it}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
