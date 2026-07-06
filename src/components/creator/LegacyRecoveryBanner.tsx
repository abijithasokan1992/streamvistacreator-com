import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Sparkles, ArrowRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

/**
 * Legacy Film Recovery banner + per-title completion checklist.
 * Shown on the creator Home when the user has one or more titles restored
 * from `legacy_film_imports` (metadata->>'legacy_import' === 'true').
 *
 * Each restored title shows a 5-step checklist:
 *   1. Title & synopsis        (title present + synopsis)
 *   2. Language & runtime      (language + duration_minutes)
 *   3. Cast & director         (metadata.director + metadata.cast)
 *   4. Poster & trailer        (title_assets: poster + trailer)
 *   5. Master video uploaded   (title_assets: master OR video)
 *
 * Progress = percentage of steps satisfied. Titles at 100% and status other
 * than 'draft' are hidden from the checklist (already submitted).
 */

const DISMISS_KEY = "sv_legacy_banner_dismissed";

type LegacyTitle = {
  id: string;
  title: string;
  synopsis: string | null;
  language: string | null;
  duration_minutes: number | null;
  status: string;
  metadata: Record<string, any> | null;
  assetKinds: Set<string>;
  steps: { label: string; done: boolean }[];
  percent: number;
};

export default function LegacyRecoveryBanner({ onNavigate }: { onNavigate?: (s: any) => void }) {
  const { user } = useAuth();
  const [titles, setTitles] = useState<LegacyTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: rows } = await (supabase as any)
          .from("content_titles")
          .select("id, title, synopsis, language, duration_minutes, status, metadata")
          .eq("owner_user_id", user.id)
          .contains("metadata", { legacy_import: true });

        const list = (rows ?? []) as any[];
        if (list.length === 0) { if (!cancelled) setTitles([]); return; }

        const ids = list.map((r) => r.id);
        const { data: assets } = await (supabase as any)
          .from("title_assets")
          .select("title_id, category")
          .in("title_id", ids);

        const byTitle = new Map<string, Set<string>>();
        for (const a of (assets ?? []) as any[]) {
          const set = byTitle.get(a.title_id) ?? new Set<string>();
          set.add(String(a.category).toLowerCase());
          byTitle.set(a.title_id, set);
        }

        const computed: LegacyTitle[] = list.map((r) => {
          const meta = (r.metadata ?? {}) as Record<string, any>;
          const cats = byTitle.get(r.id) ?? new Set<string>();
          const hasPoster = cats.has("poster") || cats.has("key_art") || cats.has("artwork");
          const hasTrailer = cats.has("trailer");
          const hasMaster = cats.has("master") || cats.has("video") || cats.has("proxy") || cats.has("feature");
          const steps = [
            { label: "Title & synopsis", done: !!r.title && !!r.synopsis && r.synopsis.trim().length > 20 },
            { label: "Language & runtime", done: !!r.language && !!r.duration_minutes },
            { label: "Cast & director", done: !!meta.director && !!meta.cast },
            { label: "Poster & trailer uploaded", done: hasPoster && hasTrailer },
            { label: "Master video uploaded", done: hasMaster },
          ];
          const done = steps.filter((s) => s.done).length;
          return {
            id: r.id, title: r.title, synopsis: r.synopsis, language: r.language,
            duration_minutes: r.duration_minutes, status: r.status, metadata: meta,
            assetKinds: kinds, steps, percent: Math.round((done / steps.length) * 100),
          };
        });

        // Hide titles that are already submitted/approved and complete.
        const visible = computed.filter((t) => t.status === "draft" || t.percent < 100);
        if (!cancelled) setTitles(visible);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (loading || titles.length === 0 || dismissed) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ }
    setDismissed(true);
  };

  return (
    <section
      aria-label="Legacy films restored"
      className="rounded-xl border border-accent/40 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent p-5 sm:p-6 space-y-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/20 grid place-items-center shrink-0">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.22em] text-accent font-semibold">
              Legacy films recovered
            </p>
            <h2 className="font-display text-lg sm:text-xl mt-1">
              Welcome back! Your legacy films have been restored as drafts.
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
              Complete each title to 100% and submit for review. We saved every piece of
              metadata we had; upload the master video and confirm details to finish.
            </p>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="p-1.5 rounded hover:bg-secondary/40 text-muted-foreground shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ul className="space-y-3">
        {titles.map((t) => (
          <li
            key={t.id}
            className="rounded-lg border border-border/60 bg-background/50 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{t.title}</p>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  {t.percent}% complete · {t.status}
                </p>
              </div>
              <Link
                to={`/dashboard/content?section=titles&title=${t.id}`}
                onClick={() => onNavigate?.("titles")}
                className="text-xs inline-flex items-center gap-1 text-accent hover:underline"
              >
                Finish this title <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="h-1.5 rounded bg-secondary/40 overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${t.percent}%` }}
              />
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {t.steps.map((s, i) => (
                <li
                  key={i}
                  className={`flex items-center gap-2 text-xs ${s.done ? "text-muted-foreground line-through" : "text-foreground"}`}
                >
                  {s.done
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                    : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                  <span className="truncate">{s.label}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
