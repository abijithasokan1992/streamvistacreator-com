// title-removal
// -----------------------------------------------------------------------------
// User-facing edge function that lets a title's owner (or an admin) archive or
// submit a permanent removal request. Reads `title_removal_policy` (admin-only
// via RLS) with the service-role client so standard users can still discover
// whether permanent removal is enabled.
//
// Actions:
//   { action: "preflight",  title_id }
//   { action: "archive",    title_id, reason? }
//   { action: "permanent",  title_id, reason  }
//
// Auth: bearer JWT required. Ownership is enforced against content_titles.
// Storage is untouched here — the async `title-removal-worker` handles purge
// after admin approval + retention window.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

type Action = "preflight" | "archive" | "permanent";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7);

    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const action = body?.action as Action | undefined;
    const titleId = body?.title_id as string | undefined;
    const reason  = (body?.reason as string | undefined) ?? null;

    if (!action || !titleId) return json({ error: "action and title_id are required" }, 400);

    // Ownership / role check.
    const { data: title, error: titleErr } = await admin
      .from("content_titles")
      .select("id, owner_user_id, status")
      .eq("id", titleId)
      .maybeSingle();
    if (titleErr) return json({ error: titleErr.message }, 500);
    if (!title)   return json({ error: "title_not_found" }, 404);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const isOwner = title.owner_user_id === userId;
    if (!isOwner && !isAdmin) return json({ error: "not_authorized" }, 403);

    if (action === "preflight") return json(await preflight(admin, titleId));

    if (action === "archive") {
      const req_id = crypto.randomUUID();
      const prev_status = title.status;

      const ins = await admin.from("title_removal_requests").insert({
        id: req_id,
        title_id: titleId,
        requested_by: userId,
        mode: "archive",
        status: "archived",
        reason,
        completed_at: new Date().toISOString(),
      });
      if (ins.error) return json({ error: ins.error.message }, 500);

      const upd = await admin.from("content_titles")
        .update({ previous_status: prev_status, status: "archived", updated_at: new Date().toISOString() })
        .eq("id", titleId);
      if (upd.error) return json({ error: upd.error.message }, 500);

      await admin.from("title_removal_events").insert({
        request_id: req_id, actor_id: userId, action: "archive",
        from_status: prev_status, to_status: "archived",
        metadata: { title_id: titleId },
      });
      await admin.from("admin_audit_log").insert({
        actor_id: userId, action: "title.archive",
        target_type: "content_title", target_id: titleId,
        metadata: { request_id: req_id, via: "edge:title-removal" },
      });

      return json(req_id);
    }

    if (action === "permanent") {
      if (!reason?.trim()) return json({ error: "reason_required" }, 400);

      const { data: policy } = await admin
        .from("title_removal_policy")
        .select("allow_permanent_removal")
        .eq("id", 1)
        .maybeSingle();
      if (policy && policy.allow_permanent_removal === false) {
        return json({ error: "permanent_removal_disabled" }, 403);
      }

      const pre = await preflight(admin, titleId);
      if (!pre.can_permanent) {
        return json({ error: "blocked_by_commercial_or_legal_records", blockers: pre.blockers }, 409);
      }

      const req_id = crypto.randomUUID();
      const ins = await admin.from("title_removal_requests").insert({
        id: req_id,
        title_id: titleId,
        requested_by: userId,
        mode: "permanent",
        status: "pending",
        reason,
        blockers: pre.blockers,
        file_count: pre.file_count ?? 0,
      });
      if (ins.error) return json({ error: ins.error.message }, 500);

      await admin.from("title_removal_events").insert({
        request_id: req_id, actor_id: userId, action: "submit",
        to_status: "pending", metadata: pre,
      });
      await admin.from("admin_audit_log").insert({
        actor_id: userId, action: "title.permanent_removal.request",
        target_type: "content_title", target_id: titleId,
        metadata: { request_id: req_id, via: "edge:title-removal" },
      });

      return json(req_id);
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    console.error("title-removal error", e);
    return json({ error: e?.message ?? "internal_error" }, 500);
  }
});

async function preflight(admin: any, titleId: string) {
  const blockers: { type: string; count: number }[] = [];
  const push = (type: string, count: number) => { if (count > 0) blockers.push({ type, count }); };
  const countJson = async (table: string) => {
    const { count } = await admin.from(table)
      .select("*", { count: "exact", head: true })
      .contains("metadata", { title_id: titleId });
    return count ?? 0;
  };
  const countCol = async (table: string) => {
    const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq("title_id", titleId);
    return count ?? 0;
  };

  push("license_contracts",       await countCol("license_contracts"));
  push("deal_memos",              await countCol("deal_memos"));
  push("invoices",                await countJson("invoices"));
  push("manual_invoices",         await countJson("manual_invoices"));
  push("settlements",             await countJson("settlements"));
  push("partner_statements",      await countJson("partner_statements"));
  push("distribution_deliveries", await countCol("distribution_deliveries"));
  push("distribution_queue",      await countCol("distribution_queue"));
  push("deal_deliveries",         await countJson("deal_deliveries"));
  push("legal_acceptances",       await countJson("legal_acceptances"));

  const file_count =
    (await countCol("title_assets")) +
    (await countCol("title_media_versions")) +
    (await countCol("title_screening_assets"));

  return {
    title_id: titleId,
    file_count,
    blockers,
    can_archive: true,
    can_permanent: blockers.length === 0,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
