import { Navigate } from "react-router-dom";
import { Navbar } from "@/components/streamvista/Navbar";
import { Hero } from "@/components/streamvista/Hero";
import { FinalCta } from "@/components/streamvista/FinalCta";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";
import { dashboardForRole, useAuth } from "@/hooks/useAuth";

const homePillars = [
  {
    title: "Upload & Organize",
    description: "Bring title metadata, screeners, masters, artwork and supporting files into one creator workspace.",
  },
  {
    title: "Rights & Readiness",
    description: "Prepare ownership, territory, language, legal documents and QC status before commercial review.",
  },
  {
    title: "Buyer & Delivery",
    description: "Move approved titles into controlled buyer, licensing and secure delivery workflows.",
  },
];

const Index = () => {
  const { user, role, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to={dashboardForRole(role)} replace />;

  return (
    <main className="min-h-dvh home-serif">
      <Seo
        title="StreamVista Creator — Prepare Content for Licensing & Distribution"
        description="A focused creator workspace for title onboarding, media assets, rights readiness, QC and professional distribution workflows."
        path="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "StreamVista",
            legalName: "STREAMVISTA (OPC) PRIVATE LIMITED",
            url: "https://streamvista.in/",
            founder: {
              "@type": "Person",
              name: "Abijith Asokan",
            },
            areaServed: "Worldwide",
          },
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "StreamVista Creator Content Readiness Workspace",
            description:
              "Creator and studio workflow for content onboarding, rights readiness, QC, secure screening and delivery preparation.",
            provider: {
              "@type": "Organization",
              name: "StreamVista",
              legalName: "STREAMVISTA (OPC) PRIVATE LIMITED",
            },
          },
        ]}
      />

      <Navbar />
      <Hero />

      <section id="workflow" className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-7 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Creator workflow</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">One clear path from title to readiness.</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {homePillars.map((item, index) => (
            <article key={item.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground">0{index + 1}</span>
              <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/30 p-5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Have content ready to submit?</p>
            <p className="mt-1 text-sm text-muted-foreground">Start with title details and rights ownership. Licensing remains subject to review and written terms.</p>
          </div>
          <a
            href="https://www.crayonsloop.com/login"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Submit content
          </a>
        </div>
      </section>

      <FinalCta />
      <Footer />
    </main>
  );
};

export default Index;
