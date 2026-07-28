import Submissions from "@/components/creator/sections/Submissions";
import { ModuleHeader } from "@/components/creator/shell/ModuleHeader";
import { useNavigate } from "react-router-dom";
import type { SectionId } from "@/components/creator/CreatorSidebar";

export default function CreatorMarketplace() {
  const navigate = useNavigate();
  return (
    <>
      <ModuleHeader
        eyebrow="Marketplace"
        title="Buyer Marketplace"
        subtitle="Matched buyer requirements, AI licensing opportunities and screening requests for your catalog."
      />
      <Submissions
        onNavigate={(s: SectionId) => {
          if (s === "titles") navigate("/creator/catalog");
          else if (s === "billing") navigate("/creator/settings");
        }}
      />
    </>
  );
}
