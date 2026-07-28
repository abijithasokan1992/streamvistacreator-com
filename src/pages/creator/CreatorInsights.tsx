import Home from "@/components/creator/sections/Home";
import { ModuleHeader } from "@/components/creator/shell/ModuleHeader";
import { useState, useEffect } from "react";
import { fetchFreeTierStatus } from "@/lib/creator/titleApi";
import { useNavigate } from "react-router-dom";
import type { SectionId } from "@/components/creator/CreatorSidebar";

const SECTION_TO_ROUTE: Partial<Record<SectionId, string>> = {
  titles: "/creator/catalog",
  delivery_vault: "/creator/deliveries",
  distribution: "/creator/distribution",
  submissions: "/creator/marketplace",
  business: "/creator/marketplace",
  messages: "/creator/deals",
  activity: "/creator/deals",
  updates: "/creator/deals",
  statements: "/creator/revenue",
  billing: "/creator/settings",
  storage: "/creator/settings",
  help: "/creator/settings",
  profile: "/creator/settings",
  home: "/creator/insights",
};

export default function CreatorInsights() {
  const [isFree, setIsFree] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const t = await fetchFreeTierStatus();
      setIsFree(!!t?.is_free);
    })();
  }, []);

  return (
    <>
      <ModuleHeader
        eyebrow="Account"
        title="Insights"
        subtitle="Portfolio pulse, revenue trends, buyer signals and next-best actions across your catalog."
      />
      <Home
        isFree={isFree}
        onNavigate={(s) => {
          const route = SECTION_TO_ROUTE[s as string];
          if (route) navigate(route);
        }}
      />
    </>
  );
}
