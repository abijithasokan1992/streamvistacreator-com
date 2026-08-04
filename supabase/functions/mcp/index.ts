// supabase function: mcp
// Bundled from src/lib/mcp/index.ts by @lovable.dev/mcp-js.
// src/lib/mcp/index.ts
import { auth, defineMcp } from "npm:@lovable.dev/mcp-js@0.20.0";

// src/lib/mcp/tools/whoami.ts
import { defineTool } from "npm:@lovable.dev/mcp-js@0.20.0";
var whoami_default = defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the signed-in StreamVista user's id, email, and OAuth client id.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const payload = {
      user_id: ctx.getUserId(),
      email: ctx.getUserEmail(),
      client_id: ctx.getClientId()
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload
    };
  }
});

// src/lib/mcp/tools/list-titles.ts
import { createClient } from "npm:@supabase/supabase-js@^2.105.4";
import { defineTool as defineTool2 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z } from "npm:zod@^3.25.76";
function userClient(ctx) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    }
  );
}
var list_titles_default = defineTool2({
  name: "list_titles",
  title: "List my titles",
  description: "List content titles owned by the signed-in creator. Returns id, title, status, genre, language, and updated_at.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 20)."),
    status: z.string().optional().describe("Optional exact status filter (e.g. 'draft', 'submitted', 'approved').")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = userClient(ctx);
    let q = supabase.from("content_titles").select("id, title, status, genre, language, duration_minutes, updated_at").order("updated_at", { ascending: false }).limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { titles: data ?? [] }
    };
  }
});

// src/lib/mcp/tools/get-title.ts
import { createClient as createClient2 } from "npm:@supabase/supabase-js@^2.105.4";
import { defineTool as defineTool3 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z2 } from "npm:zod@^3.25.76";
function userClient2(ctx) {
  return createClient2(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    }
  );
}
var get_title_default = defineTool3({
  name: "get_title",
  title: "Get a title",
  description: "Fetch full details for a single content title by id (RLS-scoped to the signed-in user).",
  inputSchema: { id: z2.string().uuid().describe("The title id (UUID).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await userClient2(ctx).from("content_titles").select("*").eq("id", id).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Not found" }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { title: data }
    };
  }
});

// src/lib/mcp/tools/list-ingest-jobs.ts
import { createClient as createClient3 } from "npm:@supabase/supabase-js@^2.105.4";
import { defineTool as defineTool4 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z3 } from "npm:zod@^3.25.76";
function userClient3(ctx) {
  return createClient3(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    }
  );
}
var list_ingest_jobs_default = defineTool4({
  name: "list_ingest_jobs",
  title: "List ingest jobs",
  description: "List recent Studio ingest jobs visible to the signed-in user (RLS-scoped). Returns status, progress, and workspace/project ids.",
  inputSchema: {
    limit: z3.number().int().min(1).max(100).optional().describe("Max rows to return (default 20)."),
    status: z3.string().optional().describe("Optional exact status filter (e.g. 'queued', 'uploading', 'complete', 'failed').")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = userClient3(ctx).from("ingest_jobs").select(
      "id, status, job_mode, destination_type, project_id, workspace_id, total_files, completed_files, failed_files, total_bytes, transferred_bytes, started_at, completed_at, updated_at"
    ).order("updated_at", { ascending: false }).limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { jobs: data ?? [] }
    };
  }
});

// src/lib/mcp/tools/list-productions.ts
import { defineTool as defineTool5 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z4 } from "npm:zod@^3.25.76";

// src/lib/mcp/tools/_shared.ts
import { createClient as createClient4 } from "npm:@supabase/supabase-js@^2.105.4";
function userClient4(ctx) {
  return createClient4(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    }
  );
}
function unauth() {
  return {
    content: [{ type: "text", text: "Please sign in to your StreamVista Studio account." }],
    isError: true
  };
}
function notStudio() {
  return {
    content: [
      {
        type: "text",
        text: "This tool is available to StreamVista Studio users only. Ask your workspace owner for access."
      }
    ],
    isError: true
  };
}
async function getStudioWorkspaceIds(ctx) {
  const sb = userClient4(ctx);
  const uid = ctx.getUserId();
  if (!uid) return [];
  const [owned, member] = await Promise.all([
    sb.from("workspaces").select("id").eq("owner_id", uid),
    sb.from("workspace_members").select("workspace_id").eq("user_id", uid)
  ]);
  const ids = /* @__PURE__ */ new Set();
  (owned.data ?? []).forEach((r) => ids.add(r.id));
  (member.data ?? []).forEach((r) => ids.add(r.workspace_id));
  return Array.from(ids);
}
function notCreator() {
  return {
    content: [
      {
        type: "text",
        text: "This tool is available to StreamVista Creator accounts only. Contact support if you believe you should have access."
      }
    ],
    isError: true
  };
}
async function isCreatorUser(ctx) {
  const uid = ctx.getUserId();
  if (!uid) return false;
  const { data } = await userClient4(ctx).from("user_roles").select("role").eq("user_id", uid);
  const roles = (data ?? []).map((r) => r.role);
  return roles.includes("content_owner") || roles.includes("creator");
}
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}
function ok(structured, summary) {
  return {
    content: [{ type: "text", text: summary }],
    structuredContent: structured
  };
}

// src/lib/mcp/tools/list-productions.ts
var list_productions_default = defineTool5({
  name: "list_productions",
  title: "List productions",
  description: "List the signed-in Studio user's active productions across their studio workspaces. Returns each production's name, title number, banner, and last-updated time.",
  inputSchema: {
    limit: z4.number().int().min(1).max(100).optional().describe("Max productions to return (default 25)."),
    search: z4.string().optional().describe("Optional case-insensitive substring match on production name.")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, search }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    let q = userClient4(ctx).from("projects").select("id, name, description, workspace_id, production_banner, crew, updated_at, created_at").in("workspace_id", wsIds).order("updated_at", { ascending: false }).limit(limit ?? 25);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: "Could not load productions right now." }], isError: true };
    const productions = (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      title_number: p.crew?.title_number ?? null,
      banner: p.production_banner ?? p.crew?.production_house ?? null,
      last_updated: p.updated_at
    }));
    return ok(
      { productions, total: productions.length },
      productions.length ? `Found ${productions.length} production${productions.length === 1 ? "" : "s"}.` : "No productions yet in your studio workspace."
    );
  }
});

// src/lib/mcp/tools/open-production.ts
import { defineTool as defineTool6 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z5 } from "npm:zod@^3.25.76";
var open_production_default = defineTool6({
  name: "open_production",
  title: "Open production",
  description: "Open a single production and return its overview: name, banner, title number, team crew summary, active ingest jobs, and asset totals. Studio-scoped by RLS.",
  inputSchema: {
    id: z5.string().uuid().describe("The production id (UUID) from `list_productions`.")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    const sb = userClient4(ctx);
    const { data: p, error } = await sb.from("projects").select("id, name, description, workspace_id, production_banner, crew, created_at, updated_at").eq("id", id).maybeSingle();
    if (error || !p) return { content: [{ type: "text", text: "Production not found or access denied." }], isError: true };
    const [jobs, assets] = await Promise.all([
      sb.from("ingest_jobs").select("id, status, total_files, completed_files, transferred_bytes, total_bytes, updated_at").eq("project_id", id).order("updated_at", { ascending: false }).limit(5),
      sb.from("studio_assets").select("id, total_size_bytes", { count: "exact" }).eq("project_id", id)
    ]);
    const assetCount = assets.count ?? (assets.data?.length ?? 0);
    const totalBytes = (assets.data ?? []).reduce(
      (n, a) => n + (Number(a.total_size_bytes) || 0),
      0
    );
    return ok(
      {
        production: {
          id: p.id,
          name: p.name,
          description: p.description ?? null,
          banner: p.production_banner ?? p.crew?.production_house ?? null,
          title_number: p.crew?.title_number ?? null,
          crew: p.crew ?? {},
          last_updated: p.updated_at
        },
        recent_uploads: jobs.data ?? [],
        asset_totals: { count: assetCount, total_bytes: totalBytes }
      },
      `Opened production "${p.name}".`
    );
  }
});

// src/lib/mcp/tools/show-todays-work.ts
import { defineTool as defineTool7 } from "npm:@lovable.dev/mcp-js@0.20.0";
var show_todays_work_default = defineTool7({
  name: "show_todays_work",
  title: "Show today's work",
  description: "Summarize what the signed-in Studio user should do next today: unread alerts, in-flight uploads, and deliveries awaiting action.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    const sb = userClient4(ctx);
    const uid = ctx.getUserId();
    const [notifs, active, pendingDeliveries] = await Promise.all([
      sb.from("notifications").select("id, title, message, is_read, created_at").eq("user_id", uid).eq("is_read", false).order("created_at", { ascending: false }).limit(10),
      sb.from("ingest_jobs").select("id, status, total_files, completed_files, updated_at, project_id").in("workspace_id", wsIds).in("status", ["queued", "uploading", "processing", "verifying"]).order("updated_at", { ascending: false }).limit(10),
      sb.from("deal_deliveries").select("id, status, recipient_email, buyer_org_name, updated_at").in("status", ["pending", "in_progress", "shared"]).order("updated_at", { ascending: false }).limit(10)
    ]);
    const tasks = [];
    (notifs.data ?? []).forEach(
      (n) => tasks.push({ kind: "alert", label: n.title || n.message || "New alert", id: n.id })
    );
    (active.data ?? []).forEach(
      (j) => tasks.push({
        kind: "upload",
        label: `Upload in progress \xB7 ${j.completed_files ?? 0}/${j.total_files ?? 0} files`,
        id: j.id
      })
    );
    (pendingDeliveries.data ?? []).forEach(
      (d) => tasks.push({
        kind: "delivery",
        label: `Delivery to ${d.buyer_org_name ?? d.recipient_email ?? "buyer"} \xB7 ${d.status}`,
        id: d.id
      })
    );
    return ok(
      {
        unread_alerts: notifs.data ?? [],
        active_uploads: active.data ?? [],
        pending_deliveries: pendingDeliveries.data ?? [],
        tasks
      },
      tasks.length ? `You have ${tasks.length} item${tasks.length === 1 ? "" : "s"} needing attention today.` : "You're all caught up \u2014 no pending items today."
    );
  }
});

