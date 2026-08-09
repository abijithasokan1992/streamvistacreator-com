import { Check, ArrowRight, Crown, HardDrive, Layers, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { usePublicPlans, withGst } from "@/hooks/usePublicPlans";
import { GlobalCheckout } from "./GlobalCheckout";

/**
 * Public pricing — three commercial blocks that match what the MVP actually does.
 *
 *   1. Creator plans              → founder-assisted. CTA = request.
 *   2. Creator storage add-ons    → self-serve recurring 1 TB blocks. Price + GST
 *                                    are read live from the canonical `plans` row
 *                                    `creator_payg_1tb`. Never hardcode a ₹ figure.
 *   3. Studio / Enterprise        → founder-assisted commercial conversation.
 *
 * Free tier copy ("5 GB workspace") is also driven by the canonical `creator_basic`
 * row so the DB stays the single source of truth.
 */

export const Pricing = () => {
  const { byCode, loading } = usePublicPlans();
  const basic = byCode("creator_basic");
  const payg = byCode("creator_payg_1tb");

  // Storage block pricing — derived from DB, never hardcoded.
  const paygPrice = payg
    ? withGst(payg.price_amount, payg.gst_percent)
    : null;
  const paygTbSize = payg?.storage_gb ? Math.round(payg.storage_gb / 1024) : 1;

  const basicStorageLabel = basic?.storage_gb
    ? `${basic.storage_gb} GB workspace`
    : "Workspace";

  const storageBlockBullets = payg
    ? (payg.features.length
        ? payg.features
        : [
            `${paygTbSize} TB per block, recurring monthly via Razorpay`,
            "Add multiple blocks — each cancels independently",
            "Cancellation takes effect at cycle end, files are never auto-deleted",
            "Server-enforced quota: uploads stop cleanly when limit is reached",
          ])
    : [];

  const creatorPlansBullets = basic
    ? [
        `Creator Basic — ${basicStorageLabel}, 1 active title, standard review`,
        "Creator Pro (managed) — up to 10 active titles, priority review, named contact",
        "Creator Studio (managed) — custom commercial terms for larger catalogs",
        "Plan upgrades are handled by our team — no surprise checkout",
      ]
    : [];

  return (
    <section id="pricing" className="py-28 relative border-b border-border/40">
      <div className="container">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 animate-fade-in">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-px bg-accent" />
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
                Honest commercial model
              </span>
            </div>
            <h1 className="font-display font-black uppercase leading-[0.9] tracking-tight text-5xl md:text-7xl">
              Plans you talk about.
              <br />
              <span className="gradient-text">Storage you buy yourself.</span>
            </h1>
          </div>
          <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
            StreamVista uses a hybrid model on purpose. Creator and Studio plans are founder-assisted
            because the right fit matters. Storage is self-serve and recurring because capacity is
            a commodity. Buyers don't pay to open a conversation.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden">
          {/* Block 1 — Creator plans (founder-assisted) */}
          <PriceCard
            index={0}
            pill="Creator plans"
            icon={Crown}
            name="Basic · Pro · Studio"
            priceValue={basic ? "Free" : "—"}
            priceSuffix=" → managed"
            tagline={
              basic?.description ??
              "Start free on Creator Basic. Upgrade to Pro or Studio when your catalog grows — our team confirms pricing based on titles, storage and workflow needs."
            }
            bullets={creatorPlansBullets}
            cta={{ label: "Get started free", to: "/auth?intent=signup&role=content_owner", intent: "primary" }}
            note="Sign up free, request an upgrade from inside your workspace."
            loading={loading && !basic}
          />

          {/* Block 2 — Storage add-on (self-serve, canonical DB price) */}
          <PriceCard
            index={1}
            pill="Storage add-ons · Self-serve"
            icon={HardDrive}
            name={`Recurring ${paygTbSize} TB blocks`}
            priceValue={paygPrice ? paygPrice.totalLabel : "—"}
            priceSuffix={payg ? `/TB · ${shortCycle(payg.billing_cycle)}` : ""}
            tagline={
              payg
                ? `Pure storage capacity, billed ${payg.billing_cycle}. ${paygPrice!.baseLabel} + ${payg.gst_percent}% GST = ${paygPrice!.totalLabel}, server-priced. Add a block when you need more room, cancel any block at end of cycle.`
                : "Pure storage capacity, billed monthly. Add a block when you need more room, cancel any block at end of cycle."
            }
            bullets={storageBlockBullets}
            cta={{ label: "Buy storage in dashboard", to: "/auth?intent=signup&role=content_owner", intent: "primary" }}
            note="Available inside Storage & Billing after sign-in."
            highlight
            loading={loading && !payg}
            badgeOverride={payg ? "Live · Self-serve" : undefined}
          />

          {/* Block 3 — Studio / Enterprise (founder-assisted) */}
          <PriceCard
            index={2}
            pill="Studio & Enterprise"
            icon={Layers}
            name="Custom commercial"
            priceValue="Talk to us"
            priceSuffix=""
            tagline="Vault, ingest, mastering, QC and delivery operations for studios, post houses and production teams. Plan changes are founder-assisted because the scope is real."
            bullets={[
              "Studio plan changes handled by StreamVista",
              "Service requests for ingest, mastering, QC, delivery",
              "Vault / heavy storage with operational support",
              "Workspace access for production teams and operators",
            ]}
            cta={{ label: "Request a Studio plan", to: "/contact", intent: "ghost" }}
            note="We reply by email with scope and pricing."
          />
        </div>

        {/* International billing — Paddle rail is dormant; route to founder-assisted contact */}
        <div className="mt-8 rounded-2xl border border-border/60 bg-card/40 p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6 animate-fade-in">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-px bg-accent" />
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
                International billing
              </span>
            </div>
            <h2 className="font-display text-xl md:text-2xl font-bold tracking-tight mb-1">
              Outside India? Talk to StreamVista.
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
              Self-serve checkout is currently India / INR only via Razorpay. International billing
              for Creator, Studio and enterprise customers is handled directly by our team while we
              finish onboarding the global rail.
            </p>
          </div>
          <Link
            to="/contact?topic=international-billing"
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full border border-border/60 px-5 py-2.5 text-sm font-medium hover:bg-accent/10 hover:border-accent/40 transition-colors"
          >
            Talk to StreamVista
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <GlobalCheckout />





        <p className="text-center text-xs text-muted-foreground mt-8 max-w-2xl mx-auto">
          {payg && paygPrice ? (
            <>
              Storage block pricing is server-priced ({paygPrice.baseLabel} + {payg.gst_percent}% GST = {paygPrice.totalLabel}
              {" "}per {paygTbSize} TB · {payg.billing_cycle}) and shown in your dashboard before checkout. Plan-related
              conversations are handled by email — there is no surprise charge for talking to us.
            </>
          ) : (
            <>Storage block pricing is server-priced and shown in your dashboard before checkout.</>
          )}
        </p>

        <PricingFaq />
      </div>
    </section>
  );
};

function PricingFaq() {
  const faqs: { q: string; a: string }[] = [
    {
      q: "Why is Creator plan pricing founder-assisted instead of a checkout page?",
      a: "Creator Pro and Studio plans depend on how many active titles you carry, review turnaround, and workflow support. We confirm the fit by email so you never get a surprise charge. Creator Basic is free and self-serve.",
    },
    {
      q: "What does the 5 GB free workspace include?",
      a: "Creator Basic gives you 5 GB of workspace, one active title, and standard review — no credit card required. It runs on the same secure infrastructure as paid plans.",
    },
    {
      q: "How does storage billing work?",
      a: "Storage is sold as recurring 1 TB blocks via Razorpay. Each block bills monthly, cancels independently at cycle end, and files are never auto-deleted. Uploads stop cleanly at the quota — no overage bills.",
    },
    {
      q: "Do buyers pay to reach out about a title?",
      a: "No. Buyers can browse and open a licensing conversation without any charge. Commercial terms are agreed between the rights holder and the buyer.",
    },
    {
      q: "Is GST included in the price shown?",
      a: "Yes. Every storage price on this page is displayed with GST already added, matching what appears in your dashboard checkout.",
    },
    {
      q: "Can I buy from outside India?",
      a: "Self-serve checkout is India / INR only right now. International Creator and Studio customers are onboarded directly by our team while we finish the global billing rail.",
    },
  ];

  return (
    <div className="mt-20 pt-12 border-t border-border/40">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-5 justify-center">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
            Frequently asked
          </span>
          <div className="w-8 h-px bg-accent" />
        </div>
        <h2 className="font-display font-black uppercase text-3xl md:text-4xl tracking-tight text-center mb-10">
          Pricing <span className="gradient-text">questions</span>
        </h2>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-xl border border-border/60 bg-card/40 px-5 py-4 hover:border-accent/40 transition-colors"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-sm md:text-base font-semibold text-foreground">
                <span>{f.q}</span>
                <span className="text-accent text-lg leading-none group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}


function shortCycle(cycle: string) {
  switch (cycle) {
    case "monthly": return "month";
    case "quarterly": return "quarter";
    case "semiannual": return "6 months";
    case "annual": return "year";
    case "lifetime": return "forever";
    default: return cycle;
  }
}

type PriceCardProps = {
  index: number;
  pill: string;
  icon: typeof Crown;
  name: string;
  priceValue: string;
  priceSuffix?: string;
  tagline: string;
  bullets: string[];
  cta: { label: string; to: string; intent: "primary" | "ghost" };
  note: string;
  highlight?: boolean;
  loading?: boolean;
  badgeOverride?: string;
};

function PriceCard({
  index, pill, icon: Icon, name, priceValue, priceSuffix, tagline,
  bullets, cta, note, highlight, loading, badgeOverride,
}: PriceCardProps) {
  return (
    <div
      className={cn(
        "relative text-left p-7 md:p-9 bg-card flex flex-col animate-fade-in",
        highlight && "ring-1 ring-accent/30",
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {(highlight || badgeOverride) && (
        <div className="absolute top-0 right-0 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground" style={{ backgroundImage: "var(--gradient-primary)" }}>
          {badgeOverride ?? "Live · Self-serve"}
        </div>
      )}

      <div className="flex items-center justify-between mb-7">
        <div className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-text-tertiary">
          {String(index + 1).padStart(2, "0")} · {pill}
        </div>
        <div
          className="w-10 h-10 rounded-xl grid place-items-center text-primary-foreground border border-primary/30"
          style={{
            backgroundImage: "var(--gradient-primary)",
            boxShadow: "0 1px 0 hsl(0 0% 100% / 0.25) inset, 0 -2px 0 hsl(225 60% 6% / 0.18) inset, 0 8px 22px -10px hsl(var(--primary) / 0.6)",
          }}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mb-1 flex items-baseline gap-2 min-h-[3.5rem]">
        {loading ? (
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
        ) : (
          <>
            <span className="stat-bold text-5xl md:text-6xl">
              {priceValue}
            </span>
            {priceSuffix && (
              <span className="font-mono-tech text-[11px] uppercase tracking-widest text-text-tertiary">
                {priceSuffix}
              </span>
            )}
          </>
        )}
      </div>
      <div className="font-display text-lg font-black mb-4 text-foreground">{name}</div>

      <p className="text-[15px] text-text-secondary mb-6 leading-relaxed border-t border-border-subtle pt-5 font-medium">
        {tagline}
      </p>

      <ul className="space-y-2.5 text-sm mb-8">
        {bullets.map((f) => (
          <li key={f} className="flex items-start gap-3">
            <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <span className="text-text-secondary">{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-2">
        <Link
          to={cta.to}
          className={cn(
            "group/btn h-12 w-full inline-flex items-center justify-center gap-2 font-bold uppercase tracking-[0.18em] text-xs rounded-md transition-colors",
            cta.intent === "primary"
              ? "btn-emboss"
              : "border border-border-strong/60 hover:border-primary/60 hover:bg-primary/5 text-foreground",
          )}
        >
          <span>{cta.label}</span>
          <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
        </Link>
        <p className="text-[10px] text-text-tertiary text-center">{note}</p>
      </div>
    </div>
  );
}
