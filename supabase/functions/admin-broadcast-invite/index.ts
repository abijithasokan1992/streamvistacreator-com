// Universal Invitation & Broadcast — admin-only one-click signed invites.
//
// POST { audience: { mode, userIds?, emails?, roleFilter?, planFilter? },
//        subject?, message?, ctaLabel? }
//
// Generates a per-recipient signed token in public.intro_invites and emails
// each recipient a cinematic StreamVista invite via Resend.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
import { sendGmail } from "../_shared/gmail.ts";
const MAIL_FROM = Deno.env.get("MAIL_FROM") || "StreamVista <abijithasokan@crayonspictures.com>";
const PRIMARY_DOMAIN = "https://streamvistacreator.com";

function json(o: unknown, s = 200, cors: HeadersInit = {}) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}

function randToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
}

function renderInviteHtml(p: { name: string; inviteUrl: string; message?: string; ctaLabel: string }) {
  const name = esc(p.name);
  const inviteUrl = esc(p.inviteUrl);
  const cta = esc(p.ctaLabel);
  const msg = p.message ? esc(p.message).replace(/\n/g, "<br/>") : "";
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>StreamVista invite</title></head>
<body style="margin:0;padding:0;background:#06060b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e8e8ee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#06060b;background-image:radial-gradient(ellipse at top,rgba(168,85,247,0.22),transparent 60%),radial-gradient(ellipse at bottom,rgba(59,130,246,0.16),transparent 60%);padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0e0f17;border:1px solid rgba(255,255,255,0.08);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(168,85,247,0.4);">
<tr><td style="padding:28px 32px 0;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;letter-spacing:0.6px;background:linear-gradient(90deg,#a855f7,#ec4899,#f59e0b);-webkit-background-clip:text;background-clip:text;color:transparent;">STREAMVISTA</div>
<div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent);margin:18px 0 0;"></div>
</td></tr>
<tr><td style="padding:28px 32px 8px;">
<div style="display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.35);font-size:11px;letter-spacing:2px;color:#c4b5fd;text-transform:uppercase;font-weight:700;">Private Invitation</div>
<h1 style="margin:12px 0 8px;font-family:Georgia,serif;font-size:30px;line-height:1.2;font-weight:700;color:#fff;">You're invited to StreamVista.</h1>
<p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#b8b8c8;">Hi ${name}, you've been personally invited by the StreamVista team to join our cinematic creator cloud — built for filmmakers, studios, and storytellers.</p>
${msg ? `<div style="margin-top:18px;padding:16px 18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;font-size:14px;line-height:1.7;color:#d4d4dc;">${msg}</div>` : ""}
</td></tr>
<tr><td align="center" style="padding:28px 32px 8px;">
<a href="${inviteUrl}" style="display:inline-block;padding:16px 36px;background:linear-gradient(90deg,#a855f7,#ec4899);color:#fff;font-weight:700;font-size:15px;letter-spacing:0.4px;text-decoration:none;border-radius:999px;box-shadow:0 14px 40px -10px rgba(236,72,153,0.55);">${cta} →</a>
<p style="margin:14px 0 0;font-size:12px;color:#71717a;word-break:break-all;">or paste: <span style="color:#a8a8b8;">${inviteUrl}</span></p>
</td></tr>
<tr><td style="padding:18px 32px 28px;">
<p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#9999aa;">Warmly,<br/><b style="color:#fff;">The StreamVista Team</b></p>
</td></tr>
<tr><td style="padding:0 32px 24px;">
<div style="height:1px;background:rgba(255,255,255,0.08);"></div>
<p style="margin:14px 0 0;font-size:11px;color:#5b5b6b;text-align:center;">This invite is personal and expires in 30 days.<br/>© StreamVista · <a href="${PRIMARY_DOMAIN}" style="color:#7c7c8c;text-decoration:none;">streamvistacreator.com</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const cors = buildCorsHeaders(req);
  try {
    // Gmail credentials checked inside sendGmail()
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthenticated" }, 401, cors);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: userRes } = await admin.auth.getUser(token);
    const uid = userRes?.user?.id;
    if (!uid) return json({ error: "invalid token" }, 401, cors);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (!isAdmin) return json({ error: "forbidden" }, 403, cors);

    const body = await req.json().catch(() => ({}));
    const audience = body.audience ?? {};
    const mode = String(audience.mode ?? "external");
    const subject = String(body.subject ?? "You're invited to StreamVista");
    const message = body.message ? String(body.message) : "";
    const ctaLabel = String(body.ctaLabel ?? "Accept your invite");

    // Resolve recipient list: { email, name? }[]
    type R = { email: string; name?: string };
    const recipients: R[] = [];

    if (mode === "external") {
      const emails: string[] = Array.isArray(audience.emails) ? audience.emails : [];
      for (const e of emails) {
        const t = String(e).trim().toLowerCase();
        if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) recipients.push({ email: t });
      }
    } else {
      // Pull users from auth.admin + profiles + roles
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const allUsers = list?.users ?? [];
      const ids = allUsers.map((u) => u.id);
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        admin.from("user_profiles").select("user_id, display_name, plan_tier").in("user_id", ids),
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      const pmap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const rmap = new Map<string, string[]>();
      for (const r of roles ?? []) {
        const arr = rmap.get((r as any).user_id) ?? [];
        arr.push((r as any).role);
        rmap.set((r as any).user_id, arr);
      }

      const wantedIds: Set<string> = new Set();
      if (mode === "all") {
        allUsers.forEach((u) => wantedIds.add(u.id));
      } else if (mode === "selected") {
        const ids: string[] = Array.isArray(audience.userIds) ? audience.userIds : [];
        ids.forEach((i) => wantedIds.add(i));
      } else if (mode === "filter") {
        const roleFilter: string[] = Array.isArray(audience.roleFilter) ? audience.roleFilter : [];
        const planFilter: string[] = Array.isArray(audience.planFilter) ? audience.planFilter : [];
        for (const u of allUsers) {
          const ur = rmap.get(u.id) ?? ["client"];
          const up = pmap.get(u.id)?.plan_tier ?? "free";
          const roleOk = !roleFilter.length || ur.some((r) => roleFilter.includes(r));
          const planOk = !planFilter.length || planFilter.includes(up);
          if (roleOk && planOk) wantedIds.add(u.id);
        }
      }

      for (const u of allUsers) {
        if (!wantedIds.has(u.id) || !u.email) continue;
        recipients.push({
          email: u.email,
          name: pmap.get(u.id)?.display_name ?? u.email.split("@")[0],
        });
      }
    }

    if (!recipients.length) return json({ error: "No valid recipients" }, 400, cors);

    let sent = 0, failed = 0;
    const errors: { email: string; error: string }[] = [];
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    for (const r of recipients) {
      try {
        const inviteToken = randToken();
        const first = (r.name ?? r.email.split("@")[0]).split(" ")[0] || "Friend";
        const last = (r.name ?? "").split(" ").slice(1).join(" ") || "";
        await admin.from("intro_invites").insert({
          inviter_user_id: uid,
          first_name: first.slice(0, 80),
          last_name: last.slice(0, 80),
          email: r.email,
          token: inviteToken,
          status: "pending",
          rate: 0,
          expires_at: expiresAt,
        });
        const inviteUrl = `${PRIMARY_DOMAIN}/auth?invite=${encodeURIComponent(inviteToken)}`;
        const html = renderInviteHtml({ name: first, inviteUrl, message, ctaLabel });
        const out = await sendGmail({
          from: MAIL_FROM,
          to: r.email,
          subject,
          html,
          replyTo: "hello@streamvistacreator.com",
        });
        if (!out.ok) {
          failed++;
          errors.push({ email: r.email, error: out.error ?? `Gmail ${out.status}` });
        } else {
          sent++;
        }
      } catch (e) {
        failed++;
        errors.push({ email: r.email, error: (e as Error).message });
      }
    }
    return json({ ok: true, sent, failed, total: recipients.length, errors: errors.slice(0, 20) }, 200, cors);
  } catch (e) {
    return json({ error: (e as Error).message }, 500, cors);
  }
});
