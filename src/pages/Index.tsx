import { Navigate } from "react-router-dom";
import { Navbar } from "@/components/streamvista/Navbar";
import { Hero } from "@/components/streamvista/Hero";
import { PlatformOverview } from "@/components/streamvista/PlatformOverview";
import { Partners } from "@/components/streamvista/Partners";
import { Workflow } from "@/components/streamvista/Workflow";

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
        title="StreamVista Cloud X — The Digital Media Business Platform"
        description="Manage, protect, distribute, license and monetize professional media through one connected platform."
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
      
      <Partners />
      <FinalCta />
      <Footer />
    </main>
  );
};

export default Index;
