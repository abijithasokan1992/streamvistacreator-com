import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Crayons Pictures <onboarding@resend.dev>";
const SITE_ORIGIN = Deno.env.get("SITE_ORIGIN") || "https://creatoreconomy.lovable.app";
const CC_EMAILS = ["picturecrayons@gmail.com", "abijithasokan1992@gmail.com"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function renderHtml(p: {
  name: string;
  inviteUrl: string;
  refUrl: string | null;
  storageTb: number;
  validityDays: number;
  isFree: boolean;
  priceLabel: string;
}) {
  const safe = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const name = safe(p.name);
  const inviteUrl = safe(p.inviteUrl);
  const refUrl = p.refUrl ? safe(p.refUrl) : null;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Your Crayons Creator Cloud Invite</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e8e8ee;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your private invite to the Crayons Creator Cloud — ${p.storageTb} TB · ${p.validityDays} days.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;background-image:radial-gradient(ellipse at top,rgba(168,85,247,0.18),transparent 60%),radial-gradient(ellipse at bottom,rgba(59,130,246,0.15),transparent 60%);padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#11121a;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(168,85,247,0.35);">
        <tr><td style="padding:28px 32px 0;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;letter-spacing:0.5px;background:linear-gradient(90deg,#a855f7,#ec4899,#f59e0b);-webkit-background-clip:text;background-clip:text;color:transparent;">CRAYONS · CREATOR CLOUD</div>
          <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent);margin:18px 0 0;"></div>
        </td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;font-weight:700;color:#fff;">An exclusive cloud, opened for you.</h1>
          <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#b8b8c8;">Hi ${name}, you've been hand-picked for the StreamVista creator cloud — built for filmmakers, studios and storytellers who need cinema-grade storage with zero compromises.</p>
        </td></tr>
        <tr><td style="padding:24px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(168,85,247,0.12),rgba(236,72,153,0.08));border:1px solid rgba(168,85,247,0.25);border-radius:14px;">
            <tr><td style="padding:18px 20px;">
              <table role="presentation" width="100%"><tr>
                <td style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#a855f7;font-weight:600;">Your allocation</td>
              </tr></table>
              <table role="presentation" width="100%" style="margin-top:8px;"><tr>
                <td style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#fff;">${p.storageTb} TB</td>
                <td align="right" style="font-size:13px;color:#b8b8c8;">Valid for <b style="color:#fff;">${p.validityDays} days</b></td>
              </tr></table>
              <p style="margin:10px 0 0;font-size:13px;color:#b8b8c8;">${p.isFree ? "Complimentary — at our cost." : `Your price: <b style="color:#fff;">${safe(p.priceLabel)}</b>`}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:28px 32px 8px;">
          <a href="${inviteUrl}" style="display:inline-block;padding:16px 36px;background:linear-gradient(90deg,#a855f7,#ec4899);color:#fff;font-weight:700;font-size:15px;letter-spacing:0.4px;text-decoration:none;border-radius:999px;box-shadow:0 14px 40px -10px rgba(236,72,153,0.55);">Activate your cloud →</a>
          <p style="margin:14px 0 0;font-size:12px;color:#71717a;word-break:break-all;">or paste: <span style="color:#a8a8b8;">${inviteUrl}</span></p>
        </td></tr>
        ${refUrl ? `
        <tr><td style="padding:18px 32px 8px;">
          <div style="border:1px dashed rgba(245,158,11,0.35);border-radius:12px;padding:16px 18px;background:rgba(245,158,11,0.05);">
            <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#f59e0b;font-weight:600;">🎁 Your referral link</div>
            <p style="margin:8px 0 6px;font-size:13px;color:#d4d4dc;">Share it on WhatsApp status or socials — every signup earns you extra storage or revenue.</p>
            <a href="${refUrl}" style="font-size:13px;color:#fbbf24;word-break:break-all;text-decoration:none;">${refUrl}</a>
          </div>
        </td></tr>` : ""}
        <tr><td style="padding:18px 32px 28px;">
          <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#9999aa;">Warmly,<br/><b style="color:#fff;">Abijith Asokan</b><br/>Crayons Pictures</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <div style="height:1px;background:rgba(255,255,255,0.08);"></div>
          <p style="margin:14px 0 0;font-size:11px;color:#5b5b6b;text-align:center;">This invite is personal and expires in ${p.validityDays} days. © Crayons Pictures · StreamVista Creator Cloud.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const uid = claims?.claims?.sub;
    if (!uid) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const invitationId = body?.invitationId as string | undefined;
    if (!invitationId || typeof invitationId !== "string") return json({ error: "invitationId required" }, 400);

    const { data: inv, error: invErr } = await admin
      .from("premium_invitations").select("*").eq("id", invitationId).maybeSingle();
    if (invErr || !inv) return json({ error: "Invitation not found" }, 404);
    if (!inv.invitee_email) return json({ error: "Invitation has no email" }, 400);
    if (inv.status === "revoked") return json({ error: "Invitation revoked" }, 400);

    const inviteUrl = `${SITE_ORIGIN}/invite/${encodeURIComponent(inv.token)}`;
    const refUrl = inv.referral_code ? `${SITE_ORIGIN}/?ref=${encodeURIComponent(inv.referral_code)}` : null;
    const name = inv.invitee_name || (inv.invitee_email as string).split("@")[0];

    // Price label (1 TB @ ₹650 + 18% GST = ₹767)
    const base = (Number(inv.storage_tb) || 1) * 650;
    const total = Math.round(base * 1.18);
    const priceLabel = inv.is_free ? "FREE" : `₹${total.toLocaleString("en-IN")} (₹650/TB + 18% GST)`;

    const html = renderHtml({
      name,
      inviteUrl,
      refUrl,
      storageTb: Number(inv.storage_tb) || 1,
      validityDays: Number(inv.validity_days) || 30,
      isFree: !!inv.is_free,
      priceLabel,
    });

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [inv.invitee_email],
        cc: CC_EMAILS,
        subject: "Your exclusive Crayons Creator Cloud invite",
        html,
        reply_to: "abijithasokan@crayonspictures.com",
      }),
    });

    const out = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("Resend error", resp.status, out);
      return json({ error: out?.message || "Resend send failed", status: resp.status }, 502);
    }

    const channels = Array.from(new Set([...(inv.sent_channels ?? []), "email"]));
    await admin.from("premium_invitations")
      .update({ sent_channels: channels, status: inv.status === "pending" ? "sent" : inv.status })
      .eq("id", inv.id);

    return json({ ok: true, id: out?.id ?? null });
  } catch (e) {
    console.error("send-premium-invitation error", e);
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});
