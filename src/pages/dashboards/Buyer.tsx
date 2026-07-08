import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AgreementGate } from "@/components/legal/AgreementGate";
import BuyerNav, { type BuyerSectionId } from "@/components/buyer/sections/BuyerNav";
import DashboardSection from "@/components/buyer/sections/DashboardSection";
import FindContentSection from "@/components/buyer/sections/FindContentSection";
import RequestsSection from "@/components/buyer/sections/RequestsSection";
import ScreenersSection from "@/components/buyer/sections/ScreenersSection";
import WatchlistSection from "@/components/buyer/sections/WatchlistSection";
import CommercialSection from "@/components/buyer/sections/CommercialSection";
import BillingSection from "@/components/buyer/sections/BillingSection";
import HelpSection from "@/components/buyer/sections/HelpSection";
import { useBuyerRequests } from "@/components/buyer/requests/useBuyerRequests";
import { OPEN_STATES, type Category } from "@/components/buyer/requests/shared";
import type { MarketplaceTitle } from "@/components/buyer/marketplace/useMarketplaceCatalog";

const VALID: BuyerSectionId[] = ["dashboard", "find", "requests", "screeners", "commercial", "billing", "help"];

/**
 * Buyer Workspace — organised around the buyer journey:
 *   Dashboard → Find Content → My Requests → Screeners → Commercial → Billing → Help
 * Read-only until a commercial workflow requires action. All data is live and
 * reuses existing tables, RLS policies and edge functions.
 */
export default function BuyerDashboard() {
  const { user, role, dashboardRole, loading, signOut } = useAuth();
  const { rows, screenerCount, loading: reqLoading, reload } = useBuyerRequests();

  const [section, setSection] = useState<BuyerSectionId>(() => {
    if (typeof window === "undefined") return "dashboard";
    const p = new URLSearchParams(window.location.search).get("section");
    const h = window.location.hash.replace(/^#/, "");
    // Backwards compat: old links (marketplace/watchlist/deliveries) redirect
    const legacy: Record<string, BuyerSectionId> = {
      marketplace: "find", watchlist: "find", deliveries: "commercial",
    };
    const raw = (p ?? h) as string;
    if (raw in legacy) return legacy[raw];
    return (VALID.includes(raw as BuyerSectionId) ? (raw as BuyerSectionId) : "dashboard");
  });

  const [needsGate, setNeedsGate] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ category?: Category; title?: string } | null>(null);

  // Deep-link support: ?type=<category> opens the request wizard.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("type");
    if (t) {
      setSection("requests");
      setPrefill({ category: t as Category });
      setComposerOpen(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.hash = section;
    window.history.replaceState(null, "", url.toString());
  }, [section]);

  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background text-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-accent" aria-hidden />
      </main>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (dashboardRole && dashboardRole !== "buyer" && role !== "admin" && role !== "super_admin") {
    return <Navigate to={dashboardForRole(role)} replace />;
  }

  const displayName =
    (user.user_metadata as Record<string, unknown> | undefined)?.full_name as string | undefined
    ?? user.email?.split("@")[0]
    ?? "there";

  const openBadge = rows.filter(r => OPEN_STATES.includes(r.state)).length;

  const requestForTitle = (t: MarketplaceTitle, hint: "screener" | "acquisition") => {
    setPrefill({
      category: hint === "screener" ? "screener" : "acquisition_interest",
      title: t.title,
    });
    setComposerOpen(true);
    setSection("requests");
  };

  return (
    <main className="min-h-dvh bg-background text-foreground overflow-x-hidden">
      <header className="border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="text-sm font-semibold tracking-tight">StreamVista</Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/my-workspace" className="text-xs text-muted-foreground hover:text-foreground">
              My Workspace
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-5 sm:mb-8">
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">Buyer workspace</p>
          <h1 className="font-display text-2xl md:text-3xl mt-2">Welcome, {String(displayName)}.</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Discover, evaluate and license content. Every commercial action is admin-mediated.
          </p>
        </div>

        {needsGate && (
          <AgreementGate
            type="buyer_request_confidentiality"
            onAccepted={() => { setNeedsGate(false); toast.success("NDA accepted. Please resubmit."); }}
            onCancel={() => setNeedsGate(false)}
            context={{ surface: "buyer_dashboard" }}
          />
        )}

        <div className="grid lg:grid-cols-[220px_1fr] gap-6">
          <BuyerNav
            section={section}
            onChange={setSection}
            badges={{ requests: openBadge }}
          />

          <div className="min-w-0">
            {section === "dashboard"  && <DashboardSection rows={rows} screenerCount={screenerCount} onGo={setSection} />}
            {section === "find"       && <FindContentSection onRequestForTitle={requestForTitle} />}
            {section === "requests"   && (
              <RequestsSection
                rows={rows}
                loading={reqLoading}
                reload={reload}
                onNeedsGate={() => setNeedsGate(true)}
                composerOpen={composerOpen}
                onComposerChange={setComposerOpen}
                prefill={prefill}
                onPrefillConsumed={() => setPrefill(null)}
              />
            )}
            {section === "screeners"  && <ScreenersSection />}
            {section === "commercial" && <CommercialSection rows={rows} />}
            {section === "billing"    && <BillingSection />}
            {section === "help"       && <HelpSection />}
          </div>
        </div>
      </div>
    </main>
  );
}
