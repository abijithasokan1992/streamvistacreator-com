import { supabase } from "@/integrations/supabase/client";

export type ManagedProjectRow = {
  content_title_id: string;
  owner_id: string;
  enabled: boolean;
  assigned_team: string | null;
  assigned_operator: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  due_date: string | null;
  status: "intake" | "in_progress" | "qc" | "packaging" | "delivery" | "completed" | "on_hold";
  progress_pct: number;
  created_at: string;
  updated_at: string;
};

/** Owner-side: enable managed service on a title they own. */
export async function enableManagedForTitle(userId: string, contentTitleId: string) {
  const { error } = await supabase
    .from("managed_projects")
    .upsert(
      { content_title_id: contentTitleId, owner_id: userId, enabled: true },
      { onConflict: "content_title_id" },
    );
  if (error) throw error;
}

/** Owner-side: disable managed service (does not transfer ownership). */
export async function disableManagedForTitle(contentTitleId: string) {
  const { error } = await supabase
    .from("managed_projects")
    .update({ enabled: false })
    .eq("content_title_id", contentTitleId);
  if (error) throw error;
}

/** Ops-side: list all managed titles the current user can see. */
export async function listManagedProjects(): Promise<ManagedProjectRow[]> {
  const { data, error } = await supabase
    .from("managed_projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ManagedProjectRow[];
}

/** Ops-side: assign / update the row (lead or admin only, enforced by RLS). */
export async function updateManagedProject(
  contentTitleId: string,
  patch: Partial<Pick<ManagedProjectRow, "assigned_team" | "assigned_operator" | "priority" | "due_date" | "status" | "progress_pct" | "enabled">>,
) {
  const { error } = await supabase
    .from("managed_projects")
    .update(patch)
    .eq("content_title_id", contentTitleId);
  if (error) throw error;
}
