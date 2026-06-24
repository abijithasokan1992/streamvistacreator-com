// Monthly egress overage sweep.
//
// For the prior calendar month, calls stage_egress_overage_invoices() which
// scans usage_meters and creates one manual_invoices row per workspace that
// exceeded the configured free quota (default 500 GB) at the configured
// flat OCI-aligned ₹/GB rate. Invoices are created in `pending_review` so
// an operator approves them in /admin/operations before they are sent.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const cors = { ...buildCorsHeaders(req), "Content-Type": "application/json" };

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token && token.split(".").length === 3) {
    const { data: u } = await admin.auth.getUser(token);
    if (u?.user?.id) {
      const { data: ok } = await admin.rpc("has_role", {
        _user_id: u.user.id,
        _role: "admin",
      });
      if (!ok) {
        return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
          status: 403,
          headers: cors,
        });
      }
    }
  }

  let periodIso: string | null = null;
  try {
    const body = await req.json();
    if (body?.period) periodIso = String(body.period);
  } catch { /* empty */ }

  // Default = first day of previous month.
  if (!periodIso) {
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    periodIso = prev.toISOString().slice(0, 10);
  }

  const { data, error } = await admin.rpc("stage_egress_overage_invoices", {
    p_period: periodIso,
  });
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: cors,
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      period: periodIso,
      staged: data?.length ?? 0,
      invoices: data ?? [],
    }),
    { headers: cors },
  );
});
