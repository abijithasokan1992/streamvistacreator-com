import { useEffect, useState } from "react";
import { Database, Film, UploadCloud, Lock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";

export default function InsightsSection({ isFree = false }: { isFree?: boolean }) {
  const { user } = useAuth();
  const [, setParams] = useSearchParams();
  const [storageBytes, setStorageBytes] = useState(0);
  const [titleCount, setTitleCount] = useState(0);
  const [uploads30, setUploads30] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
      const [storage, titles, recent] = await Promise.all([
        (supabase as any).from("recent_uploads").select("file_size").eq("user_id", user.id),
        (supabase as any).from("content_titles").select("id", { count: "exact", head: true }).eq("owner_user_id", user.id),
        (supabase as any).from("recent_uploads").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).gte("created_at", since),
      ]);
      const total = (storage.data ?? []).reduce((s: number, r: any) => s + (Number(r.file_size) || 0), 0);
      setStorageBytes(total);
      setTitleCount(titles.count ?? 0);
      setUploads30(recent.count ?? 0);
      setLoading(false);
    })();
  }, [user]);

  const card = (icon: any, label: string, value: string) => {
    const Icon = icon;
    return (
      <div className="rounded-xl border border-border/40 bg-secondary/5 p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="w-3.5 h-3.5" /> {label}</div>
        <div className="text-2xl font-semibold font-display mt-1.5">{value}</div>
      </div>
    );
  };

  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        {card(Database, "Storage Usage", `${(storageBytes / 1024 / 1024 / 1024).toFixed(2)} GB`)}
        {card(Film, "Title Count", String(titleCount))}
        {card(UploadCloud, "Uploads (30d)", String(uploads30))}
      </div>

      {isFree ? (
        <button
          onClick={() => setParams({ section: "upgrade" })}
          className="w-full rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-accent/5 p-6 text-left flex items-start gap-4 hover:from-amber-500/15"
        >
          <div className="rounded-full bg-amber-500/15 p-2.5">
            <Lock className="w-5 h-5 text-amber-300" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Advanced analytics are on Creator Pro</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-prose">
              Viewership trends, licensing performance, channel breakdowns and revenue reporting unlock when you upgrade.
              Free accounts see operational metrics only.
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs text-accent mt-2 font-medium">
              Request upgrade <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>
      ) : (
        <div className="rounded-xl border border-dashed border-border/50 bg-secondary/5 p-6 text-center">
          <p className="text-sm">Advanced analytics modules are being rolled out — your account will see them as they ship.</p>
        </div>
      )}
    </div>
  );
}
