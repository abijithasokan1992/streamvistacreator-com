import { useEffect, useState } from "react";
import { MessageSquare, AlertOctagon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Note = {
  id: string;
  title_id: string;
  to_status: string;
  note: string;
  created_at: string;
  title: string;
};

/**
 * Surfaces the latest review notes posted by admins for this creator's titles.
 * Prioritizes changes_requested / hold / rejected. Read-only.
 */
export default function ReviewNotesInbox() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Pull this creator's titles first; then approval notes attached to them.
      const { data: titles } = await (supabase as any)
        .from("content_titles")
        .select("id, title")
        .eq("owner_user_id", user.id);
      const titleIds = (titles ?? []).map((t: any) => t.id);
      const titleMap = new Map((titles ?? []).map((t: any) => [t.id, t.title as string]));
      if (titleIds.length === 0) { setLoading(false); return; }

      const { data: rows } = await (supabase as any)
        .from("content_approvals")
        .select("id, title_id, to_status, note, created_at")
        .in("title_id", titleIds)
        .not("note", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);

      setNotes(((rows ?? []) as any[]).map((r) => ({
        id: r.id,
        title_id: r.title_id,
        to_status: r.to_status,
        note: r.note,
        created_at: r.created_at,
        title: titleMap.get(r.title_id) ?? "Untitled",
      })));
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading || notes.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-secondary/5">
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold">Review notes</h2>
        <span className="text-[11px] text-muted-foreground ml-auto">
          From the review team
        </span>
      </div>
      <ul className="divide-y divide-border/30">
        {notes.map((n) => {
          const isAction = n.to_status === "changes_requested" || n.to_status === "rejected";
          return (
            <li key={n.id} className="px-4 py-3 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                {isAction && <AlertOctagon className="w-3.5 h-3.5 text-orange-400" />}
                <span className="font-medium">{n.title}</span>
                <span className="text-muted-foreground">
                  · {n.to_status.replace(/_/g, " ")}
                </span>
                <span className="text-muted-foreground/70 ml-auto">
                  {new Date(n.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">{n.note}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
