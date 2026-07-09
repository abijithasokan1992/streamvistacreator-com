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
import { Clapperboard, Loader2, AlertCircle, RefreshCw, Inbox } from "lucide-react";

type RecentProduction = {
  id: string;
  name: string;
  tracking_code: string;
};

function RecentProductionsTable() {
  const [productions, setProductions] = useState<RecentProduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProductions = async (isRetry = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase.rpc as any)("list_public_recent_productions", {
        _limit: 10,
      });

      if (rpcError) throw rpcError;
      setProductions((data as RecentProduction[]) ?? []);
    } catch (err: any) {
      console.error("Error fetching productions:", err);
      setError(err.message || "Failed to load recent productions. Please try again.");
      setProductions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductions();
  }, []);

  // 1. LOADING STATE
  if (loading) {
    return (
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-6">
          <Clapperboard className="w-5 h-5 text-accent" aria-hidden="true" />
          <h2 className="text-2xl font-display">Recent Productions</h2>
        </div>
        <div className="rounded-xl border border-border/50 bg-secondary/5 py-12 grid place-items-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-accent" aria-label="Loading recent productions" />
            <span className="text-xs text-muted-foreground animate-pulse">Syncing production catalog...</span>
          </div>
        </div>
      </section>
    );
  }

  // 2. ERROR STATE (With manual retry action)
  if (error) {
    return (
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 max-w-2xl mx-auto text-center flex flex-col items-center justify-center gap-4">
          <AlertCircle className="w-8 h-8 text-destructive animate-bounce" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Connection Interrupted</h3>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
          <button
            onClick={() => fetchProductions(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border text-xs font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Connection
          </button>
        </div>
      </section>
    );
  }

  // 3. EMPTY STATE
  if (productions.length === 0) {
    return (
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-6">
          <Clapperboard className="w-5 h-5 text-accent" aria-hidden="true" />
          <h2 className="text-2xl font-display">Recent Productions</h2>
        </div>
        <div className="rounded-xl border border-dashed border-border/60 bg-secondary/5 py-12 text-center flex flex-col items-center justify-center gap-3">
          <Inbox className="w-8 h-8 text-muted-foreground/60" />
          <div className="max-w-xs">
            <h4 className="text-sm font-medium text-muted-foreground">Queue Clear</h4>
            <p className="text-xs text-muted-foreground/80 mt-1">
              No active staging or delivery operations found at this timestamp.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // 4. ACTIVE DATA PRESENTATION STATE
  return (
    <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-6">
        <Clapperboard className="w-5 h-5 text-accent" aria-hidden="true" />
        <h2 className="text-2xl font-display">Recent Productions</h2>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/50 bg-secondary/5 backdrop-blur-sm transition-all duration-300 shadow-sm hover:shadow-md">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/40 bg-secondary/10">
              <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Production Name
              </th>
              <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tracking Code
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {productions.map((production) => (
              <tr key={production.id} className="hover:bg-secondary/10 transition-colors group cursor-pointer">
                <td className="px-5 py-4 text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                  {production.name}
                </td>
                <td className="px-5 py-4 text-sm font-mono text-muted-foreground tabular-nums select-all">
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
