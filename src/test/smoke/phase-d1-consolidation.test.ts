/**
 * Phase D1 consolidation smoke tests.
 *
 * Assertions:
 *   1. Buyer / Studio navigation stays task-first with no obsolete generic
 *      "Send Money" or generic buyer download-request/revoke entry points.
 *   2. Payment-rail registry keeps Razorpay standard as the only active rail
 *      and Paddle / RazorpayX / legacy Django as inert.
 *   3. Workspace scope derivation stays workspace-scoped (not identity-scoped).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BUYER_SECTIONS } from "@/components/buyer/sections/BuyerNav";
import {
  PAYMENT_RAILS,
  isRailActive,
  canSurfaceRail,
} from "@/lib/payments/paymentRails";
import { deriveWorkspaceScope } from "@/lib/rbac/workspaceScope";

// ---------- Navigation ---------------------------------------------------

describe("buyer navigation (Phase D1)", () => {
  const labels = BUYER_SECTIONS.map((s) => s.label.toLowerCase());
  const ids = BUYER_SECTIONS.map((s) => s.id);

  it("does not expose generic Send Money / Payout entries", () => {
    for (const l of labels) {
      expect(l).not.toContain("send money");
      expect(l).not.toContain("payout");
    }
  });

  it("does not expose a generic Downloads or Revoke tab", () => {
    // Commercial + Screeners surface *approved* deliverables. A generic
    // top-level "Downloads" or "Revoke" entry would violate D1 scope.
    expect(ids).not.toContain("downloads" as never);
    expect(ids).not.toContain("revoke" as never);
    for (const l of labels) {
      expect(l).not.toBe("downloads");
      expect(l).not.toBe("revoke access");
    }
  });

  it("keeps the task-first pipeline sections", () => {
    for (const key of ["dashboard", "find", "requests", "screeners", "commercial", "billing", "help"]) {
      expect(ids).toContain(key as never);
    }
  });
});

// ---------- Payment rails ------------------------------------------------

describe("payment rails registry (Phase D1)", () => {
  it("only razorpay_standard is active", () => {
    const active = PAYMENT_RAILS.filter((r) => r.status === "active").map((r) => r.id);
    expect(active).toEqual(["razorpay_standard"]);
    expect(isRailActive("razorpay_standard")).toBe(true);
  });

  it("paddle stays disabled unless VITE_ENABLE_PADDLE=true", () => {
    // Test env does not set the flag, so paddle must be disabled.
    expect(isRailActive("paddle")).toBe(false);
    expect(canSurfaceRail("paddle")).toBe(false);
  });

  it("razorpayx payouts and legacy django stay deprecated", () => {
    expect(canSurfaceRail("razorpayx_payouts")).toBe(false);
    expect(canSurfaceRail("legacy_django_pythonanywhere")).toBe(false);
  });
});

// ---------- Workspace scope ---------------------------------------------

describe("workspace scope derivation (Phase D1)", () => {
  it("returns identity-only fallback when no workspace is active", () => {
    const s = deriveWorkspaceScope(null, "content_owner");
    expect(s.workspaceId).toBeNull();
    expect(s.canWrite).toBe(false);
    expect(s.productRole).toBe("content_owner");
  });

  it("grants write access to owner/admin/editor and denies viewer", () => {
    const base = { id: "w1", name: "Studio A", owner_id: "u1" };
    expect(deriveWorkspaceScope({ ...base, role: "owner" }, "studio").canWrite).toBe(true);
    expect(deriveWorkspaceScope({ ...base, role: "admin" }, "studio").canWrite).toBe(true);
    expect(deriveWorkspaceScope({ ...base, role: "editor" }, "studio").canWrite).toBe(true);
    expect(deriveWorkspaceScope({ ...base, role: "viewer" }, "studio").canWrite).toBe(false);
  });

  it("marks owner isOwner flag correctly", () => {
    const s = deriveWorkspaceScope({ id: "w1", name: "n", owner_id: "u1", role: "owner" }, "studio");
    expect(s.isOwner).toBe(true);
    const v = deriveWorkspaceScope({ id: "w1", name: "n", owner_id: "u1", role: "editor" }, "studio");
    expect(v.isOwner).toBe(false);
  });
});

// ---------- Static source-tree guards -----------------------------------

describe("obsolete user-facing entry points are absent (Phase D1)", () => {
  const SRC = join(process.cwd(), "src");

  function walk(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        // Skip test folder — tests reference the forbidden strings on purpose.
        if (name === "test") continue;
        walk(p, acc);
      } else if (/\.(t|j)sx?$/.test(name)) {
        acc.push(p);
      }
    }
    return acc;
  }

  // The rails registry intentionally names deprecated rails — exempt it.
  const REGISTRY = join(SRC, "lib/payments/paymentRails.ts");
  const files = walk(SRC).filter((f) => f !== REGISTRY);

  it("no source file renders a 'Send Money' user action", () => {
    const offenders = files.filter((f) => /send\s+money/i.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("Paddle checkout is never called unconditionally from UI", () => {
    // Any call to initializePaddle / openPaddleCheckout must be gated by PADDLE_ENABLED.
    const offenders: string[] = [];
    for (const f of files) {
      if (f.includes("/lib/paddle") || f.includes("usePaddleCheckout")) continue;
      const src = readFileSync(f, "utf8");
      if (/initializePaddle\(|openPaddleCheckout\(/.test(src) && !/PADDLE_ENABLED/.test(src)) {
        offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no RazorpayX payout SDK reference exists in the client bundle", () => {
    const offenders = files.filter((f) => /razorpayx|razorpay_x\b/i.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
