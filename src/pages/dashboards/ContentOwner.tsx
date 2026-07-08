import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { CreatorSidebar, SECTIONS, type SectionId } from "@/components/creator/CreatorSidebar";
import HomeSection from "@/components/creator/sections/Home";
import MyTitlesSection from "@/components/creator/sections/MyTitles";
import SubmissionsSection from "@/components/creator/sections/Submissions";
import UpdatesSection from "@/components/creator/sections/Updates";
import StatementsSection from "@/components/creator/sections/Statements";
import DeliveryVaultSection from "@/components/creator/sections/DeliveryVault";
import StorageSection from "@/components/creator/sections/Storage";
import HelpSection from "@/components/creator/sections/Help";
import MyCreatorProfile from "@/pages/profile/MyCreatorProfile";
import EntitlementChip from "@/components/creator/EntitlementChip";
import CreatorGuide from "@/components/creator/CreatorGuide";
import { fetchFreeTierStatus, listTitles, type FreeTierStatus, type TitleRow } from "@/lib/creator/titleApi";
import CreatorTour, { hasSeenCreatorTour } from "@/components/creator/CreatorTour";
import { markOnboardingStep } from "@/components/creator/OnboardingChecklist";
import { WorkspaceShell } from "@/components/px/WorkspaceShell";
import CreatorQuickActions from "@/components/creator/CreatorQuickActions";
import StorageLive from "@/components/creator/StorageLive";

/**
 * Creator Workspace — migrated into the StreamVista WorkspaceShell.
 *
 * Presentation-only migration:
 *  - WorkspaceShell provides header + universal search + left rail chrome.
 *  - Existing CreatorSidebar is embedded into the shell's left rail.
 *  - All existing section components (Home, Titles, Business, Messages,
 *    Activity, Vault, Storage, Billing, Help, Profile) are re-used untouched.
 *  - Right rail surfaces at-a-glance context: entitlement, storage,
 *    and the existing CreatorQuickActions launcher — all pre-existing
 *    components, not new ones.
 *  - Routing (?section=...), free-tier gating, onboarding markers,
 *    guided tour and auth redirects are preserved verbatim.
 */
export default function ContentOwnerDashboard() {
  const { user, role, dashboardRole, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [isFree, setIsFree] = useState<boolean>(true);
  const [tier, setTier] = useState<FreeTierStatus | null>(null);
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [tourOpen, setTourOpen] = useState(false);
  const raw = (params.get("section") as SectionId) || "home";
  // Backward-compat: legacy `?section=upgrade` deep links resolve to Storage & Billing.
  const section: SectionId = raw === "upgrade" ? "billing" : raw;

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [t, ts] = await Promise.all([fetchFreeTierStatus(), listTitles(user.id).catch(() => [] as TitleRow[])]);
      setTier(t ?? null);
      setIsFree(!!t?.is_free);
      setTitles(Array.isArray(ts) ? ts : []);
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
  };

  // Free-tier: pro-only sections redirect to Storage & Billing rather than rendering empty.
  const def = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const effectiveSection: SectionId = isFree && (def as any).proOnly ? "billing" : def.id;
  const current = SECTIONS.find((s) => s.id === effectiveSection)!;

  const handleSearch = (q: string) => {
    const query = q.trim();
    if (!query) return;
    // Route universal search into the existing Titles section, which
    // already handles list filtering client-side.
    const next = new URLSearchParams(params);
    next.set("section", "titles");
    next.set("q", query);
    setParams(next, { replace: false });
  };

  return (
    <WorkspaceShell
      workspaceLabel="Creator"
      workspaceIdentifier={current.label}
      accountName={user.email ?? undefined}
      onSignOut={signOut}
      onSearch={handleSearch}
      onNotifications={() => setSection("messages")}
      leftRail={
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <EntitlementChip />
            <CreatorGuide />
          </div>
          <CreatorSidebar
            active={effectiveSection}
            onSelect={setSection}
            mobileOpen={true}
            isFree={isFree}
          />
          <button
            onClick={() => navigate("/my-workspace")}
            className="w-full text-left text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70 hover:text-foreground px-3 py-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            My Workspace →
          </button>
        </div>
      }
      rightRail={
        <div className="p-4 space-y-5">
          <section aria-labelledby="rr-plan">
            <h2 id="rr-plan" className="text-[10px] font-mono-tech uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Plan & Entitlement
            </h2>
            <EntitlementChip />
          </section>
          <section aria-labelledby="rr-storage">
            <h2 id="rr-storage" className="text-[10px] font-mono-tech uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Storage
            </h2>
            <StorageLive />
          </section>
          <section aria-labelledby="rr-actions">
            <h2 id="rr-actions" className="text-[10px] font-mono-tech uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Quick Actions
            </h2>
            <CreatorQuickActions onNavigate={setSection as any} />
          </section>
        </div>
      }
    >
      {effectiveSection !== "home" && (
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">{current.label}</p>
          <h1 className="font-display text-2xl md:text-3xl mt-1">{current.heading}</h1>
          {current.subhead && (
            <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{current.subhead}</p>
          )}
        </div>
      )}
      {effectiveSection === "home" && <HomeSection onNavigate={setSection} isFree={isFree} />}
      {effectiveSection === "titles" && <MyTitlesSection />}
      {(effectiveSection === "business" || effectiveSection === "submissions") && (
        <SubmissionsSection onNavigate={setSection} />
      )}
      {(effectiveSection === "messages" || effectiveSection === "activity" || effectiveSection === "updates") && (
        <UpdatesSection />
      )}
      {(effectiveSection === "statements" || effectiveSection === "billing") && <StatementsSection />}
      {effectiveSection === "storage" && <StorageSection />}
      {effectiveSection === "delivery_vault" && <DeliveryVaultSection />}
      {effectiveSection === "help" && <HelpSection />}
      {effectiveSection === "profile" && <MyCreatorProfile embedded />}

      {tourOpen && <CreatorTour onClose={() => setTourOpen(false)} />}
    </WorkspaceShell>
  );
}
