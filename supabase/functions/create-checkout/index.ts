import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const ALLOWED_PRICE_IDS = new Set([
  "cloudx_creator",
  "cloudx_monthly",
  "cloudx_quarterly",
  "cloudx_yearly",
]);

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: buildCorsHeaders(req) });

  try {
    const { priceId, quantity, returnUrl, environment } = await req.json();
    const qty = Math.max(1, Math.min(10, Number(quantity ?? 1)));

    // Derive userId / email from authenticated session — never trust client.
    let userId: string | undefined;
    let customerEmail: string | undefined;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supaUrl = Deno.env.get("SUPABASE_URL");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (supaUrl && anonKey) {
        const sb = createClient(supaUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const token = authHeader.replace("Bearer ", "");
        const { data } = await sb.auth.getClaims(token);
        if (data?.claims?.sub) {
          userId = data.claims.sub as string;
          customerEmail = (data.claims.email as string | undefined) ?? undefined;
        }
      }
    }

    if (!priceId || !ALLOWED_PRICE_IDS.has(priceId)) {
      return new Response(JSON.stringify({ error: "Invalid priceId" }), {
        status: 400, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (environment !== "sandbox" && environment !== "live") {
      return new Response(JSON.stringify({ error: "Invalid environment" }), {
        status: 400, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (!returnUrl || typeof returnUrl !== "string") {
      return new Response(JSON.stringify({ error: "Missing returnUrl" }), {
        status: 400, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Open-redirect protection: returnUrl must be on an allow-listed origin.
    const allowList = (Deno.env.get("SITE_ORIGIN") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    let returnOrigin: string;
    try {
      returnOrigin = new URL(returnUrl).origin;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid returnUrl" }), {
        status: 400, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (!allowList.length) {
      console.error("SITE_ORIGIN is not configured");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (!allowList.includes(returnOrigin)) {
      return new Response(JSON.stringify({ error: "Invalid returnUrl" }), {
        status: 400, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const env: StripeEnv = environment;
    const stripe = createStripeClient(env);

    const prices = await stripe.prices.list({ lookup_keys: [priceId] });
    if (!prices.data.length) throw new Error("Price not found");
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    const customerId = (customerEmail || userId)
      ? await resolveOrCreateCustomer(stripe, { email: customerEmail, userId })
      : undefined;

    let productDescription: string | undefined;
    if (!isRecurring) {
      const productId = typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product.id;
      const product = await stripe.products.retrieve(productId);
      productDescription = product.name;
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: qty }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      ...(customerId && { customer: customerId }),
      ...(!isRecurring && { payment_intent_data: { description: productDescription } }),
      ...(userId && {
        metadata: { userId },
        ...(isRecurring && { subscription_data: { metadata: { userId } } }),
      }),
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout error", e);
    return new Response(JSON.stringify({ error: "Checkout session creation failed" }), {
      status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
