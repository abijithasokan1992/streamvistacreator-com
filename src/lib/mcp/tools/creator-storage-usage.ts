import { defineTool } from "@lovable.dev/mcp-js";
import { formatBytes, isCreatorUser, notCreator, ok, unauth, userClient } from "./_shared";

const GB = 1024 ** 3;

/**
 * Storage Usage — mirrors the on-app `StorageLive` panel: reads
 * `workspace_storage_entitlements` (capacity) and `workspace_storage_usage`
 * (bytes used) for the signed-in user. Same fallback chain as the UI:
 * user-scoped rows when no workspace_id is available.
 */
export default defineTool({
  name: "creator_storage_usage",
  title: "Storage usage",
  description:
    "Report the signed-in Creator's storage plan, allocated capacity, used capacity, and remaining headroom.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!(await isCreatorUser(ctx))) return notCreator();
    const sb = userClient(ctx);
    const uid = ctx.getUserId()!;
    const [entRes, usageRes] = await Promise.all([
      sb
        .from("workspace_storage_entitlements")
        .select("plan_code, total_storage_gb, included_storage_gb, paid_storage_gb, admin_bonus_storage_gb, billing_status, effective_from")
        .eq("user_id", uid)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from("workspace_storage_usage")
        .select("display_used_bytes, active_bytes, archived_bytes, last_recalculated_at")
        .eq("user_id", uid)
        .order("last_recalculated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const ent = entRes.data as any;
    const usage = usageRes.data as any;
    if (!ent && !usage) {
      return ok({ configured: false }, "No storage plan is active on your account yet.");
    }
    const totalBytes = Number(ent?.total_storage_gb ?? 0) * GB;
    const usedBytes = Number(usage?.display_used_bytes ?? 0);
    const remaining = Math.max(0, totalBytes - usedBytes);
    const pct = totalBytes > 0 ? Math.round((100 * usedBytes) / totalBytes) : 0;
    return ok(
      {
        plan: ent?.plan_code ?? null,
        billing_status: ent?.billing_status ?? null,
        total: formatBytes(totalBytes),
        used: formatBytes(usedBytes),
        available: formatBytes(remaining),
        archived: formatBytes(Number(usage?.archived_bytes ?? 0)),
        percent_used: pct,
      },
      `${formatBytes(usedBytes)} of ${formatBytes(totalBytes)} used (${pct}%).`,
    );
  },
});
