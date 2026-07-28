import Distribution from "@/components/creator/sections/Distribution";
import { ModuleHeader } from "@/components/creator/shell/ModuleHeader";

export default function CreatorDistribution() {
  return (
    <>
      <ModuleHeader
        eyebrow="Studio"
        title="Distribution"
        subtitle="Program offers, territory plans and platform delivery status for your published titles."
      />
      <Distribution />
    </>
  );
}
