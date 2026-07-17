/**
 * Onboarding + role gate policy tests (pure logic).
 *
 * The real gates (`OnboardingGate`, `RoleGate`) live in the React tree and
 * read from Supabase — but the routing decision itself is a small state
 * machine over three inputs pulled from *protected* sources:
 *
 *   1. `onboarding_step` from public.user_profiles
 *   2. `is_suspended` from public.user_profiles
 *   3. the primary role from public.user_roles
 *
 * user_metadata / app_metadata are never authoritative for authorization —
 * these tests document that invariant.
 */
import { describe, it, expect } from "vitest";
import { dashboardForRole, pickPrimaryRole, type AppRole } from "@/hooks/useAuth";

type GateInput = {
  user: { id: string } | null;
  isAdmin: boolean;
  onboardingStep: "profile" | "plan" | "done" | null;
  suspended: boolean;
  role: AppRole | null;
};

type GateDecision =
  | { kind: "loading" }
  | { kind: "redirect"; to: string }
  | { kind: "suspended" }
  | { kind: "render" };

/** Pure re-implementation of OnboardingGate for testability. */
export function decideOnboardingGate(input: GateInput, currentPath: string): GateDecision {
  if (!input.user) return { kind: "redirect", to: `/auth?next=${encodeURIComponent(currentPath)}` };
  if (input.suspended && !input.isAdmin) return { kind: "suspended" };
  if (!input.isAdmin && input.onboardingStep !== "done") return { kind: "redirect", to: "/onboarding" };
  return { kind: "render" };
}

describe("onboarding gate policy", () => {
  it("redirects unauthenticated users to /auth with next=", () => {
    const d = decideOnboardingGate(
      { user: null, isAdmin: false, onboardingStep: null, suspended: false, role: null },
      "/dashboard/content",
    );
    expect(d).toEqual({ kind: "redirect", to: "/auth?next=%2Fdashboard%2Fcontent" });
  });

  it("shows suspended screen for non-admin suspended users", () => {
    const d = decideOnboardingGate(
      { user: { id: "u" }, isAdmin: false, onboardingStep: "done", suspended: true, role: "content_owner" },
      "/dashboard/content",
    );
    expect(d.kind).toBe("suspended");
  });

  it("lets admins bypass suspension (so the control panel stays reachable)", () => {
    const d = decideOnboardingGate(
      { user: { id: "u" }, isAdmin: true, onboardingStep: "profile", suspended: true, role: "admin" },
      "/admin",
    );
    expect(d.kind).toBe("render");
  });

  it("redirects unfinished onboarding to /onboarding", () => {
    const d = decideOnboardingGate(
      { user: { id: "u" }, isAdmin: false, onboardingStep: "profile", suspended: false, role: "content_owner" },
      "/dashboard/content",
    );
    expect(d).toEqual({ kind: "redirect", to: "/onboarding" });
  });

  it("renders the app when onboarding_step='done' regardless of user_metadata", () => {
    // user_metadata is not part of GateInput — this test documents that
    // authorization must never depend on it.
    const d = decideOnboardingGate(
      { user: { id: "u" }, isAdmin: false, onboardingStep: "done", suspended: false, role: "buyer" },
      "/dashboard/buyer",
    );
    expect(d.kind).toBe("render");
  });
});

describe("role gate policy", () => {
  it("missing role sends the user to /onboarding via dashboardForRole", () => {
    expect(dashboardForRole(null)).toBe("/onboarding");
  });

  it("pickPrimaryRole prefers admin over content_owner", () => {
    expect(pickPrimaryRole(["content_owner", "admin"])).toBe("admin");
  });

  it("pickPrimaryRole returns null for the empty set (drives missing_role handling)", () => {
    expect(pickPrimaryRole([])).toBeNull();
  });
});
