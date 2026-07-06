import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/** Build a per-request Supabase client that runs under the caller's RLS. */
export function userClient(ctx: ToolContext): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export function unauth() {
  return {
    content: [{ type: "text" as const, text: "Please sign in to your StreamVista Studio account." }],
    isError: true as const,
  };
}

export function notStudio() {
  return {
    content: [
      {
        type: "text" as const,
        text: "This tool is available to StreamVista Studio users only. Ask your workspace owner for access.",
      },
    ],
    isError: true as const,
  };
}

/**
 * Returns the caller's Studio workspace ids (all workspaces they own or belong
 * to). An empty list means the caller is not a Studio user. RLS on `workspaces`
 * and `workspace_members` restricts what the query can see, so this is the
 * source of truth for Studio access — no extra role table lookup needed.
 */
export async function getStudioWorkspaceIds(ctx: ToolContext): Promise<string[]> {
  const sb = userClient(ctx);
  const uid = ctx.getUserId();
  if (!uid) return [];
  const [owned, member] = await Promise.all([
    sb.from("workspaces").select("id").eq("owner_id", uid),
    sb.from("workspace_members").select("workspace_id").eq("user_id", uid),
  ]);
  const ids = new Set<string>();
  (owned.data ?? []).forEach((r: any) => ids.add(r.id));
  (member.data ?? []).forEach((r: any) => ids.add(r.workspace_id));
  return Array.from(ids);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

export function ok<T extends Record<string, unknown>>(structured: T, summary: string) {
  return {
    content: [{ type: "text" as const, text: summary }],
    structuredContent: structured,
  };
}
