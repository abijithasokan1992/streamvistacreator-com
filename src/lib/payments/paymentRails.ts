/**
 * Payment-rail registry (Phase D1 consolidation).
 *
 * Single source of truth naming every payment rail the codebase references
 * and its current activation state. The active production rail is Razorpay
 * standard checkout on the streamvista.in domain. All other rails
 * (Paddle, RazorpayX payouts, and legacy Django/PythonAnywhere flows) are
 * explicitly deprecated and MUST NOT be surfaced in user-facing UI without
 * an intentional re-activation.
 *
 * This module does not import or execute rail SDKs. It exists so that
 * runtime checks and tests can assert the deprecated rails stay inert.
 */
import { PADDLE_ENABLED } from "@/lib/paddle";

export type PaymentRailId =
  | "razorpay_standard"
  | "paddle"
  | "razorpayx_payouts"
  | "legacy_django_pythonanywhere";

export type PaymentRailStatus = "active" | "disabled" | "deprecated";

export interface PaymentRail {
  id: PaymentRailId;
  status: PaymentRailStatus;
  /** Human-readable label for admin diagnostics. */
  label: string;
  /** Why the rail is in its current state — audit trail only. */
  note: string;
}

export const PAYMENT_RAILS: readonly PaymentRail[] = [
  {
    id: "razorpay_standard",
    status: "active",
    label: "Razorpay Standard Checkout",
    note: "Live rail on streamvista.in — collections, top-ups, vault, subscriptions.",
  },
  {
    id: "paddle",
    status: PADDLE_ENABLED ? "active" : "disabled",
    label: "Paddle (non-India billing)",
    note: "Dormant scaffold; requires catalog + webhook parity before activation.",
  },
  {
    id: "razorpayx_payouts",
    status: "deprecated",
    label: "RazorpayX Payouts",
    note: "Creator payouts handled manually in Phase D1. Do not surface a Send Money entry point.",
  },
  {
    id: "legacy_django_pythonanywhere",
    status: "deprecated",
    label: "Legacy Django / PythonAnywhere",
    note: "Historical films_payment ledger only. No live integration exists.",
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
