import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Loader2,
  ArrowRight,
  Globe,
  Languages,
  Film,
  Radio,
  Sparkles,
  Cpu,
  ClipboardCheck,
  Package,
  Send,
  BadgeCheck,
  Wallet,
  Upload,
  FileText,
} from "lucide-react";
import { Navbar } from "@/components/streamvista/Navbar";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";
import { fetchPartnerProfiles, type PartnerProfile } from "@/lib/partnerProfiles";
import { Badge } from "@/components/ui/badge";

const CATEGORY_ORDER: string[] = [
  "OTT & Streaming",
  "Broadcasters",
  "FAST",
  "TVOD",
  "AVOD",
  "SVOD",
  "Educational",
  "Airlines",
  "Rights Buyers",
  "Distribution Partners",
];

/** Best-effort match between free-form partner categories in the DB and the
 *  10 canonical buckets we surface in the portal. Any partner that doesn't
 *  match a bucket falls through into "Distribution Partners". */
function bucketFor(partner: PartnerProfile): string {
  const cats = (partner.categories ?? []).map((c) => c.toLowerCase());
  const hit = (needles: string[]) =>
    cats.some((c) => needles.some((n) => c.includes(n)));

  if (hit(["fast"])) return "FAST";
  if (hit(["tvod", "transactional"])) return "TVOD";
  if (hit(["svod", "subscription"])) return "SVOD";
  if (hit(["avod", "ad-supported", "ad supported"])) return "AVOD";
  if (hit(["broadcast", "linear", "tv "])) return "Broadcasters";
  if (hit(["educat", "library", "school"])) return "Educational";
  if (hit(["airline", "hospitality", "inflight"])) return "Airlines";
  if (hit(["rights", "licens"])) return "Rights Buyers";
  if (hit(["distribut", "aggregator"])) return "Distribution Partners";
  if (hit(["ott", "stream", "vod"])) return "OTT & Streaming";
  return "Distribution Partners";
}

