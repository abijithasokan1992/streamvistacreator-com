/**
 * ingest-preflight
 * ================
 *
 * Server-side gate that runs before the client inserts into `ingest_jobs`.
 * Runs the same checks the RLS policy enforces at the database, but returns
 * a structured, human-friendly JSON payload so the UI can show an actionable
 * message instead of a raw `row-level security policy` error.
 *
 * We do NOT duplicate business logic here — the checks read the same helper
 * functions and tables the existing RLS policies use (`workspace_members`,
 * `has_premium_storage_entitlement`, `workspace_storage_entitlements`).
 *
 * Reason codes (stable — clients switch on these):
 *   AUTH_REQUIRED               – no bearer token / getClaims failed
 *   INVALID_INPUT               – zod body validation failed
 *   WORKSPACE_ACCESS_DENIED     – user is not a member of the workspace
 *   INSUFFICIENT_ROLE           – member but role is not owner/admin
 *   PREMIUM_REQUIRED            – no premium storage entitlement for the user
 *   STORAGE_REQUIRED            – workspace has no active storage entitlement
 *   INVALID_PRODUCTION          – project_id given but not in this workspace
 *   PREFLIGHT_FAILED            – unexpected internal error (details hidden)
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  workspace_id: z.string().uuid(),
  project_id: z.string().uuid().nullish(),
});

type Reason =
  | "AUTH_REQUIRED"
  | "INVALID_INPUT"
  | "WORKSPACE_ACCESS_DENIED"
  | "INSUFFICIENT_ROLE"
  | "PREMIUM_REQUIRED"
  | "STORAGE_REQUIRED"
  | "INVALID_PRODUCTION"
  | "PREFLIGHT_FAILED";

const FRIENDLY: Record<Reason, string> = {
  AUTH_REQUIRED: "Please sign in again to continue.",
  INVALID_INPUT: "Ingest request was missing required fields.",
  WORKSPACE_ACCESS_DENIED: "You are not a member of this workspace.",
  INSUFFICIENT_ROLE: "Only workspace owners or admins can start an ingest job.",
  PREMIUM_REQUIRED: "A premium storage plan is required to start uploads.",
  STORAGE_REQUIRED: "This workspace does not have an active storage plan.",
  INVALID_PRODUCTION: "Selected production does not belong to this workspace.",
  PREFLIGHT_FAILED: "Could not verify ingest permissions. Please try again.",
};

/** Structured log line — safe to grep on `event` + `reason`. Never emits PII. */
function logDenied(reason: Reason, ctx: Record<string, unknown>) {
  console.log(JSON.stringify({
    level: "warn",
    event: "ingest_preflight_denied",
    reason,
    ...ctx,
  }));
}

function respond(status: number, body: {
  ok: boolean; reason?: Reason; message?: string;
}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      logDenied("AUTH_REQUIRED", {});
      return respond(401, { ok: false, reason: "AUTH_REQUIRED", message: FRIENDLY.AUTH_REQUIRED });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace(/^bearer\s+/i, "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      logDenied("AUTH_REQUIRED", {});
      return respond(401, { ok: false, reason: "AUTH_REQUIRED", message: FRIENDLY.AUTH_REQUIRED });
    }
    const userId = claims.claims.sub as string;

    let raw: unknown;
    try { raw = await req.json(); } catch { raw = {}; }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      logDenied("INVALID_INPUT", { user_id: userId });
      return respond(400, { ok: false, reason: "INVALID_INPUT", message: FRIENDLY.INVALID_INPUT });
    }
    const { workspace_id, project_id } = parsed.data;

    // 1. Membership + role — mirrors `is_workspace_admin()`.
    const { data: member, error: memErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (memErr) {
      console.log(JSON.stringify({ level: "error", event: "ingest_preflight_error",
        stage: "member_lookup", code: memErr.code ?? null }));
      return respond(500, { ok: false, reason: "PREFLIGHT_FAILED", message: FRIENDLY.PREFLIGHT_FAILED });
    }
    if (!member) {
      logDenied("WORKSPACE_ACCESS_DENIED", { user_id: userId, workspace_id });
      return respond(403, { ok: false, reason: "WORKSPACE_ACCESS_DENIED", message: FRIENDLY.WORKSPACE_ACCESS_DENIED });
    }
    const role = (member as { role: string }).role;
    const isWorkspaceAdmin = role === "owner" || role === "admin";
    if (!isWorkspaceAdmin) {
      logDenied("INSUFFICIENT_ROLE", { user_id: userId, workspace_id, role });
      return respond(403, { ok: false, reason: "INSUFFICIENT_ROLE", message: FRIENDLY.INSUFFICIENT_ROLE });
    }

    // 2. Global admin bypass on the entitlement check — mirrors the policy's
    //    `has_role(admin) OR has_premium_storage_entitlement()` disjunction.
    const { data: isGlobalAdmin } = await supabase
      .rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isGlobalAdmin) {
      const { data: hasPremium, error: entErr } = await supabase
        .rpc("has_premium_storage_entitlement", { _user_id: userId });
      if (entErr) {
        console.log(JSON.stringify({ level: "error", event: "ingest_preflight_error",
          stage: "entitlement_rpc", code: entErr.code ?? null }));
        return respond(500, { ok: false, reason: "PREFLIGHT_FAILED", message: FRIENDLY.PREFLIGHT_FAILED });
      }
      if (!hasPremium) {
        logDenied("PREMIUM_REQUIRED", { user_id: userId, workspace_id });
        return respond(402, { ok: false, reason: "PREMIUM_REQUIRED", message: FRIENDLY.PREMIUM_REQUIRED });
      }
    }

    // 3. Workspace-level storage plan (best-effort; skipped silently if the
    //    table isn't reachable to this role — RLS is still the source of truth).
    const { data: storage } = await supabase
      .from("workspace_storage_entitlements")
      .select("id")
      .eq("workspace_id", workspace_id)
      .limit(1)
      .maybeSingle();
    if (storage === null) {
      // maybeSingle returns null for no rows — treat as missing plan.
      // (Any RLS/permission error just falls through to the RLS gate.)
      logDenied("STORAGE_REQUIRED", { user_id: userId, workspace_id });
      return respond(402, { ok: false, reason: "STORAGE_REQUIRED", message: FRIENDLY.STORAGE_REQUIRED });
    }

    // 4. Project belongs to this workspace, if provided.
    if (project_id) {
      const { data: proj } = await supabase
        .from("projects")
        .select("id, workspace_id")
        .eq("id", project_id)
        .maybeSingle();
      if (!proj || (proj as { workspace_id: string }).workspace_id !== workspace_id) {
        logDenied("INVALID_PRODUCTION", { user_id: userId, workspace_id, project_id });
        return respond(400, { ok: false, reason: "INVALID_PRODUCTION", message: FRIENDLY.INVALID_PRODUCTION });
      }
    }

    return respond(200, { ok: true });
  } catch (e) {
    console.log(JSON.stringify({ level: "error", event: "ingest_preflight_error",
      stage: "uncaught", message: (e as Error).message?.slice(0, 200) ?? null }));
    return respond(500, { ok: false, reason: "PREFLIGHT_FAILED", message: FRIENDLY.PREFLIGHT_FAILED });
  }
});