// src/lib/mcp/tools/show-upload-progress.ts
import { defineTool as defineTool8 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z6 } from "npm:zod@^3.25.76";
var show_upload_progress_default = defineTool8({
  name: "show_upload_progress",
  title: "Show upload progress",
  description: "Show current and recent media uploads for the signed-in Studio user, with human-readable progress and transfer size.",
  inputSchema: {
    limit: z6.number().int().min(1).max(50).optional().describe("Max uploads to return (default 10).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    const { data, error } = await userClient4(ctx).from("ingest_jobs").select(
      "id, status, total_files, completed_files, failed_files, total_bytes, transferred_bytes, started_at, completed_at, updated_at, project_id"
    ).in("workspace_id", wsIds).order("updated_at", { ascending: false }).limit(limit ?? 10);
    if (error) return { content: [{ type: "text", text: "Could not load upload progress." }], isError: true };
    const uploads = (data ?? []).map((j) => {
      const pct = j.total_files && j.total_files > 0 ? Math.round(100 * (j.completed_files ?? 0) / j.total_files) : 0;
      return {
        id: j.id,
        status: j.status,
        files_completed: j.completed_files ?? 0,
        files_total: j.total_files ?? 0,
        files_failed: j.failed_files ?? 0,
        percent_complete: pct,
        transferred: formatBytes(j.transferred_bytes),
        total_size: formatBytes(j.total_bytes),
        started_at: j.started_at,
        completed_at: j.completed_at
      };
    });
    return ok(
      { uploads },
      uploads.length ? `Showing ${uploads.length} upload${uploads.length === 1 ? "" : "s"}.` : "No uploads yet."
    );
  }
});

// src/lib/mcp/tools/show-storage-usage.ts
import { defineTool as defineTool9 } from "npm:@lovable.dev/mcp-js@0.20.0";
var show_storage_usage_default = defineTool9({
  name: "show_storage_usage",
  title: "Show storage usage",
  description: "Report the signed-in Studio user's storage plan, allocated capacity, used capacity, and remaining headroom.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    const sb = userClient4(ctx);
    const [ent, usage] = await Promise.all([
      sb.from("workspace_storage_entitlements").select("workspace_id, plan_code, total_storage_gb, included_storage_gb, paid_storage_gb, admin_bonus_storage_gb, billing_status").in("workspace_id", wsIds),
      sb.from("workspace_storage_usage").select("workspace_id, billable_bytes, display_used_bytes, last_recalculated_at").in("workspace_id", wsIds)
    ]);
    const usageByWs = /* @__PURE__ */ new Map();
    (usage.data ?? []).forEach((u) => usageByWs.set(u.workspace_id, u));
    const workspaces = (ent.data ?? []).map((e) => {
      const u = usageByWs.get(e.workspace_id);
      const usedBytes = Number(u?.display_used_bytes ?? u?.billable_bytes ?? 0);
      const totalBytes = Number(e.total_storage_gb ?? 0) * 1024 ** 3;
      const remaining = Math.max(0, totalBytes - usedBytes);
      const pct = totalBytes > 0 ? Math.round(100 * usedBytes / totalBytes) : 0;
      return {
        workspace_id: e.workspace_id,
        plan: e.plan_code,
        total: formatBytes(totalBytes),
        used: formatBytes(usedBytes),
        available: formatBytes(remaining),
        percent_used: pct,
        billing_status: e.billing_status
      };
    });
    return ok({ workspaces }, workspaces.length ? "Storage summary ready." : "No storage plan is active yet.");
  }
});

// src/lib/mcp/tools/show-recent-activity.ts
import { defineTool as defineTool10 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z7 } from "npm:zod@^3.25.76";
var show_recent_activity_default = defineTool10({
  name: "show_recent_activity",
  title: "Show recent activity",
  description: "Show the signed-in Studio user's recent notifications and activity feed.",
  inputSchema: {
    limit: z7.number().int().min(1).max(100).optional().describe("Max entries (default 20).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    const { data, error } = await userClient4(ctx).from("notifications").select("id, title, message, is_read, created_at").eq("user_id", ctx.getUserId()).order("created_at", { ascending: false }).limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: "Could not load recent activity." }], isError: true };
    return ok({ activity: data ?? [] }, `Recent activity: ${(data ?? []).length} entries.`);
  }
});

// src/lib/mcp/tools/show-team.ts
import { defineTool as defineTool11 } from "npm:@lovable.dev/mcp-js@0.20.0";
var show_team_default = defineTool11({
  name: "show_team",
  title: "Show team",
  description: "List the signed-in Studio user's team members across their workspaces, including each member's role.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    const sb = userClient4(ctx);
    const { data: members, error } = await sb.from("workspace_members").select("workspace_id, user_id, role, created_at").in("workspace_id", wsIds);
    if (error) return { content: [{ type: "text", text: "Could not load team members." }], isError: true };
    const userIds = Array.from(new Set((members ?? []).map((m) => m.user_id)));
    let profiles = [];
    if (userIds.length > 0) {
      const { data: profs } = await sb.from("user_profiles").select("id, display_name, email, avatar_url").in("id", userIds);
      profiles = profs ?? [];
    }
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const team = (members ?? []).map((m) => {
      const p = byId.get(m.user_id) ?? {};
      return {
        workspace_id: m.workspace_id,
        role: m.role,
        name: p.display_name ?? null,
        email: p.email ?? null,
        joined_at: m.created_at
      };
    });
    return ok(
      { team, total: team.length },
      team.length ? `Your team has ${team.length} member${team.length === 1 ? "" : "s"}.` : "No team members yet."
    );
  }
});

// src/lib/mcp/tools/show-deliveries.ts
import { defineTool as defineTool12 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z8 } from "npm:zod@^3.25.76";
var show_deliveries_default = defineTool12({
  name: "show_deliveries",
  title: "Show deliveries",
  description: "List the signed-in Studio user's recent buyer deliveries, including recipient, delivery status, and share expiry.",
  inputSchema: {
    limit: z8.number().int().min(1).max(100).optional().describe("Max deliveries to return (default 20)."),
    status: z8.string().optional().describe("Optional exact status filter (e.g. 'pending', 'shared', 'delivered').")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    let q = userClient4(ctx).from("deal_deliveries").select(
      "id, status, method, buyer_org_name, recipient_email, share_url, expires_at, shared_at, delivered_at, updated_at"
    ).order("updated_at", { ascending: false }).limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: "Could not load deliveries." }], isError: true };
    return ok(
      { deliveries: data ?? [] },
      (data ?? []).length ? `Showing ${data.length} deliver${data.length === 1 ? "y" : "ies"}.` : "No deliveries yet."
    );
  }
});

// src/lib/mcp/tools/show-billing.ts
import { defineTool as defineTool13 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z9 } from "npm:zod@^3.25.76";
function money(paise, currency) {
  if (paise == null) return "";
  const amount = paise / 100;
  const cur = (currency || "INR").toUpperCase();
  const symbol = cur === "INR" ? "\u20B9" : cur === "USD" ? "$" : cur === "EUR" ? "\u20AC" : `${cur} `;
  return `${symbol}${amount.toFixed(2)}`;
}
var show_billing_default = defineTool13({
  name: "show_billing",
  title: "Show billing",
  description: "Summarize the signed-in Studio user's recent invoices, showing invoice number, amount, currency, status, and issued date.",
  inputSchema: {
    limit: z9.number().int().min(1).max(100).optional().describe("Max invoices to return (default 20).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    const { data, error } = await userClient4(ctx).from("invoices").select("id, invoice_number, description, currency, total_paise, status, issued_at, source").eq("user_id", ctx.getUserId()).order("issued_at", { ascending: false }).limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: "Could not load billing history." }], isError: true };
    const invoices = (data ?? []).map((r) => ({
      id: r.id,
      number: r.invoice_number,
      description: r.description,
      amount: money(r.total_paise, r.currency),
      currency: r.currency,
      status: r.status,
      issued_at: r.issued_at,
      source: r.source
    }));
    const outstanding = invoices.filter((i) => i.status && i.status !== "paid" && i.status !== "refunded").length;
    return ok(
      { invoices, outstanding_count: outstanding },
      invoices.length ? `${invoices.length} invoice${invoices.length === 1 ? "" : "s"}${outstanding ? `, ${outstanding} still open` : ""}.` : "No billing history yet."
    );
  }
});

// src/lib/mcp/tools/search-files.ts
import { defineTool as defineTool14 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z10 } from "npm:zod@^3.25.76";
var search_files_default = defineTool14({
  name: "search_files",
  title: "Search files",
  description: "Search the signed-in Studio user's media library by file title. Returns matching assets with size, camera info, and shoot date.",
  inputSchema: {
    query: z10.string().min(1).describe("Substring to match against the file title (case-insensitive)."),
    limit: z10.number().int().min(1).max(100).optional().describe("Max results (default 25)."),
    production_id: z10.string().uuid().optional().describe("Optional: limit results to a specific production.")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit, production_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    let q = userClient4(ctx).from("studio_assets").select(
      "id, title, asset_type, total_size_bytes, file_count, camera_make, camera_model, codec, resolution, fps, shoot_date, status, project_id, workspace_id, updated_at"
    ).in("workspace_id", wsIds).ilike("title", `%${query}%`).order("updated_at", { ascending: false }).limit(limit ?? 25);
    if (production_id) q = q.eq("project_id", production_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: "Could not search your media library." }], isError: true };
    const files = (data ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      type: a.asset_type,
      size: formatBytes(a.total_size_bytes),
      file_count: a.file_count,
      camera: [a.camera_make, a.camera_model].filter(Boolean).join(" ") || null,
      codec: a.codec,
      resolution: a.resolution,
      fps: a.fps,
      shoot_date: a.shoot_date,
      status: a.status,
      production_id: a.project_id
    }));
    return ok(
      { files, total: files.length, query },
      files.length ? `Found ${files.length} file${files.length === 1 ? "" : "s"} matching "${query}".` : `No files match "${query}".`
    );
  }
});

