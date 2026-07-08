import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, ArrowRight, Film, Play, Briefcase, Bell, Upload, FolderOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  listTitlesPage, fetchFreeTierStatus,
  type TitleRow, type FreeTierStatus,
} from "@/lib/creator/titleApi";
import StorageLive from "@/components/creator/StorageLive";
import LegacyRecoveryBanner from "@/components/creator/LegacyRecoveryBanner";
import { StatusBadge } from "@/components/creator/title/StatusBadge";
import { QuickActionCard } from "@/components/shared/tools/QuickActionCard";
import type { SectionId } from "@/components/creator/CreatorSidebar";

/**
 * Creator Home — enterprise-scale performance edition.
 *
 * UI is unchanged. Under the hood:
 *   • Paginated Recent Titles via `listTitlesPage` + IntersectionObserver
 *     infinite scroll (page size 12, capped by RECENT_MAX for the Home surface).
 *   • Poster URLs cached in a module-level Map so navigations back are instant
 *     and re-renders never re-hit the DB.
 *   • Titles cached per user across mounts; instant first paint on return.
 *   • Poster <img> uses native lazy + async decoding; tiles use
 *     content-visibility auto for cheap offscreen skipping (thousands of tiles).
 *   • Skeleton loaders on first paint and on load-more.
 *   • Recent activity and free-tier are decoupled from title paging.
 */

// ─── module-level caches (survive component unmount / re-mounts) ────────────
const posterCache = new Map<string, string>();          // titleId → par_url
const posterFetched = new Set<string>();                 // titleIds we've already looked up
type TitlesCacheEntry = { rows: TitleRow[]; hasMore: boolean; nextOffset: number };
const titlesCache = new Map<string, TitlesCacheEntry>(); // userId → paged state

const PAGE_SIZE = 12;
const RECENT_MAX = 240; // hard cap on the Home poster feed; the full catalog lives on the Titles page

async function hydratePosters(titleIds: string[]) {
  const missing = titleIds.filter((id) => !posterFetched.has(id));
  if (missing.length === 0) return;
  missing.forEach((id) => posterFetched.add(id));
  const { data } = await (supabase as any)
    .from("title_assets")
    .select("title_id, is_primary, category, upload:recent_uploads(par_url)")
    .in("title_id", missing)
    .eq("category", "poster")
    .eq("is_primary", true);
  for (const a of ((data ?? []) as any[])) {
    const url = a?.upload?.par_url;
    if (url && !posterCache.has(a.title_id)) posterCache.set(a.title_id, url);
  }
}

