import { useEffect, useMemo, useState } from "react";
import { Loader2, Package, Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Delivery = {
  id: string;
  title_id: string | null;
  buyer_org_name: string | null;
  recipient_email: string | null;
  status: string;
  method: string | null;
  package_notes: string | null;
  share_url: string | null;
  expires_at: string | null;
  shared_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

const COMPLETED = new Set(["delivered", "completed", "downloaded"]);
const STATUS_TONE: Record<string, string> = {
  delivered: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  downloaded: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  in_progress: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
};

export default function DeliveriesSection() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "completed" | "history">("pending");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("deal_deliveries")
        .select("id,title_id,buyer_org_name,recipient_email,status,method,package_notes,share_url,expires_at,shared_at,delivered_at,created_at,updated_at")
        .eq("buyer_user_id", user.id)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      setLoading(false);
      setRows((data as unknown as Delivery[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const { pending, completed } = useMemo(() => {
    const p: Delivery[] = [], c: Delivery[] = [];
    for (const r of rows) (COMPLETED.has(r.status) ? c : p).push(r);
    return { pending: p, completed: c };
  }, [rows]);

  const list = tab === "pending" ? pending : tab === "completed" ? completed : rows;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="font-display text-xl">Deliveries</h2>
        <p className="text-sm text-muted-foreground">Track approved packages, secure download links and full delivery history.</p>
      </header>

      <div role="tablist" aria-label="Delivery views" className="inline-flex rounded-lg border border-border/50 p-1 bg-secondary/20 text-xs">
        {(["pending", "completed", "history"] as const).map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 rounded-md capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              tab === t ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "pending" ? `Pending (${pending.length})` :
             t === "completed" ? `Completed (${completed.length})` :
             `History (${rows.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 grid place-items-center" role="status" aria-label="Loading deliveries">
          <Loader2 className="w-5 h-5 animate-spin text-accent" aria-hidden />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/10 p-10 text-center">
          <Package className="w-8 h-8 mx-auto text-muted-foreground mb-2" aria-hidden />
          <h3 className="font-semibold">Nothing here yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Approved deliveries appear here once admin authorises a package for your organisation.
          </p>
        </div>
      ) : (
        <ul className="space-y-2 list-none">
          {list.map(d => (
            <li key={d.id} className="rounded-xl border border-border/40 bg-secondary/10 p-4 flex flex-wrap gap-3 items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={cn("text-[10px] capitalize border", STATUS_TONE[d.status] ?? "bg-secondary text-muted-foreground border-border/60")}>
                    {d.status.replace(/_/g, " ")}
                  </Badge>
                  {d.method && <Badge variant="outline" className="text-[10px] capitalize">{d.method}</Badge>}
                </div>
                <div className="text-sm font-medium mt-1.5 truncate">
                  {d.buyer_org_name ?? "Delivery package"}
                </div>
                {d.package_notes && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.package_notes}</p>
                )}
                <div className="text-[10px] text-muted-foreground mt-1.5">
                  {d.delivered_at
                    ? `Delivered ${new Date(d.delivered_at).toLocaleString()}`
                    : d.shared_at
                    ? `Shared ${new Date(d.shared_at).toLocaleString()}`
                    : `Updated ${new Date(d.updated_at).toLocaleString()}`}
                  {d.expires_at && <span> · Link expires {new Date(d.expires_at).toLocaleDateString()}</span>}
                </div>
              </div>
              {d.share_url && (
                <Button asChild size="sm" variant="secondary" className="min-h-9">
                  <a href={d.share_url} target="_blank" rel="noreferrer noopener" aria-label="Open delivery package">
                    {COMPLETED.has(d.status)
                      ? (<><Download className="w-3.5 h-3.5 mr-1" aria-hidden /> Download</>)
                      : (<><ExternalLink className="w-3.5 h-3.5 mr-1" aria-hidden /> Open</>)}
                  </a>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
