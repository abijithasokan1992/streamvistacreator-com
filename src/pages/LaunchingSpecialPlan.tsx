import { Navbar } from "@/components/streamvista/Navbar";
import { Footer } from "@/components/streamvista/Footer";
import { MFILimitedEdition } from "@/components/streamvista/MFILimitedEdition";
import { Seo } from "@/components/Seo";

const LaunchingSpecialPlan = () => (
  <main className="min-h-dvh">
    <Seo title="Launching Special Plan — StreamVista Cloud X" description="Limited-edition launch pricing for the StreamVista Cloud X workflow-integrated cloud — reserved seats for early studios and creators." path="/launching-special-plan" />
    <Navbar />

    <section className="pt-32 pb-6">
      <div className="container max-w-6xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[11px] uppercase tracking-[0.25em] font-mono-tech">
          The Workflow Integrated Cloud
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          StreamVista Cloud X — Launching Special Plan
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
          Limited-edition launch pricing on the workflow-integrated cloud for early studios and creators.
        </p>
      </div>
    </section>
    <MFILimitedEdition />
    <Footer />
  </main>
);

export default LaunchingSpecialPlan;
