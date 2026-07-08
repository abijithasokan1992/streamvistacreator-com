import { useEffect, useMemo, useState } from "react";
import {
  Plus, ArrowRight, Film, Play, Briefcase, Bell,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  listTitles, fetchFreeTierStatus,
  type TitleRow, type FreeTierStatus,
} from "@/lib/creator/titleApi";
import StorageLive from "@/components/creator/StorageLive";
import LegacyRecoveryBanner from "@/components/creator/LegacyRecoveryBanner";
import { StatusBadge } from "@/components/creator/title/StatusBadge";
import type { SectionId } from "@/components/creator/CreatorSidebar";

/**
 * Creator Home — premium, media-first.
 *
 * Sections (in order):
 *   1. Continue Working
 *   2. Recent Titles      — large poster previews
 *   3. Storage            — single StorageLive instance
 *   4. Business           — link into Business section
 *   5. Recent Activity    — notifications + approval log
 *
 * No backend changes. Uses existing title_assets/recent_uploads/notifications
 * queries. Poster URLs come from the primary poster asset's `par_url`.
 */
export default function HomeSection({
  onNavigate, isFree,
}: { onNavigate: (s: SectionId) => void; isFree: boolean }) {
  const { user } = useAuth();
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [posters, setPosters] = useState<Record<string, string>>({});
  const [tier, setTier] = useState<FreeTierStatus | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [t, fs] = await Promise.all([
          listTitles(user.id),
          fetchFreeTierStatus().catch(() => null),
        ]);
        if (cancelled) return;
        setTitles(t);
        setTier(fs);

        const recentIds = t.slice(0, 6).map((x) => x.id);
        if (recentIds.length) {
          const { data: assets } = await (supabase as any)
            .from("title_assets")
            .select("title_id, is_primary, category, upload:recent_uploads(par_url)")
            .in("title_id", recentIds)
            .eq("category", "poster")
            .eq("is_primary", true);
          const map: Record<string, string> = {};
          for (const a of (assets ?? []) as any[]) {
            const url = a?.upload?.par_url;
            if (url && !map[a.title_id]) map[a.title_id] = url;
          }
          if (!cancelled) setPosters(map);
        }

        // Recent activity: notifications + approval log (last 6 combined)
        const [notes, appr] = await Promise.all([
          (supabase as any).from("notifications")
            .select("id, title, message, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }).limit(6),
          t.length
            ? (supabase as any).from("content_approvals")
                .select("id, title_id, to_status, note, created_at")
                .in("title_id", t.map((x) => x.id))
                .order("created_at", { ascending: false }).limit(6)
            : Promise.resolve({ data: [] }),
        ]);
        const tmap = new Map(t.map((x) => [x.id, x.title]));
        const items: ActivityItem[] = [
          ...((notes.data ?? []) as any[]).map((n) => ({
            id: `n-${n.id}`, label: n.title || "Update",
            hint: n.message || "", at: n.created_at,
          })),
          ...((appr.data ?? []) as any[]).map((a) => ({
            id: `a-${a.id}`,
            label: `${tmap.get(a.title_id) ?? "Title"} · ${friendlyStatus(a.to_status)}`,
            hint: a.note || "",
            at: a.created_at,
          })),
        ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 5);
        if (!cancelled) setActivity(items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const recent = titles[0];
  const capped = isFree && tier && !tier.can_create_draft && tier.lifecycle_count >= 1;
  const posterTitles = useMemo(() => titles.slice(0, 6), [titles]);

  return (
    <div className="space-y-8">
      <LegacyRecoveryBanner onNavigate={onNavigate} />

      {/* 1 · Continue Working */}
      <Section title="Continue Working">
        {loading ? (
          <Skeleton h="92px" />
        ) : recent ? (
          <button
            onClick={() => onNavigate("titles")}
            className="w-full rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent/15 p-4 sm:p-5 text-left flex items-center gap-3 transition-colors"
          >
            <Play className="w-5 h-5 text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm sm:text-base truncate">{recent.title || "Untitled"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {friendlyStatus(recent.status)} · Continue editing
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ) : (
          <button
            onClick={() => onNavigate(capped ? "billing" : "titles")}
            className="w-full rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent/15 p-4 sm:p-5 text-left flex items-center gap-3 transition-colors"
          >
            <Plus className="w-5 h-5 text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm sm:text-base">
                {capped ? "Upgrade to add more titles" : "Start a new title"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {capped ? "Free plan includes 1 title." : "Add details, upload files, and submit when ready."}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        )}
      </Section>

      {/* 2 · Recent Titles — poster grid */}
      <Section
        title="Recent Titles"
        action={titles.length > 0 ? { label: "View all", onClick: () => onNavigate("titles") } : undefined}
      >
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl border border-border/40 bg-secondary/10 animate-pulse" />
            ))}
          </div>
        ) : posterTitles.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-secondary/5 p-6 text-sm text-muted-foreground text-center">
            No titles yet — start your first one.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {posterTitles.map((t) => (
              <PosterTile
                key={t.id}
                title={t}
                poster={posters[t.id]}
                onClick={() => onNavigate("titles")}
              />
            ))}
          </div>
        )}
      </Section>

      {/* 3 · Storage — single instance */}
      <Section title="Storage">
        <StorageLive />
      </Section>

      {/* 4 · Business */}
      <Section title="Business">
        <button
          onClick={() => onNavigate(isFree ? "billing" : "business")}
          className="w-full rounded-xl border border-border/50 bg-secondary/10 hover:bg-secondary/20 p-4 sm:p-5 text-left flex items-center gap-3 transition-colors"
        >
          <Briefcase className="w-5 h-5 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm sm:text-base">
              {isFree ? "Unlock buyer interest & offers" : "Buyer interest, offers and deals"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isFree ? "Upgrade to open commercial activity." : "Track commercial activity on your titles."}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      </Section>

      {/* 5 · Recent Activity */}
      <Section
        title="Recent Activity"
        action={activity.length > 0 ? { label: "See all", onClick: () => onNavigate("activity") } : undefined}
      >
        {loading ? (
          <Skeleton h="140px" />
        ) : activity.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-secondary/5 p-4 text-sm text-muted-foreground">
            No activity yet.
          </div>
        ) : (
          <div className="rounded-xl border border-border/40 bg-secondary/5 divide-y divide-border/40">
            {activity.map((a) => (
              <div key={a.id} className="p-3.5 flex items-start gap-3 min-w-0">
                <Bell className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{a.label}</p>
                  {a.hint && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.hint}</p>}
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
                  {timeAgo(a.at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ─────────── UI helpers ─────────── */

function Section({
  title, action, children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <h2 className="font-display text-lg md:text-xl">{title}</h2>
        {action && (
          <button onClick={action.onClick} className="text-xs text-accent hover:underline shrink-0">
            {action.label} →
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Skeleton({ h }: { h: string }) {
  return <div className="rounded-xl border border-border/40 bg-secondary/5 animate-pulse" style={{ height: h }} />;
}

function PosterTile({
  title, poster, onClick,
}: { title: TitleRow; poster?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
      aria-label={`Open ${title.title || "Untitled"}`}
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-border/40 bg-gradient-to-br from-secondary/30 to-secondary/5">
        {poster ? (
          <img
            src={poster}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Film className="w-8 h-8 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <p className="text-xs font-semibold text-white truncate">{title.title || "Untitled"}</p>
        </div>
        <div className="absolute top-2 left-2">
          <StatusBadge status={title.status} />
        </div>
      </div>
    </button>
  );
}

/* ─────────── data helpers ─────────── */

type ActivityItem = { id: string; label: string; hint: string; at: string };

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - +new Date(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function friendlyStatus(s: string): string {
  switch (s) {
    case "draft":
    case "incomplete": return "Draft";
    case "submitted": return "Submitted";
    case "in_review":
    case "qc_review":
    case "legal_review":
    case "hold": return "Under Review";
    case "changes_requested": return "Changes Requested";
    case "approved":
    case "ready_for_distribution": return "Approved";
    case "rejected": return "Not Accepted";
    case "published": return "Published";
    case "archived": return "Archived";
    default: return s;
  }
}
