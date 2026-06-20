import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Loader2, LogOut, Menu } from "lucide-react";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";
import { useState } from "react";
import { CreatorSidebar, SECTIONS, type SectionId } from "@/components/creator/CreatorSidebar";
import HomeSection from "@/components/creator/sections/Home";
import MyTitlesSection from "@/components/creator/sections/MyTitles";
import UpdatesSection from "@/components/creator/sections/Updates";
import DistributionSection from "@/components/creator/sections/Distribution";
import InsightsSection from "@/components/creator/sections/Insights";
import StatementsSection from "@/components/creator/sections/Statements";
import ScheduleSection from "@/components/creator/sections/Schedule";
import UpgradeSection from "@/components/creator/sections/Upgrade";
import ReferralsSection from "@/components/creator/sections/Referrals";
import HelpSection from "@/components/creator/sections/Help";
import EntitlementChip from "@/components/creator/EntitlementChip";

export default function ContentOwnerDashboard() {
  const { user, role, dashboardRole, loading, signOut } = useAuth();
  const [params, setParams] = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const section = (params.get("section") as SectionId) || "home";

  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background text-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </main>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (dashboardRole && dashboardRole !== "content_owner" && role !== "admin" && role !== "super_admin") {
    return <Navigate to={dashboardForRole(role)} replace />;
  }

  const setSection = (s: SectionId) => {
    const next = new URLSearchParams(params);
    next.set("section", s);
    setParams(next, { replace: false });
    setMobileOpen(false);
  };

  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/40 sticky top-0 z-30 bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded hover:bg-secondary/30"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <Link to="/" className="text-sm font-semibold tracking-tight">StreamVista</Link>
            <span className="hidden md:inline text-xs text-muted-foreground/70">/ Creator</span>
          </div>
          <button
            onClick={signOut}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 grid md:grid-cols-[220px_1fr] gap-6">
        <CreatorSidebar active={section} onSelect={setSection} mobileOpen={mobileOpen} />
        <section className="min-w-0">
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">{current.label}</p>
            <h1 className="font-display text-2xl md:text-3xl mt-1">{current.heading}</h1>
            {current.subhead && <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{current.subhead}</p>}
          </div>
          {section === "home" && <HomeSection onNavigate={setSection} />}
          {section === "titles" && <MyTitlesSection />}
          {section === "updates" && <UpdatesSection />}
          {section === "distribution" && <DistributionSection />}
          {section === "insights" && <InsightsSection />}
          {section === "statements" && <StatementsSection />}
          {section === "schedule" && <ScheduleSection />}
          {section === "upgrade" && <UpgradeSection />}
          {section === "referrals" && <ReferralsSection />}
          {section === "help" && <HelpSection />}
        </section>
      </div>
    </main>
  );
}
