import { Navigate } from "react-router-dom";
import { Navbar } from "@/components/streamvista/Navbar";
import { Hero } from "@/components/streamvista/Hero";
import { PlanFeature } from "@/components/streamvista/PlanFeature";
import { ComparisonTable } from "@/components/streamvista/ComparisonTable";
import { Testimonials } from "@/components/streamvista/Testimonials";
import { Pricing } from "@/components/streamvista/Pricing";
import { CloudStudioPartners } from "@/components/streamvista/CloudStudioPartners";
import { Footer } from "@/components/streamvista/Footer";
import { CmsHeroBanners, CmsAdZone, CmsFeaturedFilms, CmsNewsEvents } from "@/components/streamvista/CmsSections";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, loading } = useAuth();

  // While auth is initializing, render nothing (avoids flash of landing page)
  if (loading) return null;

  // Authenticated users go straight to their dashboard
  if (user) return <Navigate to="/projects" replace />;

  // Public landing page for guests
  return (
    <main className="min-h-dvh">
      <Seo
        title="StreamVista Cloud X — Creator Studio Cloud Storage"
        description="Secure cloud workspace for filmmakers, studios and creators — C CLOUD-backed storage, controlled sharing, DMCA protection, and pricing that scales from free to full production."
        path="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "StreamVista",
            url: "https://streamvistacreator.com/",
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "StreamVista Cloud X",
            url: "https://streamvistacreator.com/",
          },
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "StreamVista Cloud X",
            provider: { "@type": "Organization", name: "StreamVista OPC Pvt Ltd" },
            serviceType: "Creator cloud storage and distribution",
            areaServed: "Global",
          },
        ]}
      />
      <Navbar />
      <Hero />
      <CmsHeroBanners />
      <CmsAdZone slot="top" />
      <PlanFeature />
      <CmsFeaturedFilms />
      <ComparisonTable />
      <CmsAdZone slot="mid" />
      <Testimonials />
      <CmsNewsEvents />
      <CloudStudioPartners />
      <Pricing />
      <CmsAdZone slot="bottom" />
      <Footer />
    </main>
  );
};

export default Index;
