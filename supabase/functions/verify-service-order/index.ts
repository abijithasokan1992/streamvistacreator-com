import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonWith(req: Request) {
  const cors = buildCorsHeaders(req);
  return (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
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

    const { serviceOrderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!serviceOrderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: "Missing payment fields" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const creds = await loadRazorpayCreds(admin);
    if (!creds) return json({ error: "Razorpay not configured" }, 503);

    const expected = createHmac("sha256", creds.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature) return json({ error: "Signature mismatch" }, 400);

    const { data: order, error: orderError } = await admin
      .from("service_orders").select("*").eq("id", serviceOrderId).maybeSingle();
    if (orderError || !order) return json({ error: "Service order not found" }, 404);
    if (order.user_id !== uid) return json({ error: "Forbidden" }, 403);
    if (order.razorpay_order_id !== razorpay_order_id) return json({ error: "Order mismatch" }, 400);

    if (order.status === "paid") {
      return json({ ok: true, alreadyProcessed: true, serviceOrderId: order.id, invoiceId: order.invoice_id });
    }

    const invoiceNumber = `SV-${new Date().getUTCFullYear()}-${order.id.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
    const { data: invoice, error: invoiceError } = await admin.from("invoices").insert({
      user_id: uid,
      invoice_number: invoiceNumber,
      description: order.service_name,
      currency: "INR",
      subtotal_paise: order.subtotal_paise,
      gst_percent: 18,
      gst_paise: order.gst_paise,
      total_paise: order.total_paise,
      status: "paid",
      source: "service_order",
      razorpay_order_id,
      razorpay_payment_id,
      billed_to_email: order.customer_email,
      issued_at: new Date().toISOString(),
    }).select("id").single();
    if (invoiceError || !invoice) return json({ error: invoiceError?.message || "Invoice creation failed" }, 500);

    const { error: updateError } = await admin.from("service_orders").update({
      status: "paid",
      razorpay_payment_id,
      invoice_id: invoice.id,
      paid_at: new Date().toISOString(),
    }).eq("id", serviceOrderId).eq("status", "pending");
    if (updateError) return json({ error: updateError.message }, 500);

    return json({ ok: true, alreadyProcessed: false, serviceOrderId, invoiceId: invoice.id });
  } catch (error) {
    console.error("verify-service-order error", error);
    return json({ error: "Internal server error" }, 500);
  }
});
