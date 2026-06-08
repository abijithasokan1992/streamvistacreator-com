import { Navbar } from "@/components/streamvista/Navbar";
import { Hero } from "@/components/streamvista/Hero";
import { PlanFeature } from "@/components/streamvista/PlanFeature";
import { Pricing } from "@/components/streamvista/Pricing";
import { CloudStudioPartners } from "@/components/streamvista/CloudStudioPartners";
import { Footer } from "@/components/streamvista/Footer";

const Index = () => (
  <main className="min-h-dvh">
    <Navbar />
    <Hero />
    <PlanFeature />
    <CloudStudioPartners />
    <Pricing />
    <Footer />
  </main>
);

export default Index;
