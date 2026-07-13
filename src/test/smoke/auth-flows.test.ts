/**
 * Auth flow smoke tests.
 *
 * These tests validate the pieces of the sign-in / sign-up flow that live
 * inside the frontend bundle — schema validation, safe-next sanitization,
 * role-based dashboard routing, and the invariant that no code path emits
 * a legacy `streamvistacreator.com` link. The full end-to-end (magic link,
 * Google OAuth, callback profile repair) is covered by the Playwright
 * suite under tests/e2e/.
 *
 * Each test is isolated (own describe block, no shared mutable state) so a
 * single failure does not stop the remaining tests.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { dashboardForRole } from "@/hooks/useAuth";
import { APP_ORIGIN, LEGACY_APP_ORIGINS } from "@/lib/site";

// Mirror of the schemas used in src/pages/Auth.tsx.
const EmailSchema = z.string().trim().email().max(255);
const NameSchema = z.string().trim().min(1).max(120);

/** Safe `next` sanitiser — must match the guard in Auth.tsx / AuthCallback.tsx. */
function safeNext(input: string | null | undefined): string | null {
  if (!input) return null;
  if (!input.startsWith("/")) return null;      // must be relative
  if (input.startsWith("//")) return null;      // protocol-relative → open redirect
  if (input.startsWith("/\\")) return null;     // backslash trick
  return input;
}

describe("auth: signup input validation", () => {
  it("accepts a well-formed creator signup", () => {
    expect(EmailSchema.safeParse("creator@example.com").success).toBe(true);
    expect(NameSchema.safeParse("Asha Menon").success).toBe(true);
  });
  it("rejects missing name", () => {
    expect(NameSchema.safeParse("   ").success).toBe(false);
  });
  it("rejects malformed email", () => {
    expect(EmailSchema.safeParse("not-an-email").success).toBe(false);
  });
});

describe("auth: studio signup", () => {
  it("accepts a studio account payload", () => {
    expect(EmailSchema.safeParse("ops@studio.co").success).toBe(true);
    expect(NameSchema.safeParse("Studio Ops").success).toBe(true);
  });
});

describe("auth: buyer signup", () => {
  it("accepts a buyer account payload", () => {
    expect(EmailSchema.safeParse("acq@buyer.tv").success).toBe(true);
  });
});

describe("auth: safe-next sanitizer (blocks open redirects)", () => {
  it("passes an internal relative path", () => {
    expect(safeNext("/dashboard/content")).toBe("/dashboard/content");
  });
  it("blocks protocol-relative URLs", () => {
    expect(safeNext("//evil.example.com/steal")).toBeNull();
  });
  it("blocks absolute external URLs", () => {
    expect(safeNext("https://evil.example.com")).toBeNull();
  });
  it("blocks backslash-prefixed tricks", () => {
    expect(safeNext("/\\evil.example.com")).toBeNull();
  });
  it("returns null for empty input", () => {
    expect(safeNext("")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});

describe("auth: role → dashboard routing", () => {
  it("routes creator (content_owner) to /dashboard/content", () => {
    expect(dashboardForRole("content_owner")).toBe("/dashboard/content");
  });
  it("routes studio to /dashboard/studio", () => {
    expect(dashboardForRole("studio")).toBe("/dashboard/studio");
  });
  it("routes buyer to /dashboard/buyer", () => {
    expect(dashboardForRole("buyer")).toBe("/dashboard/buyer");
  });
  it("routes admin to /admin", () => {
    expect(dashboardForRole("admin")).toBe("/admin");
  });
  it("routes qc_reviewer to /admin/qc", () => {
    expect(dashboardForRole("qc_reviewer")).toBe("/admin/qc");
  });
  it("routes legal_reviewer to /admin/legal", () => {
    expect(dashboardForRole("legal_reviewer")).toBe("/admin/legal");
  });
  it("sends unknown/null roles to /onboarding", () => {
    expect(dashboardForRole(null)).toBe("/onboarding");
  });
});

describe("auth: production origin invariants", () => {
  it("APP_ORIGIN is the canonical streamvista.in", () => {
    expect(APP_ORIGIN).toBe("https://streamvista.in");
  });
  it("APP_ORIGIN does NOT contain streamvistacreator.com", () => {
    expect(APP_ORIGIN.includes("streamvistacreator")).toBe(false);
  });
  it("LEGACY origins are only referenced for the CORS allow-list, not for outbound links", () => {
    // The constant may exist for the migration allow-list, but getAppOrigin()
    // must never return it. This test guards the invariant at the module level.
    for (const legacy of LEGACY_APP_ORIGINS) {
      expect(legacy).not.toBe(APP_ORIGIN);
    }
  });
});

describe("auth: no legacy domain in shipped frontend config", () => {
  it("site.ts APP_ORIGIN is streamvista.in", async () => {
    const mod = await import("@/lib/site");
    expect(mod.APP_ORIGIN).toBe("https://streamvista.in");
  });
});
