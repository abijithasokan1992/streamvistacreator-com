// Auto-retry sweeper for failed emails.
//
// Reclaims DLQ messages for both pgmq queues (`auth_emails` and
// `transactional_emails`), moves them back to the main queue with an
// incremented attempt counter (max 3 auto-retries), and marks
// `email_send_log` accordingly.
//
// Called from pg_cron every 5 minutes. `process-email-queue` picks them up
// on its next tick (also every ~5s in the queue's own cron).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MAX_AUTO_RETRIES = 3;
const QUEUES = ["auth_emails", "transactional_emails"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const summary: Record<string, { requeued: number; skipped: number; error?: string }> = {};

  for (const queue of QUEUES) {
    const s = { requeued: 0, skipped: 0 } as { requeued: number; skipped: number; error?: string };
    try {
      // Drain up to 100 DLQ messages per queue per tick.
      const { data: dlqRows, error: dlqErr } = await supabase.rpc("pgmq_read_dlq", {
        queue_name: queue,
        n: 100,
      });

      // The helper may not exist on older infra — fall back to reading the
      // `<queue>_dlq` table directly via a raw select through pgmq public API.
      let rows: Array<{ msg_id: number; message: unknown }> = [];
      if (dlqErr) {
        const { data: fallback, error: fbErr } = await supabase
          .schema("pgmq" as never)
          .from(`${queue}_dlq` as never)
          .select("msg_id, message")
          .order("enqueued_at", { ascending: true })
          .limit(100) as unknown as { data: any[]; error: any };
        if (fbErr) {
          s.error = `read failed: ${fbErr.message || dlqErr.message}`;
          summary[queue] = s;
          continue;
        }
        rows = fallback ?? [];
      } else {
        rows = (dlqRows as any[]) ?? [];
      }

      for (const row of rows) {
        const payload = (row.message ?? {}) as Record<string, unknown>;
        const attempts = Number(payload.auto_retry_count ?? 0);
        const messageId = String(payload.message_id ?? payload.messageId ?? "");

        if (attempts >= MAX_AUTO_RETRIES) {
          s.skipped += 1;
          if (messageId) {
            await supabase.from("email_send_log").insert({
              message_id: messageId,
              template_name: (payload.template_name ?? payload.templateName ?? "unknown") as string,
              recipient_email: (payload.recipient_email ?? payload.recipientEmail ?? "unknown") as string,
              status: "dlq",
              error_message: `Auto-retry exhausted after ${attempts} attempts`,
              metadata: { auto_retry_terminal: true, queue },
            });
          }
          continue;
        }

        // Re-enqueue with the incremented counter.
        const newPayload = { ...payload, auto_retry_count: attempts + 1, auto_retry_at: new Date().toISOString() };
        const { error: enqErr } = await supabase.rpc("enqueue_email", {
          queue_name: queue,
          payload: newPayload,
        });
        if (enqErr) {
          s.error = `enqueue failed: ${enqErr.message}`;
          continue;
        }

        // Best-effort DLQ delete.
        await supabase.rpc("pgmq_delete_dlq", { queue_name: queue, msg_id: row.msg_id }).catch(() => {});

        if (messageId) {
          await supabase.from("email_send_log").insert({
            message_id: messageId,
            template_name: (payload.template_name ?? payload.templateName ?? "unknown") as string,
            recipient_email: (payload.recipient_email ?? payload.recipientEmail ?? "unknown") as string,
            status: "pending",
            error_message: `Auto-retry ${attempts + 1}/${MAX_AUTO_RETRIES}`,
            metadata: { auto_retry_count: attempts + 1, queue },
          });
        }
        s.requeued += 1;
        console.log(`[retry-failed-emails] requeued ${queue} msg=${row.msg_id} attempt=${attempts + 1}`);
      }
    } catch (e) {
      s.error = e instanceof Error ? e.message : String(e);
      console.error(`[retry-failed-emails] ${queue} error`, e);
    }
    summary[queue] = s;
  }

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
