import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

  return json({ error: "Unknown action" }, 400);
});
