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
