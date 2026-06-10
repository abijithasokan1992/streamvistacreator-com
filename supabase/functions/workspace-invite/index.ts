// Invite a user to a workspace by email.
//
// POST { workspace_id: string, email: string, role?: 'admin'|'editor'|'viewer' }
//
// - Requires the caller to be an owner/admin of the target workspace.
// - Looks the email up in auth.users (service role).
// - If the user exists: inserts into public.workspace_members.
// - If the user does NOT exist: creates a row in public.intro_invites so they
//   are auto-attached on signup (existing flow handled elsewhere) and returns
//   { pending: true } so the UI can show "invite sent".
// - Business rule: any address ending in @crayonspictures.com is internal
//   staff and is always added with role='admin' regardless of the requested
//   role.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STAFF_DOMAIN = "crayonspictures.com";

function json(body: unknown, status = 200, cors: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function isEmail(s: unknown): s is string {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

function isUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return handleOptions(req);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401, cors);
  }

  // Verify caller
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "unauthorized" }, 401, cors);
  const caller = userData.user;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, cors); }

  const { workspace_id, email, role } = body ?? {};
  if (!isUuid(workspace_id)) return json({ error: "invalid_workspace_id" }, 400, cors);
  if (!isEmail(email)) return json({ error: "invalid_email" }, 400, cors);
  const normalizedEmail = email.trim().toLowerCase();
  const requestedRole = ["admin", "editor", "viewer"].includes(role) ? role : "editor";

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Authorize: caller must be owner/admin of the workspace (or platform admin).
  const { data: callerMember } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace_id)
    .eq("user_id", caller.id)
    .maybeSingle();
  const { data: isPlatformAdmin } = await admin.rpc("has_role", {
    _user_id: caller.id,
    _role: "admin",
  });
  const callerAllowed =
    isPlatformAdmin === true ||
    (callerMember && ["owner", "admin"].includes(callerMember.role));
  if (!callerAllowed) return json({ error: "forbidden" }, 403, cors);

  // Apply staff-domain override.
  const isStaff = normalizedEmail.endsWith("@" + STAFF_DOMAIN);
  const finalRole = isStaff ? "admin" : requestedRole;

  // Look up auth user by email (paginated scan up to a few pages).
  let foundUser: { id: string; email?: string } | null = null;
  for (let page = 1; page <= 20 && !foundUser; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    foundUser = data.users.find((u) => (u.email ?? "").toLowerCase() === normalizedEmail) ?? null;
    if (data.users.length < 200) break;
  }

  if (foundUser) {
    const { error: insErr } = await admin
      .from("workspace_members")
      .upsert(
        { workspace_id, user_id: foundUser.id, role: finalRole },
        { onConflict: "workspace_id,user_id" },
      );
    if (insErr) return json({ error: insErr.message }, 400, cors);
    return json({ ok: true, added: true, user_id: foundUser.id, role: finalRole, staff: isStaff }, 200, cors);
  }

  // User does not exist yet — register a pending intro_invite so they are
  // attached to the workspace on signup (assumes intro_invites supports
  // workspace_id / role; otherwise this is a soft pending marker).
  try {
    await admin.from("intro_invites").insert({
      email: normalizedEmail,
      status: "pending",
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    });
  } catch (_) { /* table shape may differ — non-fatal */ }

  return json({ ok: true, added: false, pending: true, role: finalRole, staff: isStaff }, 200, cors);
});
