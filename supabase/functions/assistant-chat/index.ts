// StreamVista AI Assistant — orchestrates existing modules only.
// Read-only. Every tool query runs with the caller's bearer token so existing
// RLS enforces read scope.
//
// Provider selection (mirrors agent-chat):
//   1) Independent OpenAI-compatible provider (AI_API_KEY + AI_BASE_URL + AI_MODEL),
//      with AI_CHIEF_MODEL as an optional override reserved for founder-tier use.
//   2) Lovable AI Gateway (LOVABLE_API_KEY) as an optional fallback.
// Structured error codes are returned so the UI can display targeted messages.
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateText, tool, stepCountIs } from "npm:ai@5";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@1";
import { z } from "npm:zod";
import { buildCorsHeaders } from "../_shared/cors.ts";

const SYSTEM_PROMPT = `You are "Ask StreamVista" — the AI assistant embedded inside the StreamVista Creator Dashboard, helping independent filmmakers (many non-technical, many Malayalam-speaking) run their titles on StreamVista Cloud X.

Scope you can help with (READ-ONLY — never approve, publish, delete, mutate rights, accept offers, take payments or change plans):
1. Explain the current dashboard page and what the creator should do on it.
2. Guide them through adding a title and the metadata each field needs.
3. Guide uploads and explain why an upload failed (from ingest_jobs / recent_uploads).
4. Explain storage usage and what to do when nearly full.
5. Explain rights, licensing terms, plans, billing and invoices in simple language.
6. Summarize notifications, review feedback and current title/submission status.
7. Tell them the concrete next action to take, and offer to draft synopsis / descriptions / metadata text.

Language rules — CRITICAL:
- The user's UI locale is provided in the context (en or ml). Reply in that language by default.
- If the user writes in Malayalam script (Unicode), reply in natural Malayalam.
- If the user writes Malayalam using English letters (Manglish, e.g. "ente cinema upload cheyyaan"), understand it and reply in simple Malayalam; you may add a short English line if useful. If it's ambiguous, briefly ask which language they prefer.
- Use simple, natural Malayalam suitable for a filmmaker who is not a software engineer. Avoid heavy technical Sanskritized vocabulary.
- Never translate file names, title names, human names, IDs or user-entered content. Only translate the creator's own text when they explicitly ask you to translate.
- Keep answers short and end with a clear "Next: …" step whenever possible.

Data rules:
- Always call a tool when the answer depends on the user's data. Do not guess.
- If a tool returns zero rows, say so plainly — do not fabricate items.
- If a capability is not yet available, say it is coming soon; do not attempt it.
- If Firecrawl is not connected, tell the user research tools are unavailable rather than fabricating results.
- Respect the active production and active page context supplied by the client when filtering.
- Never expose internal error text, model names, provider details, or any credentials.
- You are strictly read-only. If the user asks you to approve, publish, delete, change rights, accept an offer, change a plan or make a payment, refuse politely and point them to the relevant dashboard section to do it themselves.`;

type ErrorCode =
  | "provider_not_configured"
  | "expired_authentication"
  | "exhausted_credits"
  | "rate_limited"
  | "provider_timeout"
  | "provider_auth_failure"
  | "provider_failure"
  | "invalid_request";

