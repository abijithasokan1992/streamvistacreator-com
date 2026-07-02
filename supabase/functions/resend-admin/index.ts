import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

function jsonWith(req: Request) {
  const cors = buildCorsHeaders(req);
  return (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
}

async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Unauthorized" };
  const { data: isAdmin } = await supa.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return { ok: false as const, status: 403, error: "Admin required" };
  return { ok: true as const, user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const json = jsonWith(req);

  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  let body: any = {};
  try { body = await req.json(); } catch { /* noop */ }
  const action = body?.action ?? "status";
  const key = Deno.env.get("RESEND_API_KEY") ?? "";

  if (action === "status") {
    return json({
      configured: !!key,
      key_preview: key ? `${key.slice(0, 5)}…${key.slice(-4)}` : null,
      source: key ? "env" : null,
    });
  }

  if (action === "test") {
    if (!key) return json({ ok: false, error: "RESEND_API_KEY is not set" }, 200);
    try {
      const r = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (r.status === 401 || r.status === 403) {
        return json({ ok: false, error: "Resend rejected the API key (unauthorized)" });
      }
      if (!r.ok) {
        const t = await r.text();
        return json({ ok: false, error: `Resend API error ${r.status}: ${t.slice(0, 200)}` });
      }
      const j = await r.json().catch(() => ({}));
      const count = Array.isArray(j?.data) ? j.data.length : 0;
      return json({ ok: true, message: `Connected · ${count} domain${count === 1 ? "" : "s"} configured` });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message });
    }
  }

  if (action === "send_test") {
    if (!key) return json({ ok: false, error: "RESEND_API_KEY is not set" }, 200);
    const to = String(body?.to ?? "").trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return json({ ok: false, error: "Provide a valid recipient email" }, 200);
    }
    const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN") || "streamvistacreator.com";
    const senderName = Deno.env.get("RESEND_SENDER_NAME") || "StreamVista";
    const from = `${senderName} <noreply@${fromDomain}>`;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [to],
          subject: "StreamVista · Resend test email",
          html: `<div style="font-family:Arial,sans-serif;padding:24px;max-width:560px">
            <h2 style="margin:0 0 12px">Resend connectivity OK</h2>
            <p>This is an operational test from the StreamVista admin panel.</p>
            <p style="color:#666;font-size:12px">Sent at ${new Date().toISOString()} from <code>${from}</code></p>
          </div>`,
        }),
      });
      const txt = await r.text();
      let parsed: any = null;
      try { parsed = JSON.parse(txt); } catch { /* noop */ }
      if (!r.ok) {
        return json({ ok: false, error: `Resend ${r.status}: ${parsed?.message || txt.slice(0, 240)}`, from });
      }
      return json({ ok: true, id: parsed?.id ?? null, from, to });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message, from });
    }
  }

  if (action === "sender_info") {
    return json({
      from_address: `noreply@${Deno.env.get("RESEND_FROM_DOMAIN") || "streamvistacreator.com"}`,
      sender_name: Deno.env.get("RESEND_SENDER_NAME") || "StreamVista",
      sender_domain: Deno.env.get("SENDER_DOMAIN") || "notify.streamvistacreator.com",
      source: "edge function constants (send-transactional-email / auth-email-hook)",
    });
  }

  return json({ error: "Unknown action" }, 400);
});
