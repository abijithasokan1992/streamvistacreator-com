/**
 * Payment-rail registry (Phase D1 consolidation, corrected in Revenue MVP).
 *
 * Truth source for every payment rail this codebase references and its
 * activation state on streamvista.in production.
 *
 * Semantics:
 *   - `active`        the rail is live and may be surfaced.
 *   - `disabled`      rail exists as scaffold but is turned off at build time.
 *   - `unconfigured`  rail is a real, non-deprecated capability but has not
 *                     been provisioned in this environment. UI must not
 *                     surface it until an operator provisions it.
 *   - `deprecated`    rail is retired and must not be resurrected.
 *
 * IMPORTANT: RazorpayX (creator payouts) is NOT deprecated. It is an
 * automatic-payout capability that requires external production
 * verification (KYC, RazorpayX account, webhook parity) before it can be
 * flipped to `active`. No manual "Send Money" or fake payout fallback is
 * ever surfaced by the app.
 */
import { PADDLE_ENABLED } from "@/lib/paddle";

export type PaymentRailId =
  | "razorpay_standard"
  | "paddle"
  | "razorpayx_payouts"
  | "legacy_django_pythonanywhere";

export type PaymentRailStatus = "active" | "disabled" | "unconfigured" | "deprecated";

export type PaymentRailCapability = "collection" | "payout" | "subscription";

export interface PaymentRail {
  id: PaymentRailId;
  status: PaymentRailStatus;
  capability: PaymentRailCapability;
  /** Human-readable label for admin diagnostics. */
  label: string;
  /** Why the rail is in its current state — audit trail only. */
  note: string;
}

export const PAYMENT_RAILS: readonly PaymentRail[] = [
  {
    id: "razorpay_standard",
    status: "active",
    capability: "collection",
    label: "Razorpay Standard Checkout",
    note: "Live rail on streamvista.in — collections, top-ups, vault, subscriptions.",
  },
  {
    id: "paddle",
    status: PADDLE_ENABLED ? "active" : "disabled",
    capability: "collection",
    label: "Paddle (non-India billing)",
    note: "Dormant scaffold; requires catalog + webhook parity before activation.",
  },
  {
    id: "razorpayx_payouts",
    status: "unconfigured",
    capability: "payout",
    label: "RazorpayX Automatic Payouts",
    note: "Automatic creator/producer payout capability. Requires configuration and external production verification (KYC, webhook parity) before activation. No manual fallback.",
  },
  {
    id: "legacy_django_pythonanywhere",
    status: "deprecated",
    capability: "collection",
    label: "Legacy Django / PythonAnywhere Razorpay",
    note: "Historical films_payment ledger only. Retired — do not resurrect credentials or flows.",
  },
] as const;

export function getRail(id: PaymentRailId): PaymentRail {
  const rail = PAYMENT_RAILS.find((r) => r.id === id);
  if (!rail) throw new Error(`Unknown payment rail: ${id}`);
  return rail;
}

export function isRailActive(id: PaymentRailId): boolean {
  return getRail(id).status === "active";
}

/** True when it's safe to render a user-facing entry point for the rail. */
export function canSurfaceRail(id: PaymentRailId): boolean {
  return isRailActive(id);
}

/** True when the rail is a legitimate future capability (not deprecated). */
export function isRailAvailableCapability(id: PaymentRailId): boolean {
  const s = getRail(id).status;
  return s === "active" || s === "unconfigured";
}
