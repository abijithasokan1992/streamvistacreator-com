import { useEffect, useMemo, useState } from "react";
import {
  Plus, ArrowRight, Film, Play, Briefcase, Bell, Upload, FolderOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  listTitles, fetchFreeTierStatus,
  type TitleRow, type FreeTierStatus,
} from "@/lib/creator/titleApi";
import StorageLive from "@/components/creator/StorageLive";
import LegacyRecoveryBanner from "@/components/creator/LegacyRecoveryBanner";
import { StatusBadge } from "@/components/creator/title/StatusBadge";
import { QuickActionCard } from "@/components/shared/tools/QuickActionCard";
import type { SectionId } from "@/components/creator/CreatorSidebar";

/**
 * Creator Home — premium, workflow-first dashboard.
 *
 * Sections (in order):
 *   1. Continue Working      — primary title card with quick actions
 *   2. Recent Titles         — large poster previews with hover Open action
 *   3. Storage               — single compact StorageLive card
 *   4. Business              — contextual CTA card
 *   5. Recent Activity       — notifications + approval log
 *
 * No backend changes. Reuses existing title_assets, recent_uploads,
 * notifications, and content_approvals queries. Poster URLs come from the
 * primary poster asset's `par_url`. All navigation uses existing section ids.
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
    <div className="space-y-10">
      <LegacyRecoveryBanner onNavigate={onNavigate} />

      <header className="space-y-1">
        <h1 className="font-display text-2xl md:text-3xl">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Your creator workspace at a glance.
        </p>
      </header>

      {/* 1 · Continue Working */}
      <Section title="Continue Working">
        {loading ? (
          <Skeleton h="128px" />
        ) : recent ? (
          <div className="rounded-xl border border-border/50 bg-card/40 p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
            <div className="shrink-0">
              {posters[recent.id] ? (
                <img
                  src={posters[recent.id]}
                  alt=""
                  className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg object-cover border border-border/50"
                />
              ) : (
                <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg bg-secondary/50 grid place-items-center border border-border/50">
                  <Film className="w-8 h-8 text-muted-foreground/50" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Continue working on</p>
                  <p className="font-semibold text-base sm:text-lg truncate">{recent.title || "Untitled"}</p>
                </div>
                <StatusBadge status={recent.status} />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {friendlyStatus(recent.status)} · Last updated {timeAgo(recent.updated_at)}
              </p>
              <div className="flex items-center gap-2 mt-auto pt-4">
                <Button size="sm" onClick={() => onNavigate("titles")}>
                  <Play className="w-4 h-4" /> Continue
                </Button>
                <Button size="sm" variant="outline" onClick={() => onNavigate("titles")}>
                  <FolderOpen className="w-4 h-4" /> Open
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Film}
            title="No titles yet"
            message="Start your first title to upload posters, trailers, and masters."
            cta={capped ? "Upgrade to upload" : "Upload first title"}
            onClick={() => onNavigate(capped ? "billing" : "titles")}
          />
        )}
      </Section>

      {/* 2 · Recent Titles — large poster grid */}
      <Section
        title="Recent Titles"
        action={titles.length > 0 ? { label: "View all", onClick: () => onNavigate("titles") } : undefined}
        right={titles.length > 0 && !capped ? (
          <Button size="sm" onClick={() => onNavigate("titles")}>
            <Upload className="w-4 h-4" /> Upload
          </Button>
        ) : undefined}
      >
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl border border-border/40 bg-secondary/10 animate-pulse" />
            ))}
          </div>
        ) : posterTitles.length === 0 ? (
          <EmptyState
            icon={Film}
            title="Your catalog is empty"
            message="Recent titles will appear here once you start adding content."
            cta={capped ? "Upgrade to upload" : "Upload first title"}
            onClick={() => onNavigate(capped ? "billing" : "titles")}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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

      {/* 3 · Storage — single compact card */}
      <Section
        title="Storage"
        action={{ label: "Manage storage", onClick: () => onNavigate("storage") }}
      >
        <StorageLive compact />
      </Section>

      {/* 4 · Business */}
      <Section title="Business">
        <QuickActionCard
          icon={Briefcase}
          title={isFree ? "Unlock buyer interest & offers" : "Buyer interest, offers and deals"}
          description={isFree ? "Upgrade to open commercial activity." : "Track commercial activity on your titles."}
          cta={isFree ? "Upgrade plan" : "Open business"}
          tone="accent"
          onClick={() => onNavigate(isFree ? "billing" : "business")}
        />
      </Section>

      {/* 5 · Recent Activity */}
      <Section
        title="Recent Activity"
        action={activity.length > 0 ? { label: "See all", onClick: () => onNavigate("activity") } : undefined}
      >
        {loading ? (
          <Skeleton h="140px" />
        ) : activity.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">No activity yet.</p>
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
  title, action, right, children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-lg md:text-xl tracking-tight">{title}</h2>
        <div className="flex items-center gap-3">
          {right}
          {action && (
            <button onClick={action.onClick} className="text-xs text-accent hover:underline shrink-0">
              {action.label} →
            </button>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function Skeleton({ h }: { h: string }) {
  return <div className="rounded-xl border border-border/40 bg-secondary/5 animate-pulse" style={{ height: h }} />;
}

function EmptyState({
  icon: Icon, title, message, cta, onClick,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-6 sm:p-8 text-center">
      <div className="w-12 h-12 rounded-xl bg-secondary/50 grid place-items-center mx-auto mb-3">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="font-semibold text-base">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{message}</p>
      <Button size="sm" className="mt-4" onClick={onClick}>
        <Upload className="w-4 h-4" /> {cta}
      </Button>
    </div>
  );
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
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-background/90 text-foreground px-3 py-1.5 text-xs font-medium shadow-sm">
            <FolderOpen className="w-3.5 h-3.5" />
            Open
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
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
