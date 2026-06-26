import { Navigate } from "react-router-dom";
import { Navbar } from "@/components/streamvista/Navbar";
import { Hero } from "@/components/streamvista/Hero";
import { HeroReel } from "@/components/streamvista/HeroReel";
import { SuccessStories } from "@/components/streamvista/SuccessStories";
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

  if (loading) return null;
  if (user) return <Navigate to={dashboardForRole(role)} replace />;

  return (
    <main className="min-h-dvh home-serif">
      <Seo
        title="StreamVista — Secure cinema & content cloud, intake to deal"
        description="One secure cinema and content cloud for creators, studios and licensing teams — ingest, store, prepare, control access and license your titles end-to-end."
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
      <HeroReel />
      <SuccessStories />
      <PlatformOverview />
      <Workflow />
      <Partners />
      <WhyStreamVista />
      <FinalCta />
      <Footer />
    </main>
  );
};

export default Index;
