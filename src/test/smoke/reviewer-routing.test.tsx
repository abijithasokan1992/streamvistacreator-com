import { describe, it, expect } from "vitest";
import {
  dashboardForRole,
  REGISTERED_DASHBOARD_ROUTES,
  MVP_ROLES,
  type AppRole,
} from "@/hooks/useAuth";

/**
 * Guard test: every role the app knows about — including the dormant Phase 2
 * roles and the "unknown / null" fallback — must map to a route that is
 * actually registered in App.tsx. If this test fails, magic-link login for
 * that role will land the user on WrongPortal (admin host) or NotFound
 * (public host) instead of a real console.
 *
 * qc_reviewer and legal_reviewer are the roles that regressed most recently,
 * so they're asserted explicitly on top of the exhaustive sweep.
 */
describe("reviewer + role routing guard", () => {
  const registered = new Set<string>(REGISTERED_DASHBOARD_ROUTES);

  const ALL_ROLES: (AppRole | null)[] = [
    ...MVP_ROLES,
    "localization_partner",
    "distributor",
    "executive_producer",
    "creator",
    "client",
    "moderator",
    "user",
    null, // signed-in user with no role row yet
  ];

  it.each(ALL_ROLES.map((r) => [r] as const))(
    "role %s lands on a registered route",
    (role) => {
      const target = dashboardForRole(role);
      expect(
        registered.has(target),
        `${role ?? "null"} → ${target} is not registered in App.tsx`,
      ).toBe(true);
    },
  );

  it("qc_reviewer lands on /admin/qc (never WrongPortal / NotFound)", () => {
    expect(dashboardForRole("qc_reviewer")).toBe("/admin/qc");
  });

  it("legal_reviewer lands on /admin/legal (never WrongPortal / NotFound)", () => {
    expect(dashboardForRole("legal_reviewer")).toBe("/admin/legal");
  });

  it("unknown / null role falls back to /onboarding, not a dashboard we can't guarantee", () => {
    expect(dashboardForRole(null)).toBe("/onboarding");
    // "user" is a dormant legacy role — it must still resolve to a real route.
    expect(registered.has(dashboardForRole("user"))).toBe(true);
  });
});
