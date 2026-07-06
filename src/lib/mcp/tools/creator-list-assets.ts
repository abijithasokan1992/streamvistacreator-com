import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { formatBytes, isCreatorUser, notCreator, ok, unauth, userClient } from "./_shared";

/**
 * Assets — files linked to one of the Creator's titles via `title_assets` and
 * `recent_uploads`. Ownership is verified before listing so this cannot be
 * used to enumerate assets on titles the caller doesn't own.
 */
export default defineTool({
  name: "creator_list_assets",
  title: "List title assets",
  description:
    "List the files (masters, artwork, subtitles, etc.) attached to one of the signed-in Creator's titles.",
  inputSchema: {
    title_id: z.string().uuid().describe("The title id."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ title_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!(await isCreatorUser(ctx))) return notCreator();
    const sb = userClient(ctx);
    const owner = await sb
      .from("content_titles")
      .select("id, title")
      .eq("id", title_id)
      .eq("owner_user_id", ctx.getUserId()!)
      .maybeSingle();
    if (owner.error || !owner.data) {
      return { content: [{ type: "text", text: "Title not found in your workspace." }], isError: true };
    }
    const { data, error } = await sb
      .from("title_assets")
      .select(
        "id, category, is_primary, created_at, upload:recent_uploads(id, file_name, file_size, mime_type, status, created_at)",
      )
      .eq("title_id", title_id)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (error) return { content: [{ type: "text", text: "Could not load assets for that title." }], isError: true };
    const assets = (data ?? []).map((row: any) => ({
      id: row.id,
      category: row.category,
      is_primary: row.is_primary,
      file_name: row.upload?.file_name ?? null,
      file_size: formatBytes(row.upload?.file_size ?? null),
      file_type: row.upload?.mime_type ?? null,
      upload_status: row.upload?.status ?? null,
      added_at: row.created_at,
    }));
    return ok(
      { title: owner.data.title, assets },
      assets.length
        ? `${assets.length} file${assets.length === 1 ? "" : "s"} on "${owner.data.title}".`
        : `No files attached yet on "${owner.data.title}".`,
    );
  },
});
