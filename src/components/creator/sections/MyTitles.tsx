import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Pencil, Eye, Lock, Crown, AlertTriangle, X, Film, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import {
  createTitle, listTitles, fetchFreeTierStatus, findFirstActiveDraft,
  type TitleRow, type FreeTierStatus,
} from "@/lib/creator/titleApi";
import { CONTENT_TYPE_OPTIONS, CONTENT_TYPE_LABEL, type TitleMetadata } from "@/lib/creator/titleSchema";
import { StatusBadge } from "@/components/creator/title/StatusBadge";
import { TitleEditor } from "@/components/creator/title/TitleEditor";
import { AgreementGate } from "@/components/legal/AgreementGate";
import { supabase } from "@/integrations/supabase/client";

import { cn } from "@/lib/utils";

type DeleteEligibility = {
  allow: boolean;
  reason: string;
  blockers?: string[];
  lock_days_remaining?: number;
  lock_active?: boolean;
  early_termination_fee_inr?: number;
  status?: string;
};

type Format = TitleMetadata["format"];

export default function MyTitlesSection() {
  const { user } = useAuth();
  const { active } = useWorkspaces();
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<FreeTierStatus | null>(null);
  const [creating, setCreating] = useState(false);
  const [gating, setGating] = useState(false);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"edit" | "view">("edit");
  const [filter, setFilter] = useState<"all" | "drafts" | "in_review" | "approved">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "updated">("updated");
  const [deleteTarget, setDeleteTarget] = useState<TitleRow | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [ts, t] = await Promise.all([listTitles(user.id), fetchFreeTierStatus()]);
      setTitles(ts);
      setTier(t);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const handleStartCreate = async () => {
    if (!user) return;
    // Free-tier: if a draft already exists, reopen it instead of allowing a duplicate.
    if (tier?.is_free && !tier.can_create_draft) {
      const draft = await findFirstActiveDraft(user.id);
      if (draft) {
        toast.info("Free plan allows 1 draft — reopening your existing one.");
        setEditorId(draft.id);
        setEditorMode("edit");
        return;
      }
      toast.error("Free plan limit reached. Upgrade from Storage & Billing to add more titles.");
      return;
    }
    setGating(true);
  };

  const freeLimitHit = !!tier?.is_free && tier.lifecycle_count >= 1 && !tier.can_create_draft;

  const FILTERS = useMemo(() => ({
    all: (_: TitleRow) => true,
    drafts: (t: TitleRow) => ["draft", "incomplete", "changes_requested"].includes(t.status),
    in_review: (t: TitleRow) => ["submitted", "in_review", "qc_review", "legal_review", "hold"].includes(t.status),
    approved: (t: TitleRow) => ["approved", "ready_for_distribution", "published"].includes(t.status),
  }), []);

  const counts = useMemo(() => ({
    all: titles.length,
    drafts: titles.filter(FILTERS.drafts).length,
    in_review: titles.filter(FILTERS.in_review).length,
    approved: titles.filter(FILTERS.approved).length,
  }), [titles, FILTERS]);

  const visible = useMemo(() => {
    const filtered = titles.filter(FILTERS[filter]);
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "newest") return +new Date(b.created_at) - +new Date(a.created_at);
      if (sort === "oldest") return +new Date(a.created_at) - +new Date(b.created_at);
      return +new Date(b.updated_at) - +new Date(a.updated_at);
    });
    return sorted;
  }, [titles, filter, sort, FILTERS]);


  return (
    <div>
      {tier?.is_free && (
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3 text-xs sm:text-sm">
          <Crown className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Free plan — 1 title only</div>
            <div className="text-muted-foreground mt-0.5">
              {tier.draft_count}/1 draft · {tier.lifecycle_count}/1 submission used. Upgrade for additional submissions and 5 TB storage.
            </div>
          </div>
          <a
            href="?section=billing"
            className="text-[11px] rounded-md border border-amber-500/40 px-2.5 py-1 hover:bg-amber-500/10 whitespace-nowrap"
          >
            Open Billing
          </a>
        </div>
      )}

      {/* Upgrade CTA lives on the Billing section — the inline free-plan banner above
          already surfaces the limit here and links straight to Billing. */}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-xs text-muted-foreground">
          {loading ? "Loading…" : `${visible.length} of ${titles.length} title${titles.length === 1 ? "" : "s"}`}
        </p>
        <button
          onClick={handleStartCreate}
          disabled={freeLimitHit}
          title={freeLimitHit ? "Free plan limit reached — upgrade to add more titles" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md text-xs px-3 py-1.5 transition-colors",
            freeLimitHit
              ? "border border-amber-500/40 text-amber-200/80 bg-amber-500/5 cursor-not-allowed"
              : "bg-accent text-accent-foreground hover:bg-accent/90",
          )}
        >
          {freeLimitHit ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {freeLimitHit ? "Upgrade to add" : "New Title"}
        </button>
      </div>

      {/* Filter chips + sort */}
      {titles.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {([
              ["all", "All"],
              ["drafts", "Drafts"],
              ["in_review", "In Review"],
              ["approved", "Approved"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn(
                  "text-[11px] rounded-full border px-2.5 py-1 transition-colors",
                  filter === id
                    ? "border-accent/60 bg-accent/15 text-foreground"
                    : "border-border/40 bg-secondary/5 text-muted-foreground hover:bg-secondary/20",
                )}
              >
                {label} <span className="opacity-60">({counts[id]})</span>
              </button>
            ))}
          </div>
          <label className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="bg-background border border-border/40 rounded-md text-[11px] px-2 py-1"
            >
              <option value="updated">Recently updated</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>
        </div>
      )}



      {gating && (
        <AgreementGate
          type="creator_master"
          context={{ action: "create_title" }}
          onCancel={() => setGating(false)}
          onAccepted={() => { setGating(false); setCreating(true); }}
        />
      )}

      {creating && user && (
        <CreateTitleModal
          onClose={() => setCreating(false)}
          onCreated={async (id) => {
            setCreating(false);
            await reload();
            setEditorId(id);
            setEditorMode("edit");
          }}
          workspaceId={active?.id ?? null}
          userId={user.id}
        />
      )}


      {loading ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
          role="status"
          aria-label="Loading your titles"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/40 bg-secondary/5 p-4 flex flex-col gap-3 animate-pulse"
            >
              <div className="h-4 w-2/3 bg-secondary/40 rounded" />
              <div className="h-3 w-1/2 bg-secondary/30 rounded" />
              <div className="h-4 w-20 bg-secondary/30 rounded-full mt-1" />
              <div className="flex gap-1.5 mt-auto pt-2">
                <div className="h-7 flex-1 bg-secondary/30 rounded-md" />
                <div className="h-7 flex-1 bg-secondary/30 rounded-md" />
              </div>
            </div>
          ))}
          <span className="sr-only">Loading titles…</span>
        </div>
      ) : titles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-secondary/5 p-8 sm:p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 grid place-items-center mb-4">
            <Film className="w-5 h-5 text-accent" aria-hidden="true" />
          </div>
          <h2 className="font-display font-semibold text-lg">No titles yet</h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
            Start your first title with just a name — you can add metadata, assets, and legal documents at your own pace.
          </p>
          <button
            onClick={handleStartCreate}
            disabled={freeLimitHit}
            className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground text-sm font-medium px-4 py-2 disabled:opacity-50 hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" /> New Title
          </button>
        </div>

      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-secondary/5 p-8 text-center">
          <p className="text-sm font-medium">Nothing matches this filter</p>
          <p className="text-xs text-muted-foreground mt-1">Try another filter or clear it to see all titles.</p>
          <button
            onClick={() => setFilter("all")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border/50 text-xs px-3 py-1.5 hover:bg-secondary/30"
          >
            Show All
          </button>
        </div>
      ) : (
        <ul
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 list-none p-0"
          aria-label="Your titles"
        >
          {visible.map((t) => {
            const typeLabel = CONTENT_TYPE_LABEL[t.metadata.format] ?? "Title";
            const updated = new Date(t.updated_at).toLocaleDateString();
            return (
              <li key={t.id} className="min-w-0">
                <article className="h-full rounded-xl border border-border/40 bg-secondary/5 hover:bg-secondary/10 hover:border-border/60 transition-colors p-4 flex flex-col gap-3 min-w-0 focus-within:ring-2 focus-within:ring-accent/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium truncate text-sm sm:text-base leading-tight">{t.title}</h3>
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                        <span>{typeLabel}</span>
                        <span aria-hidden="true"> · </span>
                        <span>Updated {updated}</span>
                      </p>
                    </div>
                    {t.locked && (
                      <Lock
                        className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5"
                        aria-label="Locked — submitted for review"
                      />
                    )}
                  </div>
                  <StatusBadge status={t.status} />
                  <div className="flex items-center gap-1.5 mt-auto pt-2">
                    <button
                      onClick={() => { setEditorId(t.id); setEditorMode("view"); }}
                      aria-label={`View ${t.title}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border/50 text-xs px-2 py-2 min-h-9 hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" /> View
                    </button>
                    <button
                      disabled={t.locked}
                      onClick={() => { setEditorId(t.id); setEditorMode("edit"); }}
                      aria-label={t.locked ? `${t.title} is locked` : `Edit ${t.title}`}
                      title={t.locked ? "Locked while under review" : undefined}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border/50 text-xs px-2 py-2 min-h-9 hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Edit
                    </button>
                    {user?.id === t.owner_user_id && (
                      <button
                        onClick={() => setDeleteTarget(t)}
                        aria-label={`Delete ${t.title}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/40 text-destructive text-xs px-2 py-2 min-h-9 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete
                      </button>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {editorId && (
        <TitleEditor
          titleId={editorId}
          mode={editorMode}
          onClose={() => { setEditorId(null); reload(); }}
          onSubmitted={() => { setEditorId(null); reload(); toast.success("Submitted for review."); }}
        />
      )}

      {deleteTarget && (
        <DeleteTitleDialog
          title={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={async () => { setDeleteTarget(null); await reload(); }}
        />
      )}
    </div>
  );
}

function DeleteTitleDialog({
  title, onClose, onDeleted,
}: { title: TitleRow; onClose: () => void; onDeleted: () => void }) {
  const [checking, setChecking] = useState(true);
  const [elig, setElig] = useState<DeleteEligibility | null>(null);
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setChecking(true);
      const { data, error } = await (supabase as any).rpc("title_delete_eligibility", { _title_id: title.id });
      if (!alive) return;
      if (error) {
        // Log server-side error so support can trace which validation failed.
        console.error("[title_delete_eligibility] RPC error", { titleId: title.id, error });
        setElig({ allow: false, reason: "Unable to verify deletion requirements. Please try again." });
      } else {
        setElig(data as DeleteEligibility);
      }
      setChecking(false);
    })();
    return () => { alive = false; };
  }, [title.id]);

  const confirm = async () => {
    if (!elig?.allow) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("delete_creator_title", {
        _title_id: title.id, _reason: "creator_self_service",
      });
      if (error) {
        toast.error("We couldn't remove this title right now. Please try again.");
        return;
      }
      const res = data as { ok: boolean; message?: string };
      if (res?.ok) {
        toast.success(res.message || "Title removed.");
        onDeleted();
      } else {
        toast.error(res?.message || "This title cannot be removed right now.");
      }
    } finally {
      setBusy(false);
    }
  };

  const lockActive = !!elig?.lock_active && (elig?.lock_days_remaining ?? 0) > 0;
  const fee = elig?.early_termination_fee_inr ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Delete title">
      <div className="bg-background border border-border/50 rounded-2xl w-[calc(100vw-2rem)] sm:w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
          <div>
            <h2 className="font-semibold">Delete title</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[22rem]">{title.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary/30" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4 text-sm">
          {checking ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking whether this title can be removed…
            </div>
          ) : elig?.allow ? (
            <>
              <p>Removing this title cannot be undone. Metadata, uploaded assets and draft history will be permanently deleted.</p>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input type="checkbox" className="mt-0.5" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <span>I understand this action is permanent.</span>
              </label>
            </>
          ) : (
            <>
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
                <div className="whitespace-pre-line leading-relaxed">{elig?.reason}</div>
              </div>
              {lockActive && (
                <div className="rounded-md border border-border/40 bg-secondary/10 p-3 text-xs space-y-1">
                  <div><span className="text-muted-foreground">Contractual lock remaining:</span> <span className="font-medium">{elig?.lock_days_remaining} day(s)</span></div>
                  {fee > 0 && (
                    <div><span className="text-muted-foreground">Early Termination Fee:</span> <span className="font-medium">₹{fee.toLocaleString("en-IN")} + GST</span></div>
                  )}
                  <div className="text-muted-foreground pt-1">Deletion can only proceed after this obligation is cleared and payment is verified. Please contact your account manager.</div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Next steps: close any open buyer conversations, complete or cancel pending deliveries, and once nothing commercial remains, try again.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/40">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">
            {elig?.allow ? "Cancel" : "Close"}
          </button>
          {elig?.allow && (
            <button
              onClick={confirm}
              disabled={busy || !ack}
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive text-destructive-foreground text-xs px-3 py-1.5 disabled:opacity-50 hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete permanently
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateTitleModal({
  onClose, onCreated, userId, workspaceId,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  userId: string;
  workspaceId: string | null;
}) {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<Format>("feature_film");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Title name is required."); return; }
    setBusy(true);
    try {
      const t = await createTitle(userId, workspaceId, name, format);
      onCreated(t.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not create title.";
      // Surface DB free-tier guard text cleanly.
      toast.error(msg.replace(/^.*Free plan/, "Free plan"));
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4">
      <div className="bg-background border border-border/50 rounded-2xl w-[calc(100vw-2rem)] sm:w-full max-w-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
          <div>
            <h2 className="font-semibold">Add a new title</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Pick a content type to get started.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary/30" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Content type</label>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CONTENT_TYPE_OPTIONS.map((o) => {
                const selected = format === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setFormat(o.value)}
                    className={cn(
                      "text-left rounded-lg border px-3 py-2.5 transition-colors min-w-0",
                      selected
                        ? "border-accent/60 bg-accent/10"
                        : "border-border/40 hover:bg-secondary/20",
                    )}
                  >
                    <div className="text-sm font-medium truncate">{o.label}</div>
                    {o.hint && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{o.hint}</div>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Title name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunrise Over Kochi"
              className="mt-2 w-full bg-background border border-border/40 rounded-md px-3 py-2 text-sm"
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
          </div>

          <div className="rounded-md border border-border/40 bg-secondary/10 p-3 text-[11px] text-muted-foreground flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>You can change metadata, add assets, and continue later. Your draft is auto-saved.</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/40">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">Cancel</button>
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground text-xs px-3 py-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Start Draft
          </button>
        </div>
      </div>
    </div>
  );
}
