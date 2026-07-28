import DeliveryVault from "@/components/creator/sections/DeliveryVault";
import { ModuleHeader } from "@/components/creator/shell/ModuleHeader";

export default function CreatorDeliveries() {
  return (
    <>
      <ModuleHeader
        eyebrow="Studio"
        title="Deliveries"
        subtitle="Upload master files, trailers, subtitles and artwork. Track which deliverables are ready for buyers and platforms."
      />
      <DeliveryVault />
    </>
  );
}
