import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Update = { id: string; kind: string; title: string; body: string; at: string };

export default function UpdatesSection() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [items, setItems] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const collected: Update[] = [];

      // (a) approval log for my titles
      const { data: titles } = await (supabase as any)
        .from("content_titles").select("id, title").eq("owner_user_id", user.id);
      const tmap = new Map((titles ?? []).map((t: any) => [t.id, t.title as string]));
      if (titles?.length) {
        const { data: appr } = await (supabase as any)
          .from("content_approvals")
          .select("id, title_id, from_status, to_status, note, created_at")
          .in("title_id", titles.map((t: any) => t.id))
          .order("created_at", { ascending: false })
          .limit(40);
        for (const a of appr ?? []) {
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
      const { data: notes } = await (supabase as any)
        .from("notifications")
        .select("id, title, message, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40);
      for (const n of notes ?? []) {
        collected.push({
          id: `n-${n.id}`, kind: "System",
          title: n.title || "Update", body: n.message || "", at: n.created_at,
        });
      }

      collected.sort((a, b) => +new Date(b.at) - +new Date(a.at));
      setItems(collected);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <p className="text-xs text-muted-foreground">{t("common.loading")}</p>;
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 bg-secondary/5 p-10 text-center">
        <Bell className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium">{t("creator.updates.emptyTitle")}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          {t("creator.updates.emptyMessage")}
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
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
