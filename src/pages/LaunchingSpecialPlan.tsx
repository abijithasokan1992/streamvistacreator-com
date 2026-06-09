import { Navbar } from "@/components/streamvista/Navbar";
import { Footer } from "@/components/streamvista/Footer";
import { MFILimitedEdition } from "@/components/streamvista/MFILimitedEdition";
import { Seo } from "@/components/Seo";

const LaunchingSpecialPlan = () => (
  <main className="min-h-dvh">
    <Seo title="Launching Special Plan — StreamVista Cloud X" description="Limited-edition launch pricing for the StreamVista Cloud X workflow-integrated cloud — reserved seats for early studios and creators." path="/launching-special-plan" />
    <Navbar />

    <section className="pt-32 pb-6">
      <div className="container max-w-6xl">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[11px] uppercase tracking-[0.25em] font-mono-tech">
          The Workflow Integrated Cloud
        </div>
      </div>
    </section>
    <MFILimitedEdition />
    <Footer />
  </main>
);

export default LaunchingSpecialPlan;
