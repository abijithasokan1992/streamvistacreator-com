import { defineTool } from "@lovable.dev/mcp-js";
import { formatBytes, getStudioWorkspaceIds, notStudio, ok, unauth, userClient } from "./_shared";

export default defineTool({
  name: "show_storage_usage",
  title: "Show storage usage",
  description:
    "Report the signed-in Studio user's storage plan, allocated capacity, used capacity, and remaining headroom.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    const sb = userClient(ctx);
    const [ent, usage] = await Promise.all([
      sb
        .from("workspace_storage_entitlements")
        .select("workspace_id, plan_code, total_storage_gb, included_storage_gb, paid_storage_gb, admin_bonus_storage_gb, billing_status")
        .in("workspace_id", wsIds),
      sb
        .from("workspace_storage_usage")
        .select("workspace_id, billable_bytes, display_used_bytes, last_recalculated_at")
        .in("workspace_id", wsIds),
    ]);
    const usageByWs = new Map<string, any>();
    (usage.data ?? []).forEach((u: any) => usageByWs.set(u.workspace_id, u));
    const workspaces = (ent.data ?? []).map((e: any) => {
      const u = usageByWs.get(e.workspace_id);
      const usedBytes = Number(u?.display_used_bytes ?? u?.billable_bytes ?? 0);
      const totalBytes = Number(e.total_storage_gb ?? 0) * 1024 ** 3;
      const remaining = Math.max(0, totalBytes - usedBytes);
      const pct = totalBytes > 0 ? Math.round((100 * usedBytes) / totalBytes) : 0;
      return {
        workspace_id: e.workspace_id,
        plan: e.plan_code,
        total: formatBytes(totalBytes),
        used: formatBytes(usedBytes),
        available: formatBytes(remaining),
        percent_used: pct,
        billing_status: e.billing_status,
      };
    });
    return ok({ workspaces }, workspaces.length ? "Storage summary ready." : "No storage plan is active yet.");
  },
});
