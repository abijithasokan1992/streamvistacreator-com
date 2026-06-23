import { Check, ArrowRight, Crown, HardDrive, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Public pricing — three commercial blocks that match what the MVP actually does.
 *
 *   1. Creator plans              → founder-assisted. CTA = request.
 *   2. Creator storage add-ons    → self-serve recurring 1 TB blocks.
 *   3. Studio / Enterprise        → founder-assisted commercial conversation.
 *
 * Buyer is intentionally NOT a column here — buyers don't subscribe.
 * The Buyer entry block lives in <BuyerEntry />.
 *
 * Numbers shown:
 *   • Creator Basic       free, 5 GB workspace
 *   • Storage add-on       ₹650 + 18% GST = ₹767 per TB / month (already live)
 *   • Studio / Creator Pro / Studio plans → priced on conversation
 */

type Block = {
  key: "creator-plans" | "creator-storage" | "studio";
  pill: string;
  icon: typeof Crown;
  name: string;
  price: { value: string; suffix?: string };
  tagline: string;
  bullets: string[];
  cta: { label: string; to: string; intent: "primary" | "ghost" };
  note: string;
  highlight?: boolean;
};

const BLOCKS: Block[] = [
  {
    key: "creator-plans",
    pill: "Creator plans",
    icon: Crown,
    name: "Basic · Pro · Studio",
    price: { value: "Free", suffix: " → managed" },
    tagline:
      "Start free on Creator Basic. Upgrade to Pro or Studio when your catalog grows — our team confirms pricing based on titles, storage and workflow needs.",
    bullets: [
      "Creator Basic — 5 GB workspace, 1 active title, standard review",
      "Creator Pro (managed) — up to 10 active titles, priority review, named contact",
      "Creator Studio (managed) — custom commercial terms for larger catalogs",
      "Plan upgrades are handled by our team — no surprise checkout",
    ],
    cta: { label: "Get started free", to: "/auth?intent=signup&role=content_owner", intent: "primary" },
    note: "Sign up free, request an upgrade from inside your workspace.",
  },
  {
    key: "creator-storage",
    pill: "Storage add-ons · Self-serve",
    icon: HardDrive,
    name: "Recurring 1 TB blocks",
    price: { value: "₹767", suffix: "/TB · month" },
    tagline:
      "Pure storage capacity, billed monthly. Add a block when you need more room, cancel any block at end of cycle. ₹650 + 18% GST, server-priced.",
    bullets: [
      "1 TB per block, recurring monthly via Razorpay",
      "Add multiple blocks — each cancels independently",
      "Cancellation takes effect at cycle end, files are never auto-deleted",
      "Server-enforced quota: uploads stop cleanly when limit is reached",
    ],
    cta: { label: "Buy storage in dashboard", to: "/auth?intent=signup&role=content_owner", intent: "primary" },
    note: "Available inside Storage & Billing after sign-in.",
    highlight: true,
  },
  {
    key: "studio",
    pill: "Studio & Enterprise",
    icon: Layers,
    name: "Custom commercial",
    price: { value: "Talk to us", suffix: "" },
    tagline:
      "Vault, ingest, mastering, QC and delivery operations for studios, post houses and production teams. Plan changes are founder-assisted because the scope is real.",
    bullets: [
      "Studio plan changes handled by StreamVista",
      "Service requests for ingest, mastering, QC, delivery",
      "Vault / heavy storage with operational support",
      "Workspace access for production teams and operators",
    ],
    cta: { label: "Request a Studio plan", to: "/contact", intent: "ghost" },
    note: "We reply by email with scope and pricing.",
  },
];

export const Pricing = () => (
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
        {BLOCKS.map((b, i) => {
          const Icon = b.icon;
          return (
            <div
              key={b.key}
              className={cn(
                "relative text-left p-7 md:p-9 bg-card flex flex-col animate-fade-in",
                b.highlight && "ring-1 ring-accent/30",
              )}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {b.highlight && (
                <div className="absolute top-0 right-0 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] bg-accent/20 text-accent">
                  Live · Self-serve
                </div>
              )}

              <div className="flex items-center justify-between mb-7">
                <div className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")} · {b.pill}
                </div>
                <Icon className="w-4 h-4 text-primary" />
              </div>

              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-display font-black text-4xl md:text-5xl tracking-tight">
                  {b.price.value}
                </span>
                {b.price.suffix && (
                  <span className="font-mono-tech text-[11px] uppercase tracking-widest text-muted-foreground">
                    {b.price.suffix}
                  </span>
                )}
              </div>
              <div className="font-display text-lg font-bold mb-4 text-foreground/90">{b.name}</div>

              <p className="text-sm text-muted-foreground mb-6 leading-relaxed border-t border-border/60 pt-5">
                {b.tagline}
              </p>

              <ul className="space-y-2.5 text-sm mb-8">
                {b.bullets.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="w-3.5 h-3.5 text-primary mt-1 shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto space-y-2">
                <Link
                  to={b.cta.to}
                  className={cn(
                    "group/btn h-12 w-full inline-flex items-center justify-center gap-2 font-semibold uppercase tracking-[0.18em] text-xs rounded-md transition-colors",
                    b.cta.intent === "primary"
                      ? "cta-guide bg-gradient-primary text-primary-foreground"
                      : "border border-border/60 hover:border-accent/60 hover:bg-accent/5 text-foreground",
                  )}
                >
                  <span>{b.cta.label}</span>
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
                <p className="text-[10px] text-muted-foreground text-center">{b.note}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8 max-w-2xl mx-auto">
        Storage block pricing is server-priced (₹650 + 18% GST = ₹767/month per 1 TB) and shown in your
        dashboard before checkout. Plan-related conversations are handled by email — there is no
        surprise charge for talking to us.
      </p>
    </div>
  </section>
);
