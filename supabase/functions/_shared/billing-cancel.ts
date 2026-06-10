// Shared subscription cancellation helpers for user tear-down flows.
//
// Both helpers are best-effort: they catch their own errors so a failed
// cancellation never blocks the rest of a user-deletion pipeline. Counts and
// errors are returned so the caller can surface them in the audit log.

import { loadRazorpayCreds } from "./razorpay-config.ts";

interface CancelResult {
  attempted: number;
  cancelled: number;
  errors: string[];
}

/**
 * Cancel every active/non-terminal Razorpay subscription tied to the user.
 * Looks up rows in `public.subscriptions` where `gateway = 'razorpay'`.
 */
export async function cancelRazorpaySubscriptionsForUser(
  admin: any,
  userId: string,
): Promise<CancelResult> {
  const result: CancelResult = { attempted: 0, cancelled: 0, errors: [] };
  const TERMINAL = new Set(["cancelled", "canceled", "completed", "expired"]);

  const { data: rows, error } = await admin
    .from("subscriptions")
    .select("id, razorpay_subscription_id, status, gateway")
    .eq("user_id", userId)
    .eq("gateway", "razorpay");
  if (error) {
    result.errors.push(`select: ${error.message}`);
    return result;
  }
  const targets = (rows ?? []).filter(
    (r: any) => r.razorpay_subscription_id && !TERMINAL.has((r.status ?? "").toLowerCase()),
  );
  if (!targets.length) return result;

  const creds = await loadRazorpayCreds(admin);
  if (!creds) {
    result.errors.push("razorpay_not_configured");
    return result;
  }
  const auth = btoa(`${creds.keyId}:${creds.keySecret}`);

  for (const row of targets) {
    result.attempted++;
    const subId = (row as any).razorpay_subscription_id as string;
    try {
      const res = await fetch(
        `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subId)}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
          // `cancel_at_cycle_end: 0` cancels immediately so we stop incurring
          // platform fees on the very next billing cycle.
          body: JSON.stringify({ cancel_at_cycle_end: 0 }),
        },
      );
      if (!res.ok && res.status !== 404) {
        const txt = await res.text().catch(() => "");
        result.errors.push(`razorpay ${subId}: ${res.status} ${txt.slice(0, 160)}`);
        continue;
      }
      result.cancelled++;
      await admin
        .from("subscriptions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", (row as any).id);
    } catch (e) {
      result.errors.push(`razorpay ${subId}: ${(e as Error).message}`);
    }
  }
  return result;
}

/**
 * Cancel every non-terminal Stripe subscription tied to the user. Uses the
 * shared gateway client so we never hold a raw Stripe secret here.
 */
export async function cancelStripeSubscriptionsForUser(
  admin: any,
  userId: string,
): Promise<CancelResult> {
  const result: CancelResult = { attempted: 0, cancelled: 0, errors: [] };
  const TERMINAL = new Set(["canceled", "incomplete_expired"]);

  const { data: rows, error } = await admin
    .from("subscriptions")
    .select("id, stripe_subscription_id, status, environment")
    .eq("user_id", userId)
    .not("stripe_subscription_id", "is", null);
  if (error) {
    result.errors.push(`select: ${error.message}`);
    return result;
  }
  const targets = (rows ?? []).filter(
    (r: any) =>
      r.stripe_subscription_id && !TERMINAL.has((r.status ?? "").toLowerCase()),
  );
  if (!targets.length) return result;

  // Lazy-import so this file works in functions that never touch Stripe.
  let createStripeClient: (env: "sandbox" | "live") => any;
  try {
    ({ createStripeClient } = await import("./stripe.ts"));
  } catch (e) {
    result.errors.push(`stripe shim missing: ${(e as Error).message}`);
    return result;
  }

  for (const row of targets) {
    result.attempted++;
    const subId = (row as any).stripe_subscription_id as string;
    const env = ((row as any).environment ?? "sandbox") === "live" ? "live" : "sandbox";
    try {
      const stripe = createStripeClient(env);
      await stripe.subscriptions.cancel(subId);
      result.cancelled++;
      await admin
        .from("subscriptions")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("id", (row as any).id);
    } catch (e: any) {
      // If Stripe says the subscription is already canceled or missing, count it.
      const msg = String(e?.message ?? e);
      if (/No such subscription|already been canceled/i.test(msg)) {
        result.cancelled++;
        continue;
      }
      result.errors.push(`stripe ${subId}: ${msg.slice(0, 200)}`);
    }
  }
  return result;
}
