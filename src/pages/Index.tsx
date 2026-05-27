import { useState } from "react";
import { Navbar } from "@/components/streamvista/Navbar";
import { Hero } from "@/components/streamvista/Hero";
import { PlanFeature } from "@/components/streamvista/PlanFeature";
import { Pricing } from "@/components/streamvista/Pricing";
import { OnboardingForm } from "@/components/streamvista/OnboardingForm";
import { CloudStudioPartners } from "@/components/streamvista/CloudStudioPartners";
import { Footer } from "@/components/streamvista/Footer";
import type { Cycle } from "@/components/streamvista/plans";

const Index = () => {
  const [selected, setSelected] = useState<Cycle>("yearly");
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <PlanFeature />
      <CloudStudioPartners />

      <Pricing selected={selected} onSelect={setSelected} />
      <OnboardingForm selected={selected} />
      <Footer />
    </main>
  );
};

export default Index;
