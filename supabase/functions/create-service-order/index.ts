import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SERVICES = {
  film_onboarding: { name: "Film Onboarding Package", subtotalPaise: 99900, gstPaise: 18000, totalPaise: 117900 },
  licensing_ready: { name: "Licensing Ready Package", subtotalPaise: 299900, gstPaise: 54000, totalPaise: 353900 },
} as const;

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

    const body = await req.json().catch(() => ({}));
    const code = String(body?.serviceCode || "") as keyof typeof SERVICES;
    const service = SERVICES[code];
    if (!service) return json({ error: "Invalid service" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const creds = await loadRazorpayCreds(admin);
    if (!creds) return json({ error: "Razorpay not configured" }, 503);

    const { data: row, error: insertError } = await admin.from("service_orders").insert({
      user_id: uid,
      service_code: code,
      service_name: service.name,
      subtotal_paise: service.subtotalPaise,
      gst_paise: service.gstPaise,
      total_paise: service.totalPaise,
      customer_email: userRes.user.email ?? null,
      metadata: body?.__metadata ?? {},
    }).select("id").single();
    if (insertError || !row) return json({ error: insertError?.message || "Could not create service order" }, 500);

    const auth = btoa(`${creds.keyId}:${creds.keySecret}`);
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: service.totalPaise,
        currency: "INR",
        receipt: `service_${row.id.slice(0, 24)}`,
        payment_capture: 1,
        notes: { service_order_id: row.id, service_code: code, user_id: uid },
      }),
    });
    const order = await rzpRes.json();
    if (!rzpRes.ok) {
      await admin.from("service_orders").update({ status: "failed" }).eq("id", row.id);
      return json({ error: order?.error?.description || "Razorpay order creation failed" }, 502);
    }

    await admin.from("service_orders").update({ razorpay_order_id: order.id }).eq("id", row.id);
    return json({ serviceOrderId: row.id, orderId: order.id, amount: order.amount, currency: order.currency, keyId: creds.keyId });
  } catch (error) {
    console.error("create-service-order error", error);
    return json({ error: "Internal server error" }, 500);
  }
});
