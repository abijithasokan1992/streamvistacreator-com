/**
 * reconcile-storage-topups
 *
 * Admin-only reconciler for stuck `storage_topups` rows.
 *
 * Scope (per PR-C plan):
 *   - Reads NOTHING that is not either the target topup row or the matching
 *     Razorpay order.
 *   - Writes only to `storage_topups` (status/notes/updated_at) and
 *     `admin_audit_log` (one row per action).
 *   - `mark_paid` re-runs the same `project_topup_entitlement` RPC used by
 *     `verify-storage-topup` so quota accrual is identical to the normal
 *     checkout flow. It refuses when Razorpay does not show a captured
 *     payment or when the amount does not match the DB row.
 *   - Never touches create-storage-topup / verify-storage-topup runtime paths.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

import {
  validateReconcilePayload,
  type ReconcileAction,
  type ReconcileActionItem,
} from "./validate.ts";

const ADMIN_ROLES = ["admin", "super_admin", "platform_owner", "founder"] as const;

type Action = ReconcileAction;
type ActionItem = ReconcileActionItem;

interface RowResult {
  topup_id: string;
  status: "ok" | "skipped" | "error";
  message: string;
  action?: Action;
}

async function fetchRazorpayOrder(orderId: string, keyId: string, keySecret: string) {
  const auth = btoa(`${keyId}:${keySecret}`);
  const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Razorpay order fetch failed: ${res.status} ${text}`);
  return JSON.parse(text);
}

async function writeAudit(
  admin: any,
  adminId: string,
  adminEmail: string | null,
  targetUserId: string | null,
  action: string,
  details: Record<string, unknown>,
) {
  try {
    await admin.from("admin_audit_log").insert({
      admin_user_id: adminId,
      admin_email: adminEmail,
      target_user_id: targetUserId,
      action,
      details,
    });
  } catch (e) {
    console.error("admin_audit_log insert failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const cors = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    const adminEmail = userRes?.user?.email ?? null;
    if (userErr || !uid) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Role gate
    let allowed = false;
    for (const role of ADMIN_ROLES) {
      const { data, error } = await admin.rpc("has_role", { _user_id: uid, _role: role });
      if (!error && data === true) { allowed = true; break; }
    }
    if (!allowed) return json({ error: "Forbidden" }, 403);

    const parsed = validatePayload(await req.json().catch(() => null));
    if ("error" in parsed) return json({ error: parsed.error }, 400);

    const results: RowResult[] = [];
    let creds: { keyId: string; keySecret: string } | null = null;

    for (const item of parsed.actions) {
      const { topup_id, action, reason } = item;
      try {
        const { data: row, error: rowErr } = await admin
          .from("storage_topups").select("*").eq("id", topup_id).maybeSingle();
        if (rowErr || !row) {
          results.push({ topup_id, action, status: "error", message: "Top-up not found" });
          continue;
        }

        if (!["created", "pending"].includes(row.status)) {
          results.push({
            topup_id, action, status: "skipped",
            message: `Current status is '${row.status}', no action taken`,
          });
          continue;
        }

        if (action === "mark_failed" || action === "cancel") {
          const newStatus = action === "mark_failed" ? "failed" : "cancelled";
          const noteLine = `[${new Date().toISOString()}] reconciled by ${adminEmail ?? uid}: ${action} — ${reason}`;
          const notes = row.notes ? `${row.notes}\n${noteLine}` : noteLine;
          const { error: updErr } = await admin.from("storage_topups")
            .update({ status: newStatus, notes, updated_at: new Date().toISOString() })
            .eq("id", topup_id)
            .in("status", ["created", "pending"]);
          if (updErr) {
            results.push({ topup_id, action, status: "error", message: updErr.message });
            continue;
          }
          await writeAudit(admin, uid, adminEmail, row.user_id, `storage_topups.${action}`, {
            topup_id, reason, before: { status: row.status }, after: { status: newStatus },
            amount_inr: row.amount_inr, razorpay_order_id: row.razorpay_order_id,
          });
          results.push({ topup_id, action, status: "ok", message: `Marked ${newStatus}` });
          continue;
        }

        // mark_paid: verify with Razorpay first
        if (!row.razorpay_order_id) {
          results.push({ topup_id, action, status: "error", message: "No razorpay_order_id on row" });
          continue;
        }
        if (!creds) {
          creds = await loadRazorpayCreds(admin);
          if (!creds) {
            results.push({ topup_id, action, status: "error", message: "Razorpay not configured" });
            continue;
          }
        }
        const order = await fetchRazorpayOrder(row.razorpay_order_id, creds.keyId, creds.keySecret);
        const expectedPaise = Number(row.total_paise ?? Math.round(Number(row.amount_inr) * 100));
        if (order.status !== "paid") {
          results.push({
            topup_id, action, status: "error",
            message: `Razorpay order status is '${order.status}', refusing mark_paid`,
          });
          continue;
        }
        if (Number(order.amount_paid) !== expectedPaise) {
          results.push({
            topup_id, action, status: "error",
            message: `Amount mismatch: RZP ${order.amount_paid} vs DB ${expectedPaise}`,
          });
          continue;
        }

        const noteLine = `[${new Date().toISOString()}] reconciled by ${adminEmail ?? uid}: mark_paid — ${reason}`;
        const notes = row.notes ? `${row.notes}\n${noteLine}` : noteLine;
        const { error: updErr } = await admin.from("storage_topups")
          .update({ status: "paid", notes, updated_at: new Date().toISOString() })
          .eq("id", topup_id)
          .in("status", ["created", "pending"]);
        if (updErr) {
          results.push({ topup_id, action, status: "error", message: updErr.message });
          continue;
        }

        const { data: proj, error: projErr } = await admin.rpc("project_topup_entitlement", { _topup_id: topup_id });
        if (projErr) {
          results.push({ topup_id, action, status: "error", message: `Entitlement projection failed: ${projErr.message}` });
          continue;
        }

        await writeAudit(admin, uid, adminEmail, row.user_id, "storage_topups.mark_paid", {
          topup_id, reason,
          before: { status: row.status },
          after: { status: "paid", invoice_id: proj?.invoice_id ?? null, tb_added: proj?.tb_added ?? null },
          razorpay_order_id: row.razorpay_order_id,
          razorpay_amount_paid: order.amount_paid,
        });
        results.push({ topup_id, action, status: "ok", message: "Marked paid and entitlement projected" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ topup_id, action, status: "error", message: msg });
      }
    }

    return json({ ok: true, results });
  } catch (e) {
    console.error("reconcile-storage-topups error", e);
    return json({ error: "Internal server error" }, 500);
  }
});
