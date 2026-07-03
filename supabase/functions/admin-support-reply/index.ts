/**
 * admin-support-reply
 *
 * Admin-only edge function — emails a support-ticket reply to the user via
 * the Gmail connector and (idempotently) marks the request resolved.
 *
 * Body: { requestId: string; reply: string }
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
import { sendGmail } from "../_shared/gmail.ts";
const MAIL_FROM = Deno.env.get("MAIL_FROM") || "StreamVista Support <abijithasokan@crayonspictures.com>";

function jsonWith(req: Request) {
  const cors = buildCorsHeaders(req);
  return (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function renderHtml(opts: { name: string; subject: string; reply: string; originalMessage: string }) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#06060b;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#e8e8ee;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;background:#06060b;background-image:radial-gradient(ellipse at top,rgba(168,85,247,0.18),transparent 60%);"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0e0f17;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;">
      <tr><td style="padding:24px 28px 0;"><div style="font-family:Georgia,serif;font-size:20px;font-weight:700;background:linear-gradient(90deg,#a855f7,#ec4899,#f59e0b);-webkit-background-clip:text;background-clip:text;color:transparent;">STREAMVISTA · CLOUD&nbsp;X</div></td></tr>
      <tr><td style="padding:18px 28px 6px;"><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a855f7;font-weight:700;">Support reply</div><h1 style="margin:8px 0 4px;font-family:Georgia,serif;font-size:22px;color:#fff;">Re: ${esc(opts.subject)}</h1><p style="margin:6px 0 0;font-size:13px;color:#9999aa;">Hi ${esc(opts.name)}, thanks for reaching out — here's our reply:</p></td></tr>
      <tr><td style="padding:16px 28px;"><div style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.25);border-radius:12px;padding:16px 18px;font-size:14px;line-height:1.6;color:#e8e8ee;white-space:pre-wrap;">${esc(opts.reply)}</div></td></tr>
      <tr><td style="padding:6px 28px 18px;"><details style="font-size:12px;color:#9999aa;"><summary style="cursor:pointer;">Your original request</summary><div style="margin-top:8px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;white-space:pre-wrap;color:#b8b8c8;">${esc(opts.originalMessage)}</div></details></td></tr>
      <tr><td style="padding:0 28px 24px;"><div style="height:1px;background:rgba(255,255,255,0.08);"></div><p style="margin:14px 0 0;font-size:11px;color:#5b5b6b;text-align:center;">© StreamVista Cloud X · streamvistacreator.com</p></td></tr>
    </table>
  </td></tr></table></body></html>`;
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
    const requestId = body?.requestId as string | undefined;
    const reply = (body?.reply as string | undefined)?.trim();
    if (!requestId || !reply) return json({ error: "requestId & reply required" }, 400);
    if (reply.length > 8000) return json({ error: "Reply too long" }, 400);

    const { data: row, error: rowErr } = await admin
      .from("support_requests").select("*").eq("id", requestId).maybeSingle();
    if (rowErr || !row) return json({ error: "Request not found" }, 404);

    // Resolve user email
    const { data: userRow } = await admin.auth.admin.getUserById(row.user_id);
    const to = userRow?.user?.email;
    if (!to) return json({ error: "User has no email on file" }, 400);

    const { data: profile } = await admin
      .from("user_profiles").select("display_name,first_name").eq("user_id", row.user_id).maybeSingle();
    const name = profile?.first_name || profile?.display_name || to.split("@")[0];

    // Send via Gmail FIRST — only mark resolved if delivery succeeds
    const out = await sendGmail({
      from: MAIL_FROM,
      to,
      subject: `Re: ${row.subject} · StreamVista Support`,
      html: renderHtml({ name, subject: row.subject, reply, originalMessage: row.message }),
      replyTo: "hello@streamvistacreator.com",
    });
    if (!out.ok) {
      console.error("Gmail send error", out.status, out.error);
      const insufficientScope = out.status === 403 && /insufficient authentication scopes/i.test(out.error || "");
      return json({
        error: insufficientScope
          ? "Gmail connection is missing the 'gmail.send' scope. Reconnect the Gmail connector with Send permission and try again."
          : (out.error || "Email send failed"),
        status: out.status,
      }, 502);
    }

    // Persist reply + status only after successful send
    await admin.from("support_requests")
      .update({ admin_reply: reply, status: "resolved" }).eq("id", requestId);
    return json({ ok: true, id: out?.id ?? null });
  } catch (e) {
    console.error("admin-support-reply error", e);
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});
