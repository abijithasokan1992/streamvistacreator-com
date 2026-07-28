import Submissions from "@/components/creator/sections/Submissions";
import { ModuleHeader } from "@/components/creator/shell/ModuleHeader";

export default function CreatorMarketplace() {
  return (
    <>
      <ModuleHeader
        eyebrow="Marketplace"
        title="Buyer Marketplace"
        subtitle="Matched buyer requirements, AI licensing opportunities and screening requests for your catalog."
      />
      <Submissions onNavigate={() => {}} />
    </>
  );
}
