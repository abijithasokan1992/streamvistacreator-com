import { AlertTriangle, CheckCircle2, ExternalLink, Globe } from "lucide-react";
import { APP_ORIGIN, classifyOrigin } from "@/lib/site";
import { RAZORPAY_BANNER_COPY, SITE_ROLE_LABELS } from "@/lib/copy/adminLabels";
import TechnicalDetailsDisclosure from "@/components/admin/TechnicalDetailsDisclosure";

/**
 * Plain-language banner explaining that the Razorpay merchant dashboard is
 * still reviewing the request to switch the registered website. The wording
 * mirrors the customer-facing copy so admins never have to translate for
 * finance / support staff.
 *
 * This banner is display-only. It does not change any payment routing or
 * merchant configuration.
 */
export default function RazorpayOpsBanner() {
  const origin = typeof window !== "undefined" ? window.location.origin : APP_ORIGIN;
  const kind = classifyOrigin(origin);
  const c = RAZORPAY_BANNER_COPY;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300 grid place-items-center shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="space-y-2">
          <h3 className="font-display text-lg font-bold">{c.heading}</h3>
          <p className="text-sm text-muted-foreground max-w-3xl">
            {c.intro}
          </p>
          <p className="text-sm font-mono text-foreground">{c.approvedDomain}</p>
          <p className="text-sm text-muted-foreground max-w-3xl">
            {c.stillShowsIntro}
          </p>
          <p className="text-sm font-mono text-foreground">{c.stillShowsDomain}</p>
          <p className="text-sm text-muted-foreground max-w-3xl">
            {c.reassurance}
          </p>
        </div>
      </div>

      <section className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          {c.currentWebsitesHeading}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <Row
            tone="ok"
            label={c.appPaymentLabel}
            value={c.appPaymentDomain}
          />
          <Row
            tone="ok"
            label={c.companyLabel}
            value={c.companyDomain}
          />
          <Row
            tone="warn"
            label={c.razorpayShownLabel}
            value={c.razorpayShownDomain}
            note={c.razorpayShownNote}
          />
          <Row
            tone="info"
            label={c.previewLabel}
            value={c.previewDomain}
            note={c.previewNote}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border/40 bg-secondary/20 p-3 text-sm space-y-1">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          {c.statusHeading}
        </div>
        <p className="text-muted-foreground">{c.statusLine1}</p>
        <p className="text-muted-foreground">{c.statusLine2}</p>
      </section>

      <TechnicalDetailsDisclosure
        title="Support & operator information"
        entries={[
          { label: SITE_ROLE_LABELS.currentlyOpen, value: origin, mono: true },
          {
            label: "Origin classification",
            value:
              kind === "production" ? "Production" :
              kind === "preview" ? "Test website" :
              kind === "deprecated" ? "No longer used" : "Unknown",
          },
        ]}
      >
        <a
          href="https://dashboard.razorpay.com/app/website-details"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          Open Razorpay → Website Details <ExternalLink className="w-3 h-3" />
        </a>
      </TechnicalDetailsDisclosure>
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
  note?: string;
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
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
        {dot} {label}
      </div>
      <div className="font-mono text-[12px] text-foreground break-all">{value}</div>
      {note && <div className="text-[11px] text-muted-foreground">{note}</div>}
    </div>
  );
}
