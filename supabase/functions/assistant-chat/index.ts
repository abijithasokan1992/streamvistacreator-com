// StreamVista AI Assistant — orchestrates existing modules only.
// Streams via Lovable AI Gateway. Every tool query runs with the caller's
// bearer token so existing RLS enforces read scope. No admin bypass.
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateText, tool, stepCountIs } from "npm:ai@5";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@1";
import { z } from "npm:zod";
import { buildCorsHeaders } from "../_shared/cors.ts";

const SYSTEM_PROMPT = `You are the StreamVista AI Assistant — a platform assistant embedded inside StreamVista Cloud X.

Your job is to orchestrate the user's EXISTING data across Production, Studio, Ingest, Production Media, Storage, Billing, and (when connected) web Research. You never invent data. You never modify workflows. You are read-only in this release.

Rules:
- Always call a tool when the answer depends on the user's data. Do not guess.
- Present results tersely. Prefer short lists and concrete numbers. Include IDs and production numbers when relevant so the user can navigate.
- If a tool returns zero rows, say so plainly — do not fabricate items.
- If a capability is not yet available (metadata generation, subtitles, reports, AI QC, analytics, automation), say it is coming soon; do not attempt it.
- If Firecrawl is not connected, tell the user research tools are unavailable rather than fabricating results.
- Respect the user's active production context supplied by the client when filtering.
- Never expose internal error text, model names, or provider details to the user.`;

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401, cors);
    }
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "assistant_not_configured" }, 500, cors);

    const body = await req.json().catch(() => ({}));
    const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> =
      Array.isArray(body?.messages) ? body.messages : [];
    const ctx = body?.context ?? {};

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supa.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401, cors);

    const firecrawlKey = (Deno.env.get("FIRECRAWL_API_KEY") ?? "").trim();
    const firecrawlConnected = !!firecrawlKey;

    // AI SDK provider — Lovable AI Gateway (OpenAI-compatible).
    const gateway = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: {
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
    });

    // Auto-select best available model. Users never see this.
    // Prefer GPT-5.5 for reasoning; the gateway handles fallback when unavailable.
    const modelId = "openai/gpt-5.5";
    const model = gateway(modelId);

    const tools = {
      find_productions: tool({
        description:
          "Search the user's productions (projects) by keyword. Returns id, name, production_number, status, updated_at.",
        inputSchema: z.object({
          query: z.string().optional().describe("Free-text keyword. Omit to list recent."),
          limit: z.number().min(1).max(25).default(10),
        }),
        execute: async ({ query, limit }) => {
          let q = supa
            .from("projects")
            .select("id, name, production_number, status, updated_at")
            .order("updated_at", { ascending: false })
            .limit(limit ?? 10);
          if (query && query.trim()) q = q.ilike("name", `%${query.trim()}%`);
          const { data, error } = await q;
          if (error) return { error: "query_failed" };
          return { productions: data ?? [] };
        },
      }),

      list_ingest_jobs: tool({
        description:
          "List recent ingest jobs (upload/proxy/archive). Optionally filter by production id and status.",
        inputSchema: z.object({
          production_id: z.string().uuid().optional(),
          status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]).optional(),
          limit: z.number().min(1).max(50).default(20),
        }),
        execute: async ({ production_id, status, limit }) => {
          let q = supa
            .from("ingest_jobs")
            .select("id, project_id, kind, status, progress, error_message, created_at, updated_at")
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
          "List the user's recent uploaded media (Production Media). Supports free-text search on file name and filters by camera, card, shoot day, or asset kind when those columns exist on the row.",
        inputSchema: z.object({
          query: z.string().optional(),
          status: z.enum(["uploading", "uploaded", "failed", "processing"]).optional(),
          limit: z.number().min(1).max(50).default(20),
        }),
        execute: async ({ query, status, limit }) => {
          let q = supa
            .from("recent_uploads")
            .select("id, file_name, object_key, size_bytes, status, created_at, error_message")
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
            .select("size_bytes, status");
          if (error) return { error: "query_failed" };
          const rows = data ?? [];
          const used = rows.reduce((n, r: any) => n + (Number(r.size_bytes) || 0), 0);
          const byStatus: Record<string, number> = {};
          for (const r of rows) byStatus[(r as any).status ?? "unknown"] =
            (byStatus[(r as any).status ?? "unknown"] ?? 0) + 1;
          return { used_bytes: used, counts_by_status: byStatus, total_items: rows.length };
        },
      }),

      list_invoices: tool({
        description: "List the user's recent invoices (billing history).",
        inputSchema: z.object({ limit: z.number().min(1).max(25).default(10) }),
        execute: async ({ limit }) => {
          const { data, error } = await supa
            .from("invoices")
            .select("id, amount, currency, status, created_at, description")
            .order("created_at", { ascending: false })
            .limit(limit ?? 10);
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
    const firecrawlLine = firecrawlConnected
      ? ""
      : "\n\nFirecrawl is not connected — the research_web tool is unavailable this session.";

    const result = await generateText({
      model,
      system: SYSTEM_PROMPT + activeLine + firecrawlLine,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools,
      stopWhen: stepCountIs(20),
    });

    const toolCalls = (result.steps ?? [])
      .flatMap((s: any) => s.toolCalls ?? [])
      .map((c: any) => ({ tool: c.toolName, input: c.args ?? c.input }));

    return json({ content: result.text, tool_calls: toolCalls }, 200, cors);
  } catch (e) {
    console.error("assistant-chat error", e);
    return json({ error: "internal_error", message: (e as Error).message }, 500, cors);
  }
});

function json(body: unknown, status: number, cors: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
