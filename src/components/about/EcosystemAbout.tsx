import { useEffect, useState } from "react";
import { Film, Building2, Radio, Tv, Sparkles, Award, User2 } from "lucide-react";
import {
  fetchCompanyProfile,
  fetchFounderWorks,
  type CompanyProfile,
  type FounderWork,
} from "@/lib/companyProfile";

const brandIcon: Record<string, JSX.Element> = {
  crayons_pictures: <Film className="w-5 h-5" />,
  crayons_bridge: <Radio className="w-5 h-5" />,
  crayons_loop: <Tv className="w-5 h-5" />,
};

export default function EcosystemAbout() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [works, setWorks] = useState<FounderWork[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCompanyProfile(), fetchFounderWorks(true)]).then(([p, w]) => {
      setProfile(p);
      setWorks(w);
      setLoading(false);
    });
  }, []);

  if (loading || !profile) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Loading ecosystem…
      </div>
    );
  }

  const v = profile.visibility ?? { hero: true, founder: true, brands: true, works: true, thesis: true };

  return (
    <div className="space-y-16">
      {v.hero && (
        <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-secondary/30 via-background to-background p-8 md:p-12">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
          <div className="relative space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-accent">
              <Building2 className="w-4 h-4" /> About the Ecosystem
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              {profile.parent_company_name}
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              {profile.parent_company_description}
            </p>
          </div>
        </section>
      )}

      {v.brands && profile.brands?.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-accent">Operating Brands</div>
              <h2 className="font-display text-2xl md:text-3xl font-bold mt-1">
                Three brands. One ecosystem.
              </h2>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {profile.brands.map((b) => (
              <div
                key={b.key}
                className="group relative rounded-2xl border border-border/60 bg-gradient-to-b from-secondary/30 to-background p-6 hover:border-accent/60 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent grid place-items-center mb-4">
                  {brandIcon[b.key] ?? <Sparkles className="w-5 h-5" />}
                </div>
                <h3 className="font-display text-lg font-bold">{b.title}</h3>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                  {b.one_liner}
                </div>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{b.description}</p>
                {b.link && (
                  <a
                    href={b.link}
                    className="inline-block mt-4 text-xs font-semibold text-accent hover:underline"
                  >
                    Explore →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {v.founder && (
        <section className="grid md:grid-cols-[280px,1fr] gap-8 items-start rounded-3xl border border-border/60 bg-secondary/20 p-6 md:p-10">
          <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-gradient-to-br from-secondary to-background border border-border/60 grid place-items-center">
            {profile.founder_image_url ? (
              <img
                src={profile.founder_image_url}
                alt={profile.founder_image_alt ?? profile.founder_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center px-4">
                <User2 className="w-12 h-12 mx-auto text-muted-foreground/60" />
                <div className="text-xs text-muted-foreground mt-2">Founder portrait</div>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-accent">Founder</div>
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
              {profile.founder_name}
            </h2>
            <div className="text-sm text-muted-foreground leading-relaxed">
              {profile.founder_role_line}
            </div>
            <div className="h-px bg-border/60 my-2" />
            <div className="text-sm md:text-base text-muted-foreground whitespace-pre-line leading-relaxed">
              {profile.founder_bio}
            </div>
            {v.works && works.length > 0 && (
              <a
                href="#selected-works"
                className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-accent hover:underline"
              >
                <Award className="w-4 h-4" /> Selected works & milestones
              </a>
            )}
          </div>
        </section>
      )}

      {v.works && works.length > 0 && (
        <section id="selected-works" className="space-y-6 scroll-mt-24">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-accent">Filmography</div>
            <h2 className="font-display text-2xl md:text-3xl font-bold mt-1">
              Selected works & milestones
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {works.map((w) => (
              <article
                key={w.id}
                className="rounded-2xl border border-border/60 bg-gradient-to-b from-secondary/30 to-background p-6 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-bold">{w.title}</h3>
                  {w.year && (
                    <span className="text-xs text-muted-foreground shrink-0">{w.year}</span>
                  )}
                </div>
                {w.role && (
                  <div className="text-xs uppercase tracking-wider text-accent">{w.role}</div>
                )}
                {w.banner && (
                  <div className="text-[11px] text-muted-foreground">Under {w.banner}</div>
                )}
                {w.synopsis && (
                  <p className="text-sm text-muted-foreground leading-relaxed pt-1">{w.synopsis}</p>
                )}
                {w.achievement && (
                  <div className="mt-3 flex items-start gap-2 text-sm text-amber-200/90 border-t border-border/40 pt-3">
                    <Award className="w-4 h-4 mt-0.5 shrink-0 text-amber-300" />
                    <span>{w.achievement}</span>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {v.thesis && (
        <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-accent/10 via-secondary/30 to-background p-8 md:p-12">
          <div className="max-w-3xl space-y-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-accent">Why this ecosystem exists</div>
            <p className="text-lg md:text-xl font-display leading-relaxed text-foreground/90">
              {profile.ecosystem_thesis}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
