// Entitlement helper: authoritative check for Paddle-backed paid access.
//
// Rule (aligned with product spec):
//  • `active` and `trialing` grant access.
//  • A `scheduled_change_action` (e.g. pending cancel at term end) does NOT
//    revoke access — the user keeps it until `status` physically flips.
//  • `canceled`, `paused`, `past_due` deny access.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export type PaidAccessResult = {
  hasAccess: boolean;
  reason: "active" | "trialing" | "no_customer" | "no_subscription" | "revoked";
  subscriptionId?: string;
  status?: string;
  scheduledChangeAction?: string | null;
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Check whether a Paddle customer currently has paid access.
 * Pass the Paddle customer id (not the internal user id).
 */
export async function checkUserPaidAccess(
  customerId: string,
  client?: SupabaseClient,
): Promise<PaidAccessResult> {
  if (!customerId) return { hasAccess: false, reason: "no_customer" };
  const sb = client ?? admin();
  const { data, error } = await sb
    .from("subscriptions")
    .select("paddle_subscription_id,status,scheduled_change_action")
    .eq("paddle_customer_id", customerId)
    .order("updated_at", { ascending: false })
    .limit(10);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    paddle_subscription_id: string | null;
    status: string | null;
    scheduled_change_action: string | null;
  }>;
  if (rows.length === 0) return { hasAccess: false, reason: "no_subscription" };

  const grant = rows.find((r) => ACTIVE_STATUSES.has(String(r.status)));
  if (grant) {
    return {
      hasAccess: true,
      reason: grant.status === "trialing" ? "trialing" : "active",
      subscriptionId: grant.paddle_subscription_id ?? undefined,
      status: grant.status ?? undefined,
      scheduledChangeAction: grant.scheduled_change_action,
    };
  }
  return {
    hasAccess: false,
    reason: "revoked",
    status: rows[0].status ?? undefined,
    subscriptionId: rows[0].paddle_subscription_id ?? undefined,
    scheduledChangeAction: rows[0].scheduled_change_action,
  };
}
