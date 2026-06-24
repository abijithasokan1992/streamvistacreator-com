/**
 * Lightweight transactional notification helper.
 *
 * Writes one row into public.notifications (in-app notification surface
 * already rendered by the Creator "Updates" section). Admin role bypasses
 * RLS through the "Admins full access" policy; regular users can only
 * write to themselves indirectly via SECURITY DEFINER RPCs or admin paths.
 *
 * If/when the project wires the send-transactional-email queue with a
 * shared "operational-notice" template, swap the supabase.from(...) call
 * below for a supabase.functions.invoke("send-transactional-email", ...).
 */
import { supabase } from "@/integrations/supabase/client";

export type NotifyEvent =
  | "storage_topup_paid"
  | "vault_purchase_paid"
  | "invoice_issued"
  | "offer_issued"
  | "offer_accepted"
  | "offer_rejected"
  | "screening_invite_created"
  | "edit_request_approved"
  | "edit_request_rejected"
  | "entitlement_granted";

export async function notify(
  userId: string,
  event: NotifyEvent,
  title: string,
  message: string,
) {
  if (!userId) return;
  try {
    await (supabase as any).from("notifications").insert({
      user_id: userId,
      title: `[${event}] ${title}`.slice(0, 200),
      message,
    });
  } catch (err) {
    // Do not let notification failures break the calling workflow.
    console.warn("notify failed", event, err);
  }
}