// src/lib/mcp/tools/creator-my-workspace.ts
import { defineTool as defineTool15 } from "npm:@lovable.dev/mcp-js@0.20.0";
var creator_my_workspace_default = defineTool15({
  name: "creator_my_workspace",
  title: "My workspace",
  description: "Overview of the signed-in Creator's workspace: total titles, titles by review stage, and active distribution offers.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!await isCreatorUser(ctx)) return notCreator();
    const uid = ctx.getUserId();
    const sb = userClient4(ctx);
    const [titles, offers] = await Promise.all([
      sb.from("content_titles").select("id, status").eq("owner_user_id", uid),
      sb.from("distribution_program_offers").select("id, status").eq("creator_user_id", uid)
    ]);
    if (titles.error || offers.error) {
      return { content: [{ type: "text", text: "Could not load your workspace summary." }], isError: true };
    }
    const byStatus = {};
    (titles.data ?? []).forEach((t) => {
      const s = t.status || "draft";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    });
    const activeOffers = (offers.data ?? []).filter(
      (o) => o.status && o.status !== "rejected" && o.status !== "expired"
    ).length;
    return ok(
      {
        total_titles: (titles.data ?? []).length,
        titles_by_status: byStatus,
        active_distribution_offers: activeOffers
      },
      `You have ${(titles.data ?? []).length} title${(titles.data ?? []).length === 1 ? "" : "s"} and ${activeOffers} active distribution offer${activeOffers === 1 ? "" : "s"}.`
    );
  }
});

// src/lib/mcp/tools/creator-list-titles.ts
import { defineTool as defineTool16 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z11 } from "npm:zod@^3.25.76";
var creator_list_titles_default = defineTool16({
  name: "creator_list_titles",
  title: "List my titles",
  description: "List the signed-in Creator's titles with title, status, genre, language, duration, and last-updated time.",
  inputSchema: {
    limit: z11.number().int().min(1).max(100).optional().describe("Max rows to return (default 25)."),
    status: z11.string().optional().describe("Optional exact status filter (e.g. 'draft', 'submitted', 'approved').")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!await isCreatorUser(ctx)) return notCreator();
    let q = userClient4(ctx).from("content_titles").select("id, title, status, genre, language, duration_minutes, updated_at").eq("owner_user_id", ctx.getUserId()).order("updated_at", { ascending: false }).limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: "Could not load your titles." }], isError: true };
    return ok(
      { titles: data ?? [], total: (data ?? []).length },
      (data ?? []).length ? `Showing ${data.length} title${data.length === 1 ? "" : "s"}.` : "No titles yet."
    );
  }
});

// src/lib/mcp/tools/creator-open-title.ts
import { defineTool as defineTool17 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z12 } from "npm:zod@^3.25.76";
var creator_open_title_default = defineTool17({
  name: "creator_open_title",
  title: "Open a title",
  description: "Open one of the signed-in Creator's titles by id and return its core details, current status, and last-updated time.",
  inputSchema: { id: z12.string().uuid().describe("The title id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!await isCreatorUser(ctx)) return notCreator();
    const { data, error } = await userClient4(ctx).from("content_titles").select(
      "id, title, status, genre, language, duration_minutes, synopsis, submitted_at, approved_at, published_at, updated_at, created_at"
    ).eq("id", id).eq("owner_user_id", ctx.getUserId()).maybeSingle();
    if (error) return { content: [{ type: "text", text: "Could not open that title." }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Title not found in your workspace." }], isError: true };
    return ok({ title: data }, `${data.title} \u2014 status: ${data.status ?? "draft"}.`);
  }
});

// src/lib/mcp/tools/creator-submission-status.ts
import { defineTool as defineTool18 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z13 } from "npm:zod@^3.25.76";
var creator_submission_status_default = defineTool18({
  name: "creator_submission_status",
  title: "Submission status",
  description: "Show the review/approval status of the signed-in Creator's titles, grouped by stage, and list the most recently updated titles.",
  inputSchema: {
    limit: z13.number().int().min(1).max(100).optional().describe("Max recent titles to list (default 20).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!await isCreatorUser(ctx)) return notCreator();
    const { data, error } = await userClient4(ctx).from("content_titles").select("id, title, status, submitted_at, approved_at, published_at, updated_at").eq("owner_user_id", ctx.getUserId()).order("updated_at", { ascending: false }).limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: "Could not load submission status." }], isError: true };
    const buckets = {};
    (data ?? []).forEach((t) => {
      const s = t.status || "draft";
      buckets[s] = (buckets[s] ?? 0) + 1;
    });
    return ok(
      { by_stage: buckets, recent: data ?? [] },
      `Reviewed ${(data ?? []).length} recent title${(data ?? []).length === 1 ? "" : "s"}.`
    );
  }
});

// src/lib/mcp/tools/creator-rights-status.ts
import { defineTool as defineTool19 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z14 } from "npm:zod@^3.25.76";
var creator_rights_status_default = defineTool19({
  name: "creator_rights_status",
  title: "Rights status",
  description: "Show rights availability for one of the signed-in Creator's titles: territory, language, category, exclusivity, term dates, and current status.",
  inputSchema: {
    title_id: z14.string().uuid().describe("The title id to inspect."),
    limit: z14.number().int().min(1).max(200).optional().describe("Max rights rows (default 100).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ title_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!await isCreatorUser(ctx)) return notCreator();
    const sb = userClient4(ctx);
    const owner = await sb.from("content_titles").select("id, title").eq("id", title_id).eq("owner_user_id", ctx.getUserId()).maybeSingle();
    if (owner.error || !owner.data) {
      return { content: [{ type: "text", text: "Title not found in your workspace." }], isError: true };
    }
    const { data, error } = await sb.from("title_rights_availability").select("id, right_category, territory, language, exclusivity, status, term_start, term_end, notes, updated_at").eq("title_id", title_id).order("updated_at", { ascending: false }).limit(limit ?? 100);
    if (error) return { content: [{ type: "text", text: "Could not load rights availability." }], isError: true };
    return ok(
      { title: owner.data.title, rights: data ?? [] },
      (data ?? []).length ? `${(data ?? []).length} rights entr${(data ?? []).length === 1 ? "y" : "ies"} on "${owner.data.title}".` : `No rights configured yet on "${owner.data.title}".`
    );
  }
});

// src/lib/mcp/tools/creator-list-assets.ts
import { defineTool as defineTool20 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z15 } from "npm:zod@^3.25.76";
var creator_list_assets_default = defineTool20({
  name: "creator_list_assets",
  title: "List title assets",
  description: "List the files (masters, artwork, subtitles, etc.) attached to one of the signed-in Creator's titles.",
  inputSchema: {
    title_id: z15.string().uuid().describe("The title id."),
    limit: z15.number().int().min(1).max(100).optional().describe("Max rows (default 50).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ title_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!await isCreatorUser(ctx)) return notCreator();
    const sb = userClient4(ctx);
    const owner = await sb.from("content_titles").select("id, title").eq("id", title_id).eq("owner_user_id", ctx.getUserId()).maybeSingle();
    if (owner.error || !owner.data) {
      return { content: [{ type: "text", text: "Title not found in your workspace." }], isError: true };
    }
    const { data, error } = await sb.from("title_assets").select(
      "id, category, is_primary, created_at, upload:recent_uploads(id, file_name, file_size, mime_type, status, created_at)"
    ).eq("title_id", title_id).order("created_at", { ascending: false }).limit(limit ?? 50);
    if (error) return { content: [{ type: "text", text: "Could not load assets for that title." }], isError: true };
    const assets = (data ?? []).map((row) => ({
      id: row.id,
      category: row.category,
      is_primary: row.is_primary,
      file_name: row.upload?.file_name ?? null,
      file_size: formatBytes(row.upload?.file_size ?? null),
      file_type: row.upload?.mime_type ?? null,
      upload_status: row.upload?.status ?? null,
      added_at: row.created_at
    }));
    return ok(
      { title: owner.data.title, assets },
      assets.length ? `${assets.length} file${assets.length === 1 ? "" : "s"} on "${owner.data.title}".` : `No files attached yet on "${owner.data.title}".`
    );
  }
});

// src/lib/mcp/tools/creator-review-notes.ts
import { defineTool as defineTool21 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z16 } from "npm:zod@^3.25.76";
var creator_review_notes_default = defineTool21({
  name: "creator_review_notes",
  title: "Review notes",
  description: "Latest review notes posted by the review team on the signed-in Creator's titles. Includes the review decision and the note text.",
  inputSchema: {
    limit: z16.number().int().min(1).max(100).optional().describe("Max notes (default 20).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!await isCreatorUser(ctx)) return notCreator();
    const sb = userClient4(ctx);
    const titles = await sb.from("content_titles").select("id, title").eq("owner_user_id", ctx.getUserId());
    if (titles.error) return { content: [{ type: "text", text: "Could not load your titles." }], isError: true };
    const titleIds = (titles.data ?? []).map((t) => t.id);
    if (titleIds.length === 0) return ok({ notes: [] }, "No review notes yet.");
    const titleMap = new Map((titles.data ?? []).map((t) => [t.id, t.title]));
    const { data, error } = await sb.from("content_approvals").select("id, title_id, to_status, note, created_at").in("title_id", titleIds).not("note", "is", null).order("created_at", { ascending: false }).limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: "Could not load review notes." }], isError: true };
    const notes = (data ?? []).map((r) => ({
      id: r.id,
      title_id: r.title_id,
      title: titleMap.get(r.title_id) ?? "Untitled",
      decision: r.to_status,
      note: r.note,
      posted_at: r.created_at
    }));
    return ok(
      { notes },
      notes.length ? `${notes.length} review note${notes.length === 1 ? "" : "s"} from the review team.` : "No review notes yet."
    );
  }
});

// src/lib/mcp/tools/creator-distribution-status.ts
import { defineTool as defineTool22 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z17 } from "npm:zod@^3.25.76";
var creator_distribution_status_default = defineTool22({
  name: "creator_distribution_status",
  title: "Distribution status",
  description: "List distribution program offers held by the signed-in Creator, showing program name, term, revenue split, and current status.",
  inputSchema: {
    status: z17.string().optional().describe("Optional exact status filter (e.g. 'offered', 'accepted', 'rejected')."),
    limit: z17.number().int().min(1).max(100).optional().describe("Max offers (default 25).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!await isCreatorUser(ctx)) return notCreator();
    let q = userClient4(ctx).from("distribution_program_offers").select(
      "id, program_name, status, revenue_model, rights_holder_share_pct, streamvista_share_pct, term_years, term_start_date, term_end_date, is_non_exclusive, offered_at, accepted_at, rejected_at, title_id, updated_at"
    ).eq("creator_user_id", ctx.getUserId()).order("updated_at", { ascending: false }).limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: "Could not load distribution offers." }], isError: true };
    return ok(
      { offers: data ?? [] },
      (data ?? []).length ? `Showing ${data.length} distribution offer${data.length === 1 ? "" : "s"}.` : "No distribution offers yet."
    );
  }
});

