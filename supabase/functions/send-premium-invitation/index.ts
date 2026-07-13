import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
import { sendGmail } from "../_shared/gmail.ts";
const MAIL_FROM = Deno.env.get("MAIL_FROM") || "StreamVista Cloud X <abijithasokan@crayonspictures.com>";
// Always use the live primary domain for invite links, regardless of where the admin sends from.
const PRIMARY_DOMAIN = "https://streamvista.in";
const CC_EMAILS = ["abijithasokan@crayonspictures.com"];

function jsonWith(req: Request) {
  const cors = buildCorsHeaders(req);
  return (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
}

function renderHtml(p: {
  name: string;
  inviteUrl: string;
  refUrl: string | null;
  storageTb: number;
  validityDays: number;
  accountType: "personal" | "professional";
}) {
  const safe = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const name = safe(p.name);
  const inviteUrl = safe(p.inviteUrl);
  const refUrl = p.refUrl ? safe(p.refUrl) : null;
  const tier = p.accountType === "professional" ? "Professional Tier" : "Personal Tier";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>StreamVista Cloud X — Your Special Invite</title>
</head>
<body style="margin:0;padding:0;background:#06060b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e8e8ee;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Special Invite · ${p.storageTb} TB FREE for ${p.validityDays} days on StreamVista Cloud X.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#06060b;background-image:radial-gradient(ellipse at top,rgba(168,85,247,0.22),transparent 60%),radial-gradient(ellipse at bottom,rgba(59,130,246,0.16),transparent 60%);padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0e0f17;border:1px solid rgba(255,255,255,0.08);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(168,85,247,0.4);">
        <tr><td style="padding:28px 32px 0;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;letter-spacing:0.6px;background:linear-gradient(90deg,#a855f7,#ec4899,#f59e0b);-webkit-background-clip:text;background-clip:text;color:transparent;">STREAMVISTA · CLOUD&nbsp;X</div>
          <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent);margin:18px 0 0;"></div>
        </td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);font-size:11px;letter-spacing:2px;color:#fbbf24;text-transform:uppercase;font-weight:700;">Special Invite · ${tier}</div>
          <h1 style="margin:12px 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.15;font-weight:700;color:#fff;">A cinematic cloud, on the house.</h1>
          <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#b8b8c8;">Hi ${name}, you've been hand-picked for <b style="color:#fff;">StreamVista Cloud X</b> — the storage layer built for filmmakers, studios and storytellers who need cinema-grade infrastructure with zero compromises.</p>
        </td></tr>
        <tr><td style="padding:24px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(168,85,247,0.14),rgba(236,72,153,0.08));border:1px solid rgba(168,85,247,0.3);border-radius:14px;">
            <tr><td style="padding:18px 20px;">
              <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a855f7;font-weight:700;">Your allocation</div>
              <table role="presentation" width="100%" style="margin-top:8px;"><tr>
                <td style="font-family:Georgia,serif;font-size:30px;font-weight:700;color:#fff;">${p.storageTb} TB · FREE</td>
                <td align="right" style="font-size:13px;color:#b8b8c8;">Valid for <b style="color:#fff;">${p.validityDays} days</b></td>
              </tr></table>
              <p style="margin:10px 0 0;font-size:13px;color:#b8b8c8;">Complimentary on us — no card required. Plan 1 TB Free.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:28px 32px 8px;">
          <a href="${inviteUrl}" style="display:inline-block;padding:16px 36px;background:linear-gradient(90deg,#a855f7,#ec4899);color:#fff;font-weight:700;font-size:15px;letter-spacing:0.4px;text-decoration:none;border-radius:999px;box-shadow:0 14px 40px -10px rgba(236,72,153,0.55);">Activate StreamVista Cloud X →</a>
          <p style="margin:14px 0 0;font-size:12px;color:#71717a;word-break:break-all;">or paste: <span style="color:#a8a8b8;">${inviteUrl}</span></p>
        </td></tr>
        ${refUrl ? `
        <tr><td style="padding:18px 32px 8px;">
          <div style="border:1px dashed rgba(245,158,11,0.35);border-radius:12px;padding:16px 18px;background:rgba(245,158,11,0.05);">
            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#f59e0b;font-weight:700;">🎁 Your referral link</div>
            <p style="margin:8px 0 6px;font-size:13px;color:#d4d4dc;">Share it on WhatsApp status or socials — every signup earns you extra storage or revenue.</p>
            <a href="${refUrl}" style="font-size:13px;color:#fbbf24;word-break:break-all;text-decoration:none;">${refUrl}</a>
          </div>
        </td></tr>` : ""}
        <tr><td style="padding:18px 32px 28px;">
          <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#9999aa;">Warmly,<br/><b style="color:#fff;">The StreamVista Team</b></p>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <div style="height:1px;background:rgba(255,255,255,0.08);"></div>
          <p style="margin:14px 0 0;font-size:11px;color:#5b5b6b;text-align:center;">This invite is personal and expires in ${p.validityDays} days.<br/>© StreamVista Cloud X · <a href="${PRIMARY_DOMAIN}" style="color:#7c7c8c;text-decoration:none;">streamvista.in</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const json = jsonWith(req);

  try {
    // Gmail credentials checked inside sendGmail()

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (userErr || !uid) return json({ error: "Unauthorized" }, 401);

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

    const inviteUrl = `${PRIMARY_DOMAIN}/invite/${encodeURIComponent(inv.token)}`;
    const refUrl = inv.referral_code ? `${PRIMARY_DOMAIN}/?ref=${encodeURIComponent(inv.referral_code)}` : null;
    const name = inv.invitee_name || (inv.invitee_email as string).split("@")[0];
    const accountType = (inv.account_type === "professional" ? "professional" : "personal") as "personal" | "professional";

    const html = renderHtml({
      name,
      inviteUrl,
      refUrl,
      storageTb: Number(inv.storage_tb) || 1,
      validityDays: Number(inv.validity_days) || 30,
      accountType,
    });

    const out = await sendGmail({
      from: MAIL_FROM,
      to: inv.invitee_email,
      cc: CC_EMAILS,
      subject: `Your StreamVista Cloud X invite · ${inv.storage_tb} TB FREE`,
      html,
      replyTo: "hello@streamvista.in",
    });

    if (!out.ok) {
      console.error("Gmail send error", out.status, out.error);
      return json({ error: out.error || "Email send failed", status: out.status }, 502);
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
