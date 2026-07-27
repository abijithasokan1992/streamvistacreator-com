import { describe, it, expect } from "vitest";
import {
  validateReconcilePayload,
  ALLOWED_RECONCILE_ACTIONS,
} from "../../../supabase/functions/reconcile-storage-topups/validate";

/**
 * PR-C — reconcile-storage-topups payload validator.
 *
 * Role-gate and Razorpay/mark_paid guards live inside the Deno edge function
 * and are covered by the integration checklist we run after the admin
 * triggers actions from the UI. This suite locks the pure input contract so
 * regressions in the shared validator fail fast in CI.
 */
describe("validateReconcilePayload", () => {
  it("rejects non-object bodies", () => {
    expect(validateReconcilePayload(null)).toEqual({ error: "Invalid body" });
    expect(validateReconcilePayload("nope")).toEqual({ error: "Invalid body" });
  });

  it("requires a non-empty actions array", () => {
    expect(validateReconcilePayload({})).toEqual({ error: "actions array required" });
    expect(validateReconcilePayload({ actions: [] })).toEqual({ error: "actions array required" });
  });

  it("caps the batch size", () => {
    const actions = Array.from({ length: 101 }, () => ({
      topup_id: "00000000-aaaa-bbbb-cccc-000000000000",
      action: "mark_failed",
      reason: "reconcile",
    }));
    expect(validateReconcilePayload({ actions })).toEqual({ error: "Too many actions (max 100)" });
  });

  it("rejects unknown actions", () => {
    const res = validateReconcilePayload({
      actions: [{ topup_id: "abcdefgh", action: "delete", reason: "please" }],
    });
    expect("error" in res).toBe(true);
    if ("error" in res) expect(res.error).toContain("action must be one of");
  });

  it("rejects short reasons", () => {
    const res = validateReconcilePayload({
      actions: [{ topup_id: "abcdefgh", action: "mark_failed", reason: "no" }],
    });
    expect(res).toEqual({ error: "reason must be at least 5 characters" });
  });

  it("accepts every allowed action and trims the reason", () => {
    const res = validateReconcilePayload({
      actions: ALLOWED_RECONCILE_ACTIONS.map((action) => ({
        topup_id: "abcdefgh-uuid",
        action,
        reason: "   reconciled per Gate 1 approval   ",
      })),
    });
    expect("actions" in res).toBe(true);
    if ("actions" in res) {
      expect(res.actions).toHaveLength(ALLOWED_RECONCILE_ACTIONS.length);
      expect(res.actions.every((a) => a.reason === "reconciled per Gate 1 approval")).toBe(true);
    }
  });
});
