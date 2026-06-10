// Loads Razorpay credentials. Secrets (key_secret, webhook_secret) live ONLY in
// backend environment variables (managed via Lovable Cloud secrets). The public
// `razorpay_config` row may store the non-sensitive `key_id` and `mode` for
// admin display, but secrets are NEVER read from the database.

export interface RazorpayCreds {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  mode: "test" | "live";
  source: "env";
}

export async function loadRazorpayCreds(supabase: any): Promise<RazorpayCreds | null> {
  let mode: "test" | "live" = "test";
  let dbKeyId = "";
  try {
    const { data } = await supabase
      .from("razorpay_config")
      .select("key_id, mode")
      .eq("id", true)
      .maybeSingle();
    if (data) {
      dbKeyId = (data.key_id ?? "").trim();
      mode = data.mode === "live" ? "live" : "test";
    }
  } catch (e) {
    console.error("loadRazorpayCreds: db read failed", e);
  }

  const envKeyId = (Deno.env.get("RAZORPAY_KEY_ID") ?? "").trim();
  const envKeySecret = (Deno.env.get("RAZORPAY_KEY_SECRET") ?? "").trim();
  const envWebhook = (Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "").trim();

  const keyId = envKeyId || dbKeyId; // prefer env, fall back to DB display value
  const keySecret = envKeySecret;
  const webhookSecret = envWebhook;

  if (!keyId || !keySecret) return null;

  return { keyId, keySecret, webhookSecret, mode, source: "env" };
}
