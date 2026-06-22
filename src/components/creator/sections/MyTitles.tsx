import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Pencil, Eye, Lock, Crown, AlertTriangle, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
        toast.info("Free plan allows 1 draft — opening your existing draft.");
        setEditorId(draft.id);
        setEditorMode("edit");
        return;
      }
      toast.error("Free plan limit reached. Request an upgrade from the Upgrade tab to add more titles.");
      return;
    }
    setGating(true);
  };

  const freeLimitHit = !!tier?.is_free && tier.lifecycle_count >= 1 && !tier.can_create_draft;

  return (
    <div>
      {tier?.is_free && (
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3 text-xs sm:text-sm">
          <Crown className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Creator Basic</div>
            <div className="text-muted-foreground mt-0.5">
              {tier.draft_count}/1 draft · {tier.lifecycle_count}/1 submission used.
              Upgrade for more titles, more storage and priority review.
            </div>
          </div>
          <a
            href="?section=upgrade"
            className="text-[11px] rounded-md border border-amber-500/40 px-2.5 py-1 hover:bg-amber-500/10 whitespace-nowrap"
          >
            Upgrade
          </a>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs text-muted-foreground">
          {loading ? "Loading…" : `${titles.length} title${titles.length === 1 ? "" : "s"}`}
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
          {freeLimitHit ? "Add Title — Pro" : "Add Title"}
        </button>
      </div>

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
        <div className="grid place-items-center py-16">
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
        </div>
      ) : titles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-secondary/5 p-6 sm:p-10 text-center">
          <p className="font-semibold">No titles yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add your first title to begin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {titles.map((t) => (
            <article key={t.id} className="rounded-xl border border-border/40 bg-secondary/5 p-4 flex flex-col gap-3 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium truncate">{t.title}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {CONTENT_TYPE_LABEL[t.metadata.format] ?? "Title"} · Updated {new Date(t.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {t.locked && <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              </div>
              <StatusBadge status={t.status} />
              <div className="flex items-center gap-1.5 mt-auto pt-2">
                <button
                  onClick={() => { setEditorId(t.id); setEditorMode("view"); }}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-border/50 text-xs px-2 py-1.5 hover:bg-secondary/30"
                >
                  <Eye className="w-3 h-3" /> View
                </button>
                <button
                  disabled={t.locked}
                  onClick={() => { setEditorId(t.id); setEditorMode("edit"); }}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-border/50 text-xs px-2 py-1.5 hover:bg-secondary/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editorId && (
        <TitleEditor
          titleId={editorId}
          mode={editorMode}
          onClose={() => { setEditorId(null); reload(); }}
          onSubmitted={() => { setEditorId(null); reload(); toast.success("Submitted to Admin."); }}
        />
      )}
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
      <div className="bg-background border border-border/50 rounded-2xl w-full max-w-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
          <div>
            <h2 className="font-semibold">Add a new title</h2>
            <p className="text-xs text-muted-foreground mt-0.5">What are you adding?</p>
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
            Create draft
          </button>
        </div>
      </div>
    </div>
  );
}
