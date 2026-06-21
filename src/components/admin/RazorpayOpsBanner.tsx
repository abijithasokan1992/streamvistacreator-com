import { AlertTriangle, CheckCircle2, ExternalLink, Globe } from "lucide-react";
import { APP_ORIGIN, CORPORATE_SITE, PREVIEW_ORIGIN, classifyOrigin } from "@/lib/site";

/**
 * Operator-facing banner that makes the cutover window explicit:
 *  - StreamVista Creator is the canonical in-app payment domain (final).
 *  - Razorpay merchant dashboard may still list Crayons Loop as the primary
 *    website while the website-edit request is under review. That state lives
 *    in Razorpay's dashboard, NOT in this app. App-side checkout, callbacks,
 *    invoices and entitlements never depend on Crayons Loop.
 *
 * This is intentionally read-only — it documents external operator state and
 * stops the team from re-introducing Crayons Loop into app code paths during
 * the review window.
 */
export default function RazorpayOpsBanner() {
  const origin = typeof window !== "undefined" ? window.location.origin : APP_ORIGIN;
  const kind = classifyOrigin(origin);

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300 grid place-items-center shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <h3 className="font-display text-lg font-bold">
            Razorpay website review pending — app build continues on StreamVista Creator
          </h3>
          <p className="text-xs text-muted-foreground max-w-3xl">
            Razorpay is still reviewing the website-edit request to switch the merchant's
            primary website to <span className="font-mono text-foreground">{APP_ORIGIN}</span>.
            Until that approval lands, the Razorpay dashboard may still show
            <span className="font-mono text-foreground"> https://www.crayonsloop.com</span> as
            the current primary website. That is an external merchant-dashboard state — the
            StreamVista app does not route any payment, callback, invoice or auth link through
            Crayons Loop.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <Row
          tone="ok"
          label="Canonical app + payment domain"
          value={APP_ORIGIN}
          note="Used by Studio Vault checkout, success callback, verify, webhook return, invoice CTAs."
        />
        <Row
          tone="ok"
          label="Corporate website"
          value={CORPORATE_SITE}
          note="Approved as additional business website. Not the app payment domain."
        />
        <Row
          tone="warn"
          label="Razorpay merchant primary (during review)"
          value="https://www.crayonsloop.com"
          note="External Razorpay state. Deprecated in StreamVista app logic — do not re-introduce."
        />
        <Row
          tone="info"
          label="Preview host (non-canonical)"
          value={PREVIEW_ORIGIN}
          note="Lovable preview only. Never treated as the production payment website."
        />
      </div>

      <div className="rounded-xl border border-border/40 bg-secondary/20 p-3 text-xs space-y-1">
        <p className="font-semibold text-foreground inline-flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-accent" /> Current browser origin:
          <span className="font-mono">{origin}</span>
          {kind === "production" && <span className="text-emerald-300">· production</span>}
          {kind === "preview" && <span className="text-amber-300">· preview — not the payment domain</span>}
          {kind === "deprecated" && <span className="text-red-300">· deprecated — stop using</span>}
        </p>
        <p className="text-muted-foreground">
          Safe to continue building. After Razorpay approves the website cutover, run one real
          Studio Vault purchase from <span className="font-mono text-foreground">{APP_ORIGIN}</span> to
          complete live launch validation.
        </p>
        <a
          href="https://dashboard.razorpay.com/app/website-details"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          Open Razorpay → Website Details <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

function Row({
  tone,
  label,
  value,
  note,
}: {
  tone: "ok" | "warn" | "info";
  label: string;
  value: string;
  note: string;
}) {
  const toneClass =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "warn"
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-border/40 bg-secondary/20";
  const dot =
    tone === "ok" ? (
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
    ) : tone === "warn" ? (
      <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
    ) : (
      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
    );
  return (
    <div className={`rounded-xl border p-3 space-y-1 ${toneClass}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {dot} {label}
      </div>
      <div className="font-mono text-[12px] text-foreground break-all">{value}</div>
      <div className="text-[11px] text-muted-foreground">{note}</div>
    </div>
  );
}
