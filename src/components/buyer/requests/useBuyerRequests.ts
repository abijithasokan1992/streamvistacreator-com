import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Row } from "./shared";

/**
 * Single, shared hook to load a buyer's commercial requests + approved
 * screener count. Prevents duplicate queries across sections.
 */
export function useBuyerRequests() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [screenerCount, setScreenerCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data, error }, screeners] = await Promise.all([
      supabase
        .from("commercial_requests")
        .select("id,request_type,state,title_query,message,admin_notes,terms,title_id,created_at,updated_at")
        .eq("buyer_user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("screening_invites")
        .select("id", { count: "exact", head: true })
        .eq("buyer_user_id", user.id),
    ]);
    setLoading(false);
    if (!error) setRows((data as unknown as Row[]) ?? []);
    setScreenerCount(screeners.count ?? 0);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { rows, screenerCount, loading, reload: load };
}
