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
  const [selected, setSelected] = useState<Cycle>("free");
  return (
    <main className="min-h-dvh">
      <Navbar />
      <Hero />
      <PlanFeature />
      <CloudStudioPartners />

      <Pricing selected={selected} onSelect={setSelected} />
      <OnboardingForm />
      <Footer />
    </main>
  );
};

export default Index;
