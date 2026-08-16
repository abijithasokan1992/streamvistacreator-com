import { Navigate } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { PublicAiHome } from "@/components/streamvista/PublicAiHome";
import { dashboardForRole, useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, role, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to={dashboardForRole(role)} replace />;

  return (
    <>
      <Seo
        title="StreamVista AI — Film Rights, Licensing & Distribution"
        description="Ask StreamVista AI about content submission, rights readiness, buyers, licensing workflows and delivery preparation for films, series and documentaries."
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
            name: "StreamVista Film Rights, Licensing and Distribution Workflow",
            description:
              "Public media-business guidance for creators, rights holders and professional buyers, with pathways for content submission, rights readiness, licensing and delivery preparation.",
            provider: {
              "@type": "Organization",
              name: "StreamVista",
              legalName: "STREAMVISTA (OPC) PRIVATE LIMITED",
            },
          },
        ]}
      />
      <PublicAiHome />
    </>
  );
};

export default Index;
