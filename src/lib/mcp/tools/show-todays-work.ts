import { defineTool } from "@lovable.dev/mcp-js";
import { getStudioWorkspaceIds, notStudio, ok, unauth, userClient } from "./_shared";

export default defineTool({
  name: "show_todays_work",
  title: "Show today's work",
  description:
    "Summarize what the signed-in Studio user should do next today: unread alerts, in-flight uploads, and deliveries awaiting action.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    const sb = userClient(ctx);
    const uid = ctx.getUserId()!;

    const [notifs, active, pendingDeliveries] = await Promise.all([
      sb
        .from("notifications")
        .select("id, title, message, is_read, created_at")
        .eq("user_id", uid)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(10),
      sb
        .from("ingest_jobs")
        .select("id, status, total_files, completed_files, updated_at, project_id")
        .in("workspace_id", wsIds)
        .in("status", ["queued", "uploading", "processing", "verifying"])
        .order("updated_at", { ascending: false })
        .limit(10),
      sb
        .from("deal_deliveries")
        .select("id, status, recipient_email, buyer_org_name, updated_at")
        .in("status", ["pending", "in_progress", "shared"])
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);

    const tasks: Array<{ kind: string; label: string; id?: string }> = [];
    (notifs.data ?? []).forEach((n: any) =>
      tasks.push({ kind: "alert", label: n.title || n.message || "New alert", id: n.id }),
    );
    (active.data ?? []).forEach((j: any) =>
      tasks.push({
        kind: "upload",
        label: `Upload in progress · ${j.completed_files ?? 0}/${j.total_files ?? 0} files`,
        id: j.id,
      }),
    );
    (pendingDeliveries.data ?? []).forEach((d: any) =>
      tasks.push({
        kind: "delivery",
        label: `Delivery to ${d.buyer_org_name ?? d.recipient_email ?? "buyer"} · ${d.status}`,
        id: d.id,
      }),
    );

    return ok(
      {
        unread_alerts: notifs.data ?? [],
        active_uploads: active.data ?? [],
        pending_deliveries: pendingDeliveries.data ?? [],
        tasks,
      },
      tasks.length
        ? `You have ${tasks.length} item${tasks.length === 1 ? "" : "s"} needing attention today.`
        : "You're all caught up — no pending items today.",
    );
  },
});
