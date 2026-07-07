// Auto-retry sweeper for stuck / failed ingest items.
//
// Scans `ingest_job_items` where status='failed', increments a retry_count
// stored under metadata.retry_count, and resets status→'queued' so the client
// resume controller (or the ingest engine) picks them up again.
//
// Terminal after `MAX_RETRIES` — the item stays failed and is reported to the
// admin support inbox (existing `support_requests` funnel used by
// `uploadFailure.ts`).
//
// Called from pg_cron every 5 minutes.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MAX_RETRIES = 3;
const STALE_MINUTES = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();

  const { data: items, error } = await supabase
    .from("ingest_job_items")
    .select("id, status, error_message, metadata, updated_at, file_name, job_id")
    .eq("status", "failed")
    .lt("updated_at", cutoff)
    .limit(100);

  if (error) {
    console.error("[retry-failed-uploads] query error", error);
    return json({ error: error.message }, 500);
  }

  let requeued = 0;
  let terminal = 0;
  for (const item of items ?? []) {
    const meta = (item.metadata as Record<string, unknown> | null) ?? {};
    const attempts = Number(meta.retry_count ?? 0);
    if (attempts >= MAX_RETRIES) {
      // Log terminal failure once, then leave the row alone.
      if (!meta.terminal_reported) {
        await supabase.from("support_requests").insert({
          request_type: "upload_failure",
          subject: `Upload terminal failure · ${item.file_name ?? "(unnamed)"}`,
          message:
            `Automatic retry exhausted after ${attempts} attempts.\n\n` +
            `Item: ${item.id}\nJob: ${item.job_id}\nFile: ${item.file_name ?? "-"}\n` +
            `Last error: ${item.error_message ?? "(none)"}`,
          status: "open",
          metadata: { ...meta, kind: "upload_terminal_failure", item_id: item.id },
        });
        await supabase
          .from("ingest_job_items")
          .update({ metadata: { ...meta, terminal_reported: true } })
          .eq("id", item.id);
      }
      terminal += 1;
      continue;
    }

    const nextAttempts = attempts + 1;
    const backoffSec = Math.min(300, 30 * Math.pow(2, attempts)); // 30s, 60s, 120s
    const nextAttemptAt = new Date(Date.now() + backoffSec * 1000).toISOString();

    const { error: upErr } = await supabase
      .from("ingest_job_items")
      .update({
        status: "queued",
        error_message: null,
        metadata: {
          ...meta,
          retry_count: nextAttempts,
          last_retry_at: new Date().toISOString(),
          next_attempt_at: nextAttemptAt,
          previous_error: item.error_message ?? null,
        },
      })
      .eq("id", item.id)
      .eq("status", "failed"); // guard against races

    if (upErr) {
      console.error("[retry-failed-uploads] update error", upErr, "item", item.id);
      continue;
    }
    requeued += 1;
    console.log(
      `[retry-failed-uploads] requeued item=${item.id} attempt=${nextAttempts}/${MAX_RETRIES}`,
    );
  }

  return json({ scanned: items?.length ?? 0, requeued, terminal });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
