/**
 * StudioProfileOnboardingGate — one-time onboarding wizard for studios.
 *
 * Wraps the `/dashboard/studio` route: when the workspace's studio profile
 * is incomplete (missing tax / billing / < 100% completeness), we render
 * `<MyStudioProfile onboarding />` as a full-page mandatory wizard instead
 * of the Production Control Center dashboard.
 *
 * The moment the profile finishes saving, `onDone` flips this gate to
 * "complete" locally so the user glides straight into the Active Production
 * view without a hard reload — Active Production state (localStorage /
 * workspace context) is preserved.
 *
 * Reuses:
 *   • existing `useEntityProfile` hook and APIs — no new tables, no new RPCs
 *   • existing MyStudioProfile page — no duplicate form
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useEntityProfile, type EntityProfile } from "@/hooks/useEntityProfile";
import StudioOnboardingWizard from "@/components/studio/StudioOnboardingWizard";

/**
 * "Onboarded" = the MVP activation fields are on file. This mirrors what the
 * 4-step onboarding wizard collects; extra profile detail (About, Services,
 * Public Links, Billing overrides, etc.) lives under Settings > Studio
 * Profile and never re-locks the studio.
 */
export function isStudioOnboarded(p: EntityProfile | null): boolean {
  if (!p) return false;
  const required: Array<keyof EntityProfile> = [
    "legal_name",
    "entity_type",
    "primary_email",
    "primary_phone",
    "country",
    "state",
    "pan_number",
  ];
  for (const k of required) {
    const v = p[k];
    if (v == null || String(v).trim() === "") return false;
  }
  if (p.is_gst_registered) {
    if (!p.gstin || String(p.gstin).trim() === "") return false;
    if (!p.place_of_supply_state || String(p.place_of_supply_state).trim() === "") return false;
  }
  return true;
}

export default function StudioProfileOnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { activeId: orgId, loading: wsLoading } = useWorkspaces();
  const { profile, loading } = useEntityProfile({ kind: "studio", orgId: orgId ?? null });

  const [justCompleted, setJustCompleted] = useState(false);
  useEffect(() => { setJustCompleted(false); }, [orgId]);

  const complete = useMemo(
    () => justCompleted || isStudioOnboarded(profile),
    [justCompleted, profile],
  );

  if (authLoading || wsLoading || loading) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background text-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </main>
    );
  }

  if (!user || !orgId) return <>{children}</>;

  if (!complete) {
    return <StudioOnboardingWizard onDone={() => setJustCompleted(true)} />;
  }

  return <>{children}</>;
}