// src/lib/mcp/tools/creator-storage-usage.ts
import { defineTool as defineTool23 } from "npm:@lovable.dev/mcp-js@0.20.0";
var GB = 1024 ** 3;
var creator_storage_usage_default = defineTool23({
  name: "creator_storage_usage",
  title: "Storage usage",
  description: "Report the signed-in Creator's storage plan, allocated capacity, used capacity, and remaining headroom.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!await isCreatorUser(ctx)) return notCreator();
    const sb = userClient4(ctx);
    const uid = ctx.getUserId();
    const [entRes, usageRes] = await Promise.all([
      sb.from("workspace_storage_entitlements").select("plan_code, total_storage_gb, included_storage_gb, paid_storage_gb, admin_bonus_storage_gb, billing_status, effective_from").eq("user_id", uid).order("effective_from", { ascending: false }).limit(1).maybeSingle(),
      sb.from("workspace_storage_usage").select("display_used_bytes, active_bytes, archived_bytes, last_recalculated_at").eq("user_id", uid).order("last_recalculated_at", { ascending: false }).limit(1).maybeSingle()
    ]);
    const ent = entRes.data;
    const usage = usageRes.data;
    if (!ent && !usage) {
      return ok({ configured: false }, "No storage plan is active on your account yet.");
    }
    const totalBytes = Number(ent?.total_storage_gb ?? 0) * GB;
    const usedBytes = Number(usage?.display_used_bytes ?? 0);
    const remaining = Math.max(0, totalBytes - usedBytes);
    const pct = totalBytes > 0 ? Math.round(100 * usedBytes / totalBytes) : 0;
    return ok(
      {
        plan: ent?.plan_code ?? null,
        billing_status: ent?.billing_status ?? null,
        total: formatBytes(totalBytes),
        used: formatBytes(usedBytes),
        available: formatBytes(remaining),
        archived: formatBytes(Number(usage?.archived_bytes ?? 0)),
        percent_used: pct
      },
      `${formatBytes(usedBytes)} of ${formatBytes(totalBytes)} used (${pct}%).`
    );
  }
});

// src/lib/mcp/tools/creator-notifications.ts
import { defineTool as defineTool24 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z18 } from "npm:zod@^3.25.76";
var creator_notifications_default = defineTool24({
  name: "creator_notifications",
  title: "Notifications",
  description: "Recent notifications for the signed-in Creator, newest first, including whether each has been read.",
  inputSchema: {
    limit: z18.number().int().min(1).max(100).optional().describe("Max notifications (default 20)."),
    unread_only: z18.boolean().optional().describe("If true, only unread notifications are returned.")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, unread_only }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!await isCreatorUser(ctx)) return notCreator();
    let q = userClient4(ctx).from("notifications").select("id, title, message, is_read, created_at").eq("user_id", ctx.getUserId()).order("created_at", { ascending: false }).limit(limit ?? 20);
    if (unread_only) q = q.eq("is_read", false);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: "Could not load notifications." }], isError: true };
    const unread = (data ?? []).filter((n) => !n.is_read).length;
    return ok(
      { notifications: data ?? [], unread_count: unread },
      (data ?? []).length ? `${(data ?? []).length} notification${(data ?? []).length === 1 ? "" : "s"} (${unread} unread).` : "No notifications yet."
    );
  }
});

