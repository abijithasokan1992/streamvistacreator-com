/**
 * Cross-dashboard billing failure utilities.
 *
 * Goal: replace generic "Edge Function returned a non-2xx status code"
 * toasts with the actual server error, and write an actionable
 * support_requests row so admins can triage purchase failures.
 *
 * Reuses existing infra:
 *   • supabase.functions.invoke FunctionsHttpError.context contains the real body
 *   • support_requests table is already the admin inbox (see Upgrade + Admin Support)
 */
import { supabase } from "@/integrations/supabase/client";

export type BillingStage =
  | "sku_resolution"
  | "dialog_launch"
  | "order_create"
  | "payment_verify"
  | "allocation_refresh";

export type BillingDashboard = "creator" | "studio";

export interface BillingFailureContext {
  userId?: string | null;
  userEmail?: string | null;
  dashboard: BillingDashboard;
  surface: string;          // e.g. "studio_testing_allowance_cta"
  intent: string;           // e.g. "1 TB Studio Storage" or product id
  stage: BillingStage;
  error: unknown;
  extra?: Record<string, unknown>;
}

/**
 * Best-effort: extract a human-readable error from a
 * supabase.functions.invoke() result. The SDK throws FunctionsHttpError
 * whose `.context` is a Response; the JSON body usually carries `{ error }`.
 */
export async function extractFnError(error: unknown, fallback: string): Promise<string> {
  if (!error) return fallback;
  // FunctionsHttpError exposes `context` (a Response) on recent SDKs
  const anyErr = error as any;
  try {
    const ctx = anyErr?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json().catch(() => null);
      if (body) {
        if (typeof body.error === "string") return body.error;
        if (typeof body.message === "string") return body.message;
      }
    }
    if (ctx && typeof ctx.text === "function") {
      const txt = await ctx.text().catch(() => "");
      if (txt && txt.length < 400) return txt;
    }
  } catch { /* swallow */ }
  if (typeof anyErr?.message === "string" && !/non-2xx/i.test(anyErr.message)) {
    return anyErr.message;
  }
  return fallback;
}

/**
 * Write an actionable admin issue record. Routed through the existing
 * support_requests table so it surfaces in the existing admin Support inbox.
 * Silent / best-effort — never throws.
 */
export async function reportBillingFailure(ctx: BillingFailureContext): Promise<void> {
  try {
    const message = ctx.error instanceof Error ? ctx.error.message : String(ctx.error ?? "");
    const metadata = {
      kind: "billing_failure",
      surface: ctx.surface,
      dashboard_type: ctx.dashboard,
      billing_stage: ctx.stage,
      purchase_intent: ctx.intent,
      error_message: message,
      error_at: new Date().toISOString(),
      ...(ctx.extra ?? {}),
    };
    await (supabase as any).from("support_requests").insert({
      user_id: ctx.userId ?? null,
      request_type: "billing_failure",
      subject: `Billing failure · ${ctx.dashboard} · ${ctx.stage} · ${ctx.intent}`,
      message:
        `A customer checkout failed and was logged automatically.\n\n` +
        `Dashboard: ${ctx.dashboard}\n` +
        `Surface: ${ctx.surface}\n` +
        `Stage: ${ctx.stage}\n` +
        `Intent: ${ctx.intent}\n` +
        `User: ${ctx.userEmail ?? ctx.userId ?? "—"}\n\n` +
        `Error:\n${message || "(no message)"}\n`,
      status: "open",
      metadata,
    });
  } catch {
    /* never block the user on logging */
  }
}
