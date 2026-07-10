// Integration test: invoke the deployed retry-failed-emails edge function
// and assert the post-run audit reports zero pending rows in email_send_log.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test({
  name: "retry-failed-emails sweep leaves 0 pending rows",
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Invoke the retry scheduler.
  const res = await fetch(`${SUPABASE_URL}/functions/v1/retry-failed-emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: "{}",
  });
  const body = await res.json();

  // 2. Function must return the post-run audit block.
  if (!body.audit) {
    throw new Error(`missing audit in response: ${JSON.stringify(body)}`);
  }
  assertEquals(
    body.audit.pending_remaining,
    0,
    `expected 0 pending rows, got ${body.audit.pending_remaining}`,
  );
  assertEquals(body.audit.passed, true);
  assertEquals(res.status, 200);

  // 3. Cross-check directly against the database.
  const { count, error } = await supabase
    .from("email_send_log")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  assertEquals(count ?? 0, 0, `db shows ${count} pending rows post-sweep`);
});

// Idempotency: running the sweeper twice must not create new rows for the
// same message_id. Only terminal statuses ('sent' | 'bounced') should remain,
// and per message_id the row count must not increase between runs.
Deno.test({
  name: "retry-failed-emails is idempotent across repeated runs",
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const TERMINAL = new Set(["sent", "bounced"]);

  const snapshot = async () => {
    const { data, error } = await supabase
      .from("email_send_log")
      .select("message_id,status")
      .not("message_id", "is", null);
    if (error) throw error;
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const key = row.message_id as string;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return { rows: data ?? [], counts };
  };

  const invoke = async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/retry-failed-emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: "{}",
    });
    const body = await res.json();
    assertEquals(res.status, 200);
    assertEquals(body?.audit?.pending_remaining, 0);
    return body;
  };

  // Run 1
  await invoke();
  const before = await snapshot();

  // Run 2
  await invoke();
  const after = await snapshot();

  // 1. No new message_ids introduced.
  for (const mid of after.counts.keys()) {
    if (!before.counts.has(mid)) {
      throw new Error(`new message_id appeared after 2nd run: ${mid}`);
    }
  }

  // 2. Per message_id row count must not grow.
  for (const [mid, prev] of before.counts) {
    const next = after.counts.get(mid) ?? 0;
    if (next > prev) {
      throw new Error(
        `message_id ${mid} row count grew ${prev} -> ${next} after 2nd run`,
      );
    }
  }

  // 3. Every row for tracked message_ids is in a terminal status.
  for (const row of after.rows) {
    if (!TERMINAL.has(row.status as string)) {
      throw new Error(
        `non-terminal status '${row.status}' for message_id ${row.message_id}`,
      );
    }
  }
});

