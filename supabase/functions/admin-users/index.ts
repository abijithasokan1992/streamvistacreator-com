// Admin user management — service-role edge function.
// All mutating actions require an authenticated admin caller and write to admin_audit_log.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions, resolveSiteOrigin } from "../_shared/cors.ts";
import { loadOciConfig, deleteUserObjects } from "../_shared/oci.ts";
import {
  cancelRazorpaySubscriptionsForUser,
  cancelStripeSubscriptionsForUser,
} from "../_shared/billing-cancel.ts";

type Action =
  | "list"
  | "get"
  | "setRolesAndPlan"
  | "setSuspended"
  | "deleteUser"
  | "inviteAdmin"
  | "sendRecoveryToSelf"
  | "audit";

const VALID_ROLES = new Set([
  "admin",
  "executive_producer",
  "creator",
  "moderator",
  "client",
  "user",
]);

const ROLE_ORDER: Record<string, number> = {
  admin: 1,
  executive_producer: 2,
  creator: 3,
  moderator: 4,
  client: 5,
  user: 6,
};

function pickPrimary(roles: string[]): string | null {
  let best: string | null = null;
  let bestRank = 99;
  for (const r of roles) {
    const rank = ROLE_ORDER[r] ?? 99;
    if (rank < bestRank) { bestRank = rank; best = r; }
  }
  return best;
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return handleOptions(req);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // 1. Verify caller and admin role
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const callerId = userRes.user.id;
  const callerEmail = userRes.user.email ?? null;

  const admin = createClient(url, service, { auth: { persistSession: false } });

  const { data: isAdminRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();
  if (!isAdminRow) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: { action: Action; [k: string]: unknown } = { action: "list" };
  try { body = await req.json(); } catch { /* default */ }
  const action = body.action as Action;

  const writeAudit = async (target_user_id: string | null, target_email: string | null, name: string, details: unknown) => {
    await admin.from("admin_audit_log").insert({
      admin_user_id: callerId,
      admin_email: callerEmail,
      target_user_id,
      target_email,
      action: name,
      details: details ?? {},
    });
  };

  try {
    switch (action) {
      case "list": {
        const staffOnly = !!body.staffOnly;
        const search = String(body.search ?? "").trim().toLowerCase();

        const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const list = users?.users ?? [];

        const ids = list.map(u => u.id);
        const [{ data: profiles }, { data: rolesRows }] = await Promise.all([
          admin.from("user_profiles").select("user_id, display_name, plan_tier, is_suspended").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
          admin.from("user_roles").select("user_id, role").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        ]);

        const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
        const rolesMap = new Map<string, string[]>();
        for (const r of rolesRows ?? []) {
          const arr = rolesMap.get((r as any).user_id) ?? [];
          arr.push((r as any).role);
          rolesMap.set((r as any).user_id, arr);
        }

        let rows = list.map(u => {
          const roles = rolesMap.get(u.id) ?? [];
          const p = profileMap.get(u.id) as any;
          return {
            id: u.id,
            email: u.email,
            display_name: p?.display_name ?? u.user_metadata?.full_name ?? null,
            avatar_url: u.user_metadata?.avatar_url ?? null,
            roles,
            primary_role: pickPrimary(roles),
            plan_tier: p?.plan_tier ?? "free",
            is_suspended: !!p?.is_suspended,
            last_sign_in_at: u.last_sign_in_at,
            created_at: u.created_at,
          };
        });

        if (staffOnly) {
          rows = rows.filter(r => r.roles.some(x => ["admin", "executive_producer", "moderator"].includes(x)));
        }
        if (search) {
          rows = rows.filter(r =>
            (r.email ?? "").toLowerCase().includes(search) ||
            (r.display_name ?? "").toLowerCase().includes(search)
          );
        }
        rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
        return new Response(JSON.stringify({ users: rows }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      case "get": {
        const target = String(body.user_id ?? "");
        if (!target) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        const { data: u } = await admin.auth.admin.getUserById(target);
        const [{ data: profile }, { data: roles }, { data: audit }] = await Promise.all([
          admin.from("user_profiles").select("*").eq("user_id", target).maybeSingle(),
          admin.from("user_roles").select("role").eq("user_id", target),
          admin.from("admin_audit_log").select("*").eq("target_user_id", target).order("created_at", { ascending: false }).limit(20),
        ]);
        return new Response(JSON.stringify({
          user: u?.user ?? null,
          profile,
          roles: (roles ?? []).map((r: any) => r.role),
          audit: audit ?? [],
        }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      case "setRolesAndPlan": {
        const target = String(body.user_id ?? "");
        const nextRoles: string[] = Array.isArray(body.roles) ? body.roles.filter((r: string) => VALID_ROLES.has(r)) : [];
        const plan = String(body.plan_tier ?? "");
        if (!target) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        if (target === callerId && !nextRoles.includes("admin")) {
          return new Response(JSON.stringify({ error: "You cannot remove your own admin role" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        }

        await admin.from("user_roles").delete().eq("user_id", target);
        if (nextRoles.length) {
          await admin.from("user_roles").insert(nextRoles.map(r => ({ user_id: target, role: r })));
        }
        if (plan) {
          await admin.from("user_profiles").update({ plan_tier: plan, updated_at: new Date().toISOString() }).eq("user_id", target);
        }

        const { data: u } = await admin.auth.admin.getUserById(target);
        await writeAudit(target, u?.user?.email ?? null, "set_roles_and_plan", { roles: nextRoles, plan_tier: plan });
        return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      case "setSuspended": {
        const target = String(body.user_id ?? "");
        const suspended = !!body.suspended;
        if (!target) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        if (target === callerId) {
          return new Response(JSON.stringify({ error: "You cannot suspend yourself" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        }
        await admin.from("user_profiles").update({ is_suspended: suspended, updated_at: new Date().toISOString() }).eq("user_id", target);
        if (suspended) {
          // Revoke any active sessions so the suspension takes effect immediately.
          await admin.auth.admin.signOut(target).catch(() => {});
        }
        const { data: u } = await admin.auth.admin.getUserById(target);
        await writeAudit(target, u?.user?.email ?? null, suspended ? "suspend" : "unsuspend", {});
        return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      case "deleteUser": {
        const target = String(body.user_id ?? "");
        if (!target) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        if (target === callerId) {
          return new Response(JSON.stringify({ error: "You cannot delete yourself" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        }
        const { data: u } = await admin.auth.admin.getUserById(target);
        const targetEmail = u?.user?.email ?? null;

        // 1. Cancel billing FIRST so we stop charging the user even if a later
        //    step fails. Both helpers are best-effort and never throw.
        const razorpay = await cancelRazorpaySubscriptionsForUser(admin, target);
        const stripe = await cancelStripeSubscriptionsForUser(admin, target);

        // 2. Purge OCI Object Storage to free the storage quota.
        let storage: { deleted: number; failed: number; total: number; skipped?: string } =
          { deleted: 0, failed: 0, total: 0 };
        try {
          const oci = await loadOciConfig(admin);
          if (!oci) {
            storage = { ...storage, skipped: "oci_not_configured" };
          } else {
            storage = await deleteUserObjects(admin, oci, target);
          }
        } catch (e) {
          storage = { ...storage, skipped: `oci_error: ${(e as Error).message}` };
        }

        // 3. Clear app-table rows that don't cascade via FK to auth.users.
        //    Most user-scoped tables already cascade on auth.users delete, but
        //    these touch the user via email / referrer columns and need an
        //    explicit pass.
        const cleanupErrors: string[] = [];
        const sweep = async (q: Promise<{ error: any }>, label: string) => {
          try {
            const { error } = await q;
            if (error) cleanupErrors.push(`${label}: ${error.message}`);
          } catch (e) {
            cleanupErrors.push(`${label}: ${(e as Error).message}`);
          }
        };
        await sweep(admin.from("recent_uploads").delete().eq("user_id", target), "recent_uploads");
        await sweep(admin.from("shared_files").delete().eq("owner_id", target), "shared_files.owner");
        await sweep(admin.from("storage_topups").delete().eq("user_id", target), "storage_topups");
        await sweep(admin.from("fastlink_payments").delete().eq("user_id", target), "fastlink_payments");
        await sweep(admin.from("support_requests").delete().eq("user_id", target), "support_requests");
        await sweep(admin.from("referrals").delete().eq("referred_user_id", target), "referrals.referred");
        await sweep(admin.from("referrals").delete().eq("referrer_user_id", target), "referrals.referrer");
        await sweep(admin.from("referral_codes").delete().eq("user_id", target), "referral_codes");
        await sweep(admin.from("producer_assignments").delete().eq("creator_user_id", target), "producer_assignments.creator");
        await sweep(admin.from("producer_assignments").delete().eq("ep_user_id", target), "producer_assignments.ep");
        await sweep(admin.from("subscriptions").delete().eq("user_id", target), "subscriptions");
        await sweep(admin.from("user_roles").delete().eq("user_id", target), "user_roles");
        await sweep(admin.from("user_profiles").delete().eq("user_id", target), "user_profiles");
        if (targetEmail) {
          await sweep(admin.from("suppressed_emails").delete().eq("email", targetEmail.toLowerCase()), "suppressed_emails");
          await sweep(admin.from("onboarding_requests").delete().eq("email", targetEmail.toLowerCase()), "onboarding_requests");
        }

        // 4. Finally remove the auth.users row. Any remaining FK rows that
        //    cascade on auth.users(id) will be wiped automatically.
        const { error } = await admin.auth.admin.deleteUser(target);
        if (error) {
          await writeAudit(target, targetEmail, "delete_failed", {
            error: error.message, razorpay, stripe, storage, cleanupErrors,
          });
          return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        }

        await writeAudit(target, targetEmail, "delete", {
          razorpay, stripe, storage, cleanupErrors,
        });
        return new Response(JSON.stringify({
          ok: true,
          billing: { razorpay, stripe },
          storage,
          cleanupErrors,
        }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      case "inviteAdmin": {
        const email = String(body.email ?? "").trim().toLowerCase();
        if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        const origin = (() => { try { return resolveSiteOrigin(req); } catch { return ""; } })();
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: origin ? `${origin}/admin` : undefined,
          data: { invited_role: "admin" },
        });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        }
        // Pre-assign the admin role so they land in /admin on first sign-in.
        if (data?.user?.id) {
          await admin.from("user_roles").insert({ user_id: data.user.id, role: "admin" }).catch(() => {});
        }
        await writeAudit(data?.user?.id ?? null, email, "invite_admin", {});
        return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      case "sendRecoveryToSelf": {
        const origin = (() => { try { return resolveSiteOrigin(req); } catch { return ""; } })();
        const { error } = await admin.auth.resetPasswordForEmail(callerEmail!, {
          redirectTo: origin ? `${origin}/auth?next=/admin` : undefined,
        });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        }
        await writeAudit(callerId, callerEmail, "self_password_reset", {});
        return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      case "audit": {
        const limit = Math.min(Number(body.limit ?? 50), 200);
        const { data } = await admin
          .from("admin_audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        return new Response(JSON.stringify({ entries: data ?? [] }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
