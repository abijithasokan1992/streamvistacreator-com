import { Link } from "react-router-dom";
import {
  ArrowRight, DollarSign, Globe2, Film, Handshake, FileSignature,
  HardDrive, TrendingUp, Sparkles, PlayCircle, Eye,
} from "lucide-react";
import { Navbar } from "@/components/streamvista/Navbar";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";

/**
 * Public marketing preview of the Creator Workspace.
 *
 * All numbers are illustrative sample data — never real customer records.
 * The authenticated workspace at /dashboard/content renders the same shell
 * with live data from `src/components/creator/sections/Home.tsx`.
 */
export default function CreatorPreview() {
  return (
    <div className="min-h-dvh bg-background text-foreground public-cinematic">
      <Seo
        title="Creator Workspace Preview — StreamVista"
        description="See how creators track revenue, distribution, partner performance, licensing and storage inside StreamVista. Interactive sample dashboard."
        path="/creator-preview"
      />
      <Navbar />

      {/* Persistent illustrative-demo watermark — pins to viewport across scroll. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden"
      >
        <span className="rotate-[-24deg] whitespace-nowrap font-display text-[9vw] font-black uppercase tracking-tighter text-foreground/[0.045] select-none">
          Illustrative Demo
        </span>
      </div>
      <div
        role="note"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none rounded-full border border-accent/40 bg-background/85 backdrop-blur px-4 py-1.5 text-[10px] font-mono-tech uppercase tracking-[0.22em] text-accent shadow-lg"
      >
        Illustrative Demo — not real customer records or revenue
      </div>

      <main className="pt-24 pb-24">

        <div className="container max-w-6xl">
          {/* Hero */}
          <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-accent mb-4">
                <Eye className="w-3 h-3" />
                Public preview · Demo data
              </div>
              <h1 className="font-display text-3xl md:text-5xl font-semibold tracking-tight">
                Your Creator Workspace,{" "}
                <span className="gradient-text">at a glance</span>
              </h1>
              <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl">
                Revenue, distribution, active titles, partner performance, licensing activity
                and storage — one workspace for the business of your catalog.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                to="/auth?intent=signup&role=content_owner"
                className="h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 glow-primary"
              >
                Create Your Creator Workspace
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/auth?intent=signup&role=content_owner"
                className="h-11 px-5 rounded-xl border border-border/60 bg-input/20 hover:bg-input/40 text-sm font-medium inline-flex items-center justify-center gap-2"
              >
                Start Free
              </Link>
            </div>
          </header>

          {/* Persistent Demo Data badge */}
          <div className="sticky top-20 z-30 mb-6 flex justify-end">
            <div className="rounded-full border border-amber-500/40 bg-amber-500/10 backdrop-blur px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-amber-300 inline-flex items-center gap-2 shadow-lg">
              <Sparkles className="w-3 h-3" />
              Demo Data — Not Real Customer Records
            </div>
          </div>

          {/* Row 1 · KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Kpi icon={DollarSign} label="Revenue (90d)" value="$48,720" delta="+12.4%" />
            <Kpi icon={Film} label="Active titles" value="14" delta="+2" />
            <Kpi icon={Handshake} label="Live partners" value="9" delta="+1" />
            <Kpi icon={HardDrive} label="Storage used" value="812 GB" delta="of 1 TB" muted />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Revenue overview */}
            <Card title="Revenue overview" hint="Rolling 90 days · sample data" className="lg:col-span-2">
              <div className="flex items-end gap-1.5 h-40">
                {[38, 52, 44, 61, 55, 72, 68, 84, 76, 91, 88, 96].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-accent/30 to-accent/80"
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-[9px] text-muted-foreground/70">W{i + 1}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-border/40 text-xs">
                <Stat label="Gross" value="$48,720" />
                <Stat label="Net payouts" value="$41,412" />
                <Stat label="Avg / title" value="$3,480" />
              </div>
            </Card>

            {/* Distribution insights */}
            <Card title="Distribution insights" hint="Reach across live channels">
              <ul className="space-y-3">
                {[
                  { region: "North America", pct: 42 },
                  { region: "Europe & UK", pct: 28 },
                  { region: "APAC", pct: 18 },
                  { region: "LATAM", pct: 8 },
                  { region: "MENA & Africa", pct: 4 },
                ].map((r) => (
                  <li key={r.region}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{r.region}</span>
                      <span className="font-mono">{r.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                      <div className="h-full bg-gradient-primary" style={{ width: `${r.pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
                <Globe2 className="w-3.5 h-3.5" />
                Streaming in <span className="text-foreground font-semibold">37 countries</span>
              </div>
            </Card>

            {/* Active titles */}
            <Card title="Active titles" hint="Currently in market" className="lg:col-span-2">
              <ul className="divide-y divide-border/40">
                {SAMPLE_TITLES.map((t) => (
                  <li key={t.name} className="py-3 flex items-center gap-3">
                    <div className="w-10 h-14 rounded-md bg-gradient-to-br from-accent/30 to-primary/30 shrink-0 grid place-items-center">
                      <PlayCircle className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.type} · {t.year} · {t.status}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono">{t.revenue}</p>
                      <p className="text-[11px] text-muted-foreground">{t.partners} partners</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Partner breakdown */}
            <Card title="Partner breakdown" hint="Revenue share by channel">
              <ul className="space-y-3">
                {SAMPLE_PARTNERS.map((p) => (
                  <li key={p.name} className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg grid place-items-center text-[10px] font-bold shrink-0"
                      style={{ background: p.color, color: "#0b0b12" }}
                    >
                      {p.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.kind}</p>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{p.share}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Recent licensing activity */}
            <Card title="Recent licensing activity" hint="Deals, renewals & offers" className="lg:col-span-2">
              <ul className="divide-y divide-border/40">
                {SAMPLE_ACTIVITY.map((a, i) => (
                  <li key={i} className="py-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 grid place-items-center shrink-0">
                      <FileSignature className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold">{a.event}</span>{" "}
                        <span className="text-muted-foreground">— {a.title}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {a.partner} · {a.territory} · {a.when}
                      </p>
                    </div>
                    <span className="text-xs font-mono shrink-0">{a.value}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Storage overview */}
            <Card title="Storage overview" hint="Your workspace vault">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-3xl font-display font-semibold">812 GB</p>
                  <p className="text-xs text-muted-foreground">of 1 TB plan</p>
                </div>
                <span className="text-xs font-mono text-accent">79%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-secondary/40 overflow-hidden">
                <div className="h-full bg-gradient-primary" style={{ width: "79%" }} />
              </div>
              <ul className="mt-4 space-y-2 text-xs">
                <StorageRow label="Masters (ProRes/DCP)" value="512 GB" />
                <StorageRow label="Deliverables" value="184 GB" />
                <StorageRow label="Trailers & keyart" value="72 GB" />
                <StorageRow label="Screeners & captions" value="44 GB" />
              </ul>
            </Card>
          </div>

          {/* Bottom CTA */}
          <section className="mt-14 rounded-3xl border border-border/50 glass-strong p-8 md:p-12 text-center">
            <TrendingUp className="w-8 h-8 text-accent mx-auto mb-4" />
            <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
              Ready to run the business of your catalog?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
              Sign up in under a minute. Your workspace replaces this sample data with
              your own revenue, partners, licensing and storage — automatically.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/auth?intent=signup&role=content_owner"
                className="h-12 px-6 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 glow-primary"
              >
                Create Your Creator Workspace
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/auth?intent=signup&role=content_owner"
                className="h-12 px-6 rounded-xl border border-border/60 bg-input/20 hover:bg-input/40 text-sm font-semibold inline-flex items-center justify-center"
              >
                Start Free
              </Link>
            </div>
            <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
              All figures shown on this page are demonstration data · No real customer records displayed
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/* ─────────────── sample data (illustrative only) ─────────────── */

const SAMPLE_TITLES = [
  { name: "Monsoon Highway",     type: "Feature",       year: 2025, status: "Streaming",         revenue: "$14,220", partners: 5 },
  { name: "Between Stations",    type: "Documentary",   year: 2024, status: "Streaming",         revenue: "$9,840",  partners: 4 },
  { name: "Kite Runner Reprise", type: "Short",         year: 2025, status: "In Distribution",   revenue: "$6,110",  partners: 3 },
  { name: "The Long Room",       type: "Series · S1",   year: 2024, status: "Renewal pending",   revenue: "$11,540", partners: 6 },
  { name: "Salt Coast",          type: "Feature",       year: 2023, status: "Catalog · Evergreen",revenue: "$7,010", partners: 4 },
];

const SAMPLE_PARTNERS = [
  { name: "Prime Video Direct",  kind: "SVOD",       initials: "PV", color: "#7dd3fc", share: "34%" },
  { name: "Apple TV",            kind: "TVOD / EST", initials: "AT", color: "#f5f5f5", share: "22%" },
  { name: "MX Player",           kind: "AVOD",       initials: "MX", color: "#fbbf24", share: "14%" },
  { name: "Roku Channel",        kind: "FAST",       initials: "RK", color: "#a78bfa", share: "12%" },
  { name: "Filmhub",             kind: "Aggregator", initials: "FH", color: "#34d399", share: "10%" },
  { name: "Local Syndicates",    kind: "Broadcast",  initials: "LS", color: "#fb7185", share: "8%"  },
];

const SAMPLE_ACTIVITY = [
  { event: "License signed",   title: "Monsoon Highway",     partner: "Prime Video Direct", territory: "US, CA, UK",  when: "2 days ago",  value: "$4,200" },
  { event: "Renewal offered",  title: "The Long Room S1",    partner: "Apple TV",           territory: "Worldwide",   when: "5 days ago",  value: "$6,800" },
  { event: "New offer",        title: "Between Stations",    partner: "MX Player",          territory: "India, SEA",  when: "1 week ago",  value: "$1,900" },
  { event: "Payout cleared",   title: "Salt Coast",          partner: "Roku Channel",       territory: "US",          when: "2 weeks ago", value: "$2,340" },
  { event: "Territory added",  title: "Kite Runner Reprise", partner: "Filmhub",            territory: "+ LATAM",     when: "3 weeks ago", value: "—"      },
];

/* ─────────────── primitives ─────────────── */

function Kpi({
  icon: Icon, label, value, delta, muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; delta?: string; muted?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/5 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      {delta && (
        <p className={`text-[11px] mt-1 ${muted ? "text-muted-foreground" : "text-accent"}`}>
          {delta}
        </p>
      )}
    </div>
  );
}

function Card({
  title, hint, className = "", children,
}: { title: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-border/50 bg-secondary/5 p-5 ${className}`}>
      <header className="mb-4">
        <h3 className="font-display text-base md:text-lg">{title}</h3>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono text-sm mt-0.5">{value}</p>
    </div>
  );
}

function StorageRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </li>
  );
}
