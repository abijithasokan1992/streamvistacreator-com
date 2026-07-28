import Statements from "@/components/creator/sections/Statements";
import { ModuleHeader } from "@/components/creator/shell/ModuleHeader";

export default function CreatorRevenue() {
  return (
    <>
      <ModuleHeader
        eyebrow="Marketplace"
        title="Revenue"
        subtitle="Statements, invoices, payouts and tax documents — always workspace-scoped and reconciled with your deals."
      />
      <Statements />
    </>
  );
}
