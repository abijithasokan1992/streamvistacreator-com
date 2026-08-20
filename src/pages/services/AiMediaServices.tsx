import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Navbar } from "@/components/streamvista/Navbar";
import { Footer } from "@/components/streamvista/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AI_MEDIA_SERVICES } from "@/config/aiMediaServices";
import { trackServiceEvent } from "@/lib/analytics/serviceAnalytics";

export default function AiMediaServices() {
  useEffect(() => {
    void trackServiceEvent("service_page_viewed", { source: "ai_media_services_landing" });
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Seo
        title="StreamVista AI Media Services — Paid Production Services for Film"
        description="AI dubbing, subtitles, audio description, editing support, poster generation and OTT delivery packages. AI-assisted, rights-controlled, human-approved."
        path="/ai-media-services"
      />
      <Navbar />
      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="container mx-auto px-4 py-20 md:py-28 max-w-5xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground mb-5">
              Production Services
            </p>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
              StreamVista AI Media Services
            </h1>
            <p className="mt-5 text-lg md:text-xl text-muted-foreground max-w-2xl">
              Turn film and media work into paid production services.
            </p>
            <p className="mt-3 text-sm md:text-base text-muted-foreground/80 max-w-2xl">
              AI-assisted. Rights-controlled. Human-approved. Commercially operated.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="tracking-wide">
                <Link to="/ai-media-services/intake">
                  START A PAID PROJECT <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="tracking-wide">
                <Link to="/contact?enquiry=crayons-bridge-representation">
                  ACTIVATE FILM REPRESENTATION — ₹25,000 + GST
                </Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground max-w-2xl">
              Film representation at ₹25,000 + GST is the existing Crayons Bridge representation
              offer and is handled separately from AI media service projects. AI media services are
              quoted per project — no fixed public price.
            </p>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {[
                { icon: Sparkles, t: "AI-assisted", d: "Modern pipelines that shorten turnaround." },
                { icon: ShieldCheck, t: "Rights-controlled", d: "Nothing moves without a rights acknowledgement." },
                { icon: UserCheck, t: "Human-approved", d: "A person signs off before anything is delivered." },
              ].map(({ icon: Icon, t, d }) => (
                <div key={t} className="rounded-lg border border-border p-4">
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="mt-3 text-sm font-medium">{t}</p>
                  <p className="text-xs text-muted-foreground mt-1">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16 max-w-5xl">
          <h2 className="text-2xl font-semibold tracking-tight">Services</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {AI_MEDIA_SERVICES.map((service) => (
              <Card key={service.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{service.tagline}</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between gap-4">
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    {service.bullets.map((b) => (
                      <li key={b}>— {b}</li>
                    ))}
                  </ul>
                  <Button asChild variant="secondary" className="self-start">
                    <Link
                      to={`/ai-media-services/intake?service=${service.id}`}
                      onClick={() =>
                        void trackServiceEvent("service_selected", {
                          service_type: service.id,
                          source: "landing_card",
                        })
                      }
                    >
                      Start this service
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t border-border">
          <div className="container mx-auto px-4 py-14 max-w-5xl">
            <h2 className="text-2xl font-semibold tracking-tight">How a paid project runs</h2>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              {["Intake & rights", "Quote confirmed", "Payment verified", "Production → Human QC → Delivery"].map(
                (step, i) => (
                  <li key={step} className="rounded-lg border border-border p-4">
                    <span className="text-xs text-muted-foreground">Step {i + 1}</span>
                    <p className="mt-1 font-medium">{step}</p>
                  </li>
                ),
              )}
            </ol>
            <p className="mt-6 text-sm text-muted-foreground">
              Production begins only after payment is verified by our payment provider. Deliverables
              are released only after a human quality-control approval.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
