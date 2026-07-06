import { useEffect, useState } from "react";
import { ArrowRight, Bookmark, Clock, Film, Inbox, MessagesSquare, Package, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BuyerPlanStrip from "../BuyerPlanStrip";
import BuyerQuickActions from "../BuyerQuickActions";
import { useWatchlist } from "../hooks/useWatchlist";
import { useMarketplaceCatalog, type MarketplaceTitle } from "../marketplace/useMarketplaceCatalog";
import { MarketplaceCard } from "../marketplace/MarketplaceCard";
import { STATE_LABEL, STATE_TONE, OPEN_STATES, ACTIVE_STATES, CLOSED_STATES, type Row } from "../requests/shared";
import { cn } from "@/lib/utils";
import type { BuyerSectionId } from "./BuyerNav";

type PendingDelivery = { id: string; status: string; buyer_org_name: string | null; updated_at: string };

export default function DashboardSection({
  rows,
  screenerCount,
  onGo,
  onRequestForTitle,
}: {
  rows: Row[];
  screenerCount: number;
  onGo: (s: BuyerSectionId) => void;
  onRequestForTitle: (t: MarketplaceTitle, hint: "screener" | "acquisition") => void;
}) {
  const { user } = useAuth();
  const { items: watchItems, has, toggle } = useWatchlist();
  const { rows: catalog } = useMarketplaceCatalog();
  const [pending, setPending] = useState<PendingDelivery[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("deal_deliveries")
        .select("id,status,buyer_org_name,updated_at")
        .eq("buyer_user_id", user.id)
        .not("status", "in", "(delivered,completed,downloaded)")
        .order("updated_at", { ascending: false })
        .limit(4);
      if (cancelled) return;
      setPending((data as unknown as PendingDelivery[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const openRequests = rows.filter(r => OPEN_STATES.includes(r.state)).length;
  const activeConversations = rows.filter(r => ACTIVE_STATES.includes(r.state)).length;
  const closedRequests = rows.filter(r => CLOSED_STATES.includes(r.state)).length;

  const recommended = catalog.slice(0, 4);
  const recentActivity = rows.slice(0, 5);
  const activeRequests = rows.filter(r => !CLOSED_STATES.includes(r.state)).slice(0, 4);
  const watchPreview = watchItems.slice(0, 3);

  return (
    <div className="space-y-6">
      <BuyerPlanStrip
        openRequests={openRequests}
        activeConversations={activeConversations}
        approvedScreeners={screenerCount}
        onNewRequest={() => onGo("requests")}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric icon={Inbox} label="Open requests" value={openRequests} />
        <Metric icon={Film} label="Approved screeners" value={screenerCount} />
        <Metric icon={MessagesSquare} label="Active conversations" value={activeConversations} />
        <Metric icon={Package} label="Pending deliveries" value={pending.length} />
      </div>

      {/* Recommended Titles */}
      <section aria-labelledby="rec-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="rec-heading" className="font-display text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" aria-hidden /> Recommended titles
          </h2>
          <Button size="sm" variant="ghost" onClick={() => onGo("marketplace")}>
            Browse marketplace <ArrowRight className="w-3.5 h-3.5 ml-1" aria-hidden />
          </Button>
        </div>
        {recommended.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published titles right now — check back soon.</p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 list-none">
            {recommended.map(t => (
              <li key={t.id}>
                <MarketplaceCard
                  t={t}
                  actions={{
                    isWatched: has(t.id),
                    onToggleWatch: (x) => toggle({ id: x.id, title: x.title, posterUrl: x.poster_url, contentType: x.content_type }),
                    onView: () => onGo("marketplace"),
                    onRequestScreener: (x) => onRequestForTitle(x, "screener"),
                    onRequestAcquisition: (x) => onRequestForTitle(x, "acquisition"),
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Active requests */}
        <section className="lg:col-span-2 rounded-2xl border border-border/40 bg-secondary/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base">Active requests</h2>
            <Button size="sm" variant="ghost" onClick={() => onGo("requests")}>
              View all <ArrowRight className="w-3.5 h-3.5 ml-1" aria-hidden />
            </Button>
          </div>
          {activeRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No open requests. Submit a brief to begin.</p>
          ) : (
            <ul className="divide-y divide-border/40 list-none">
              {activeRequests.map(r => (
                <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.title_query || "Untitled brief"}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3" aria-hidden /> {new Date(r.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <span className={cn("text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap",
                    STATE_TONE[r.state] ?? "bg-secondary text-muted-foreground border-border/60")}>
                    {STATE_LABEL[r.state] ?? r.state}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Pending deliveries */}
        <section className="rounded-2xl border border-border/40 bg-secondary/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base flex items-center gap-2">
              <Package className="w-4 h-4" aria-hidden /> Pending deliveries
            </h2>
            <Button size="sm" variant="ghost" onClick={() => onGo("deliveries")}>
              All <ArrowRight className="w-3.5 h-3.5 ml-1" aria-hidden />
            </Button>
          </div>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nothing pending.</p>
          ) : (
            <ul className="space-y-2 list-none">
              {pending.map(p => (
                <li key={p.id} className="text-sm">
                  <div className="font-medium truncate">{p.buyer_org_name ?? "Delivery"}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">
                    {p.status.replace(/_/g, " ")} · {new Date(p.updated_at).toLocaleDateString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Watchlist */}
        <section className="lg:col-span-2 rounded-2xl border border-border/40 bg-secondary/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base flex items-center gap-2">
              <Bookmark className="w-4 h-4" aria-hidden /> Watchlist
            </h2>
            <Button size="sm" variant="ghost" onClick={() => onGo("watchlist")}>
              Manage <ArrowRight className="w-3.5 h-3.5 ml-1" aria-hidden />
            </Button>
          </div>
          {watchPreview.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nothing tracked yet. Bookmark titles from the marketplace.
            </p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 list-none">
              {watchPreview.map(i => (
                <li key={i.id} className="rounded-lg border border-border/40 bg-background/40 p-2 flex gap-2">
                  <div className="w-10 h-14 rounded bg-secondary/40 overflow-hidden shrink-0">
                    {i.posterUrl && <img src={i.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{i.title}</div>
                    {i.contentType && <div className="text-[10px] text-muted-foreground capitalize">{i.contentType}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Business overview */}
        <section className="rounded-2xl border border-border/40 bg-secondary/10 p-5">
          <h2 className="font-display text-base mb-3">Business overview</h2>
          <ul className="text-sm space-y-2 list-none">
            <Stat label="Total requests" value={rows.length} />
            <Stat label="Open" value={openRequests} />
            <Stat label="Active conversation" value={activeConversations} />
            <Stat label="Closed" value={closedRequests} />
            <Stat label="Watchlist" value={watchItems.length} />
          </ul>
        </section>
      </div>

      {/* Recent activity */}
      <section className="rounded-2xl border border-border/40 bg-secondary/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base">Recent activity</h2>
          <Button size="sm" variant="ghost" onClick={() => onGo("requests")}>
            View all <ArrowRight className="w-3.5 h-3.5 ml-1" aria-hidden />
          </Button>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-border/40 list-none">
            {recentActivity.map(r => (
              <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.title_query || "Untitled brief"}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3 h-3" aria-hidden /> {new Date(r.updated_at).toLocaleString()}
                  </div>
                </div>
                <span className={cn("text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap",
                  STATE_TONE[r.state] ?? "bg-secondary text-muted-foreground border-border/60")}>
                  {STATE_LABEL[r.state] ?? r.state}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quick actions */}
      <BuyerQuickActions
        onNewRequest={() => onGo("requests")}
        onCatalogRequest={() => onGo("requests")}
      />
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/10 p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3.5 h-3.5" aria-hidden /> {label}
      </div>
      <div className="font-display text-2xl mt-1.5 tabular-nums">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between border-b border-border/30 pb-1.5 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </li>
  );
}