// src/lib/mcp/tools/creator-search-my-titles.ts
import { defineTool as defineTool25 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z19 } from "npm:zod@^3.25.76";
var creator_search_my_titles_default = defineTool25({
  name: "creator_search_my_titles",
  title: "Search my titles",
  description: "Search the signed-in Creator's titles by name (case-insensitive substring). Returns id, title, status, genre, and last-updated time.",
  inputSchema: {
    query: z19.string().min(1).describe("Substring to match against title name."),
    limit: z19.number().int().min(1).max(100).optional().describe("Max results (default 25).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!await isCreatorUser(ctx)) return notCreator();
    const { data, error } = await userClient4(ctx).from("content_titles").select("id, title, status, genre, language, updated_at").eq("owner_user_id", ctx.getUserId()).ilike("title", `%${query}%`).order("updated_at", { ascending: false }).limit(limit ?? 25);
    if (error) return { content: [{ type: "text", text: "Could not search your titles." }], isError: true };
    return ok(
      { titles: data ?? [], total: (data ?? []).length, query },
      (data ?? []).length ? `${(data ?? []).length} title${(data ?? []).length === 1 ? "" : "s"} match "${query}".` : `No titles match "${query}".`
    );
  }
});

// src/lib/mcp/tools/control/whoami-control.ts
import { defineTool as defineTool26 } from "npm:@lovable.dev/mcp-js@0.20.0";

// src/lib/mcp/lib/control.ts
import { createClient as createClient5 } from "npm:@supabase/supabase-js@^2.105.4";
var TIMEOUT_MS = Number(process.env.MCP_TOOL_TIMEOUT_MS ?? 2e4);
var MAX_LIMIT = 100;
var MAX_LOG_ROWS = 200;
var clampLimit = (n, max = MAX_LIMIT) => Math.max(1, Math.min(Math.floor(n ?? 25), max));
function userClient5(ctx) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("supabase_env_missing");
  return createClient5(url, key, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
async function withTimeout(p, label = "op") {
  return await Promise.race([
    Promise.resolve(p),
    new Promise(
      (_, reject) => setTimeout(() => reject(new Error(`timeout:${label}`)), TIMEOUT_MS)
    )
  ]);
}
var err = (code, msg) => ({
  content: [{ type: "text", text: msg ? `${code}: ${msg}` : code }],
  isError: true
});
var ok2 = (structured, summary) => ({
  content: [{ type: "text", text: summary }],
  structuredContent: structured
});
function isSchemaMissingError(e) {
  if (!e) return false;
  const msg = String(e.message ?? "").toLowerCase();
  const code = String(e.code ?? "");
  return code === "42703" || // undefined_column
  code === "42P01" || // undefined_table
  /column .* does not exist/.test(msg) || /relation .* does not exist/.test(msg) || /could not find the .* column/.test(msg);
}
function unavailable(structured, reason) {
  return {
    content: [{ type: "text", text: `unavailable: ${reason}` }],
    structuredContent: { ...structured, unavailable: true, reason }
  };
}
var SECRET_PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]"],
  [/sbp_[A-Za-z0-9]{20,}/g, "[REDACTED_SUPABASE_PAT]"],
  [/sk_(?:live|test)_[A-Za-z0-9]{20,}/g, "[REDACTED_STRIPE_KEY]"],
  [/rzp_(?:live|test)_[A-Za-z0-9]{10,}/g, "[REDACTED_RAZORPAY_KEY]"],
  [/ghp_[A-Za-z0-9]{30,}/g, "[REDACTED_GITHUB_PAT]"],
  [/AIza[0-9A-Za-z_-]{30,}/g, "[REDACTED_GOOGLE_KEY]"],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email]"],
  [/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, "[REDACTED_PAN]"]
];
function redact(s) {
  let out = s;
  for (const [re, rep] of SECRET_PATTERNS) out = out.replace(re, rep);
  return out;
}
function redactDeep(v) {
  if (v == null) return v;
  if (typeof v === "string") return redact(v);
  if (Array.isArray(v)) return v.map(redactDeep);
  if (typeof v === "object") {
    const out = {};
    for (const [k, vv] of Object.entries(v)) out[k] = redactDeep(vv);
    return out;
  }
  return v;
}
async function authorize(ctx, tool, params = {}, opts = {}) {
  if (!ctx.isAuthenticated?.() || !ctx.getUserId()) {
    return err("unauthenticated", "Sign in to StreamVista as a founder / platform_owner / super_admin.");
  }
  const sb = userClient5(ctx);
  const safeParams = redactDeep(params);
  const correlationId = opts.correlationId ?? cryptoRandomId();
  const startedAt = Date.now();
  const { data, error } = await withTimeout(
    sb.rpc("mcp_authorize_and_log", {
      _tool: tool,
      _params: {
        ...safeParams,
        _envelope: {
          correlation_id: correlationId,
          started_at: new Date(startedAt).toISOString(),
          category: opts.category ?? (opts.writes ? "db_write" : "db_read"),
          writes: !!opts.writes,
          client_id: ctx.getClientId?.() ?? null
        }
      },
      _writes: opts.writes ?? false
    }),
    `authorize:${tool}`
  );
  if (error) return err("authorize_failed", redact(error.message));
  const decision = String(data ?? "");
  if (decision === "ok") return null;
  if (decision === "forbidden")
    return err("forbidden", "This tool is restricted to founder, platform_owner, and super_admin.");
  if (decision === "kill_switch")
    return err("writes_disabled", "The production write kill switch is on.");
  if (decision === "rate_limited")
    return err("rate_limited", "Rate limit exceeded \u2014 retry in a minute.");
  return err("authorize_unknown", decision);
}
function cryptoRandomId() {
  try {
    const g = globalThis;
    if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  } catch {
  }
  return "cor-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

// src/lib/mcp/tools/control/whoami-control.ts
var whoami_control_default = defineTool26({
  name: "ctrl_whoami",
  title: "Whoami (Control)",
  description: "Return the signed-in caller's user id, control-role status, and current kill-switch state. Founder / platform_owner / super_admin only.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const denied = await authorize(ctx, "ctrl_whoami", {});
    if (denied) return denied;
    const sb = userClient5(ctx);
    const [{ data: roles }, { data: ks }] = await Promise.all([
      withTimeout(sb.from("user_roles").select("role").eq("user_id", ctx.getUserId()), "roles"),
      withTimeout(sb.from("mcp_control_flags").select("value").eq("key", "kill_switch").maybeSingle(), "ks")
    ]);
    const roleList = (roles ?? []).map((r) => r.role);
    const structured = {
      user_id: ctx.getUserId(),
      email: ctx.getUserEmail?.() ?? null,
      client_id: ctx.getClientId?.() ?? null,
      roles: roleList,
      is_founder: roleList.includes("founder"),
      is_platform_owner: roleList.includes("platform_owner"),
      is_super_admin: roleList.includes("super_admin"),
      kill_switch_on: Boolean(ks?.value ?? true),
      env: process.env.MCP_ENV ?? "staging"
    };
    return ok2(structured, `Signed in as ${structured.email ?? structured.user_id} \u2014 roles: ${roleList.join(", ") || "(none)"}`);
  }
});

// src/lib/mcp/tools/control/connection-health.ts
import { defineTool as defineTool27 } from "npm:@lovable.dev/mcp-js@0.20.0";

// src/lib/mcp/lib/reliability.ts
var TRANSIENT_PATTERNS = [
  /timeout/i,
  /network/i,
  /fetch failed/i,
  /connection reset/i,
  /temporarily unavailable/i,
  /service unavailable/i,
  /bad gateway/i,
  /gateway timeout/i,
  /econnreset/i,
  /socket hang up/i
];
var REAUTH_PATTERNS = [
  /jwt expired/i,
  /invalid jwt/i,
  /invalid token/i,
  /token.*expired/i,
  /not authenticated/i,
  /unauthenticated/i,
  /refresh token/i,
  /oauth/i
];
function classifyRecoveryError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/rate.?limit|too many requests|\b429\b/i.test(message)) return "rate_limited";
  if (/forbidden|permission denied|\b403\b/i.test(message)) return "forbidden";
  if (REAUTH_PATTERNS.some((pattern) => pattern.test(message))) return "reauth_required";
  if (TRANSIENT_PATTERNS.some((pattern) => pattern.test(message))) return "transient";
  return "permanent";
}
async function withRecovery(operation, options = {}) {
  const attempts = Math.max(1, Math.min(options.attempts ?? 3, 5));
  const baseDelayMs = Math.max(50, options.baseDelayMs ?? 250);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return { value: await operation(), attempts: attempt };
    } catch (error) {
      lastError = error;
      const classification = classifyRecoveryError(error);
      if (classification !== "transient" && classification !== "rate_limited") throw error;
      if (attempt === attempts) break;
      const jitter = Math.floor(Math.random() * 100);
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1) + jitter));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "recovery_failed"));
}

// src/lib/mcp/tools/control/connection-health.ts
var connection_health_default = defineTool27({
  name: "ctrl_connection_health",
  title: "Control connection health",
  description: "Verify StreamVista Control authentication and database reachability. Automatically retries transient failures and reports when user reauthorization is genuinely required.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated?.() || !ctx.getUserId()) {
      return err("reauth_required", "Reconnect StreamVista Control and approve sign-in.");
    }
    try {
      const recovered = await withRecovery(async () => {
        const denied = await authorize(ctx, "ctrl_connection_health", {}, { category: "connection_health" });
        if (denied) {
          const text = denied.content?.[0]?.text ?? "authorization_failed";
          throw new Error(text);
        }
        const sb = userClient5(ctx);
        const { data, error } = await withTimeout(
          sb.from("user_roles").select("role").eq("user_id", ctx.getUserId()).limit(10),
          "connection_health"
        );
        if (error) throw new Error(error.message);
        return data ?? [];
      });
      return ok2(
        {
          connected: true,
          authenticated: true,
          database_reachable: true,
          attempts: recovered.attempts,
          recovered_automatically: recovered.attempts > 1,
          user_id: ctx.getUserId(),
          client_id: ctx.getClientId?.() ?? null,
          checked_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        recovered.attempts > 1 ? `StreamVista Control recovered automatically after ${recovered.attempts} attempts.` : "StreamVista Control connection is healthy."
      );
    } catch (error) {
      const classification = classifyRecoveryError(error);
      const message = error instanceof Error ? error.message : String(error);
      if (classification === "reauth_required") {
        return err("reauth_required", "The OAuth session is expired or invalid. User approval is required once; it cannot be bypassed.");
      }
      if (classification === "forbidden") {
        return err("forbidden", "Connected account does not have StreamVista Control permission.");
      }
      if (classification === "rate_limited") {
        return err("temporarily_unavailable", "Automatic retries were exhausted because the service is rate-limited.");
      }
      return err("connection_unhealthy", message.replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]"));
    }
  }
});

// src/lib/mcp/tools/control/get-workspace-status.ts
import { defineTool as defineTool28 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z20 } from "npm:zod@^3.25.76";
var get_workspace_status_default = defineTool28({
  name: "get_workspace_status",
  title: "Workspace status",
  description: "High-level counts across the workspace: creators, active titles, running ingest jobs, failed emails.",
  inputSchema: { workspace_id: z20.string().uuid().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "get_workspace_status", input);
    if (denied) return denied;
    const sb = userClient5(ctx);
    const q = (t, filter) => {
      let b = sb.from(t).select("*", { count: "exact", head: true });
      if (input.workspace_id && filter) b = filter(b);
      return withTimeout(b, `count:${t}`);
    };
    const [creators, titles, ingest, failedEmails, failedUploads] = await Promise.all([
      q("entity_profiles"),
      q("content_titles"),
      q("ingest_jobs"),
      q("email_send_log", (b) => b.eq("status", "failed")),
      q("ingest_job_items", (b) => b.eq("status", "failed"))
    ]);
    const structured = {
      workspace_id: input.workspace_id ?? null,
      counts: {
        entity_profiles: creators.count ?? 0,
        content_titles: titles.count ?? 0,
        ingest_jobs: ingest.count ?? 0,
        failed_emails: failedEmails.count ?? 0,
        failed_uploads: failedUploads.count ?? 0
      }
    };
    return ok2(structured, `Workspace status \u2014 ${JSON.stringify(structured.counts)}`);
  }
});

