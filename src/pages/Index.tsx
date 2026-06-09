import { Navbar } from "@/components/streamvista/Navbar";
import { Hero } from "@/components/streamvista/Hero";
import { PlanFeature } from "@/components/streamvista/PlanFeature";
import { ComparisonTable } from "@/components/streamvista/ComparisonTable";
import { Testimonials } from "@/components/streamvista/Testimonials";
import { Pricing } from "@/components/streamvista/Pricing";
import { CloudStudioPartners } from "@/components/streamvista/CloudStudioPartners";
import { Footer } from "@/components/streamvista/Footer";

const Index = () => (
  <main className="min-h-dvh">
    <Navbar />
    <Hero />
    <PlanFeature />
    <ComparisonTable />
    <Testimonials />
    <CloudStudioPartners />
    <Pricing />
    <Footer />
  </main>
);

export default Index;
