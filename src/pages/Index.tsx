import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Navbar } from "@/components/streamvista/Navbar";
import { Hero } from "@/components/streamvista/Hero";
import { PlatformOverview } from "@/components/streamvista/PlatformOverview";
import { Partners } from "@/components/streamvista/Partners";
import { Workflow } from "@/components/streamvista/Workflow";
import { WhyStreamVista } from "@/components/streamvista/WhyStreamVista";
import { FinalCta } from "@/components/streamvista/FinalCta";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";
import { dashboardForRole, useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, role, loading } = useAuth();

  if (loading) return (
    <div
      className="min-h-dvh grid place-items-center text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </div>
  );
  if (user) return <Navigate to={dashboardForRole(role)} replace />;

  return (
    <main className="min-h-dvh home-serif">
      <Seo
        title="StreamVista Cloud X — Secure content operations, camera to licensing"
        description="One secure platform for professional content operations — ingest, store, prepare and license your titles end-to-end."
        path="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "StreamVista",
            url: "https://streamvistacreator.com/",
          },
        ]}
      />
      <Navbar />
      <Hero />
      <PlatformOverview />
      <Workflow />
      <WhyStreamVista />
      <Partners />
      <FinalCta />
      <Footer />
    </main>
  );
};

export default Index;
