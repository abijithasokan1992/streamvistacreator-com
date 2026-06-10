import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

export type Workspace = {
  id: string;
  name: string;
  owner_id: string;
  /** Role of the current user inside this workspace. */
  role?: WorkspaceRole;
};

const ACTIVE_KEY = "sv:active-workspace-id";

export function useWorkspaces() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveIdState] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem(ACTIVE_KEY) : null),
  );

  const load = useCallback(async () => {
    if (!user) { setWorkspaces([]); setLoading(false); return; }
    setLoading(true);
    // Join through workspace_members so we get the user's role per workspace.
    const { data, error } = await (supabase as any)
      .from("workspace_members")
      .select("role, workspace:workspaces(id, name, owner_id)")
      .eq("user_id", user.id);
    setLoading(false);
    if (error) return;
    const list: Workspace[] = (data ?? [])
      .map((r: any) => r.workspace ? { ...r.workspace, role: r.role as WorkspaceRole } : null)
      .filter(Boolean)
      .sort((a: Workspace, b: Workspace) => a.name.localeCompare(b.name));
    setWorkspaces(list);
    // Ensure activeId is valid; otherwise default to the first one.
    if (list.length && (!activeId || !list.some((w) => w.id === activeId))) {
      setActiveIdState(list[0].id);
      try { localStorage.setItem(ACTIVE_KEY, list[0].id); } catch {}
    }
  }, [user?.id, activeId]);

  useEffect(() => { load(); }, [load]);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    try {
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {}
  }, []);

  const createWorkspace = useCallback(async (name: string): Promise<Workspace | null> => {
    if (!user) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    const { data, error } = await (supabase as any)
      .from("workspaces")
      .insert({ name: trimmed, owner_id: user.id })
      .select("id, name, owner_id")
      .single();
    if (error || !data) return null;
    // Owner row is auto-created by the workspaces_add_owner_member trigger.
    await load();
    setActiveId(data.id);
    return { ...data, role: "owner" };
  }, [user?.id, load, setActiveId]);

  const active = workspaces.find((w) => w.id === activeId) ?? null;
  const canWriteActive = !!active && ["owner", "admin", "editor"].includes(active.role ?? "viewer");

  return { workspaces, active, activeId, setActiveId, loading, reload: load, createWorkspace, canWriteActive };
}
