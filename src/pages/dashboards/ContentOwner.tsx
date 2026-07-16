import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Loader2, LogOut, Menu } from "lucide-react";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CreatorSidebar,
  SECTIONS,
  useSectionLabels,
  type SectionId,
} from "@/components/creator/CreatorSidebar";
import HomeSection from "@/components/creator/sections/Home";
import MyTitlesSection from "@/components/creator/sections/MyTitles";
import SubmissionsSection from "@/components/creator/sections/Submissions";
import UpdatesSection from "@/components/creator/sections/Updates";
import StatementsSection from "@/components/creator/sections/Statements";
import DeliveryVaultSection from "@/components/creator/sections/DeliveryVault";
import DistributionSection from "@/components/creator/sections/Distribution";
import StorageSection from "@/components/creator/sections/Storage";
import HelpSection from "@/components/creator/sections/Help";
import MyCreatorProfile from "@/pages/profile/MyCreatorProfile";
import EntitlementChip from "@/components/creator/EntitlementChip";
import CreatorGuide from "@/components/creator/CreatorGuide";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { fetchFreeTierStatus } from "@/lib/creator/titleApi";
import CreatorTour, { hasSeenCreatorTour } from "@/components/creator/CreatorTour";
import { markOnboardingStep } from "@/components/creator/OnboardingChecklist";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import LanguagePicker from "@/components/i18n/LanguagePicker";
import { useLocale } from "@/hooks/useLocale";

export default function ContentOwnerDashboard() {
  const { user, role, dashboardRole, loading, signOut } = useAuth();
  const { t } = useTranslation();
  const { chosen: hasChosenLanguage } = useLocale();
  const [params, setParams] = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isFree, setIsFree] = useState<boolean>(true);
  const [tourOpen, setTourOpen] = useState(false);
  const raw = (params.get("section") as SectionId) || "home";
  // Backward-compat: legacy `?section=upgrade` deep links resolve to Storage & Billing.
  const section: SectionId = raw === "upgrade" ? "billing" : raw;

  useEffect(() => {
    if (!user) return;
    (async () => {
      const t = await fetchFreeTierStatus();
      setIsFree(!!t?.is_free);
    })();
  }, [user?.id]);

  // First-visit guided tour (desktop only — sidebar is hidden under a menu on mobile)
  useEffect(() => {
    if (!user) return;
    if (hasSeenCreatorTour()) return;
    if (typeof window !== "undefined" && window.innerWidth < 768) return;
    const t = setTimeout(() => setTourOpen(true), 600);
    return () => clearTimeout(t);
  }, [user?.id]);

  // Auto-complete onboarding step when Vault is opened
  useEffect(() => {
    if (section === "delivery_vault") markOnboardingStep("vaultOpened");
    if (section === "billing") markOnboardingStep("accessAuthorized");
  }, [section]);

  // IMPORTANT: All hooks must be called before any conditional early returns
  // to satisfy the Rules of Hooks (loading flips false→true between renders).
  const def = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const effectiveSection: SectionId = isFree && (def as any).proOnly ? "billing" : def.id;
  const { label: currentLabel, heading: currentHeading, subhead: currentSubhead } =
    useSectionLabels(effectiveSection);

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

  return (
    <main className="min-h-dvh bg-background text-foreground">
      {/* First-visit language picker — never coerces a choice, blocks the UI
          until the user selects Malayalam or English so the dashboard renders
          in their chosen language. */}
      {!hasChosenLanguage && <LanguagePicker />}

      <header className="border-b border-border/40 sticky top-0 z-30 bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded hover:bg-secondary/30"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={t("common.toggleMenu")}
            >
              <Menu className="w-4 h-4" />
            </button>
            <Link to="/" className="text-sm font-semibold tracking-tight">StreamVista</Link>
          </div>
          <div className="flex items-center gap-3">
            <EntitlementChip />
            <CreatorGuide />
            <LanguageSwitcher />
            <ThemeToggle />
            <Link
              to="/my-workspace"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t("creator.header.workspace")}
            </Link>
            <button
              onClick={signOut}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> {t("common.signOut")}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 grid md:grid-cols-[220px_1fr] gap-6">
        <CreatorSidebar active={effectiveSection} onSelect={setSection} mobileOpen={mobileOpen} isFree={isFree} />
        <section className="min-w-0">
          {effectiveSection !== "home" && (
            <div className="mb-6">
              <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">{currentLabel}</p>
              <h1 className="font-display text-2xl md:text-3xl mt-1">{currentHeading}</h1>
              {currentSubhead && <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{currentSubhead}</p>}
            </div>
          )}
          {effectiveSection === "home" && <HomeSection onNavigate={setSection} isFree={isFree} />}
          {effectiveSection === "titles" && <MyTitlesSection />}
          {(effectiveSection === "business" || effectiveSection === "submissions") && <SubmissionsSection onNavigate={setSection} />}
          {(effectiveSection === "messages" || effectiveSection === "activity" || effectiveSection === "updates") && <UpdatesSection />}
          {(effectiveSection === "statements" || effectiveSection === "billing") && <StatementsSection />}
          {effectiveSection === "storage" && <StorageSection />}
          {effectiveSection === "delivery_vault" && <DeliveryVaultSection />}
          {effectiveSection === "distribution" && <DistributionSection />}
          {effectiveSection === "help" && <HelpSection />}
          {effectiveSection === "profile" && <MyCreatorProfile embedded />}
        </section>
      </div>
      {tourOpen && <CreatorTour onClose={() => setTourOpen(false)} />}
    </main>
  );
}

