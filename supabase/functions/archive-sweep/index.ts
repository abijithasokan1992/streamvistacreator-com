// Daily Creator Basic archive sweep.
//
// 1. Calls compute_inactive_creator_basic_uploads() to find raw masters that
//    have been untouched for >= the configured window (default 30 days) and
//    are still on Standard tier in OCI.
// 2. For each candidate, enqueues an archive_jobs row, then calls the
//    oracle-proxy edge function to invoke OCI updateObjectStorageTier.
// 3. Marks the job completed/failed and flips recent_uploads.storage_tier to
//    'Archive' on success.
//
// Invoked by pg_cron daily (see migration) or manually by ops.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_PER_RUN = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const cors = { ...buildCorsHeaders(req), "Content-Type": "application/json" };

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Authorize: cron (no JWT, anon) is allowed because verify_jwt=false; for
  // manual ops calls require admin role.
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  let invokedByAdminUser = false;
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
      invokedByAdminUser = true;
    }
  }

  const { data: candidates, error: candErr } = await admin.rpc(
    "compute_inactive_creator_basic_uploads",
    { p_days: null },
  );
  if (candErr) {
    return new Response(
      JSON.stringify({ ok: false, error: candErr.message }),
      { status: 500, headers: cors },
    );
  }

  const results: Array<{ upload_id: string; ok: boolean; error?: string }> = [];
  const work = (candidates ?? []).slice(0, MAX_PER_RUN);

  for (const row of work) {
    try {
      const { data: jobId, error: enqErr } = await admin.rpc(
        "enqueue_archive_job",
        { p_upload_id: row.upload_id },
      );
      if (enqErr) throw new Error(enqErr.message);

      // Call oracle-proxy with service-role JWT so it passes the admin check.
      // (oracle-proxy currently requires an admin user — for the cron sweep we
      // mint a session-less call using SERVICE_ROLE; the proxy will reject it
      // because getUser() returns null for a service key. So instead we mark
      // running here and let the proxy be called via signed admin token from
      // an interactive console. For now we mark "running" and rely on a
      // separate signed call — this keeps the cron sweep idempotent.)
      await admin
        .from("archive_jobs")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      // Direct OCI call: we re-export the proxy logic inline by invoking the
      // edge function with the service-role key as a bearer token AND a
      // special X-Sv-Internal header that oracle-proxy now trusts when the
      // service role matches.
      const ociRes = await fetch(`${SUPABASE_URL}/functions/v1/oracle-proxy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE}`,
          "X-Sv-Internal": SERVICE_ROLE,
        },
        body: JSON.stringify({
          action: "change-storage-tier",
          objectName: row.object_key,
          storageTier: "Archive",
        }),
      });
      const ociJson = await ociRes.json().catch(() => ({}));

      if (!ociRes.ok || !ociJson.ok) {
        await admin
          .from("archive_jobs")
          .update({
            status: "failed",
            error_message: ociJson.error ?? `OCI HTTP ${ociRes.status}`,
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId);
        results.push({
          upload_id: row.upload_id,
          ok: false,
          error: ociJson.error ?? `oci ${ociRes.status}`,
        });
        continue;
      }

      await admin
        .from("archive_jobs")
        .update({
          status: "completed",
          progress_percent: 100,
          transferred_bytes: row.file_size,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      await admin
        .from("recent_uploads")
        .update({ storage_tier: "Archive" })
        .eq("id", row.upload_id);

      results.push({ upload_id: row.upload_id, ok: true });
    } catch (e) {
      results.push({
        upload_id: row.upload_id,
        ok: false,
        error: (e as Error).message,
      });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      invokedByAdminUser,
      considered: candidates?.length ?? 0,
      processed: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    }),
    { headers: cors },
  );
});
