import { Navigate } from "react-router-dom";
import { Navbar } from "@/components/streamvista/Navbar";
import { Hero } from "@/components/streamvista/Hero";
import { RoleSurfaces } from "@/components/streamvista/RoleSurfaces";
import { Pricing } from "@/components/streamvista/Pricing";
import { BuyerEntry } from "@/components/streamvista/BuyerEntry";
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
        title="StreamVista — Secure media cloud for creators, studios & buyers"
        description="One platform for title intake, recurring storage, post & vault workflows, and buyer rights requests. Self-serve where it makes sense, founder-assisted where it matters."
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
      <Pricing />
      <BuyerEntry />
      <Footer />
    </main>
  );
};

export default Index;
