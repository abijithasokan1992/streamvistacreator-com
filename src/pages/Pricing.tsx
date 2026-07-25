import { Navbar } from "@/components/streamvista/Navbar";
import { Pricing } from "@/components/streamvista/Pricing";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";
import { useCreatorPaygPrice } from "@/hooks/usePublicPlans";
import { RevenueServicesSection } from "@/pages/Services";

export default function PricingPage() {
  const payg = useCreatorPaygPrice();
  return (
    <main className="min-h-dvh">
      <Seo
        title="Pricing & Managed Services — StreamVista Cloud X"
        description={`Transparent pricing for StreamVista Cloud X. Free Creator Basic, self-serve 1 TB storage add-ons at ${payg.totalLabel}/month, and managed film onboarding and licensing-readiness services.`}
        path="/pricing"
      />
      <Navbar />
      <Pricing />
      <RevenueServicesSection />
      <Footer />
    </main>
  );
}
