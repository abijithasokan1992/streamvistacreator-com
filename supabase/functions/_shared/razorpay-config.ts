// Loads Razorpay credentials from the admin-managed `razorpay_config` table,
// falling back to environment secrets if the row is not yet populated.
// Must only be called with a service-role Supabase client.

export interface RazorpayCreds {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  mode: "test" | "live";
  source: "db" | "env" | "mixed";
}

export async function loadRazorpayCreds(supabase: any): Promise<RazorpayCreds | null> {
  let dbKeyId = "", dbKeySecret = "", dbWebhook = "", mode: "test" | "live" = "test";
  try {
    const { data } = await supabase
      .from("razorpay_config")
      .select("key_id, key_secret, webhook_secret, mode")
      .eq("id", true)
      .maybeSingle();
    if (data) {
      dbKeyId = (data.key_id ?? "").trim();
      dbKeySecret = (data.key_secret ?? "").trim();
      dbWebhook = (data.webhook_secret ?? "").trim();
      mode = (data.mode === "live" ? "live" : "test");
    }
  } catch (e) {
    console.error("loadRazorpayCreds: db read failed", e);
  }

  const envKeyId = (Deno.env.get("RAZORPAY_KEY_ID") ?? "").trim();
  const envKeySecret = (Deno.env.get("RAZORPAY_KEY_SECRET") ?? "").trim();
  const envWebhook = (Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "").trim();

  const keyId = dbKeyId || envKeyId;
  const keySecret = dbKeySecret || envKeySecret;
  const webhookSecret = dbWebhook || envWebhook;

  if (!keyId || !keySecret) return null;

  const usedDb = (dbKeyId && dbKeySecret);
  const usedEnv = (!dbKeyId || !dbKeySecret) && envKeyId && envKeySecret;
  const source: RazorpayCreds["source"] = usedDb && !usedEnv ? "db" : (!usedDb && usedEnv ? "env" : "mixed");

  return { keyId, keySecret, webhookSecret, mode, source };
}
