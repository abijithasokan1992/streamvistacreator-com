import { supabase } from "@/integrations/supabase/client";

export type WorkspaceMode = "managed" | "self_service";

/** Fetch the current user's chosen workspace mode. `null` = not yet chosen. */
export async function getWorkspaceMode(userId: string): Promise<WorkspaceMode | null> {
  const { data, error } = await supabase
    .from("user_workspace_mode")
    .select("mode")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.mode as WorkspaceMode) ?? null;
}

/** Persist the user's mode choice (upsert). */
export async function setWorkspaceMode(userId: string, mode: WorkspaceMode): Promise<void> {
  const { error } = await supabase
    .from("user_workspace_mode")
    .upsert({ user_id: userId, mode }, { onConflict: "user_id" });
  if (error) throw error;
}