export default function Partners() {
  const [items, setItems] = useState<PartnerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [detailFor, setDetailFor] = useState<PartnerProfile | null>(null);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    fetchPartnerProfiles().then((result) => {
      if (result.status === "ok") {
        setItems(result.partners);
      } else {
        setItems([]);
        setLoadError(result.message);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, PartnerProfile[]>();
    for (const c of CATEGORY_ORDER) map.set(c, []);
    for (const p of items) {
      const b = bucketFor(p);
      map.get(b)!.push(p);
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    if (activeCategory === "All") return items;
    return items.filter((p) => bucketFor(p) === activeCategory);
  }, [items, activeCategory]);

  const hasVerifiedPartners = items.length > 0;

  return (
    <>
      <Seo
        path="/partners"
        title="Partner Ecosystem — StreamVista Cloud X"
        description="Distribution and licensing partners in the StreamVista network — OTT, broadcasters, FAST, TVOD, AVOD, SVOD, educational, airline and rights-buyer categories."
      />
      <Navbar />
      <main className="pt-24">
        {/* 1. Hero */}
        <section className="container py-16 md:py-24">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
              Partner ecosystem
            </span>
          </div>
          <h1 className="font-display font-black uppercase leading-[0.9] tracking-tight text-5xl md:text-7xl max-w-4xl">
            Distribution &{" "}
            <span className="gradient-text">licensing partners.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            StreamVista is building a curated network of streamers, broadcasters, FAST channels,
            educational libraries, airline networks and rights buyers. Every listed partner is
            an active relationship — categories with no listings are open for applications.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/auth?intent=signup&role=content_owner"
              className="cta-guide inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full bg-gradient-primary text-primary-foreground hover:scale-[1.03] transition-transform"
            >
              Enter Creator workspace <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#become-a-partner"
              className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full border border-border-strong/60 hover:border-primary/60 transition-colors"
            >
              Become a partner
            </a>
          </div>
        </section>

        {/* 2. Partner Categories */}
        <section className="container pb-4">
          <div className="eyebrow mb-4">Partner categories</div>
          <div className="flex flex-wrap gap-2">
            <CategoryChip
              label={`All (${items.length})`}
              active={activeCategory === "All"}
              onClick={() => setActiveCategory("All")}
            />
            {CATEGORY_ORDER.map((c) => {
              const count = grouped.get(c)?.length ?? 0;
              return (
                <CategoryChip
                  key={c}
                  label={`${c}${count ? ` (${count})` : ""}`}
                  active={activeCategory === c}
                  onClick={() => setActiveCategory(c)}
                  muted={count === 0}
                />
              );
            })}
          </div>
        </section>

        {/* 3. Partner Directory */}
        <section className="container py-12">
          <div className="eyebrow mb-4">
            Partner directory {activeCategory !== "All" ? `— ${activeCategory}` : ""}
          </div>
          {loading ? (
            <div className="py-20 text-center text-sm text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="w-5 h-5 animate-spin inline-block mr-2 align-middle" />
              Loading partner directory…
            </div>
          ) : loadError ? (
            <div
              role="alert"
              className="py-10 px-6 text-center border border-destructive/40 bg-destructive/5 rounded-2xl"
            >
              <div className="text-sm font-semibold text-destructive mb-2">
                Couldn't load the partner directory.
              </div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">
                {loadError}
              </p>
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full border border-border/60 hover:border-primary/60 transition-colors"
              >
                Try again
              </button>
            </div>
          ) : !hasVerifiedPartners ? (
            <div className="py-14 px-6 text-center border border-dashed border-border/60 rounded-2xl">
              <div className="eyebrow mb-2">No verified partners listed yet</div>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-5">
                The StreamVista partner directory only shows relationships we can back with
                a written agreement. We're actively onboarding — if you operate a platform,
                broadcaster, FAST channel or licensing desk, we'd love to talk.
              </p>
              <Link
                to="/contact?topic=partner"
                className="inline-flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-full bg-gradient-primary text-primary-foreground"
              >
                Apply as a partner <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground border border-dashed border-border/60 rounded-2xl">
              No partners in this category yet.{" "}
              <Link to="/contact?topic=partner" className="text-primary hover:underline">
                Apply to be the first
              </Link>
              .
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((p) => (
                <PartnerCard
                  key={p.id}
                  partner={p}
                  bucket={bucketFor(p)}
                  onView={() => setDetailFor(p)}
                />
              ))}
            </div>
          )}
        </section>


        {/* 4. AI Compatibility */}
        <section className="container py-16">
          <div className="relative overflow-hidden rounded-3xl border border-border-strong/60 glass p-8 md:p-12">
            <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: "hsl(var(--primary-glow) / 0.18)" }} />
            <div className="flex items-start gap-4 mb-5">
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-3">
                <Cpu className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="eyebrow">AI Compatibility</div>
                <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight mt-1">
                  Right title. <span className="gradient-text">Right buyer.</span>
                </h2>
              </div>
            </div>
            <p className="max-w-3xl text-muted-foreground leading-relaxed">
              StreamVista analyzes every title in your catalog and recommends the most suitable
              partners based on metadata, rights, language, territory and technical specifications.
              You see a ranked shortlist and a clear gap analysis for each opportunity — instead
              of blasting the same package to every platform.
            </p>
            <ul className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {[
                "Genre & tone alignment",
                "Rights & territory match",
                "Language & subtitle coverage",
                "Technical delivery fit",
              ].map((f) => (
                <li key={f} className="rounded-lg border border-border/50 bg-card/40 px-3 py-2 text-foreground/85">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 5. Submission Requirements */}
        <section className="container py-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="rounded-xl bg-accent/10 border border-accent/20 p-3">
              <FileText className="w-6 h-6 text-accent" />
            </div>
            <div>
              <div className="eyebrow">Submission requirements</div>
              <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight mt-1">
                Delivery specs, in plain sight.
              </h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Every partner card links to its full delivery brief — accepted formats, resolution
                floors, audio and subtitle requirements, packaging notes and turnaround times.
                Open a partner to review before you submit.
              </p>
            </div>
          </div>
        </section>

        {/* 6. Distribution Workflow */}
        <section className="container py-16">
          <div className="eyebrow mb-4">Distribution workflow</div>
          <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight mb-8">
            Upload once. <span className="gradient-text">Ship everywhere.</span>
          </h2>
          <ol className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { icon: Upload, label: "Upload" },
              { icon: ClipboardCheck, label: "QC" },
              { icon: FileText, label: "Metadata" },
              { icon: Package, label: "Packaging" },
              { icon: Cpu, label: "Partner match" },
              { icon: Send, label: "Delivery" },
              { icon: BadgeCheck, label: "Approval" },
              { icon: Wallet, label: "Revenue" },
            ].map((step, i) => (
              <li
                key={step.label}
                className="rounded-2xl border border-border-strong/60 bg-card/40 p-4 flex flex-col items-start gap-2 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-[10px] font-mono-tech uppercase tracking-[0.2em] text-muted-foreground/70">
                  Step {String(i + 1).padStart(2, "0")}
                </div>
                <step.icon className="w-5 h-5 text-primary" />
                <div className="text-sm font-semibold">{step.label}</div>
              </li>
            ))}
          </ol>
        </section>

        {/* 7. Become a Partner */}
        <section id="become-a-partner" className="container py-24">
          <div className="relative overflow-hidden rounded-3xl border border-border-strong/60 glass p-10 md:p-14 text-center">
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: "hsl(var(--primary-glow) / 0.20)" }} />
            <Sparkles className="w-8 h-8 mx-auto mb-4 text-primary" />
            <div className="eyebrow mb-2">Become a partner</div>
            <h2 className="font-display text-3xl md:text-5xl font-black tracking-tight">
              Distribute with <span className="gradient-text">StreamVista.</span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Platforms, broadcasters and rights buyers: connect once and receive
              spec-compliant, rights-cleared titles from every studio in the StreamVista network.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/contact?topic=partner"
                className="cta-guide inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full bg-gradient-primary text-primary-foreground hover:scale-[1.03] transition-transform"
              >
                Apply as a partner <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/connect"
                className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full border border-border-strong/60 hover:border-primary/60 transition-colors"
              >
                View integrations
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />

      {/* Submission requirements detail */}
      {detailFor && (
        <PartnerDetailDialog partner={detailFor} bucket={bucketFor(detailFor)} onClose={() => setDetailFor(null)} />
      )}
    </>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
  muted,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : muted
          ? "border-border/40 text-muted-foreground/60 hover:text-muted-foreground"
          : "border-border/60 bg-card/40 text-foreground/85 hover:border-primary/50"
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function PartnerCard({
  partner,
  bucket,
  onView,
}: {
  partner: PartnerProfile;
  bucket: string;
  onView: () => void;
}) {
  const submissionStatus = partner.submission_requirements
    ? "Open for submissions"
    : "By invitation";
  const deliveryMethod = partner.min_resolution
    ? "Aspera / S3 delivery"
    : "Direct upload";

  return (
    <article className="group relative rounded-2xl border border-border-strong/60 glass p-6 hover:border-primary/60 hover:-translate-y-1 transition-all duration-500 flex flex-col">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="h-14 w-32 rounded-lg bg-card/40 flex items-center justify-center overflow-hidden">
          {partner.logo_url ? (
            <img
              src={partner.logo_url}
              alt={`${partner.name} logo`}
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              className="max-h-10 max-w-[85%] w-auto object-contain"
            />
          ) : (
            <Film className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
          {bucket}
        </Badge>
      </div>

      <h3 className="font-display text-xl font-black tracking-tight">{partner.name}</h3>
      {partner.tagline && (
        <div className="text-[10px] font-mono-tech uppercase tracking-[0.22em] text-primary mt-1">
          {partner.tagline}
        </div>
      )}

      <dl className="mt-4 space-y-2 text-xs flex-1">
        {partner.territories?.length > 0 && (
          <Row icon={Globe} label="Territories" value={partner.territories.slice(0, 3).join(", ")} />
        )}
        {partner.content_preferences?.length > 0 && (
          <Row icon={Film} label="Content types" value={partner.content_preferences.slice(0, 3).join(", ")} />
        )}
        {partner.min_resolution && (
          <Row icon={Radio} label="Supported formats" value={`${partner.min_resolution}+`} />
        )}
        <Row icon={Send} label="Delivery method" value={deliveryMethod} />
        <Row icon={BadgeCheck} label="Submission status" value={submissionStatus} />
        {partner.languages?.length > 0 && (
          <Row icon={Languages} label="Languages" value={partner.languages.slice(0, 3).join(", ")} />
        )}
      </dl>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.18em] text-primary hover:underline"
        >
          View requirements <ArrowRight className="w-3 h-3" />
        </button>
        {partner.website_url && (
          <a
            href={partner.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Visit site
          </a>
        )}
      </div>
    </article>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Globe;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-muted-foreground">
      <Icon className="w-3.5 h-3.5 text-accent mt-[2px] shrink-0" />
      <div className="min-w-0">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          {label}
        </span>
        <div className="text-foreground/85 truncate">{value}</div>
      </div>
    </div>
  );
}

function PartnerDetailDialog({
  partner,
  bucket,
  onClose,
}: {
  partner: PartnerProfile;
  bucket: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${partner.name} submission requirements`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-auto rounded-2xl border border-border-strong/60 bg-card p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider mb-2">
              {bucket}
            </Badge>
            <h3 className="font-display text-2xl font-black tracking-tight">{partner.name}</h3>
            {partner.tagline && (
              <div className="text-[10px] font-mono-tech uppercase tracking-[0.22em] text-primary mt-1">
                {partner.tagline}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            Close ✕
          </button>
        </div>

        {partner.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {partner.description}
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          {partner.min_resolution && (
            <Spec label="Minimum resolution" value={partner.min_resolution} />
          )}
          {partner.audio_requirements && (
            <Spec label="Audio" value={partner.audio_requirements} />
          )}
          {partner.subtitle_requirements && (
            <Spec label="Subtitles" value={partner.subtitle_requirements} />
          )}
          {partner.runtime_min_minutes != null && partner.runtime_max_minutes != null && (
            <Spec
              label="Runtime"
              value={`${partner.runtime_min_minutes}–${partner.runtime_max_minutes} min`}
            />
          )}
          {partner.exclusivity && <Spec label="Exclusivity" value={partner.exclusivity} />}
          {partner.deal_timeline_days != null && (
            <Spec label="Deal timeline" value={`${partner.deal_timeline_days} days`} />
          )}
          {partner.licensing_models?.length > 0 && (
            <Spec label="Licensing" value={partner.licensing_models.join(" · ")} />
          )}
          {partner.territories?.length > 0 && (
            <Spec label="Territories" value={partner.territories.join(", ")} />
          )}
        </div>

        {partner.submission_requirements && (
          <div className="mt-6">
            <div className="eyebrow mb-2">Submission requirements</div>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
              {partner.submission_requirements}
            </p>
          </div>
        )}

        {partner.revenue_share_notes && (
          <div className="mt-6">
            <div className="eyebrow mb-2">Revenue share</div>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {partner.revenue_share_notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
        {label}
      </div>
      <div className="text-sm text-foreground/90 mt-1">{value}</div>
    </div>
  );
}