function makeError(
  code: ErrorCode,
  message: string,
  status: number,
  cors: HeadersInit,
  extra?: Record<string, unknown>,
) {
  return new Response(JSON.stringify({ error: { code, message, ...(extra ?? {}) } }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

type ProviderChoice =
  | { kind: "independent"; apiKey: string; baseUrl: string; model: string }
  | { kind: "lovable"; apiKey: string; model: string };

function pickProvider(useChief: boolean): ProviderChoice | null {
  const indKey = (Deno.env.get("AI_API_KEY") ?? "").trim();
  const indBase = (Deno.env.get("AI_BASE_URL") ?? "").trim();
  const indModel = useChief
    ? ((Deno.env.get("AI_CHIEF_MODEL") ?? "").trim() ||
       (Deno.env.get("AI_MODEL") ?? "").trim())
    : (Deno.env.get("AI_MODEL") ?? "").trim();

  if (indKey && indBase && indModel) {
    return {
      kind: "independent",
      apiKey: indKey,
      baseUrl: indBase.replace(/\/$/, ""),
      model: indModel,
    };
  }

  const lovKey = (Deno.env.get("LOVABLE_API_KEY") ?? "").trim();
  if (lovKey) {
    return { kind: "lovable", apiKey: lovKey, model: "google/gemini-3-flash-preview" };
  }
  return null;
}

/**
 * Classify a thrown provider error into our structured error taxonomy.
 * The AI SDK surfaces HTTP status codes on APICallError; we also fall back
 * to inspecting the message so a Lovable 402 is never returned as a generic 500.
 */
function classifyProviderError(
  err: unknown,
): { code: ErrorCode; status: number; message: string } {
  const anyErr = err as any;
  const statusCode: number | undefined =
    anyErr?.statusCode ?? anyErr?.status ?? anyErr?.response?.status;
  const raw = String(anyErr?.message ?? err ?? "").slice(0, 400);

  if (anyErr?.name === "AbortError" || /aborted|timeout/i.test(raw)) {
    return { code: "provider_timeout", status: 504, message: "The AI provider took too long to respond." };
  }
  if (statusCode === 429 || /rate.?limit|too many requests/i.test(raw)) {
    return { code: "rate_limited", status: 429, message: "The AI provider is rate-limiting requests. Please try again shortly." };
  }
  if (statusCode === 402 || /payment required|credits?.*exhaust|insufficient.*credit|402/i.test(raw)) {
    return { code: "exhausted_credits", status: 402, message: "AI credits are exhausted. Please top up or configure an independent AI provider." };
  }
  if (statusCode === 401 || statusCode === 403) {
    return { code: "provider_auth_failure", status: 502, message: "The AI provider rejected our credentials." };
  }
  return { code: "provider_failure", status: 502, message: `AI provider error${statusCode ? ` (${statusCode})` : ""}.` };
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return makeError("expired_authentication", "Please sign in to continue.", 401, cors);
    }

    const body = await req.json().catch(() => ({}));
    const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> =
      Array.isArray(body?.messages) ? body.messages : [];
    const ctx = body?.context ?? {};
    if (messages.length === 0) {
      return makeError("invalid_request", "messages required", 400, cors);
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supa.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) {
      return makeError("expired_authentication", "Your session has expired. Please sign in again.", 401, cors);
    }

    const firecrawlKey = (Deno.env.get("FIRECRAWL_API_KEY") ?? "").trim();
    const firecrawlConnected = !!firecrawlKey;

    // Chief-tier model is reserved for founder / super-admin roles. Assistant
    // preserves existing permissions and defaults to standard tier.
    let useChief = false;
    try {
      for (const role of ["founder", "platform_owner", "super_admin"] as const) {
        const { data: has } = await supa.rpc("has_role", { _user_id: userId, _role: role });
        if (has === true) { useChief = true; break; }
      }
    } catch { /* unknown role in enum — ignore */ }

    const chosen = pickProvider(useChief);
    if (!chosen) {
      return makeError(
        "provider_not_configured",
        "No AI provider is configured. Set AI_API_KEY/AI_BASE_URL/AI_MODEL, or LOVABLE_API_KEY.",
        503,
        cors,
      );
    }

    const provider = chosen.kind === "independent"
      ? createOpenAICompatible({
          name: "independent",
          baseURL: chosen.baseUrl,
          headers: { Authorization: `Bearer ${chosen.apiKey}` },
        })
      : createOpenAICompatible({
          name: "lovable",
          baseURL: "https://ai.gateway.lovable.dev/v1",
          headers: {
            "Lovable-API-Key": chosen.apiKey,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
        });

    const model = provider(chosen.model);

    const tools = {
      find_productions: tool({
        description:
          "Search the user's productions (projects) by keyword. Returns id, name, production_number (from crew.title_number), updated_at.",
        inputSchema: z.object({
          query: z.string().optional().describe("Free-text keyword. Omit to list recent."),
          limit: z.number().min(1).max(25).default(10),
        }),
        execute: async ({ query, limit }) => {
          let q = supa
            .from("projects")
            .select("id, name, crew, updated_at")
            .order("updated_at", { ascending: false })
            .limit(limit ?? 10);
          if (query && query.trim()) q = q.ilike("name", `%${query.trim()}%`);
          const { data, error } = await q;
          if (error) return { error: "query_failed" };
          const productions = (data ?? []).map((r: any) => ({
            id: r.id,
            name: r.name,
            production_number: (r.crew && typeof r.crew === "object" ? (r.crew as any).title_number : null) ?? null,
            updated_at: r.updated_at,
          }));
          return { productions };
        },
      }),

      list_ingest_jobs: tool({
        description:
          "List recent ingest jobs (upload/proxy/archive). Optionally filter by production id and status.",
        inputSchema: z.object({
          production_id: z.string().uuid().optional(),
          status: z.enum([
            "draft", "scanning", "ready", "uploading", "paused",
            "retrying", "verifying", "completed", "failed", "cancelled",
          ]).optional(),
          limit: z.number().min(1).max(50).default(20),
        }),
        execute: async ({ production_id, status, limit }) => {
          let q = supa
            .from("ingest_jobs")
            .select("id, project_id, job_mode, status, total_files, completed_files, failed_files, total_bytes, transferred_bytes, error_message, created_at, updated_at")
            .order("created_at", { ascending: false })
            .limit(limit ?? 20);
          if (production_id) q = q.eq("project_id", production_id);
          if (status) q = q.eq("status", status);
          const { data, error } = await q;
          if (error) return { error: "query_failed" };
          return { jobs: data ?? [] };
        },
      }),

      list_recent_uploads: tool({
        description:
          "List the user's recent uploaded media (Production Media). Supports free-text search on file name.",
        inputSchema: z.object({
          query: z.string().optional(),
          status: z.enum(["uploading", "uploaded", "failed", "processing"]).optional(),
          limit: z.number().min(1).max(50).default(20),
        }),
        execute: async ({ query, status, limit }) => {
          let q = supa
            .from("recent_uploads")
            .select("id, file_name, object_key, file_size, status, created_at, error_message")
            .order("created_at", { ascending: false })
            .limit(limit ?? 20);
          if (status) q = q.eq("status", status);
          if (query && query.trim()) q = q.ilike("file_name", `%${query.trim()}%`);
          const { data, error } = await q;
          if (error) return { error: "query_failed" };
          return { uploads: data ?? [] };
        },
      }),

      storage_summary: tool({
        description:
          "Summarize the user's storage: total used bytes and count of uploaded/failed items.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data, error } = await supa
            .from("recent_uploads")
            .select("file_size, status");
          if (error) return { error: "query_failed" };
          const rows = data ?? [];
          const used = rows.reduce((n, r: any) => n + (Number(r.file_size) || 0), 0);
          const byStatus: Record<string, number> = {};
          for (const r of rows) byStatus[(r as any).status ?? "unknown"] =
            (byStatus[(r as any).status ?? "unknown"] ?? 0) + 1;
          return { used_bytes: used, counts_by_status: byStatus, total_items: rows.length };
        },
      }),

      list_invoices: tool({
        description: "List the user's recent invoices (billing history). Amounts are in paise (INR minor units).",
        inputSchema: z.object({ limit: z.number().min(1).max(25).default(10) }),
        execute: async ({ limit }) => {
          const { data, error } = await supa
            .from("invoices")
            .select("id, invoice_number, total_paise, subtotal_paise, gst_paise, currency, status, created_at, description")
            .order("created_at", { ascending: false })
            .limit(limit ?? 10);
          if (error) return { error: "query_failed" };
          return { invoices: data ?? [] };
        },
      }),

      find_invoice: tool({
        description: "Find a specific invoice by id, description keyword, or status. Amounts are in paise.",
        inputSchema: z.object({
          query: z.string().optional(),
          status: z.enum(["paid", "due", "failed", "refunded"]).optional(),
          limit: z.number().min(1).max(10).default(5),
        }),
        execute: async ({ query, status, limit }) => {
          let q = supa
            .from("invoices")
            .select("id, invoice_number, total_paise, subtotal_paise, gst_paise, currency, status, created_at, description")
            .order("created_at", { ascending: false })
            .limit(limit ?? 5);
          if (status) q = q.eq("status", status);
          if (query && query.trim()) q = q.or(`description.ilike.%${query.trim()}%,invoice_number.ilike.%${query.trim()}%`);
          const { data, error } = await q;
          if (error) return { error: "query_failed" };
          return { invoices: data ?? [] };
        },
      }),

      research_web: tool({
        description:
          "Research a company, buyer, OTT platform, festival, or broadcaster via Firecrawl web search. Only available when Firecrawl is connected.",
        inputSchema: z.object({
          query: z.string().min(2),
          limit: z.number().min(1).max(10).default(5),
        }),
        execute: async ({ query, limit }) => {
          if (!firecrawlConnected) {
            return { error: "firecrawl_not_connected", message: "Firecrawl is not connected. Ask an admin to link it in Settings → Integrations." };
          }
          try {
            const res = await fetch("https://api.firecrawl.dev/v2/search", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${firecrawlKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ query, limit }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) return { error: "search_failed", status: res.status };
            const items = Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data?.web?.results)
                ? data.web.results
                : [];
            return {
              results: items.slice(0, limit).map((r: any) => ({
                title: r.title,
                url: r.url,
                description: r.description ?? r.snippet,
              })),
            };
          } catch {
            return { error: "search_failed" };
          }
        },
      }),
    };

    const activeLine = ctx?.activeProductionId
      ? `\n\nActive production context: ${ctx.activeProductionId}${ctx?.activeProductionName ? ` (${ctx.activeProductionName})` : ""}. Prefer filtering by this production unless the user asks otherwise.`
      : "";
    const locale = ctx?.locale === "ml" ? "ml" : ctx?.locale === "en" ? "en" : "en";
    const localeLine = `\n\nUser UI locale: ${locale === "ml" ? "Malayalam (ml). Default to replying in Malayalam." : "English (en). Default to replying in English."}`;
    const pageLine = ctx?.path
      ? `\n\nCurrent Creator Dashboard page: ${ctx.path}${ctx?.section ? ` (section: ${ctx.section})` : ""}. If the user asks "what is this page" or "what should I do", explain that section briefly and its typical next action.`
      : "";
    const firecrawlLine = firecrawlConnected
      ? ""
      : "\n\nFirecrawl is not connected — the research_web tool is unavailable this session.";

    try {
      const result = await generateText({
        model,
        system: SYSTEM_PROMPT + activeLine + firecrawlLine,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        tools,
        stopWhen: stepCountIs(20),
        abortSignal: AbortSignal.timeout(60_000),
      });

      const toolCalls = (result.steps ?? [])
        .flatMap((s: any) => s.toolCalls ?? [])
        .map((c: any) => ({ tool: c.toolName, input: c.args ?? c.input }));

      return new Response(
        JSON.stringify({ content: result.text, tool_calls: toolCalls, provider: chosen.kind }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    } catch (providerErr) {
      console.error("assistant-chat provider error", providerErr);
      const c = classifyProviderError(providerErr);
      return makeError(c.code, c.message, c.status, cors, { provider: chosen.kind });
    }
  } catch (e) {
    console.error("assistant-chat error", e);
    return makeError("provider_failure", (e as Error).message || String(e), 500, cors);
  }
});
