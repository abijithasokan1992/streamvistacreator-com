import { Navigate } from "react-router-dom";
import { Navbar } from "@/components/streamvista/Navbar";
import { Hero } from "@/components/streamvista/Hero";
import { HeroReel } from "@/components/streamvista/HeroReel";
import { RoleSurfaces } from "@/components/streamvista/RoleSurfaces";
import { Workflow } from "@/components/streamvista/Workflow";
import { SuccessStories } from "@/components/streamvista/SuccessStories";
import { SecuritySection } from "@/components/streamvista/SecuritySection";
import { FinalCta } from "@/components/streamvista/FinalCta";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";
import { dashboardForRole, useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, role, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to={dashboardForRole(role)} replace />;

  return (
    <main className="min-h-dvh">
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
      <RoleSurfaces />
      <Workflow />
      <SuccessStories />
      <SecuritySection />
      <FinalCta />
      <Footer />
    </main>
  );
};

export default Index;