// src/lib/mcp/tools/control/get-today-activity.ts
import { defineTool as defineTool29 } from "npm:@lovable.dev/mcp-js@0.20.0";
var get_today_activity_default = defineTool29({
  name: "get_today_activity",
  title: "Today's activity",
  description: "Counts of uploads, signups, payments, and errors in the last 24 hours.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const denied = await authorize(ctx, "get_today_activity", {});
    if (denied) return denied;
    const sb = userClient5(ctx);
    const since = new Date(Date.now() - 24 * 3600 * 1e3).toISOString();
    const q = (t, col = "created_at", filter) => {
      let b = sb.from(t).select("*", { count: "exact", head: true }).gte(col, since);
      if (filter) b = filter(b);
      return withTimeout(b, `today:${t}`);
    };
    const [uploads, ingestFail, emailFail, payments, users] = await Promise.all([
      q("ingest_job_items"),
      q("ingest_job_items", "created_at", (b) => b.eq("status", "failed")),
      q("email_send_log", "created_at", (b) => b.eq("status", "failed")),
      q("billing_orders"),
      q("user_profiles")
    ]);
    const structured = {
      since,
      uploads_24h: uploads.count ?? 0,
      failed_uploads_24h: ingestFail.count ?? 0,
      failed_emails_24h: emailFail.count ?? 0,
      payments_24h: payments.count ?? 0,
      new_users_24h: users.count ?? 0
    };
    return ok2(structured, `Last 24h \u2014 ${JSON.stringify(structured)}`);
  }
});

// src/lib/mcp/tools/control/list-creators.ts
import { defineTool as defineTool30 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z21 } from "npm:zod@^3.25.76";
var list_creators_default = defineTool30({
  name: "list_creators",
  title: "List creators",
  description: "List creator entity profiles (public directory fields only \u2014 no contact PII).",
  inputSchema: {
    limit: z21.number().int().min(1).max(100).optional(),
    search: z21.string().max(120).optional()
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "list_creators", input);
    if (denied) return denied;
    const sb = userClient5(ctx);
    let q = sb.from("entity_profiles").select("id, display_name, kind, verification_status, created_at").eq("kind", "creator").order("created_at", { ascending: false }).limit(clampLimit(input.limit));
    if (input.search) q = q.ilike("display_name", `%${input.search}%`);
    const { data, error } = await withTimeout(q, "list_creators");
    if (error) {
      if (isSchemaMissingError(error)) {
        return unavailable({ creators: [], count: 0 }, `entity_profiles schema drift: ${error.message}`);
      }
      return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    }
    const rows = redactDeep(data ?? []);
    return ok2({ creators: rows, count: rows.length }, `Returned ${rows.length} creators`);
  }
});

// src/lib/mcp/tools/control/ctrl-list-titles.ts
import { defineTool as defineTool31 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z22 } from "npm:zod@^3.25.76";
var ctrl_list_titles_default = defineTool31({
  name: "ctrl_list_titles",
  title: "List titles (Control)",
  description: "List content titles across the platform for founder audit. Optional status filter.",
  inputSchema: {
    status: z22.string().max(40).optional(),
    limit: z22.number().int().min(1).max(100).optional()
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "ctrl_list_titles", input);
    if (denied) return denied;
    const sb = userClient5(ctx);
    let q = sb.from("content_titles").select("id, title, status, owner_user_id, created_at, updated_at").order("updated_at", { ascending: false }).limit(clampLimit(input.limit));
    if (input.status) q = q.eq("status", input.status);
    const { data, error } = await withTimeout(q, "ctrl_list_titles");
    if (error) return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    return ok2({ titles: data ?? [], count: (data ?? []).length }, `Returned ${(data ?? []).length} titles`);
  }
});

// src/lib/mcp/tools/control/list-uploads.ts
import { defineTool as defineTool32 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z23 } from "npm:zod@^3.25.76";
var list_uploads_default = defineTool32({
  name: "list_uploads",
  title: "List uploads",
  description: "Recent ingest job items with optional status filter.",
  inputSchema: {
    status: z23.enum(["queued", "processing", "succeeded", "failed"]).optional(),
    since: z23.string().datetime().optional(),
    limit: z23.number().int().min(1).max(100).optional()
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "list_uploads", input);
    if (denied) return denied;
    const sb = userClient5(ctx);
    let q = sb.from("ingest_job_items").select("id, job_id, status, file_name, mime_guess, size_bytes, created_at, updated_at").order("created_at", { ascending: false }).limit(clampLimit(input.limit));
    if (input.status) q = q.eq("status", input.status);
    if (input.since) q = q.gte("created_at", input.since);
    const { data, error } = await withTimeout(q, "list_uploads");
    if (error) return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    return ok2({ uploads: data ?? [], count: (data ?? []).length }, `Returned ${(data ?? []).length} uploads`);
  }
});

// src/lib/mcp/tools/control/list-failed-uploads.ts
import { defineTool as defineTool33 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z24 } from "npm:zod@^3.25.76";
var list_failed_uploads_default = defineTool33({
  name: "list_failed_uploads",
  title: "List failed uploads",
  description: "Failed ingest job items with error reasons (redacted).",
  inputSchema: { limit: z24.number().int().min(1).max(100).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "list_failed_uploads", input);
    if (denied) return denied;
    const sb = userClient5(ctx);
    const { data, error } = await withTimeout(
      sb.from("ingest_job_items").select("id, job_id, file_name, mime_guess, size_bytes, error_message, metadata, created_at, updated_at").eq("status", "failed").order("updated_at", { ascending: false }).limit(clampLimit(input.limit)),
      "list_failed_uploads"
    );
    if (error) {
      if (isSchemaMissingError(error)) {
        return unavailable({ failed_uploads: [], count: 0 }, `ingest_job_items schema drift: ${error.message}`);
      }
      return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    }
    const rows = redactDeep(data ?? []);
    return ok2({ failed_uploads: rows, count: rows.length }, `Returned ${rows.length} failed uploads`);
  }
});

// src/lib/mcp/tools/control/ctrl-list-failed-uploads.ts
import { defineTool as defineTool34 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z25 } from "npm:zod@^3.25.76";
var ctrl_list_failed_uploads_default = defineTool34({
  name: "ctrl_list_failed_uploads",
  title: "List failed uploads (Control)",
  description: "Platform-wide list of failed ingest_job_items across all workspaces for founder audit. Optional job_id filter.",
  inputSchema: {
    job_id: z25.string().uuid().optional(),
    limit: z25.number().int().min(1).max(200).optional()
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "ctrl_list_failed_uploads", input);
    if (denied) return denied;
    const sb = userClient5(ctx);
    const limit = Math.max(1, Math.min(Math.floor(input.limit ?? 50), 200));
    let q = sb.from("ingest_job_items").select(
      "id, job_id, file_name, size_bytes, status, error_message, updated_at, ingest_jobs!inner(workspace_id, project_id)"
    ).eq("status", "failed").order("updated_at", { ascending: false }).limit(limit);
    if (input.job_id) q = q.eq("job_id", input.job_id);
    const { data, error } = await withTimeout(q, "ctrl_list_failed_uploads");
    if (error) {
      if (isSchemaMissingError(error)) {
        return unavailable(
          { failed_uploads: [], count: 0 },
          `ingest_job_items schema drift: ${error.message}`
        );
      }
      return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    }
    const rows = (data ?? []).map((r) => {
      const parent = r.ingest_jobs ?? {};
      return {
        id: r.id,
        job_id: r.job_id,
        file_name: r.file_name,
        size_bytes: r.size_bytes,
        status: r.status,
        error_message: r.error_message,
        updated_at: r.updated_at,
        workspace_id: parent.workspace_id ?? null,
        project_id: parent.project_id ?? null
      };
    });
    const redacted = redactDeep(rows);
    return ok2(
      { failed_uploads: redacted, count: redacted.length },
      `Returned ${redacted.length} failed uploads platform-wide`
    );
  }
});

// src/lib/mcp/tools/control/list-failed-emails.ts
import { defineTool as defineTool35 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z26 } from "npm:zod@^3.25.76";
var list_failed_emails_default = defineTool35({
  name: "list_failed_emails",
  title: "List failed emails",
  description: "Failed rows from email_send_log with redacted error reasons.",
  inputSchema: { limit: z26.number().int().min(1).max(100).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "list_failed_emails", input);
    if (denied) return denied;
    const sb = userClient5(ctx);
    const { data, error } = await withTimeout(
      sb.from("email_send_log").select("id, message_id, template_name, status, error_message, created_at").in("status", ["failed", "failed_permanent", "dlq", "bounced"]).order("created_at", { ascending: false }).limit(clampLimit(input.limit)),
      "list_failed_emails"
    );
    if (error) {
      if (isSchemaMissingError(error)) {
        return unavailable({ failed_emails: [], count: 0 }, `email_send_log schema drift: ${error.message}`);
      }
      return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    }
    const rows = redactDeep(data ?? []);
    return ok2({ failed_emails: rows, count: rows.length }, `Returned ${rows.length} failed emails`);
  }
});