export default function HomeSection({
  onNavigate, isFree,
}: { onNavigate: (s: SectionId) => void; isFree: boolean }) {
  const { user } = useAuth();
  const cacheKey = user?.id ?? "";
  const cached = cacheKey ? titlesCache.get(cacheKey) : undefined;

  const [titles, setTitles] = useState<TitleRow[]>(cached?.rows ?? []);
  const [hasMore, setHasMore] = useState<boolean>(cached?.hasMore ?? true);
  const [nextOffset, setNextOffset] = useState<number>(cached?.nextOffset ?? 0);
  const [tier, setTier] = useState<FreeTierStatus | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(!cached);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posterVersion, setPosterVersion] = useState(0); // trigger re-render when cache fills
  const inflightRef = useRef(false);

  const persist = useCallback((rows: TitleRow[], more: boolean, offset: number) => {
    if (cacheKey) titlesCache.set(cacheKey, { rows, hasMore: more, nextOffset: offset });
  }, [cacheKey]);

  // ── initial page + auxiliary data ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      if (!cached) setLoading(true);
      try {
        const [page, fs] = await Promise.all([
          listTitlesPage(user.id, 0, PAGE_SIZE),
          fetchFreeTierStatus().catch(() => null),
        ]);
        if (cancelled) return;
        setTier(fs);
        setTitles(page.rows);
        setHasMore(page.hasMore);
        setNextOffset(page.rows.length);
        persist(page.rows, page.hasMore, page.rows.length);

        // Posters for the first page.
        await hydratePosters(page.rows.map((r) => r.id));
        if (!cancelled) setPosterVersion((v) => v + 1);

        // Recent activity (independent of paging).
        const titleIds = page.rows.map((x) => x.id);
        const [notes, appr] = await Promise.all([
          (supabase as any).from("notifications")
            .select("id, title, message, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }).limit(6),
          titleIds.length
            ? (supabase as any).from("content_approvals")
                .select("id, title_id, to_status, note, created_at")
                .in("title_id", titleIds)
                .order("created_at", { ascending: false }).limit(6)
            : Promise.resolve({ data: [] }),
        ]);
        const tmap = new Map(page.rows.map((x) => [x.id, x.title]));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── load-more (infinite scroll) ──────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!user || inflightRef.current || !hasMore) return;
    if (titles.length >= RECENT_MAX) { setHasMore(false); return; }
    inflightRef.current = true;
    setLoadingMore(true);
    try {
      const remaining = RECENT_MAX - titles.length;
      const limit = Math.min(PAGE_SIZE, remaining);
      const page = await listTitlesPage(user.id, nextOffset, limit);
      const merged = [...titles, ...page.rows];
      const more = page.hasMore && merged.length < RECENT_MAX;
      setTitles(merged);
      setHasMore(more);
      setNextOffset(merged.length);
      persist(merged, more, merged.length);
      await hydratePosters(page.rows.map((r) => r.id));
      setPosterVersion((v) => v + 1);
    } finally {
      setLoadingMore(false);
      inflightRef.current = false;
    }
  }, [user, hasMore, titles, nextOffset, persist]);

  // ── IntersectionObserver sentinel ────────────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadMore]);

  const recent = titles[0];
  const capped = isFree && tier && !tier.can_create_draft && tier.lifecycle_count >= 1;
  // `posterVersion` is referenced so the memo re-computes when the poster cache fills.
  const posterOf = useMemo(() => {
    void posterVersion;
    return (id: string) => posterCache.get(id);
  }, [posterVersion]);

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
              {posterOf(recent.id) ? (
                <img
                  src={posterOf(recent.id)}
                  alt=""
                  loading="lazy"
                  decoding="async"
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

      {/* 2 · Recent Titles — infinite scroll poster grid */}
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
          <PosterGridSkeleton count={PAGE_SIZE} />
        ) : titles.length === 0 ? (
          <EmptyState
            icon={Film}
            title="Your catalog is empty"
            message="Recent titles will appear here once you start adding content."
            cta={capped ? "Upgrade to upload" : "Upload first title"}
            onClick={() => onNavigate(capped ? "billing" : "titles")}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {titles.map((t) => (
                <PosterTile
                  key={t.id}
                  title={t}
                  poster={posterOf(t.id)}
                  onClick={() => onNavigate("titles")}
                />
              ))}
              {loadingMore && Array.from({ length: 5 }).map((_, i) => (
                <div key={`sk-${i}`} className="aspect-[2/3] rounded-xl border border-border/40 bg-secondary/10 animate-pulse" />
              ))}
            </div>
            {hasMore && (
              <div ref={sentinelRef} aria-hidden className="h-8 w-full" />
            )}
          </>
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

function PosterGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-[2/3] rounded-xl border border-border/40 bg-secondary/10 animate-pulse" />
      ))}
    </div>
  );
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

/**
 * PosterTile
 *
 * `content-visibility: auto` + `contain-intrinsic-size` lets the browser skip
 * layout/paint for offscreen tiles — this is what makes rendering thousands
 * of posters feasible without a heavy virtualization library.
 */
function PosterTile({
  title, poster, onClick,
}: { title: TitleRow; poster?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
      aria-label={`Open ${title.title || "Untitled"}`}
      style={{ contentVisibility: "auto", containIntrinsicSize: "320px 480px" } as React.CSSProperties}
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-border/40 bg-gradient-to-br from-secondary/30 to-secondary/5">
        {poster ? (
          <img
            src={poster}
            alt=""
            loading="lazy"
            decoding="async"
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
