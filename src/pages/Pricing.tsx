import { Navbar } from "@/components/streamvista/Navbar";
import { Pricing } from "@/components/streamvista/Pricing";
import { ComparisonTable } from "@/components/streamvista/ComparisonTable";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";
import { useCreatorPaygPrice } from "@/hooks/usePublicPlans";
import { RevenueServicesSection } from "@/pages/Services";

export default function PricingPage() {
  const payg = useCreatorPaygPrice();
  return (
    <main className="min-h-dvh">
      <Seo
        title="Pricing & Compare StreamVista Solutions — StreamVista Cloud X"
        description={`Compare StreamVista Cloud X capabilities and transparent pricing. Free Creator Basic, self-serve 1 TB storage add-ons at ${payg.totalLabel}/month, and managed film onboarding and licensing-readiness services.`}
        path="/pricing"
      />
      <Navbar />
      <Pricing />
      <ComparisonTable />
      <RevenueServicesSection />
      <Footer />
    </main>
  );
}
