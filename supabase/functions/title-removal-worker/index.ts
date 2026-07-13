// title-removal-worker
// ----------------------------------------------------------------------------
// Async worker that processes approved permanent-removal requests whose
// purge_after timestamp has passed. Never called directly from the UI.
//
// Flow per request:
//   1. Claim the row (status → 'purging', attempts++)
//   2. Enumerate + delete storage objects across the buckets referenced by
//      the title's assets. Verify via .list() that each path is gone.
//   3. On full success, call `title_removal_finalize` to purge DB rows.
//   4. On partial failure, record failed_paths + last_error and leave the
//      row for the next tick (bounded by MAX_ATTEMPTS).
//   5. Enqueue an async storage recalc (storage_recalc_enqueue). UI never waits.
//
// Invoke with: POST /functions/v1/title-removal-worker  (cron-triggered).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_ATTEMPTS = 5;
const BATCH        = 10;

// Buckets that may contain title-scoped files.
const CANDIDATE_BUCKETS = [
  "title-assets",
  "title-media-versions",
  "title-screening-assets",
  "studio-vault",
  "recent-uploads",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  let authorized = false;
  if (cronSecret && bearer && bearer === cronSecret) {
    authorized = true;
  } else if (bearer && bearer.split(".").length === 3) {
    const authClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: u } = await authClient.auth.getUser(bearer);
    if (u?.user?.id) {
      const { data: ok } = await authClient.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      if (ok) authorized = true;
    }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: due, error: dueErr } = await admin
    .from("title_removal_requests")
    .select("id, title_id, workspace_id, requested_by, attempts, failed_paths")
    .in("status", ["approved", "purge_scheduled"])
    .lte("purge_after", new Date().toISOString())
    .lt("attempts", MAX_ATTEMPTS)
    .limit(BATCH);

  if (dueErr) {
    return json({ ok: false, error: dueErr.message }, 500);
  }

  const results: any[] = [];
  for (const r of due ?? []) {
    results.push(await processOne(admin, r));
  }
  return json({ ok: true, processed: results.length, results }, 200);
});

async function processOne(admin: any, r: any) {
  // Claim.
  const claim = await admin
    .from("title_removal_requests")
    .update({ status: "purging", attempts: (r.attempts ?? 0) + 1 })
    .eq("id", r.id)
    .in("status", ["approved", "purge_scheduled"])
    .select("id")
    .maybeSingle();
  if (!claim.data) return { id: r.id, skipped: "not_claimable" };

  await logEvent(admin, r.id, "purge_start", "approved", "purging", {});

  const failedPaths: string[] = [];
  let totalBytes = 0;
  let fileCount = 0;

  // Best-effort: sweep buckets by prefix `<title_id>/`.
  for (const bucket of CANDIDATE_BUCKETS) {
    try {
      const { data: list } = await admin.storage.from(bucket).list(r.title_id, { limit: 1000 });
      if (!list || list.length === 0) continue;

      const paths = list.map((f: any) => `${r.title_id}/${f.name}`);
      fileCount += paths.length;
      totalBytes += list.reduce((a: number, f: any) => a + Number(f?.metadata?.size ?? 0), 0);

      const del = await admin.storage.from(bucket).remove(paths);
      if (del.error) {
        failedPaths.push(...paths.map((p) => `${bucket}/${p}`));
        continue;
      }
      // Verify empty.
      const { data: recheck } = await admin.storage.from(bucket).list(r.title_id, { limit: 1 });
      if (recheck && recheck.length > 0) {
        failedPaths.push(...recheck.map((f: any) => `${bucket}/${r.title_id}/${f.name}`));
      }
    } catch (e: any) {
      failedPaths.push(`${bucket}/${r.title_id}/* (${e?.message ?? "list_error"})`);
    }
  }

  if (failedPaths.length > 0) {
    await admin.from("title_removal_requests").update({
      status: "purge_scheduled",
      failed_paths: failedPaths,
      last_error: "partial_storage_failure",
      file_count: fileCount,
      total_bytes: totalBytes,
    }).eq("id", r.id);
    await logEvent(admin, r.id, "purge_partial", "purging", "purge_scheduled", { failed: failedPaths.length });
    return { id: r.id, status: "partial", failed: failedPaths.length };
  }

  // All storage gone → purge DB rows in a single txn via RPC.
  const finalize = await admin.rpc("title_removal_finalize_admin", { _request_id: r.id });
  if (finalize.error) {
    await admin.from("title_removal_requests").update({
      status: "failed", last_error: finalize.error.message,
    }).eq("id", r.id);
    await logEvent(admin, r.id, "purge_failed", "purging", "failed", { error: finalize.error.message });
    return { id: r.id, status: "failed", error: finalize.error.message };
  }

  // Enqueue async recalc (fire and forget).
  await admin.rpc("storage_recalc_enqueue", {
    _workspace_id: r.workspace_id, _user_id: r.requested_by, _reason: "title_purged",
  });

  return { id: r.id, status: "purged", files: fileCount, bytes: totalBytes };
}

async function logEvent(admin: any, request_id: string, action: string, from: string | null, to: string, metadata: any) {
  await admin.from("title_removal_events").insert({
    request_id, action, from_status: from, to_status: to, metadata,
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
