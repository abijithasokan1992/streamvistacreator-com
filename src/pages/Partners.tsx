import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Globe, Languages, Film, Radio, Sparkles } from "lucide-react";
import { Navbar } from "@/components/streamvista/Navbar";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";
import { fetchPartnerProfiles, type PartnerProfile } from "@/lib/partnerProfiles";
import { Badge } from "@/components/ui/badge";

export default function Partners() {
  const [items, setItems] = useState<PartnerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPartnerProfiles().then((rows) => {
      setItems(rows);
      setLoading(false);
    });
  }, []);

  const featured = items.filter((p) => p.is_featured);
  const rest = items.filter((p) => !p.is_featured);

  return (
    <>
      <Seo
        title="Partners — StreamVista Cloud X"
        description="The distribution and streaming platforms in the StreamVista ecosystem — from mass-reach SVOD to premium TVOD, regional-first services and short-form networks."
        canonical="/partners"
      />
      <Navbar />
      <main className="pt-24">
        {/* Hero */}
        <section className="container py-16 md:py-24">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
              Connected media ecosystem
            </span>
          </div>
          <h1 className="font-display font-black uppercase leading-[0.9] tracking-tight text-5xl md:text-7xl max-w-4xl">
            One workspace.
            <br />
            <span className="gradient-text">Every buyer.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            StreamVista is plugged into the streamers, broadcasters and rights buyers your titles need to
            reach — mass-market SVOD, premium TVOD, regional platforms and short-form networks. Ship
            once, distribute everywhere.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/auth?intent=signup&role=content_owner"
              className="cta-guide inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full bg-gradient-primary text-primary-foreground hover:scale-[1.03] transition-transform"
            >
              Enter Creator workspace <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full border border-border-strong/60 hover:border-primary/60 transition-colors"
            >
              Become a partner
            </Link>
          </div>
        </section>

        {/* Featured */}
        {loading ? (
          <div className="container py-20 text-center text-sm text-muted-foreground">Loading partners…</div>
        ) : (
          <>
            {featured.length > 0 && (
              <section className="container pb-8">
                <div className="eyebrow mb-4">Featured partners</div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {featured.map((p) => <PartnerCard key={p.id} partner={p} featured />)}
                </div>
              </section>
            )}

            {rest.length > 0 && (
              <section className="container py-12">
                <div className="eyebrow mb-4">Regional & specialty</div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {rest.map((p) => <PartnerCard key={p.id} partner={p} />)}
                </div>
              </section>
            )}
          </>
        )}

        {/* CTA */}
        <section className="container py-24">
          <div className="relative overflow-hidden rounded-3xl border border-border-strong/60 glass p-10 md:p-14 text-center">
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: "hsl(var(--primary-glow) / 0.20)" }} />
            <Sparkles className="w-8 h-8 mx-auto mb-4 text-primary" />
            <h2 className="font-display text-3xl md:text-5xl font-black tracking-tight">
              See which partners <span className="gradient-text">fit your titles.</span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Sign in to the Creator workspace to see submission requirements, licensing terms and an
              AI-powered compatibility score for every title in your catalog.
            </p>
            <Link
              to="/auth?intent=signup&role=content_owner"
              className="cta-guide mt-8 inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full bg-gradient-primary text-primary-foreground hover:scale-[1.03] transition-transform"
            >
              Start free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function PartnerCard({ partner, featured }: { partner: PartnerProfile; featured?: boolean }) {
  return (
    <article
      className={`group relative rounded-2xl border border-border-strong/60 glass p-6 hover:border-primary/60 hover:-translate-y-1 transition-all duration-500 ${featured ? "md:p-7" : ""}`}
    >
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
        {partner.categories?.slice(0, 1).map((c) => (
          <Badge key={c} variant="outline" className="text-[10px] uppercase tracking-wider">{c}</Badge>
        ))}
      </div>

      <h3 className="font-display text-xl font-black tracking-tight">{partner.name}</h3>
      {partner.tagline && (
        <div className="text-[10px] font-mono-tech uppercase tracking-[0.22em] text-primary mt-1">
          {partner.tagline}
        </div>
      )}
      {partner.description && (
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-3">
          {partner.description}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        {partner.licensing_models?.length > 0 && (
          <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
            <Radio className="w-3.5 h-3.5 text-accent" />
            <span className="truncate">{partner.licensing_models.join(" · ")}</span>
          </div>
        )}
        {partner.territories?.length > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="w-3.5 h-3.5 text-accent" />
            <span className="truncate">{partner.territories.slice(0, 3).join(", ")}</span>
          </div>
        )}
        {partner.languages?.length > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Languages className="w-3.5 h-3.5 text-accent" />
            <span className="truncate">{partner.languages.slice(0, 3).join(", ")}</span>
          </div>
        )}
      </dl>

      {partner.website_url && (
        <a
          href={partner.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-5 text-xs font-bold uppercase tracking-[0.18em] text-primary hover:underline"
        >
          Visit site <ArrowRight className="w-3 h-3" />
        </a>
      )}
    </article>
  );
}
