/**
 * verify-storage-topup
 *
 * Verifies a Razorpay signature for a PAYG top-up, marks the
 * `storage_topups` row as paid, projects the entitlement to the
 * canonical `plan_assignments` + `storage_allocations` tables via
 * `project_topup_entitlement`, creates the invoice, and emails the receipt.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { createHmac } from "node:crypto";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";
import { logPayment } from "../_shared/payment-logger.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_ORIGIN  = Deno.env.get("SITE_ORIGIN") ?? "https://streamvistacreator.com";

function jsonWith(req: Request) {
  const cors = buildCorsHeaders(req);
  return (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
}

async function sendReceipt(admin: any, invoiceId: string) {
  try {
    const { data: inv } = await admin.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
    if (!inv || !inv.billed_to_email) return;
    await admin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "invoice-receipt",
        recipientEmail: inv.billed_to_email,
        idempotencyKey: `invoice-${inv.id}`,
        templateData: {
          invoiceNumber: inv.invoice_number,
          description: inv.description,
          subtotalInr: Number(inv.subtotal_paise) / 100,
          gstInr: Number(inv.gst_paise) / 100,
          totalInr: Number(inv.total_paise) / 100,
          issuedAt: inv.issued_at,
          receiptUrl: `${SITE_ORIGIN}/invoice/${inv.id}`,
          billedToEmail: inv.billed_to_email,
        },
      },
    });
  } catch (e) {
    console.error("invoice receipt email failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const json = jsonWith(req);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (userErr || !uid) return json({ error: "Unauthorized" }, 401);

    const { topupId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!topupId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: "Missing fields" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const creds = await loadRazorpayCreds(admin);
    if (!creds) return json({ error: "Razorpay not configured" }, 503);

    const expected = createHmac("sha256", creds.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature) {
      await logPayment(admin, {
        severity: "ERROR", source: "edge", action_type: "webhook.signature",
        user_id: uid, order_id: razorpay_order_id, payment_id: razorpay_payment_id,
        error_message: "Signature mismatch on verify-storage-topup",
      });
      return json({ error: "Signature mismatch" }, 400);
    }

    const { data: row, error: rowErr } = await admin
      .from("storage_topups").select("*").eq("id", topupId).maybeSingle();
    if (rowErr || !row) return json({ error: "Top-up not found" }, 404);
    if (row.user_id !== uid) return json({ error: "Forbidden" }, 403);
    if (row.razorpay_order_id !== razorpay_order_id) {
      await logPayment(admin, {
        severity: "ERROR", source: "edge", action_type: "webhook.idempotency_conflict",
        user_id: uid, order_id: razorpay_order_id, payment_id: razorpay_payment_id,
        error_message: `Order id mismatch (expected ${row.razorpay_order_id})`,
        extra: { topup_id: topupId },
      });
      return json({ error: "Order mismatch" }, 400);
    }

    if (row.status === "paid") {
      // Idempotent — webhook (or a prior verify call) already finalized this top-up.
      // Re-project entitlement (safe no-op if already projected) and return success
      // so the frontend transitions to verified_success instead of error.
      const { data: proj } = await admin.rpc("project_topup_entitlement", { _topup_id: topupId });
      if (proj?.invoice_id) await sendReceipt(admin, proj.invoice_id);
      return json({
        ok: true,
        alreadyProcessed: true,
        webhookFinalized: true,
        ...(proj ?? {}),
      });
    }

    await admin.from("storage_topups")
      .update({ status: "paid", razorpay_payment_id })
      .eq("id", topupId);

    // Canonical projection: plan_assignments + storage_allocations + invoices
    const { data: proj, error: projErr } = await admin.rpc("project_topup_entitlement", { _topup_id: topupId });
    if (projErr) {
      await logPayment(admin, {
        severity: "ERROR", source: "edge", action_type: "entitlement.projection_failed",
        user_id: uid, order_id: razorpay_order_id, payment_id: razorpay_payment_id,
        error_message: projErr.message, extra: { topup_id: topupId },
      });
      return json({ error: "Entitlement projection failed", detail: projErr.message }, 500);
    }

    if (proj?.invoice_id) await sendReceipt(admin, proj.invoice_id);

    await logPayment(admin, {
      severity: "INFO", source: "edge", action_type: "verify.complete",
      user_id: uid, order_id: razorpay_order_id, payment_id: razorpay_payment_id,
      extra: { topup_id: topupId, invoice_id: proj?.invoice_id, tb_added: proj?.tb_added },
    });

    return json({ ok: true, ...(proj ?? {}) });
  } catch (e) {
    console.error("verify-storage-topup error", e);
    return json({ error: "Internal server error" }, 500);
  }
});
