import { Navbar } from "@/components/streamvista/Navbar";
import { Pricing } from "@/components/streamvista/Pricing";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";
import { useCreatorPaygPrice } from "@/hooks/usePublicPlans";

export default function PricingPage() {
  const payg = useCreatorPaygPrice();
  return (
    <main className="min-h-dvh">
      <Seo
        title="Pricing — StreamVista Cloud X"
        description={`Transparent pricing for StreamVista Cloud X. Free Creator Basic, self-serve 1 TB storage add-ons at ${payg.totalLabel}/month, and managed Studio plans.`}
        path="/pricing"
      />
      <Navbar />
      <Pricing />
      <Footer />
    </main>
  );
}
