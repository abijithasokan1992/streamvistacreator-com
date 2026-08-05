// StreamVista Deployment Control — server-side Vercel REST proxy.
//
// Security model:
//   * Caller MUST present a Supabase JWT belonging to a user with the
//     `admin` or `super_admin` role (checked via the existing has_role RPC).
//   * VERCEL_TOKEN / VERCEL_TEAM_ID never leave the server. They are only
//     read from edge function secrets and are never echoed in responses.
//   * Strict action allow-list, id/hostname validation, sanitized errors.
//   * Every action is written to public.deployment_audit_log (no secrets).
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

const VERCEL_API = "https://api.vercel.com";

const READ_ACTIONS = [
  "status",
  "list_projects",
  "list_deployments",
  "get_project",
  "get_deployment",
  "list_domains",
  "health_check",
] as const;

const WRITE_ACTIONS = [
  "set_protection",
  "redeploy",
  "add_domain",
  "remove_domain",
] as const;

const DANGER_ACTIONS = ["delete_deployment", "delete_project"] as const;

type Action =
  | (typeof READ_ACTIONS)[number]
  | (typeof WRITE_ACTIONS)[number]
  | (typeof DANGER_ACTIONS)[number];

const ALL_ACTIONS: string[] = [...READ_ACTIONS, ...WRITE_ACTIONS, ...DANGER_ACTIONS];

const ID_RE = /^[A-Za-z0-9_.-]{1,128}$/;
const HOST_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const isId = (v: unknown): v is string => typeof v === "string" && ID_RE.test(v);
const isHost = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 253 && HOST_RE.test(v);

