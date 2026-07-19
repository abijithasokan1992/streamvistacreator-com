import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, userClient, withTimeout } from "../../lib/control";

export default defineTool({
  name: "ctrl_find_duplicate_titles",
  title: "Find duplicate draft titles (Control)",
  description:
    "Detect likely duplicate/junk rows in content_titles limited to drafts that were never submitted. Groups by (owner, normalized title) with count > 1, and flags burst-insert bursts within 5 seconds. Read-only.",
  inputSchema: {
    limit: z.number().int().min(1).max(500).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "ctrl_find_duplicate_titles", input);
    if (denied) return denied;
    const sb = userClient(ctx);
    const { data, error } = await withTimeout(
      sb.rpc("mcp_find_duplicate_draft_titles", { _limit: input.limit ?? 100 }),
      "ctrl_find_duplicate_titles",
    );
    if (error)
      return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    const groups = (data ?? []) as unknown[];
    return ok(
      { duplicate_groups: groups },
      `Found ${groups.length} duplicate draft group(s).`,
    );
  },
});
