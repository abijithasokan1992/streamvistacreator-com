import { useEffect, useState } from "react";
import { AlertOctagon, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

type IssueRow = {
  id: string; stage: string; category_group: string; category_label: string;
  severity: string; status: string; creator_note: string | null;
  raised_at: string; resolved_at: string | null;
  title_id?: string; title?: string;
};

/**
 * Creator-facing structured change requests / review feedback.
 * Reads via `creator_review_feedback` RPC (creator-safe — never exposes internal notes).
 */
export default function CreatorReviewFeedback() {
  const { user } = useAuth();
  const [items, setItems] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Find creator's titles, then ask the creator-safe RPC for each (admins-only data is filtered server-side).
      const { data: titles } = await (supabase as any)
        .from("content_titles")
        .select("id, title, status")
        .eq("owner_user_id", user.id)
        .in("status", ["changes_requested","submitted","in_review","qc_review","legal_review","hold"]);
      const all: IssueRow[] = [];
      for (const t of (titles ?? [])) {
        const { data } = await (supabase as any).rpc("creator_review_feedback", { _title_id: t.id });
        (data ?? []).forEach((r: any) => all.push({ ...r, title_id: t.id, title: t.title }));
      }
      all.sort((a, b) => +new Date(b.raised_at) - +new Date(a.raised_at));
      setItems(all.slice(0, 20));
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading || items.length === 0) return null;

  const openCount = items.filter(i => i.status === "open").length;

  return (
    <div className="rounded-xl border border-border/40 bg-secondary/5">
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <AlertOctagon className="w-4 h-4 text-orange-400" />
        <h2 className="text-sm font-semibold">Requested changes</h2>
        {openCount > 0 && <Badge variant="outline" className="border-orange-500/40 text-orange-300">{openCount} open</Badge>}
        <span className="text-[11px] text-muted-foreground ml-auto">From the review team</span>
      </div>
      <ul className="divide-y divide-border/30">
        {items.map((i) => (
          <li key={i.id} className="px-4 py-3 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {i.status === "resolved"
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                : <AlertOctagon className="w-3.5 h-3.5 text-orange-400" />}
              <span className="font-medium">{i.title}</span>
              <Badge variant="outline" className="text-[10px]">{i.stage}</Badge>
              <Badge
                variant={i.severity === "blocking" ? "destructive" : "outline"}
                className="text-[10px]"
              >
                {i.severity.replace("_"," ")}
              </Badge>
              <span className="text-muted-foreground">{i.category_label}</span>
              <span className="text-muted-foreground/70 ml-auto">
                {new Date(i.raised_at).toLocaleDateString()}
              </span>
            </div>
            {i.creator_note && (
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">{i.creator_note}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
