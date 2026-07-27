/**
 * Pure payload validator for reconcile-storage-topups.
 * Extracted so it can be unit-tested from the app test runner without
 * booting the Deno edge runtime.
 */
export type ReconcileAction = "mark_paid" | "mark_failed" | "cancel";

export const ALLOWED_RECONCILE_ACTIONS: ReconcileAction[] = [
  "mark_paid",
  "mark_failed",
  "cancel",
];

export interface ReconcileActionItem {
  topup_id: string;
  action: ReconcileAction;
  reason: string;
}

export function validateReconcilePayload(
  body: unknown,
): { actions: ReconcileActionItem[] } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const actions = (body as { actions?: unknown }).actions;
  if (!Array.isArray(actions) || actions.length === 0) {
    return { error: "actions array required" };
  }
  if (actions.length > 100) return { error: "Too many actions (max 100)" };
  const out: ReconcileActionItem[] = [];
  for (const a of actions) {
    if (!a || typeof a !== "object") return { error: "Invalid action entry" };
    const { topup_id, action, reason } = a as Record<string, unknown>;
    if (typeof topup_id !== "string" || topup_id.length < 8) {
      return { error: "topup_id must be a uuid string" };
    }
    if (typeof action !== "string" || !ALLOWED_RECONCILE_ACTIONS.includes(action as ReconcileAction)) {
      return { error: `action must be one of ${ALLOWED_RECONCILE_ACTIONS.join(", ")}` };
    }
    if (typeof reason !== "string" || reason.trim().length < 5) {
      return { error: "reason must be at least 5 characters" };
    }
    out.push({ topup_id, action: action as ReconcileAction, reason: reason.trim() });
  }
  return { actions: out };
}
