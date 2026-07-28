import Updates from "@/components/creator/sections/Updates";
import { ModuleHeader } from "@/components/creator/shell/ModuleHeader";

export default function CreatorDeals() {
  return (
    <>
      <ModuleHeader
        eyebrow="Marketplace"
        title="Deals & Rights"
        subtitle="Active deal memos, offer rounds, screening invites and rights availability for every title."
      />
      <Updates />
    </>
  );
}
