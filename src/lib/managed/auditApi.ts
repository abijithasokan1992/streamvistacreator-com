import { supabase } from "@/integrations/supabase/client";

export type ManagedAuditRow = {
  id: string;
  content_title_id: string | null;
  actor_id: string;
  actor_role: string;
  action: string;
  target: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function listAuditForTitle(contentTitleId: string, limit = 200): Promise<ManagedAuditRow[]> {
  const { data, error } = await supabase
    .from("managed_ops_audit")
    .select("*")
    .eq("content_title_id", contentTitleId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ManagedAuditRow[];
}

export async function recordAudit(params: {
  actorId: string;
  actorRole: string;
  action: string;
  contentTitleId?: string | null;
  target?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from("managed_ops_audit").insert({
    actor_id: params.actorId,
    actor_role: params.actorRole,
    action: params.action,
    content_title_id: params.contentTitleId ?? null,
    target: params.target ?? null,
    metadata: (params.metadata ?? {}) as never,
  });
  if (error) throw error;
}

export async function createEmergencyAccessGrant(params: {
  adminId: string;
  contentTitleId: string;
  reason: string;
  minutes: number;
}): Promise<void> {
  const expires = new Date(Date.now() + params.minutes * 60_000).toISOString();
  const { error } = await supabase.from("emergency_access_grants").insert({
    admin_id: params.adminId,
    content_title_id: params.contentTitleId,
    reason: params.reason,
    expires_at: expires,
  });
  if (error) throw error;
}
