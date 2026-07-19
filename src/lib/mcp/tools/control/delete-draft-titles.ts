import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, userClient, withTimeout } from "../../lib/control";

export default defineTool({
  name: "ctrl_delete_draft_titles",
  title: "Delete draft titles by ID (Control)",
  description:
    "Delete specific content_titles rows by explicit ID. Server-side guard: only rows with status='draft' AND submitted_at/approved_at/published_at all NULL are removed; anything else is returned under skipped_not_eligible. Max 50 IDs per call. Respects the MCP kill switch. Writes one audit row per deletion.",
  inputSchema: {
    title_ids: z.array(z.string().uuid()).min(1).max(50),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "ctrl_delete_draft_titles", input, { writes: true });
    if (denied) return denied;
    const sb = userClient(ctx);
    const { data, error } = await withTimeout(
      sb.rpc("mcp_delete_draft_titles", { _ids: input.title_ids }),
      "ctrl_delete_draft_titles",
    );
    if (error)
      return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    const result = (data ?? {}) as { deleted?: string[]; skipped_not_eligible?: unknown[] };
    const deleted = result.deleted ?? [];
    const skipped = result.skipped_not_eligible ?? [];
    return ok(
      { deleted, skipped_not_eligible: skipped },
      `Deleted ${deleted.length} title(s); skipped ${skipped.length}.`,
    );
  },
});
