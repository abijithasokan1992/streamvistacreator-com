import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Per-title lock state + active section unlocks.
 *
 * Sections are mapped to the editor surfaces:
 *   - metadata tab  →  basic_metadata / synopsis / cast_crew / rights
 *   - assets tab    →  master_file / trailer / poster / subtitles_audio
 *   - legal tab     →  legal_documents
 *   - delivery tab  →  delivery
 *
 * A section is "editable" when:
 *   - the title is not locked, OR
 *   - an active (status='open' AND not expired AND not closed) section_unlock row exists.
 */
export type SectionKey =
  | "basic_metadata" | "synopsis" | "cast_crew" | "rights"
  | "master_file" | "trailer" | "poster" | "subtitles_audio"
  | "legal_documents" | "delivery";

type LockRow = { is_locked: boolean; current_submission_state: string; lock_reason: string | null; locked_at: string | null };
type UnlockRow = { section_key: string; expires_at: string | null; status: string; closed_at: string | null };

export function useTitleLock(titleId: string | null) {
  const [lock, setLock] = useState<LockRow | null>(null);
  const [unlocks, setUnlocks] = useState<UnlockRow[]>([]);
  const [openRequests, setOpenRequests] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!titleId) { setLoading(false); return; }
    setLoading(true);
    const [l, u, r] = await Promise.all([
      (supabase as any).from("title_lock_state")
        .select("is_locked, current_submission_state, lock_reason, locked_at")
        .eq("title_id", titleId).maybeSingle(),
      (supabase as any).from("title_section_unlocks")
        .select("section_key, expires_at, status, closed_at")
        .eq("title_id", titleId)
        .eq("status", "open"),
      (supabase as any).from("title_edit_requests")
        .select("id", { count: "exact", head: true })
        .eq("title_id", titleId).eq("status", "open"),
    ]);
    setLock((l.data as LockRow) || null);
    setUnlocks((u.data as UnlockRow[]) || []);
    setOpenRequests((r as any).count || 0);
    setLoading(false);
  }, [titleId]);

  useEffect(() => { reload(); }, [reload]);

  const isLocked = !!lock?.is_locked;

  const isSectionEditable = useCallback((section: SectionKey): boolean => {
    if (!isLocked) return true;
    const now = Date.now();
    return unlocks.some(
      (u) =>
        u.section_key === section &&
        u.status === "open" &&
        !u.closed_at &&
        (!u.expires_at || new Date(u.expires_at).getTime() > now),
    );
  }, [isLocked, unlocks]);

  /** Coarse helper: editor "tab" → set of underlying section keys. */
  const isTabEditable = useCallback((tab: "metadata" | "assets" | "legal" | "delivery"): boolean => {
    if (!isLocked) return true;
    const map: Record<string, SectionKey[]> = {
      metadata: ["basic_metadata", "synopsis", "cast_crew", "rights"],
      assets: ["master_file", "trailer", "poster", "subtitles_audio"],
      legal: ["legal_documents"],
      delivery: ["delivery"],
    };
    return map[tab].some((s) => isSectionEditable(s));
  }, [isLocked, isSectionEditable]);

  return { lock, unlocks, openRequests, isLocked, isSectionEditable, isTabEditable, loading, reload };
}
