import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Navbar } from "@/components/streamvista/Navbar";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";

export interface CrumbLink {
  name: string;
  path: string;
}

export interface LandingSection {
  heading: string;
  body: ReactNode;
}

export interface LandingLayoutProps {
  title: string;
  description: string;
  path: string;
  h1: string;
  intro: ReactNode;
  sections: LandingSection[];
  ctaLabel?: string;
  ctaHref?: string;
  serviceName?: string;
  serviceType?: string;
  crumbs?: CrumbLink[];
  relatedLinks?: CrumbLink[];
}

const SITE = "https://streamvista.in";

const DISCLAIMER =
  "StreamVista provides professional connectivity and workflow support. Buyer response, licensing, distribution, release and revenue are not guaranteed.";

const DEFAULT_RELATED: CrumbLink[] = [
  { name: "Sell Your Film", path: "/sell-your-film" },
  { name: "Film Distribution", path: "/film-distribution" },
  { name: "OTT Content Licensing", path: "/ott-content-licensing" },
  { name: "For Content Owners", path: "/content-owners" },
  { name: "For Buyers", path: "/buyers" },
  { name: "Film Rights", path: "/film-rights" },
  { name: "Regional Indian Cinema", path: "/regional-indian-cinema" },
  { name: "Global Film Sales", path: "/global-film-sales" },
  { name: "How It Works", path: "/how-it-works" },
  { name: "Trust & Rights", path: "/trust-and-rights" },
];

export function LandingLayout({
  title,
  description,
  path,
  h1,
  intro,
  sections,
  ctaLabel = "Create a Free Account",
  ctaHref = "/auth?intent=signup",
  serviceName,
  serviceType = "Service",
  crumbs = [],
  relatedLinks,
}: LandingLayoutProps) {
  const url = `${SITE}${path}`;
  const related = (relatedLinks ?? DEFAULT_RELATED).filter((r) => r.path !== path);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      ...crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: c.name,
        item: `${SITE}${c.path}`,
      })),
      { "@type": "ListItem", position: crumbs.length + 2, name: h1, item: url },
    ],
  };

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": serviceType,
    name: serviceName ?? h1,
    description,
    url,
    provider: {
      "@type": "Organization",
      name: "StreamVista",
      alternateName: "StreamVista Global Film Content Network",
      url: `${SITE}/`,
    },
    areaServed: "Worldwide",
  };

  return (
    <main className="min-h-dvh bg-background">
      <Seo
        title={title}
        description={description}
        path={path}
        jsonLd={[breadcrumbLd, serviceLd]}
      />
      <Navbar />

      <article className="container max-w-4xl py-20 md:py-28">
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
            <ol className="flex flex-wrap gap-1">
              <li>
                <Link to="/" className="hover:text-foreground">Home</Link>
                <span className="mx-1">/</span>
              </li>
              {crumbs.map((c) => (
                <li key={c.path}>
                  <Link to={c.path} className="hover:text-foreground">{c.name}</Link>
                  <span className="mx-1">/</span>
                </li>
              ))}
              <li aria-current="page" className="text-foreground">{h1}</li>
            </ol>
          </nav>
        )}

        <header className="mb-10">
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight text-foreground">
            {h1}
          </h1>
          <div className="mt-6 text-lg text-muted-foreground leading-relaxed space-y-4">
            {intro}
          </div>
        </header>

        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground mb-4">
                {s.heading}
              </h2>
              <div className="text-base text-muted-foreground leading-relaxed space-y-4">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <aside
          role="note"
          className="mt-12 rounded-md border border-border/60 bg-muted/30 p-5 text-sm text-muted-foreground"
        >
          <strong className="text-foreground">Important:</strong> {DISCLAIMER}
        </aside>

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <Link
            to={ctaHref}
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary text-primary-foreground font-semibold uppercase tracking-wider text-sm hover:opacity-90"
          >
            {ctaLabel} <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md border border-border hover:border-accent/60 text-foreground font-semibold uppercase tracking-wider text-sm"
          >
            Send an Enquiry
          </Link>
        </div>

        {related.length > 0 && (
          <nav aria-label="Related pages" className="mt-16 border-t border-border/50 pt-8">
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">
              Explore StreamVista
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {related.map((r) => (
                <li key={r.path}>
                  <Link to={r.path} className="text-muted-foreground hover:text-foreground underline underline-offset-4">
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </article>

      <Footer />
    </main>
  );
}
