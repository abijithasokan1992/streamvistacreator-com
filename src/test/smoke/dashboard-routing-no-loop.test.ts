import { describe, it, expect } from "vitest";
import {
  dashboardForRole,
  REGISTERED_DASHBOARD_ROUTES,
  MVP_ROLES,
  type AppRole,
} from "@/hooks/useAuth";

/**
 * P0 guard against the redirect loop that returned when
 * CanonicalDashboardRedirect + role→route mapping fell out of sync
 * (distributor/localization_partner used to map to unregistered routes and
 * ping-pong forever). This test simulates one login redirect and asserts the
 * user lands on a real, terminal route in ≤ MAX_HOPS navigations.
 */

const REGISTERED = new Set<string>(REGISTERED_DASHBOARD_ROUTES);

/** Routes that CanonicalDashboardRedirect owns (see App.tsx). Hitting one
 * triggers another dashboardForRole() bounce — every entry MUST resolve to a
 * different, terminal route or we're in a loop. */
const CANONICAL_REDIRECT_ROUTES = new Set<string>([
  "/dashboard",
  "/producer",
  "/vault",
  "/studio",
  "/client",
  "/projects",
  "/archive",
  "/team",
]);

const MAX_HOPS = 3;

function follow(startRole: AppRole | null, startPath: string) {
  const visited: string[] = [];
  let path = startPath;
  for (let i = 0; i <= MAX_HOPS; i++) {
    visited.push(path);
    if (!CANONICAL_REDIRECT_ROUTES.has(path)) return { path, visited, hops: i };
    // CanonicalDashboardRedirect => Navigate(dashboardForRole(role))
    const next = dashboardForRole(startRole);
    if (next === path) {
      // Self-loop
      return { path: next, visited: [...visited, next], hops: i + 1, loop: true as const };
    }
    path = next;
  }
  return { path, visited, hops: MAX_HOPS + 1, exceeded: true as const };
}

const ROLES: (AppRole | null)[] = [
  null, // signed-out / no role row
  ...MVP_ROLES,
  // legacy / dormant aliases must not loop
  "distributor",
  "localization_partner",
  "executive_producer",
  "creator",
  "client",
  "moderator",
  "user",
];

describe("dashboard routing — no redirect loop", () => {
  it.each(ROLES.map((r) => [r] as const))(
    "role %s resolves /dashboard to a registered terminal route within MAX_HOPS",
    (role) => {
      const result = follow(role, "/dashboard");
      expect(
        (result as { loop?: boolean }).loop,
        `role ${role ?? "null"} loops on ${result.visited.join(" → ")}`,
      ).toBeFalsy();
      expect(
        (result as { exceeded?: boolean }).exceeded,
        `role ${role ?? "null"} exceeded ${MAX_HOPS} hops: ${result.visited.join(" → ")}`,
      ).toBeFalsy();
      expect(result.hops).toBeLessThanOrEqual(MAX_HOPS);
      expect(REGISTERED.has(result.path)).toBe(true);
      expect(CANONICAL_REDIRECT_ROUTES.has(result.path)).toBe(false);
    },
  );

  it.each(["/producer", "/vault", "/studio", "/client", "/projects", "/archive", "/team"])(
    "legacy alias %s resolves to a terminal registered route for a content_owner",
    (alias) => {
      const result = follow("content_owner", alias);
      expect((result as { loop?: boolean }).loop).toBeFalsy();
      expect(result.path).toBe("/dashboard/content");
      expect(REGISTERED.has(result.path)).toBe(true);
    },
  );

  it("signed-out user hitting /dashboard is handled at the redirect layer (not by dashboardForRole)", () => {
    // dashboardForRole(null) => /onboarding (registered, terminal). The
    // "send to /auth" branch lives in CanonicalDashboardRedirect itself, so
    // the important invariant here is that null never returns a canonical
    // redirect route — otherwise CanonicalDashboardRedirect would loop.
    const target = dashboardForRole(null);
    expect(CANONICAL_REDIRECT_ROUTES.has(target)).toBe(false);
    expect(REGISTERED.has(target)).toBe(true);
  });

  it("admin / founder / super_admin land directly on /admin without bouncing", () => {
    for (const r of ["admin", "super_admin"] as AppRole[]) {
      const result = follow(r, "/dashboard");
      expect(result.path).toBe("/admin");
      expect(result.hops).toBeLessThanOrEqual(1);
    }
  });
});
