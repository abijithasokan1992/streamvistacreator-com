// Public intake endpoint for AI-training content buyer requirements.
// Writes to `ai_buyer_requirements` using the service role so RLS stays
// admin-read-only. Applies zod validation and a soft in-memory rate limit
// per client IP.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const buckets = new Map<string, { count: number; resetAt: number }>();

const schema = z.object({
  organization: z.string().trim().min(1).max(200),
  authorized_contact_name: z.string().trim().min(1).max(200),
  authorized_contact_email: z.string().trim().email().max(255),
  intended_ai_use_case: z.string().trim().min(1).max(2000),
  content_types: z.string().trim().max(1000).optional().default(""),
  languages: z.string().trim().max(500).optional().default(""),
  required_hours: z.string().trim().max(50).optional().default(""),
  resolution: z.string().trim().max(100).optional().default(""),
  audio_specs: z.string().trim().max(500).optional().default(""),
  licence_term: z.string().trim().max(200).optional().default(""),
  territories: z.string().trim().max(500).optional().default(""),
  model_training_purpose: z.string().trim().max(2000).optional().default(""),
  commercial_or_research: z.enum(["commercial", "research", "both", "unspecified"]).default("unspecified"),
  derived_output_requirements: z.string().trim().max(2000).optional().default(""),
  data_retention: z.string().trim().max(500).optional().default(""),
  deletion_requirements: z.string().trim().max(500).optional().default(""),
  security_requirements: z.string().trim().max(1000).optional().default(""),
  prohibited_content: z.string().trim().max(1000).optional().default(""),
  target_budget: z.string().trim().max(200).optional().default(""),
});

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_MAX) return false;
  b.count += 1;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(ip)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "validation_failed", details: parsed.error.flatten().fieldErrors }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // Best-effort: attribute submission if a valid JWT is present, otherwise anonymous.
  let submittedBy: string | null = null;
  const authz = req.headers.get("authorization");
  if (authz?.startsWith("Bearer ")) {
    try {
      const { data } = await supabase.auth.getUser(authz.slice("Bearer ".length));
      submittedBy = data.user?.id ?? null;
    } catch { /* ignore */ }
  }

  const { error } = await supabase.from("ai_buyer_requirements").insert({
    ...parsed.data,
    submitted_by: submittedBy,
    source_ip: ip === "unknown" ? null : ip,
  });

  if (error) {
    return new Response(JSON.stringify({ error: "insert_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