// src/lib/mcp/tools/control/list-payments.ts
import { defineTool as defineTool36 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z27 } from "npm:zod@^3.25.76";
var list_payments_default = defineTool36({
  name: "list_payments",
  title: "List payments",
  description: "Billing orders / payments summary (no PAN, no card data, no UPI IDs).",
  inputSchema: {
    since: z27.string().datetime().optional(),
    status: z27.string().max(40).optional(),
    limit: z27.number().int().min(1).max(100).optional()
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "list_payments", input);
    if (denied) return denied;
    const sb = userClient5(ctx);
    let q = sb.from("billing_orders").select("id, status, amount, currency, product_code, created_at, updated_at").order("created_at", { ascending: false }).limit(clampLimit(input.limit));
    if (input.since) q = q.gte("created_at", input.since);
    if (input.status) q = q.eq("status", input.status);
    const { data, error } = await withTimeout(q, "list_payments");
    if (error) return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    return ok2({ payments: data ?? [], count: (data ?? []).length }, `Returned ${(data ?? []).length} payments`);
  }
});

// src/lib/mcp/tools/control/list-invoices.ts
import { defineTool as defineTool37 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z28 } from "npm:zod@^3.25.76";
var list_invoices_default = defineTool37({
  name: "list_invoices",
  title: "List invoices",
  description: "Invoice summary rows for founder audit.",
  inputSchema: {
    since: z28.string().datetime().optional(),
    limit: z28.number().int().min(1).max(100).optional()
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "list_invoices", input);
    if (denied) return denied;
    const sb = userClient5(ctx);
    let q = sb.from("invoices").select("id, invoice_number, status, total_amount, currency, issue_date, due_date, created_at").order("created_at", { ascending: false }).limit(clampLimit(input.limit));
    if (input.since) q = q.gte("created_at", input.since);
    const { data, error } = await withTimeout(q, "list_invoices");
    if (error) return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    return ok2({ invoices: data ?? [], count: (data ?? []).length }, `Returned ${(data ?? []).length} invoices`);
  }
});

// src/lib/mcp/tools/control/list-buyers.ts
import { defineTool as defineTool38 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z29 } from "npm:zod@^3.25.76";
var list_buyers_default = defineTool38({
  name: "list_buyers",
  title: "List buyers",
  description: "Buyer entity profiles (public directory columns only \u2014 contact PII redacted).",
  inputSchema: {
    limit: z29.number().int().min(1).max(100).optional(),
    search: z29.string().max(120).optional()
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "list_buyers", input);
    if (denied) return denied;
    const sb = userClient5(ctx);
    let q = sb.from("entity_profiles").select("id, display_name, kind, verification_status, created_at").eq("kind", "buyer").order("created_at", { ascending: false }).limit(clampLimit(input.limit));
    if (input.search) q = q.ilike("display_name", `%${input.search}%`);
    const { data, error } = await withTimeout(q, "list_buyers");
    if (error) {
      if (isSchemaMissingError(error)) {
        return unavailable({ buyers: [], count: 0 }, `entity_profiles schema drift: ${error.message}`);
      }
      return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    }
    const rows = redactDeep(data ?? []);
    return ok2({ buyers: rows, count: rows.length }, `Returned ${rows.length} buyers`);
  }
});

// src/lib/mcp/tools/control/get-storage-usage.ts
import { defineTool as defineTool39 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z30 } from "npm:zod@^3.25.76";
var get_storage_usage_default = defineTool39({
  name: "get_storage_usage",
  title: "Storage usage",
  description: "Workspace storage allocation vs usage.",
  inputSchema: {
    workspace_id: z30.string().uuid().optional(),
    limit: z30.number().int().min(1).max(100).optional()
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "get_storage_usage", input);
    if (denied) return denied;
    const sb = userClient5(ctx);
    const [ent, use] = await Promise.all([
      withTimeout(
        input.workspace_id ? sb.from("workspace_storage_entitlements").select("*").eq("workspace_id", input.workspace_id) : sb.from("workspace_storage_entitlements").select("*").limit(clampLimit(input.limit)),
        "entitlements"
      ),
      withTimeout(
        input.workspace_id ? sb.from("workspace_storage_usage").select("*").eq("workspace_id", input.workspace_id) : sb.from("workspace_storage_usage").select("*").limit(clampLimit(input.limit)),
        "usage"
      )
    ]);
    return ok2(
      { entitlements: ent.data ?? [], usage: use.data ?? [] },
      `Storage entitlements: ${(ent.data ?? []).length}, usage rows: ${(use.data ?? []).length}`
    );
  }
});

// src/lib/mcp/tools/control/get-database-schema.ts
import { defineTool as defineTool40 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z31 } from "npm:zod@^3.25.76";
var get_database_schema_default = defineTool40({
  name: "get_database_schema",
  title: "Database schema (public)",
  description: "Allowlisted read-only view of tables/columns in the public schema. Founder / platform_owner / super_admin only.",
  inputSchema: { table: z31.string().max(80).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "get_database_schema", input);
    if (denied) return denied;
    const sb = userClient5(ctx);
    const { data, error } = await withTimeout(sb.rpc("mcp_get_public_schema"), "schema");
    if (error) return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    const rows = data ?? [];
    const filtered = input.table ? rows.filter((r) => r.table_name === input.table) : rows;
    const byTable = {};
    for (const r of filtered) (byTable[r.table_name] ??= []).push({
      column: r.column_name,
      type: r.data_type,
      nullable: r.is_nullable === "YES"
    });
    return ok2(
      { tables: Object.keys(byTable).length, schema: byTable },
      `${Object.keys(byTable).length} tables, ${filtered.length} columns${input.table ? ` (filtered by ${input.table})` : ""}`
    );
  }
});

// src/lib/mcp/tools/control/get-security-advisors.ts
import { defineTool as defineTool41 } from "npm:@lovable.dev/mcp-js@0.20.0";
var get_security_advisors_default = defineTool41({
  name: "get_security_advisors",
  title: "Security advisors (DB snapshot)",
  description: "DB-side security snapshot: which public tables have RLS enabled. Founder / platform_owner / super_admin only.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const denied = await authorize(ctx, "get_security_advisors", {});
    if (denied) return denied;
    const sb = userClient5(ctx);
    const { data, error } = await withTimeout(sb.rpc("mcp_get_security_advisors"), "advisors");
    if (error) return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    return ok2({ advisors: data ?? {} }, "Security advisors \u2014 DB snapshot");
  }
});

// src/lib/mcp/tools/control/get-edge-function-logs.ts
import { defineTool as defineTool42 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z32 } from "npm:zod@^3.25.76";
var get_edge_function_logs_default = defineTool42({
  name: "get_edge_function_logs",
  title: "Edge Function logs",
  description: "Recent log lines for a Lovable Cloud edge function via the Supabase Management API (read-only PAT, bounded window).",
  inputSchema: {
    function_name: z32.string().min(1).max(80),
    since: z32.string().datetime().optional(),
    level: z32.enum(["info", "warn", "error"]).optional(),
    limit: z32.number().int().min(1).max(200).optional()
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "get_edge_function_logs", input);
    if (denied) return denied;
    const token = process.env.MGMT_ACCESS_TOKEN ?? process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN;
    const ref = process.env.MGMT_PROJECT_REF ?? process.env.SUPABASE_PROJECT_REF ?? process.env.VITE_SUPABASE_PROJECT_ID;
    if (!token || !ref) {
      return err(
        "not_configured",
        "MGMT_ACCESS_TOKEN and MGMT_PROJECT_REF must be set (read-scoped PAT, server-side only)."
      );
    }
    const windowDays = Number(process.env.MCP_LOGS_WINDOW_DAYS ?? 7);
    const minSince = new Date(Date.now() - windowDays * 24 * 3600 * 1e3);
    const since = input.since ? new Date(input.since) : minSince;
    const effectiveSince = since < minSince ? minSince : since;
    const limit = Math.min(input.limit ?? 100, MAX_LOG_ROWS);
    const sql = `select id, timestamp, event_message, metadata
                 from function_logs
                 where function_id = '${input.function_name.replace(/'/g, "''")}'
                   and timestamp >= '${effectiveSince.toISOString()}'
                 order by timestamp desc
                 limit ${limit}`;
    const url = `https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}`;
    try {
      const res = await withTimeout(
        fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }),
        "mgmt_api"
      );
      if (!res.ok) {
        const body = await res.text();
        return err("mgmt_api_error", `HTTP ${res.status}: ${redact(body).slice(0, 500)}`);
      }
      const json = await res.json();
      const rows = Array.isArray(json) ? json : json.result ?? [];
      let out = redactDeep(rows);
      if (input.level) out = out.filter((r) => JSON.stringify(r).toLowerCase().includes(`"level":"${input.level}"`));
      return ok2(
        { function: input.function_name, since: effectiveSince.toISOString(), count: out.length, logs: out },
        `Returned ${out.length} log rows for ${input.function_name}`
      );
    } catch (e) {
      return err("mgmt_api_failed", redact(String(e?.message ?? e)));
    }
  }
});