/** Strip anything that could leak a token or internal detail. */
function sanitize(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer ***")
    .replace(/[A-Za-z0-9]{24,}/g, "***")
    .slice(0, 300);
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  const requestId = crypto.randomUUID();
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify({ request_id: requestId, ...(b as object) }), {
      status: s,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    // ── 1. Authenticate ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await anon.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
      admin.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      admin.rpc("has_role", { _user_id: user.id, _role: "super_admin" }),
    ]);
    if (!isAdmin && !isSuper) return json({ error: "Forbidden" }, 403);

    // ── 2. Validate action ─────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const action = String(body.action ?? "");
    if (!ALL_ACTIONS.includes(action)) return json({ error: "Unsupported action" }, 400);
    const act = action as Action;

    const token = (Deno.env.get("VERCEL_TOKEN") ?? "").trim();
    const teamId = (Deno.env.get("VERCEL_TEAM_ID") ?? "").trim();

    if (act === "status") {
      if (!token) {
        return json({
          connected: false,
          missing_secrets: ["VERCEL_TOKEN"],
          optional_secrets: teamId ? [] : ["VERCEL_TEAM_ID"],
          message: "Vercel not connected",
        });
      }
      const probe = await vercel("GET", "/v2/user", { token, teamId: "" });
      return json({
        connected: probe.ok,
        missing_secrets: [],
        optional_secrets: teamId ? [] : ["VERCEL_TEAM_ID"],
        team_scoped: Boolean(teamId),
        user: probe.ok ? { username: (probe.data as any)?.user?.username ?? null } : null,
        error: probe.ok ? null : sanitize(probe.error ?? "Vercel API unreachable"),
      });
    }

    if (!token) {
      return json(
        { error: "Vercel not connected", missing_secrets: ["VERCEL_TOKEN"] },
        503,
      );
    }

    // health_check does not touch the Vercel API.
    if (act === "health_check") {
      const host = body.host;
      if (!isHost(host)) return json({ error: "Invalid hostname" }, 400);
      const started = Date.now();
      try {
        const res = await fetch(`https://${host}/`, { method: "GET", redirect: "follow" });
        return json({
          ok: res.ok,
          status_code: res.status,
          response_ms: Date.now() - started,
          protected: res.status === 401 || res.status === 403,
        });
      } catch (e) {
        return json({
          ok: false,
          status_code: null,
          response_ms: Date.now() - started,
          error: sanitize(String((e as Error)?.message ?? e)),
        });
      }
    }

    const isDanger = (DANGER_ACTIONS as readonly string[]).includes(act);
    const isWrite = isDanger || (WRITE_ACTIONS as readonly string[]).includes(act);

    // ── 3. Rate limit dangerous actions (max 3 / 5 min / actor) ────────
    if (isDanger) {
      const since = new Date(Date.now() - 5 * 60_000).toISOString();
      const { count } = await admin
        .from("deployment_audit_log")
        .select("id", { count: "exact", head: true })
        .eq("actor_user_id", user.id)
        .in("action", [...DANGER_ACTIONS])
        .gte("created_at", since);
      if ((count ?? 0) >= 3) {
        return json({ error: "Rate limit reached for destructive actions. Try again shortly." }, 429);
      }
    }

    const projectId = body.project_id;
    const deploymentId = body.deployment_id;

    let before: unknown = null;
    let after: unknown = null;
    let result: { ok: boolean; data?: unknown; error?: string; statusCode?: number };

    switch (act) {
      case "list_projects":
        result = await vercel("GET", `/v9/projects?limit=50`, { token, teamId });
        break;

      case "list_deployments": {
        if (!isId(projectId)) return json({ error: "Invalid project_id" }, 400);
        const limit = Math.min(Number(body.limit ?? 10) || 10, 25);
        result = await vercel(
          "GET",
          `/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=${limit}`,
          { token, teamId },
        );
        break;
      }

      case "get_project":
        if (!isId(projectId)) return json({ error: "Invalid project_id" }, 400);
        result = await vercel("GET", `/v9/projects/${encodeURIComponent(projectId)}`, { token, teamId });
        break;

      case "get_deployment":
        if (!isId(deploymentId)) return json({ error: "Invalid deployment_id" }, 400);
        result = await vercel("GET", `/v13/deployments/${encodeURIComponent(deploymentId)}`, { token, teamId });
        break;

      case "list_domains":
        if (!isId(projectId)) return json({ error: "Invalid project_id" }, 400);
        result = await vercel("GET", `/v9/projects/${encodeURIComponent(projectId)}/domains`, { token, teamId });
        break;

      case "set_protection": {
        if (!isId(projectId)) return json({ error: "Invalid project_id" }, 400);
        const enable = body.enabled === true;
        const scope = body.scope === "all" ? "all" : "preview"; // deploymentType
        const current = await vercel("GET", `/v9/projects/${encodeURIComponent(projectId)}`, { token, teamId });
        before = current.ok ? protectionOf(current.data) : null;
        result = await vercel("PATCH", `/v9/projects/${encodeURIComponent(projectId)}`, {
          token,
          teamId,
          body: { ssoProtection: enable ? { deploymentType: scope } : null },
        });
        after = result.ok ? protectionOf(result.data) : null;
        break;
      }

      case "redeploy": {
        if (!isId(deploymentId)) return json({ error: "Invalid deployment_id" }, 400);
        const name = body.name;
        if (!isId(name)) return json({ error: "Invalid project name" }, 400);
        const target = body.target === "production" ? "production" : undefined;
        result = await vercel("POST", `/v13/deployments`, {
          token,
          teamId,
          body: { name, deploymentId, target, meta: { streamvistaRedeploy: requestId } },
        });
        break;
      }

      case "add_domain": {
        if (!isId(projectId)) return json({ error: "Invalid project_id" }, 400);
        if (!isHost(body.domain)) return json({ error: "Invalid domain" }, 400);
        result = await vercel("POST", `/v10/projects/${encodeURIComponent(projectId)}/domains`, {
          token,
          teamId,
          body: { name: body.domain },
        });
        after = { domain: body.domain };
        break;
      }

      case "remove_domain": {
        if (!isId(projectId)) return json({ error: "Invalid project_id" }, 400);
        if (!isHost(body.domain)) return json({ error: "Invalid domain" }, 400);
        before = { domain: body.domain };
        result = await vercel(
          "DELETE",
          `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(String(body.domain))}`,
          { token, teamId },
        );
        break;
      }

      case "delete_deployment": {
        if (!isId(deploymentId)) return json({ error: "Invalid deployment_id" }, 400);
        if (body.confirm !== deploymentId) {
          return json({ error: "Confirmation phrase does not match the deployment id" }, 400);
        }
        before = { deployment_id: deploymentId };
        result = await vercel("DELETE", `/v13/deployments/${encodeURIComponent(deploymentId)}`, { token, teamId });
        break;
      }

      case "delete_project": {
        if (!isId(projectId)) return json({ error: "Invalid project_id" }, 400);
        const name = body.name;
        if (!isId(name)) return json({ error: "Invalid project name" }, 400);
        if (body.confirm !== name) {
          return json({ error: "Confirmation phrase does not match the project name" }, 400);
        }
        before = { project_id: projectId, name };
        result = await vercel("DELETE", `/v9/projects/${encodeURIComponent(projectId)}`, { token, teamId });
        break;
      }

      default:
        return json({ error: "Unsupported action" }, 400);
    }

    // ── 4. Audit (writes + dangerous reads of state changes) ───────────
    if (isWrite) {
      await admin.from("deployment_audit_log").insert({
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: act,
        provider: "vercel",
        project_id: isId(projectId) ? projectId : null,
        deployment_id: isId(deploymentId) ? deploymentId : null,
        target_label: typeof body.name === "string" ? String(body.name).slice(0, 120) : null,
        before_state: before as never,
        after_state: after as never,
        result: result.ok ? "success" : "failed",
        error_summary: result.ok ? null : sanitize(result.error ?? "Unknown error"),
        request_id: requestId,
      });
    }

    if (!result.ok) {
      return json(
        { error: sanitize(result.error ?? "Vercel request failed"), status_code: result.statusCode ?? null },
        result.statusCode && result.statusCode >= 400 && result.statusCode < 500 ? 400 : 502,
      );
    }

    return json({ ok: true, data: result.data, before, after });
  } catch (e) {
    return json({ error: sanitize(String((e as Error)?.message ?? e)) }, 500);
  }
});

function protectionOf(project: unknown): Record<string, unknown> {
  const p = (project ?? {}) as Record<string, any>;
  return {
    ssoProtection: p.ssoProtection ?? null,
    passwordProtection: p.passwordProtection ? { enabled: true } : null,
    publicSource: p.publicSource ?? null,
  };
}

async function vercel(
  method: string,
  path: string,
  opts: { token: string; teamId: string; body?: unknown },
): Promise<{ ok: boolean; data?: unknown; error?: string; statusCode?: number }> {
  const url = new URL(VERCEL_API + path);
  if (opts.teamId) url.searchParams.set("teamId", opts.teamId);
  try {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${opts.token}`,
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const msg =
        (data as any)?.error?.message ?? (data as any)?.message ?? `Vercel API error ${res.status}`;
      return { ok: false, error: String(msg), statusCode: res.status };
    }
    return { ok: true, data, statusCode: res.status };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e), statusCode: 0 };
  }
}
