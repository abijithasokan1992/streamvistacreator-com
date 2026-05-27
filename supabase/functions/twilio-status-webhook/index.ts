import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// Map Twilio MessageStatus -> our normalized status
function normalize(s: string): string {
  const v = (s || "").toLowerCase();
  if (["queued", "accepted", "scheduled"].includes(v)) return "queued";
  if (["sending", "sent"].includes(v)) return "sent";
  if (v === "delivered") return "delivered";
  if (v === "read") return "read";
  if (["failed", "undelivered"].includes(v)) return "failed";
  return v || "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authenticity check: require a shared secret on the StatusCallback URL.
  // Configure Twilio's StatusCallback as:
  //   https://<project>.supabase.co/functions/v1/twilio-status-webhook?secret=<TWILIO_WEBHOOK_SECRET>
  const expectedSecret = Deno.env.get("TWILIO_WEBHOOK_SECRET");
  if (expectedSecret) {
    const url = new URL(req.url);
    const provided = url.searchParams.get("secret") ?? "";
    if (provided !== expectedSecret) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }
  } else {
    console.error("TWILIO_WEBHOOK_SECRET not configured — rejecting callback");
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }


  try {
    const contentType = req.headers.get("content-type") || "";
    let params: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const usp = new URLSearchParams(text);
      usp.forEach((v, k) => (params[k] = v));
    } else if (contentType.includes("application/json")) {
      params = await req.json();
    } else {
      // Twilio also accepts query params on GET
      const url = new URL(req.url);
      url.searchParams.forEach((v, k) => (params[k] = v));
    }

    const messageSid =
      params.MessageSid || params.SmsSid || params.SmsMessageSid;
    const messageStatus =
      params.MessageStatus || params.SmsStatus || "unknown";
    const errorCode = params.ErrorCode || null;
    const errorMessage = params.ErrorMessage || null;
    const to = params.To || null;
    const channel = (to || "").startsWith("whatsapp:") ? "whatsapp" : "sms";

    if (!messageSid) {
      return new Response(
        JSON.stringify({ error: "Missing MessageSid" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const status = normalize(messageStatus);

    // Update existing notification row by message_sid
    const { data: updated, error: updateErr } = await admin
      .from("onboarding_notifications")
      .update({
        status,
        error_code: errorCode,
        error_message: errorMessage,
        raw: params,
        updated_at: new Date().toISOString(),
      })
      .eq("message_sid", messageSid)
      .select("id, onboarding_request_id")
      .maybeSingle();

    if (updateErr) {
      console.error("Update error:", updateErr);
      return new Response(
        JSON.stringify({ error: "Internal error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // If no existing row, just log and return 200 so Twilio stops retrying
    if (!updated) {
      console.warn("No onboarding_notifications row for SID:", messageSid);
    }

    console.log(
      `Twilio status: sid=${messageSid} status=${status} channel=${channel}`,
    );

    return new Response(
      JSON.stringify({ ok: true, sid: messageSid, status }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