// src/lib/mcp/tools/control/search-workspace-records.ts
import { defineTool as defineTool43 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z33 } from "npm:zod@^3.25.76";
var TABLE_ALLOWLIST = {
  content_titles: { columns: ["id", "title", "status", "created_at", "updated_at"], textCol: "title" },
  entity_profiles: { columns: ["id", "display_name", "kind", "verification_status", "created_at"], textCol: "display_name" },
  ingest_jobs: { columns: ["id", "status", "source", "created_at", "updated_at"] },
  billing_orders: { columns: ["id", "status", "amount", "currency", "product_code", "created_at"] },
  invoices: { columns: ["id", "invoice_number", "status", "total_amount", "currency", "issue_date", "created_at"] }
};
var OP = z33.enum(["eq", "neq", "gt", "gte", "lt", "lte", "ilike"]);
var search_workspace_records_default = defineTool43({
  name: "search_workspace_records",
  title: "Search workspace records",
  description: "Typed, parameterized search across an allowlisted set of tables. Never runs raw SQL.",
  inputSchema: {
    table: z33.string(),
    filters: z33.array(z33.object({ column: z33.string(), op: OP, value: z33.union([z33.string(), z33.number(), z33.boolean(), z33.null()]) })).max(6).optional(),
    text: z33.string().max(200).optional(),
    limit: z33.number().int().min(1).max(50).optional()
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "search_workspace_records", input);
    if (denied) return denied;
    const spec = TABLE_ALLOWLIST[input.table];
    if (!spec) return err("table_not_allowlisted", `Allowed: ${Object.keys(TABLE_ALLOWLIST).join(", ")}`);
    const sb = userClient5(ctx);
    let q = sb.from(input.table).select(spec.columns.join(",")).limit(clampLimit(input.limit, 50));
    for (const f of input.filters ?? []) {
      if (!spec.columns.includes(f.column)) return err("column_not_allowlisted", f.column);
      q = q[f.op](f.column, f.value);
    }
    if (input.text && spec.textCol) q = q.ilike(spec.textCol, `%${input.text}%`);
    const { data, error } = await withTimeout(q, `search:${input.table}`);
    if (error) return err("db_error", error.message);
    const rows = redactDeep(data ?? []);
    return ok2({ table: input.table, rows, count: rows.length }, `Returned ${rows.length} rows from ${input.table}`);
  }
});

// src/lib/mcp/tools/control/find-duplicate-titles.ts
import { defineTool as defineTool44 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z34 } from "npm:zod@^3.25.76";
var find_duplicate_titles_default = defineTool44({
  name: "ctrl_find_duplicate_titles",
  title: "Find duplicate draft titles (Control)",
  description: "Detect likely duplicate/junk rows in content_titles limited to drafts that were never submitted. Groups by (owner, normalized title) with count > 1, and flags burst-insert bursts within 5 seconds. Read-only.",
  inputSchema: {
    limit: z34.number().int().min(1).max(500).optional()
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "ctrl_find_duplicate_titles", input);
    if (denied) return denied;
    const sb = userClient5(ctx);
    const { data, error } = await withTimeout(
      sb.rpc("mcp_find_duplicate_draft_titles", { _limit: input.limit ?? 100 }),
      "ctrl_find_duplicate_titles"
    );
    if (error)
      return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    const groups = data ?? [];
    return ok2(
      { duplicate_groups: groups },
      `Found ${groups.length} duplicate draft group(s).`
    );
  }
});

// src/lib/mcp/tools/control/delete-draft-titles.ts
import { defineTool as defineTool45 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z35 } from "npm:zod@^3.25.76";
var delete_draft_titles_default = defineTool45({
  name: "ctrl_delete_draft_titles",
  title: "Delete draft titles by ID (Control)",
  description: "Delete specific content_titles rows by explicit ID. Server-side guard: only rows with status='draft' AND submitted_at/approved_at/published_at all NULL are removed; anything else is returned under skipped_not_eligible. Max 50 IDs per call. Respects the MCP kill switch. Writes one audit row per deletion.",
  inputSchema: {
    title_ids: z35.array(z35.string().uuid()).min(1).max(50)
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "ctrl_delete_draft_titles", input, { writes: true });
    if (denied) return denied;
    const sb = userClient5(ctx);
    const { data, error } = await withTimeout(
      sb.rpc("mcp_delete_draft_titles", { _ids: input.title_ids }),
      "ctrl_delete_draft_titles"
    );
    if (error)
      return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    const result = data ?? {};
    const deleted = result.deleted ?? [];
    const skipped = result.skipped_not_eligible ?? [];
    return ok2(
      { deleted, skipped_not_eligible: skipped },
      `Deleted ${deleted.length} title(s); skipped ${skipped.length}.`
    );
  }
});

// src/lib/mcp/tools/control/import-legacy-titles.ts
import { defineTool as defineTool46 } from "npm:@lovable.dev/mcp-js@0.20.0";
import { z as z36 } from "npm:zod@^3.25.76";
var RecordSchema = z36.object({
  legacy_ref: z36.string().min(1).max(200),
  title: z36.string().min(1).max(500),
  synopsis: z36.string().max(2e4).optional(),
  language: z36.string().max(80).optional(),
  genre: z36.string().max(120).optional(),
  duration_minutes: z36.number().int().min(0).max(1e5).optional(),
  owner_user_id: z36.string().uuid()
});
var import_legacy_titles_default = defineTool46({
  name: "ctrl_import_legacy_titles",
  title: "Import legacy titles (Control)",
  description: "Idempotent import of legacy films into content_titles. Upserts on legacy_ref: existing rows are updated, new rows insert as status='draft'. Never auto-submits/approves/publishes. Max 50 records per call. Respects the MCP kill switch. Writes one audit row per insert/update.",
  inputSchema: {
    records: z36.array(RecordSchema).min(1).max(50)
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "ctrl_import_legacy_titles", { count: input.records.length }, { writes: true });
    if (denied) return denied;
    const sb = userClient5(ctx);
    const { data, error } = await withTimeout(
      sb.rpc("mcp_import_legacy_titles", { _records: input.records }),
      "ctrl_import_legacy_titles"
    );
    if (error)
      return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    const result = data ?? {};
    const inserted = result.inserted ?? [];
    const updated = result.updated ?? [];
    const skipped = result.skipped_invalid ?? [];
    return ok2(
      { inserted, updated, skipped_invalid: skipped },
      `Inserted ${inserted.length}, updated ${updated.length}, skipped ${skipped.length}.`
    );
  }
});

// src/lib/mcp/index.ts
var projectRef = "hllgmkfqgeuqlmpcirvn";
var mcp_default = defineMcp({
  name: "streamvista-mcp",
  title: "StreamVista Cloud X",
  version: "0.3.2",
  instructions: "Tools for a signed-in StreamVista Cloud X user. When StreamVista Control appears unavailable, call `ctrl_connection_health` first. It retries transient connection, timeout, gateway, and rate-limit failures automatically and returns `reauth_required` only when OAuth user approval is genuinely necessary. Creator Workspace tools (Creator accounts only): `creator_my_workspace`, `creator_list_titles`, `creator_open_title`, `creator_submission_status`, `creator_rights_status`, `creator_list_assets`, `creator_review_notes`, `creator_distribution_status`, `creator_storage_usage`, `creator_notifications`, `creator_search_my_titles`. Studio Workspace tools (Studio accounts only): `list_productions`, `open_production`, `show_todays_work`, `show_upload_progress`, `show_storage_usage`, `show_recent_activity`, `show_team`, `show_deliveries`, `show_billing`, `search_files`. Legacy read tools kept for compatibility: `list_titles`, `get_title`, `list_ingest_jobs`. Tools that are not available to the caller's role return a friendly access message instead of data. Use `whoami` to verify identity. All data is scoped to the signed-in user via RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated"
  }),
  tools: [
    whoami_default,
    // Creator Workspace
    creator_my_workspace_default,
    creator_list_titles_default,
    creator_open_title_default,
    creator_submission_status_default,
    creator_rights_status_default,
    creator_list_assets_default,
    creator_review_notes_default,
    creator_distribution_status_default,
    creator_storage_usage_default,
    creator_notifications_default,
    creator_search_my_titles_default,
    // Studio Workspace
    list_productions_default,
    open_production_default,
    show_todays_work_default,
    show_upload_progress_default,
    show_storage_usage_default,
    show_recent_activity_default,
    show_team_default,
    show_deliveries_default,
    show_billing_default,
    search_files_default,
    // Legacy read tools
    list_titles_default,
    get_title_default,
    list_ingest_jobs_default,
    // Phase 1 Control Server — founder / platform_owner / super_admin only.
    whoami_control_default,
    connection_health_default,
    get_workspace_status_default,
    get_today_activity_default,
    list_creators_default,
    ctrl_list_titles_default,
    list_uploads_default,
    list_failed_uploads_default,
    ctrl_list_failed_uploads_default,
    list_failed_emails_default,
    list_payments_default,
    list_invoices_default,
    list_buyers_default,
    get_storage_usage_default,
    get_database_schema_default,
    get_security_advisors_default,
    get_edge_function_logs_default,
    search_workspace_records_default,
    // Cleanup + legacy import (write-guarded by kill switch)
    find_duplicate_titles_default,
    delete_draft_titles_default,
    import_legacy_titles_default
  ]
});

// lovable-mcp-supabase-entry.ts
import { createSupabaseHandler } from "npm:@lovable.dev/mcp-js@0.20.0/stacks/supabase";
Deno.serve(createSupabaseHandler(mcp_default, { functionName: "mcp" }));
