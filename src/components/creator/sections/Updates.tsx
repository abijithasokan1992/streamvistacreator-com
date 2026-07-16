import { useEffect, useState } from "react";
import { AlertCircle, Bell, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Update = { id: string; kind: string; title: string; body: string; at: string };

export default function UpdatesSection() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [items, setItems] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const collected: Update[] = [];

        // (a) approval log for my titles
        const titlesRes = await (supabase as any)
          .from("content_titles").select("id, title").eq("owner_user_id", user.id);
        if (titlesRes.error) throw titlesRes.error;
        const titles = titlesRes.data ?? [];
        const tmap = new Map(titles.map((t: any) => [t.id, t.title as string]));
        if (titles.length) {
          const apprRes = await (supabase as any)
            .from("content_approvals")
            .select("id, title_id, from_status, to_status, note, created_at")
            .in("title_id", titles.map((t: any) => t.id))
            .order("created_at", { ascending: false })
            .limit(40);
          if (apprRes.error) throw apprRes.error;
          for (const a of apprRes.data ?? []) {
            collected.push({
              id: `a-${a.id}`,
              kind: "Approval",
              title: `${tmap.get(a.title_id) ?? "Title"} → ${a.to_status}`,
              body: a.note || `Status moved from ${a.from_status ?? "—"} to ${a.to_status}.`,
              at: a.created_at,
            });
          }
        }

        // (b) notifications
        const notesRes = await (supabase as any)
          .from("notifications")
          .select("id, title, message, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(40);
        if (notesRes.error) throw notesRes.error;
        for (const n of notesRes.data ?? []) {
          collected.push({
            id: `n-${n.id}`, kind: "System",
            title: n.title || "Update", body: n.message || "", at: n.created_at,
          });
        }

        collected.sort((a, b) => +new Date(b.at) - +new Date(a.at));
        if (!cancelled) setItems(collected);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Unable to load updates.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, tick]);

  if (loading) return <p className="text-xs text-muted-foreground">{t("common.loading")}</p>;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" aria-hidden />
        <p className="text-sm font-medium">Couldn't load updates</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{error}</p>
        <button
          type="button"
          onClick={() => setTick(v => v + 1)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
        >
          <RefreshCw className="w-3 h-3" aria-hidden /> Try again
        </button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 bg-secondary/5 p-10 text-center">
        <Bell className="w-6 h-6 text-muted-foreground mx-auto mb-3" aria-hidden />
        <p className="text-sm font-medium">{t("creator.updates.emptyTitle")}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          {t("creator.updates.emptyMessage")}
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-2 list-none">
      {items.map((u) => (
        <li key={u.id} className="rounded-lg border border-border/40 bg-secondary/5 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{u.kind}</span>
            <span className="text-[11px] text-muted-foreground">{new Date(u.at).toLocaleString()}</span>
          </div>
          <p className="text-sm font-medium mt-1">{u.title}</p>
          {u.body && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{u.body}</p>}
        </li>
      ))}
    </ul>
  );
}

