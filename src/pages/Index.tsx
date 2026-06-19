import { Navigate } from "react-router-dom";
import { Navbar } from "@/components/streamvista/Navbar";
import { Hero } from "@/components/streamvista/Hero";
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
        title="StreamVista Cloud X — Creator Cloud Studio"
        description="The creator cloud studio built for cinema. Upload, review, and deliver from set to screen."
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
      <Footer />
    </main>
  );
};

export default Index;
