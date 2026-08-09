import { Navigate } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { dashboardForRole, useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/components/theme/ThemeProvider";

const routes = [
  {
    href: "/film-distribution",
    title: "Create & distribute",
    copy: "For creators, producers and content owners",
  },
  {
    href: "/buyers",
    title: "Discover & license",
    copy: "For buyers, platforms and media partners",
  },
  {
    href: "https://www.crayonsloop.com/login",
    title: "Crayons Loop",
    copy: "Submit content for licensing opportunities",
  },
];

const Index = () => {
  const { user, role, loading } = useAuth();
  const { resolved, setMode } = useTheme();

  if (loading) return null;
  if (user) return <Navigate to={dashboardForRole(role)} replace />;

  const nextTheme = resolved === "dark" ? "light" : "dark";

  return (
    <main className="stories-home">
      <Seo
        title="StreamVista — Stories move here."
        description="StreamVista connects stories, rights, distribution and audiences."
        path="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "StreamVista",
            legalName: "STREAMVISTA (OPC) PRIVATE LIMITED",
            url: "https://streamvista.in/",
            founder: { "@type": "Person", name: "Abijith Asokan" },
            areaServed: "Worldwide",
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "StreamVista",
            url: "https://streamvista.in/",
            description: "Stories, rights and reach for creators, buyers and media partners.",
          },
        ]}
      />

      <div className="stories-page">
        <header className="stories-top">
          <a className="stories-brand" href="/" aria-label="StreamVista home">
            <span className="stories-mark" aria-hidden="true">SV</span>
            <span className="stories-word">STREAMVISTA</span>
          </a>
          <div className="stories-tools">
            <button
              className="stories-theme"
              type="button"
              onClick={() => setMode(nextTheme)}
              aria-label={`Switch to ${nextTheme} theme`}
            >
              <span className="stories-theme-dot" aria-hidden="true" />
              <span>{resolved === "dark" ? "White" : "Black"}</span>
            </button>
            <a className="stories-signin" href="/auth?next=/dashboard">Sign in</a>
          </div>
        </header>

        <section className="stories-hero">
          <div className="stories-copy">
            <p className="stories-eyebrow">Stories · Rights · Reach</p>
            <h1 className="stories-title">Stories <em>move</em><br />here.</h1>
            <p className="stories-summary">
              One clear path for media: create, discover, distribute and reach the right audience.
            </p>
            <a className="stories-primary" href="/connect?intent=conversation">
              Start a conversation <span aria-hidden="true">→</span>
            </a>
            <p className="stories-hint">Already have an account? <a href="/auth?next=/dashboard">Sign in</a></p>
          </div>

          <div className="stories-sphere-wrap" aria-hidden="true">
            <div className="stories-sphere-stage">
              <div className="stories-sphere-aura" />
              <div className="stories-sphere-shadow" />
              <div className="stories-sphere" />
              <div className="stories-orbit one" />
              <div className="stories-orbit two" />
              <div className="stories-glint" />
            </div>
          </div>
        </section>

        <nav className="stories-routes" aria-label="StreamVista pathways">
          {routes.map((item) => {
            const external = item.href.startsWith("http");
            return (
              <a
                className="stories-route"
                href={item.href}
                key={item.title}
                {...(external ? { rel: "noreferrer" } : {})}
              >
                <span><strong>{item.title}</strong><span>{item.copy}</span></span>
                <b aria-hidden="true">↗</b>
              </a>
            );
          })}
        </nav>

        <footer className="stories-foot">
          <span>STREAMVISTA (OPC) PRIVATE LIMITED</span>
          <span><a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/contact">Contact</a></span>
        </footer>
      </div>
    </main>
  );
};

export default Index;
