// run-qc-scan
// ───────────
// Real QC analysis for an existing `ingest_jobs` row. Uses Lovable AI Gateway
// (Gemini) to evaluate the job's file summary and stamp a structured verdict
// onto `ingest_jobs.metadata.qc_scan_result`. No external APIs, no mock data.
//
// Flow:
//   1. Validate the caller's JWT via getClaims.
//   2. Load the job via the caller's supabase client — RLS enforces ownership.
//   3. Mark status='qc_scanning' (service role, since RLS may block status writes).
//   4. Load the item list (file names, sizes, statuses) and send a compact
//      QC prompt to Gemini with a structured JSON schema for the answer.
//   5. Stamp the verdict onto metadata.qc_scan_result and flip status to
//      'qc_passed' | 'qc_flagged'. Errors flip to 'failed' with error_message.

import { createClient } from "npm:@supabase/supabase-js@2";
import { generateText, Output } from "npm:ai@5";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@1";
import { z } from "npm:zod";
import { buildCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return respond({ error: "unauthorized" }, 401);
    const jwt = authHeader.slice("Bearer ".length);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return respond({ error: "qc_not_configured" }, 500);

    // 1) Validate caller.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(jwt);
    if (claimsErr || !claims?.claims?.sub) return respond({ error: "unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const jobId = String(body?.ingest_job_id ?? "").trim();
    if (!jobId) return respond({ error: "ingest_job_id_required" }, 400);

    // 2) Ownership check via the caller's client (RLS).
    const { data: ownedJob, error: readErr } = await userClient
      .from("ingest_jobs")
      .select("id, status, job_mode, total_files, completed_files, failed_files, total_bytes, transferred_bytes, notes, metadata")
      .eq("id", jobId)
      .maybeSingle();
    if (readErr) return respond({ error: readErr.message }, 500);
    if (!ownedJob) return respond({ error: "job_not_found_or_forbidden" }, 404);

    // Service role client for writes / joining across items regardless of RLS.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Pull a compact list of item metadata to feed the model.
    const { data: items } = await admin
      .from("ingest_job_items")
      .select("file_name, relative_path, byte_size, mime_type, status, proxy_status, checksum_sha256")
      .eq("job_id", jobId)
      .limit(50);

    const itemSummary = (items ?? []).map((it: any) => ({
      name: it.relative_path || it.file_name,
      size: Number(it.byte_size ?? 0),
      mime: it.mime_type || null,
      status: it.status || null,
      proxy: it.proxy_status || null,
      hasChecksum: !!it.checksum_sha256,
    }));

    // 3) Flip to scanning.
    await admin.from("ingest_jobs")
      .update({
        status: "qc_scanning",
        metadata: {
          ...(ownedJob.metadata ?? {}),
          qc_scan_started_at: new Date().toISOString(),
          qc_scan_requested_by: userId,
        },
      })
      .eq("id", jobId);

    // 4) Call Gemini via Lovable AI Gateway with a strict schema.
    const gateway = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
    });

    const schema = z.object({
      verdict: z.enum(["pass", "fail"]),
      summary: z.string().min(4).max(300),
      findings: z.array(z.string().max(240)).max(8),
      confidence: z.number().min(0).max(1),
    });

    const prompt = [
      "You are the QC Analyst for a professional film ingest platform. Given an ingest job summary,",
      "return a strict JSON verdict on whether it looks clean or has QC risks a delivery manager should review.",
      "Base your judgement ONLY on the provided data. Do not invent details.",
      "",
      `Job status: ${ownedJob.status}`,
      `Mode: ${ownedJob.job_mode ?? "unknown"}`,
      `Files: ${ownedJob.completed_files ?? 0}/${ownedJob.total_files ?? 0}`,
      `Failed files: ${ownedJob.failed_files ?? 0}`,
      `Bytes transferred: ${ownedJob.transferred_bytes ?? 0} / ${ownedJob.total_bytes ?? 0}`,
      `Notes: ${ownedJob.notes ?? "(none)"}`,
      "",
      "Item sample (up to 50):",
      JSON.stringify(itemSummary),
      "",
      "Heuristics: any failed files, missing checksums, or mixed mime types are risks;",
      "large jobs with 0 failed files and consistent mime types are typically 'pass'.",
    ].join("\n");

    let verdict: z.infer<typeof schema>;
    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        output: Output.object({ schema }),
        prompt,
      });
      verdict = output;
    } catch (e: any) {
      // Model outage / rate limit — flip the job back to completed and surface error.
      await admin.from("ingest_jobs")
        .update({
          status: "failed",
          error_message: `qc_scan_failed: ${String(e?.message ?? e).slice(0, 240)}`,
        })
        .eq("id", jobId);
      return respond({ error: "qc_model_unavailable", detail: String(e?.message ?? e) }, 502);
    }

    const resultRow = {
      verdict: verdict.verdict,
      summary: verdict.summary,
      findings: verdict.findings,
      confidence: verdict.confidence,
      scanned_at: new Date().toISOString(),
      scanned_by: userId,
    };

    await admin.from("ingest_jobs")
      .update({
        status: verdict.verdict === "pass" ? "qc_passed" : "qc_flagged",
        metadata: {
          ...(ownedJob.metadata ?? {}),
          qc_scan_result: resultRow,
        },
      })
      .eq("id", jobId);

    return respond({ ok: true, result: resultRow });
  } catch (e: any) {
    return respond({ error: String(e?.message ?? e) }, 500);
  }
});
