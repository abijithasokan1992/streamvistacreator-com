import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Navbar } from "@/components/streamvista/Navbar";
import { Hero } from "@/components/streamvista/Hero";
import { PlatformOverview } from "@/components/streamvista/PlatformOverview";
import { Partners } from "@/components/streamvista/Partners";
import { Workflow } from "@/components/streamvista/Workflow";

import { FinalCta } from "@/components/streamvista/FinalCta";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";
import { dashboardForRole, useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Clapperboard, Loader2 } from "lucide-react";

type RecentProduction = {
  id: string;
  name: string;
  tracking_code: string;
};

function RecentProductionsTable() {
  const [productions, setProductions] = useState<RecentProduction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase.rpc as any)("list_public_recent_productions", {
        _limit: 10,
      });
      if (!cancelled) {
        setProductions((data as RecentProduction[]) ?? []);
      }
      if (error && !cancelled) {
        // Fail silently on the public page; the section just won't render.
        setProductions([]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-6">
          <Clapperboard className="w-5 h-5 text-accent" aria-hidden="true" />
          <h2 className="text-2xl font-display">Recent Productions</h2>
        </div>
        <div className="rounded-xl border border-border/50 bg-secondary/5 py-8 grid place-items-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-label="Loading recent productions" />
        </div>
      </section>
    );
  }

  if (productions.length === 0) return null;

  return (
    <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-6">
        <Clapperboard className="w-5 h-5 text-accent" aria-hidden="true" />
        <h2 className="text-2xl font-display">Recent Productions</h2>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/50 bg-secondary/5">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/40">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Production Name
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tracking Code
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {productions.map((production) => (
              <tr key={production.id}>
                <td className="px-4 py-3.5 text-sm font-medium">{production.name}</td>
                <td className="px-4 py-3.5 text-sm font-mono text-muted-foreground tabular-nums">
                  {production.tracking_code}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}


const Index = () => {
  const { user, role, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to={dashboardForRole(role)} replace />;

  return (
    <main className="min-h-dvh home-serif">
      <Seo
        title="StreamVista Cloud X — The Digital Media Business Platform"
        description="Manage, protect, distribute, license and monetize professional media through one connected platform."
        path="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "StreamVista",
            url: "https://streamvistacreator.com/",
          },
        ]}
      />
      <Navbar />
      <Hero />
      <PlatformOverview />
      <Workflow />
      <RecentProductionsTable />
      <Partners />
      <FinalCta />
      <Footer />
    </main>
  );
};

export default Index;

