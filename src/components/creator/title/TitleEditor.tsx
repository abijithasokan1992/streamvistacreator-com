import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Loader2, Send, Lock, ShieldCheck, Clock, Check, Unlock, Plus, Trash2, CheckCircle2, Circle as CircleIcon, Globe2, BadgeCheck, Sparkles, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  getTitle, listAssets, saveTitleMetadata, submitTitle,
  evaluateChecklist, fetchReadiness, fetchTitleTimeline, fetchFreeTierStatus,
  type TitleRow, type TitleAsset, type ServerReadiness, type ContentStatus, type TitleTimelineEntry,
} from "@/lib/creator/titleApi";
import {
  type TitleMetadata, type AssetCategory, CATEGORY_LABEL,
} from "@/lib/creator/titleSchema";
import { AssetUploader, AssetList } from "./AssetUploader";
import { StatusBadge } from "./StatusBadge";
import { RightsAvailabilityPanel } from "./RightsAvailabilityPanel";
import { FreeSubmissionTermsModal } from "./FreeSubmissionTermsModal";
import RequestEditButton from "@/components/creator/RequestEditButton";
import { useTitleLock } from "@/hooks/useTitleLock";

type TabId = "overview" | "metadata" | "assets" | "legal" | "submission";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview",   label: "Overview" },
  { id: "metadata",   label: "Metadata" },
  { id: "assets",     label: "Assets" },
  { id: "legal",      label: "Legal & Rights" },
  { id: "submission", label: "Submission" },
];

export function TitleEditor({
  titleId, mode, onClose, onSubmitted,
}: {
  titleId: string;
  mode: "edit" | "view";
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState<TitleRow | null>(null);
  const [assets, setAssets] = useState<TitleAsset[]>([]);
  const [readiness, setReadiness] = useState<ServerReadiness | null>(null);
  const [timeline, setTimeline] = useState<TitleTimelineEntry[]>([]);
  const [tab, setTab] = useState<TabId>("overview");
  const [saving, setSaving] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [pendingFreeSubmit, setPendingFreeSubmit] = useState(false);
  const [name, setName] = useState("");
  const [meta, setMeta] = useState<TitleMetadata | null>(null);
  const [isFree, setIsFree] = useState<boolean>(true);
  const [profileDefaults, setProfileDefaults] = useState<{ rights_owner: string; production_company: string }>({ rights_owner: "", production_company: "" });

  const lockState = useTitleLock(titleId);
  const titleLocked = !!title?.locked || lockState.isLocked;
  const readOnly = mode === "view" || titleLocked;
  const metadataLocked = mode === "view" || (titleLocked && !lockState.isTabEditable("metadata"));
  const assetsLockedFor = (cat: AssetCategory): boolean => {
    if (mode === "view") return true;
    if (!titleLocked) return false;
    const map: Record<string, "master_file" | "trailer" | "poster" | "subtitles_audio" | "legal_documents"> = {
      feature_film: "master_file",
      trailer: "trailer",
      poster: "poster",
      censor_certificate: "legal_documents",
      censor_cert: "legal_documents",
      ownership_documents: "legal_documents",
      ownership: "legal_documents",
    };
    const key = map[cat];
    if (!key) return true;
    return !lockState.isSectionEditable(key);
  };
  const debounceRef = useRef<number | null>(null);
  const loadedRef = useRef(false);

  const reload = useCallback(async () => {
    const [t, a, r, tl] = await Promise.all([
      getTitle(titleId),
      listAssets(titleId),
      fetchReadiness(titleId),
      fetchTitleTimeline(titleId),
    ]);
    setTitle(t);
    setAssets(a);
    setReadiness(r);
    setTimeline(tl);
    if (t) {
      setName(t.title);
      setMeta(t.metadata);
    }
    loadedRef.current = true;
    setDirty(false);
  }, [titleId]);

  useEffect(() => { reload(); }, [reload]);

  // Best-effort fetch creator profile defaults (Rights Owner / Production Company auto-fill).
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("entity_profiles")
          .select("legal_name, display_name")
          .eq("user_id", user.id)
          .eq("kind", "creator")
          .maybeSingle();
        if (cancelled || !data) return;
        setProfileDefaults({
          rights_owner: (data.legal_name as string) || (data.display_name as string) || "",
          production_company: (data.display_name as string) || (data.legal_name as string) || "",
        });
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Auto-fill empty rights_owner / production_company once metadata + defaults are ready.
  useEffect(() => {
    if (!meta || !loadedRef.current) return;
    if (!profileDefaults.rights_owner && !profileDefaults.production_company) return;
    const patch: Partial<TitleMetadata> = {};
    if (!meta.rights_owner?.trim() && profileDefaults.rights_owner) patch.rights_owner = profileDefaults.rights_owner;
    if (!meta.production_company?.trim() && profileDefaults.production_company) patch.production_company = profileDefaults.production_company;
    if (Object.keys(patch).length > 0) setMeta({ ...meta, ...patch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileDefaults, meta?.rights_owner, meta?.production_company]);


  const doSave = useCallback(async (silent = false) => {
    if (!title || !meta) return;
    setSaving(true);
    try {
      await saveTitleMetadata(title.id, { title: name, metadata: meta });
      setDirty(false);
      setAutoSavedAt(Date.now());
      if (!silent) toast.success("Saved.");
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally { setSaving(false); }
  }, [title, meta, name]);

  const save = () => doSave(false);

  // Mark dirty whenever the editable fields change after initial load.
  useEffect(() => {
    if (!loadedRef.current || readOnly) return;
    setDirty(true);
  }, [name, meta, readOnly]);

  // Debounced auto-save (1.5s) while the editor is open.
  useEffect(() => {
    if (!dirty || readOnly || !title || !meta) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { doSave(true); }, 1500);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [dirty, readOnly, title, meta, name, doSave]);

  // Best-effort flush on unmount / tab close so accidental closures don't lose work.
  useEffect(() => {
    const flush = () => {
      if (dirty && !readOnly && title && meta) {
        // Fire-and-forget; storage trigger will persist.
        void saveTitleMetadata(title.id, { title: name, metadata: meta }).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [dirty, readOnly, title, meta, name]);

  const localChecklist = useMemo(
    () => (title ? evaluateChecklist(title, assets) : null),
    [title, assets],
  );
  const ready = readiness?.ready ?? localChecklist?.ready ?? false;
  const missing = readiness?.missing ?? localChecklist?.missing ?? [];

  const doSubmit = async () => {
    if (!title) return;
    setSubmitting(true);
    try {
      await submitTitle(title.id);
      setTermsOpen(false);
      onSubmitted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed.");
    } finally { setSubmitting(false); }
  };

  const handleSubmit = async () => {
    if (!title) return;
    if (!ready) {
      toast.error(`Missing: ${missing.join(", ")}`);
      return;
    }
    // Flush any pending edits before submitting so the lock doesn't strand changes.
    if (dirty) { await doSave(true); }
    // Free-tier guard: 1 submission allowed.
    const t = await fetchFreeTierStatus();
    if (t?.is_free && !t.can_submit) {
      toast.error("Free plan allows 1 submission. Request a plan change from Storage & Billing to submit more titles.");
      return;
    }
    // Free-tier: require explicit acknowledgement of commercial submission terms.
    if (t?.is_free) {
      setPendingFreeSubmit(true);
      setTermsOpen(true);
      return;
    }
    await doSubmit();
  };

  const byCat = (cats: AssetCategory[]) => assets.filter((a) => cats.includes(a.category));

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-stretch">
      <div className="bg-background border-l border-border/50 w-full sm:max-w-5xl sm:ml-auto h-dvh flex flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-3 border-b border-border/40">
          <div className="min-w-0 flex items-center gap-2 sm:gap-3 flex-1">
            <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary/30" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Title Workspace</p>
              {readOnly ? (
                <p className="font-semibold truncate">{title?.title ?? "Loading…"}</p>
              ) : (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent font-semibold text-base outline-none border-b border-transparent focus:border-border/60"
                />
              )}
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {title && <StatusBadge status={title.status} />}
                {title?.locked && (
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
                {!readOnly && (
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    {saving ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
                    ) : dirty ? (
                      <>Unsaved changes</>
                    ) : autoSavedAt ? (
                      <><Check className="w-3 h-3 text-emerald-400" /> Auto-saved</>
                    ) : null}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {mode === "edit" && (!titleLocked || lockState.unlocks.length > 0) && (
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md border border-border/50 text-xs px-3 py-1.5 hover:bg-secondary/30 disabled:opacity-50"
              >
                {saving ? "Saving…" : titleLocked ? "Save unlocked sections" : "Save"}
              </button>
            )}
            {mode === "edit" && !titleLocked && (
              <button
                onClick={handleSubmit}
                disabled={submitting || !ready}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground text-xs px-3 py-1.5 disabled:opacity-40"
                title={ready ? "Submit for review" : `Missing: ${missing.join(", ")}`}
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Submit to Admin</span>
                <span className="sm:hidden">Submit</span>
              </button>
            )}
          </div>
        </div>


        {/* Locked banner + section unlocks + edit request */}
        {titleLocked && (
          <div className="px-3 sm:px-5 py-3 border-b border-border/40 bg-amber-500/5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span className="font-medium">Submitted For Review</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <Lock className="w-3 h-3" /> Content Locked
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> Awaiting Admin Review
              </span>
              {lockState.openRequests > 0 && (
                <span className="ml-2 text-[11px] inline-flex items-center gap-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-300 px-2 py-0.5">
                  <Clock className="w-3 h-3" /> {lockState.openRequests} edit request pending
                </span>
              )}
              {lockState.unlocks.length > 0 && (
                <span className="ml-2 text-[11px] inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-2 py-0.5">
                  <Unlock className="w-3 h-3" /> {lockState.unlocks.length} section{lockState.unlocks.length === 1 ? "" : "s"} unlocked
                </span>
              )}
              {mode === "edit" && (
                <div className="ml-auto">
                  <RequestEditButton titleId={title!.id} />
                </div>
              )}
            </div>
            {lockState.unlocks.length > 0 && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                Editable now: {lockState.unlocks.map((u) => u.section_key.replace(/_/g, " ")).join(", ")}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-border/40 overflow-x-auto">
          <div className="flex gap-1 px-3 py-2 min-w-max">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-md whitespace-nowrap",
                  tab === t.id ? "bg-accent/15 text-foreground" : "text-muted-foreground hover:bg-secondary/30",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 sm:py-5">
          {!title || !meta ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
            </div>
          ) : (
            <>
              {tab === "overview" && (
                <OverviewSnapshot title={title} meta={meta} assets={assets} timeline={timeline} />
              )}
              {tab === "metadata" && (
                <MetadataTab meta={meta} setMeta={setMeta} readOnly={metadataLocked} />
              )}
              {tab === "assets" && (
                <div className="space-y-8">
                  <AssetTab cat="feature_film" label="Master File"
                    assets={byCat(["feature_film"])} titleId={title.id}
                    locked={assetsLockedFor("feature_film")} onUploaded={reload} accept="video/*" />
                  <AssetTab cat="trailer" label="Trailer"
                    assets={byCat(["trailer"])} titleId={title.id}
                    locked={assetsLockedFor("trailer")} onUploaded={reload} accept="video/*" />
                  <AssetTab cat="poster" label="Poster"
                    assets={byCat(["poster"])} titleId={title.id}
                    locked={assetsLockedFor("poster")} onUploaded={reload} accept="image/*" />
                </div>
              )}
              {tab === "legal" && (
                <div className="space-y-8">
                  <AssetTab cat="censor_certificate" label="Censor Certificate"
                    assets={byCat(["censor_certificate", "censor_cert"])} titleId={title.id}
                    locked={assetsLockedFor("censor_certificate")} onUploaded={reload} accept="application/pdf,image/*" />
                  <AssetTab cat="ownership_documents" label="Ownership Documents"
                    assets={byCat(["ownership_documents", "ownership"])} titleId={title.id}
                    locked={assetsLockedFor("ownership_documents")} onUploaded={reload} accept="application/pdf,image/*" />
                  <RightsAvailabilityPanel meta={meta} setMeta={setMeta} readOnly={metadataLocked} />
                </div>
              )}
              {tab === "submission" && (
                <SubmissionTab title={title} readiness={readiness} local={localChecklist!} assets={assets} meta={meta} onJumpTab={setTab} />
              )}
            </>

          )}
        </div>
      </div>
      <FreeSubmissionTermsModal
        open={termsOpen}
        submitting={submitting}
        onCancel={() => { setTermsOpen(false); setPendingFreeSubmit(false); }}
        onConfirm={() => { if (pendingFreeSubmit) void doSubmit(); }}
      />
    </div>
  );
}

/* ---------------- Sub-tabs ---------------- */

/**
 * OverviewSnapshot — light, read-only summary surface for the Overview tab.
 */
function OverviewSnapshot({
  title, meta, assets, timeline,
}: {
  title: TitleRow; meta: TitleMetadata | null; assets: TitleAsset[]; timeline: TitleTimelineEntry[];
}) {
  const lastEvent = timeline[timeline.length - 1];
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border/40 p-4 bg-card/30">
        <div className="text-xs font-semibold mb-2">Summary</div>
        <dl className="grid sm:grid-cols-2 gap-3 text-xs">
          <div><dt className="text-muted-foreground">Title</dt><dd className="truncate">{title.title}</dd></div>
          <div><dt className="text-muted-foreground">Format</dt><dd>{title.metadata.format}</dd></div>
          <div><dt className="text-muted-foreground">Runtime</dt><dd>{formatRuntime(meta?.runtime_minutes ?? 0)}</dd></div>
          <div><dt className="text-muted-foreground">Genres</dt><dd className="truncate">{meta?.genres.join(", ") || "—"}</dd></div>
          <div><dt className="text-muted-foreground">Production company</dt><dd className="truncate">{meta?.production_company || "—"}</dd></div>
          <div><dt className="text-muted-foreground">Current status</dt><dd><StatusBadge status={title.status} /></dd></div>
          <div><dt className="text-muted-foreground">Last updated</dt><dd>{new Date(title.updated_at).toLocaleString()}</dd></div>
          <div><dt className="text-muted-foreground">Total files</dt><dd>{assets.length}</dd></div>
        </dl>
        {lastEvent && (
          <p className="text-[11px] text-muted-foreground mt-3">
            Latest event: {(lastEvent.from_status ?? "—").replace(/_/g, " ")} → {lastEvent.to_status.replace(/_/g, " ")} ·{" "}
            {new Date(lastEvent.created_at).toLocaleString()}
          </p>
        )}
      </section>
      <p className="text-[11px] text-muted-foreground">
        Submission readiness, missing items and the final review summary live in the <span className="text-foreground">Submission</span> tab.
      </p>
    </div>
  );
}

/**
 * SubmissionTab — creator-facing only.
 * Three blocks: Readiness · Missing checklist · Final review summary.
 * Internal QC / verification matrix and review pipeline stage tracker live
 * elsewhere (admin) and are intentionally hidden from the creator.
 */
function SubmissionTab({
  title, readiness, local, assets, meta, onJumpTab,
}: {
  title: TitleRow;
  readiness: ServerReadiness | null;
  local: ReturnType<typeof evaluateChecklist>;
  assets: TitleAsset[];
  meta: TitleMetadata | null;
  onJumpTab: (t: TabId) => void;
}) {
  const has = readiness?.has ?? {
    feature_film: local.hasFilm,
    trailer: local.hasTrailer,
    poster: local.hasPoster,
    censor_certificate: local.hasCensor,
    ownership_documents: local.hasOwnership,
  };

  const commercial = meta?.commercial;
  const rightsAvailableCount = commercial
    ? Object.values(commercial.rights).filter((v) => v === "available").length
    : 0;
  const territoriesAvailableCount = commercial
    ? Object.values(commercial.territories).filter((v) => v === "available").length
    : 0;
  const engagementSet = !!commercial && commercial.engagement_mode !== "unspecified";

  // Creator-facing readiness — completeness, not verification.
  const items: { key: string; label: string; ok: boolean; goto: TabId }[] = [
    { key: "title", label: "Add a title name",                 ok: !!local.hasTitle,                              goto: "metadata" },
    { key: "synopsis", label: "Add a synopsis",                ok: !!local.hasSynopsis,                           goto: "metadata" },
    { key: "genres", label: "Pick at least one genre",         ok: (meta?.genres?.length ?? 0) > 0,               goto: "metadata" },
    { key: "language", label: "Set the original language",     ok: !!meta?.original_language?.trim(),             goto: "metadata" },
    { key: "runtime", label: "Set the runtime",                ok: (meta?.runtime_minutes ?? 0) > 0,              goto: "metadata" },
    { key: "rights_owner", label: "Confirm rights owner",      ok: !!meta?.rights_owner?.trim(),                  goto: "metadata" },
    { key: "feature_film", label: "Upload the master file",    ok: !!(has.feature_film ?? local.hasFilm),         goto: "assets" },
    { key: "poster", label: "Upload poster artwork",           ok: !!(has.poster ?? local.hasPoster),             goto: "assets" },
    { key: "censor_certificate", label: "Upload censor certificate", ok: !!(has.censor_certificate ?? local.hasCensor), goto: "legal" },
    { key: "ownership_documents", label: "Upload ownership documents", ok: !!(has.ownership_documents ?? local.hasOwnership), goto: "legal" },
    { key: "engagement_mode", label: "Choose a commercial path (Free / Premium)", ok: engagementSet, goto: "legal" },
    { key: "rights_available", label: "Mark at least one right as available",     ok: rightsAvailableCount > 0,  goto: "legal" },
    { key: "territory_available", label: "Mark at least one territory as available", ok: territoriesAvailableCount > 0, goto: "legal" },
  ];
  const done = items.filter((i) => i.ok).length;
  const total = items.length;
  const pct = Math.round((done / total) * 100);
  const missing = items.filter((i) => !i.ok);

  const posterAsset = assets.find((a) => a.category === "poster" && a.is_primary);

  return (
    <div className="space-y-6">
      {/* A. Submission Readiness */}
      <section className="rounded-lg border border-border/40 p-4 bg-card/30">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold">Submission readiness</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {pct === 100 ? "Everything is in place. You can submit to Admin." : `${missing.length} item${missing.length === 1 ? "" : "s"} left.`}
            </div>
          </div>
          <div className={cn("text-2xl font-semibold tabular-nums", pct === 100 ? "text-emerald-300" : pct >= 60 ? "text-sky-300" : "text-amber-300")}>
            {pct}%
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-secondary/40 overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              pct === 100 ? "bg-emerald-400" : pct >= 60 ? "bg-sky-400" : "bg-amber-400",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      {/* B. Missing items checklist */}
      <section>
        <h3 className="text-sm font-semibold">What's left</h3>
        <ul className="mt-3 space-y-1.5">
          {items.map((i) => (
            <li key={i.key} className="text-xs flex items-center gap-2 rounded-md border border-border/40 px-3 py-2">
              {i.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <CircleIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <span className={cn("flex-1", i.ok && "text-muted-foreground line-through")}>{i.label}</span>
              {!i.ok && (
                <button
                  type="button"
                  onClick={() => onJumpTab(i.goto)}
                  className="text-[11px] text-accent-foreground bg-accent/15 hover:bg-accent/25 rounded px-2 py-0.5"
                >
                  Open
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* C. Final review summary */}
      <section className="rounded-lg border border-border/40 p-4 bg-card/30">
        <div className="text-xs font-semibold mb-3">Final review</div>
        <div className="grid sm:grid-cols-[120px_1fr] gap-4 items-start">
          <div className="rounded-md border border-border/40 bg-secondary/10 aspect-[2/3] grid place-items-center text-[10px] text-muted-foreground overflow-hidden">
            {posterAsset?.upload?.file_name ? (
              <div className="p-2 text-center">
                <div className="font-medium text-foreground truncate">{posterAsset.upload.file_name}</div>
                <div className="mt-1">Poster attached</div>
              </div>
            ) : (
              <span>No poster yet</span>
            )}
          </div>
          <dl className="text-xs grid sm:grid-cols-2 gap-y-2 gap-x-4">
            <div><dt className="text-muted-foreground">Title</dt><dd className="truncate">{title.title || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Format</dt><dd>{title.metadata.format}</dd></div>
            <div><dt className="text-muted-foreground">Runtime</dt><dd>{formatRuntime(meta?.runtime_minutes ?? 0)}</dd></div>
            <div><dt className="text-muted-foreground">Genres</dt><dd className="truncate">{meta?.genres?.join(", ") || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Production company</dt><dd className="truncate">{meta?.production_company || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Rights owner</dt><dd className="truncate">{meta?.rights_owner || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Files attached</dt><dd>{assets.length}</dd></div>
            <div><dt className="text-muted-foreground">Current status</dt><dd><StatusBadge status={title.status} /></dd></div>
          </dl>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Use the <span className="text-foreground">Submit to Admin</span> button at the top right when you're ready.
        </p>
      </section>
    </div>
  );
}

function AssetTab({
  cat, label, assets, titleId, locked, onUploaded, accept,
}: {
  cat: AssetCategory; label: string;
  assets: TitleAsset[]; titleId: string; locked: boolean;
  onUploaded: () => void; accept?: string;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold">{label}</h3>
      <p className="text-xs text-muted-foreground mt-1">Category: {CATEGORY_LABEL[cat]}.</p>
      <div className="mt-3">
        <AssetUploader
          titleId={titleId}
          category={cat}
          locked={locked}
          accept={accept}
          label={`Upload ${label.toLowerCase()}`}
          onUploaded={onUploaded}
        />
        <AssetList assets={assets} />
      </div>
    </section>
  );
}

/* ----- Metadata tab ----- */

const LANGUAGE_OPTIONS = [
  "English", "Hindi", "Malayalam", "Tamil", "Telugu", "Kannada", "Marathi", "Bengali",
  "Punjabi", "Gujarati", "Urdu", "Spanish", "French", "German", "Italian", "Portuguese",
  "Japanese", "Korean", "Mandarin", "Arabic", "Russian", "Other",
];
const COUNTRY_OPTIONS = [
  "India", "United States", "United Kingdom", "Canada", "Australia", "France", "Germany",
  "Spain", "Italy", "Japan", "South Korea", "China", "Brazil", "Mexico", "UAE", "Singapore", "Other",
];
const GENRE_OPTIONS = [
  "Action", "Adventure", "Animation", "Biography", "Comedy", "Crime", "Documentary", "Drama",
  "Family", "Fantasy", "History", "Horror", "Music", "Musical", "Mystery", "Romance",
  "Sci-Fi", "Sport", "Thriller", "War", "Western",
];
const SYNOPSIS_WORD_LIMIT = 250;

function formatRuntime(totalMin: number): string {
  const safe = Math.max(0, Math.floor(totalMin || 0));
  if (safe === 0) return "—";
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function splitRuntime(totalMin: number): { hh: number; mm: number } {
  const safe = Math.max(0, Math.floor(totalMin || 0));
  return { hh: Math.floor(safe / 60), mm: safe % 60 };
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-[10px] text-muted-foreground/80 mt-1 block">{hint}</span>}
    </label>
  );
}
function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("w-full bg-background border border-border/40 rounded-md px-3 py-1.5 text-sm disabled:opacity-60", props.className)} />;
}
function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="w-full bg-background border border-border/40 rounded-md px-3 py-2 text-sm disabled:opacity-60" />;
}
function SelectInput({ value, onChange, disabled, options, placeholder }: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
  options: string[]; placeholder?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-background border border-border/40 rounded-md px-3 py-1.5 text-sm disabled:opacity-60"
    >
      <option value="">{placeholder ?? "Select…"}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/** Chip / tag input with autocomplete suggestions. */
function TagInput({
  value, onChange, disabled, suggestions, placeholder,
}: {
  value: string[]; onChange: (v: string[]) => void; disabled?: boolean;
  suggestions?: string[]; placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (value.includes(t)) { setDraft(""); return; }
    onChange([...value, t]);
    setDraft("");
  };
  const remove = (t: string) => onChange(value.filter((v) => v !== t));
  const filtered = (suggestions ?? []).filter(
    (s) => s.toLowerCase().includes(draft.toLowerCase()) && !value.includes(s),
  ).slice(0, 8);
  return (
    <div className={cn("rounded-md border border-border/40 bg-background px-2 py-1.5 text-sm flex flex-wrap gap-1.5 min-h-[36px]", disabled && "opacity-60")}>
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 bg-accent/15 text-accent-foreground rounded px-1.5 py-0.5 text-xs">
          {t}
          {!disabled && (
            <button type="button" onClick={() => remove(t)} className="hover:text-rose-400" aria-label={`Remove ${t}`}>
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}
      <div className="relative flex-1 min-w-[120px]">
        <input
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
            else if (e.key === "Backspace" && !draft && value.length) { remove(value[value.length - 1]); }
          }}
          onBlur={() => { if (draft) add(draft); }}
          placeholder={placeholder ?? "Type and press Enter"}
          className="w-full bg-transparent outline-none text-sm py-0.5"
        />
        {!disabled && draft && filtered.length > 0 && (
          <div className="absolute z-20 mt-1 left-0 right-0 max-h-40 overflow-y-auto rounded-md border border-border/60 bg-popover shadow-md text-xs">
            {filtered.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); add(s); }}
                className="w-full text-left px-2 py-1 hover:bg-accent/15"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RuntimeInput({ value, onChange, disabled }: {
  value: number; onChange: (totalMinutes: number) => void; disabled?: boolean;
}) {
  const { hh, mm } = splitRuntime(value);
  const upd = (nh: number, nm: number) => onChange(Math.max(0, nh) * 60 + Math.min(59, Math.max(0, nm)));
  return (
    <div className="flex items-center gap-1.5">
      <TextInput type="number" min={0} max={48} value={hh} disabled={disabled}
        onChange={(e) => upd(Number(e.target.value || 0), mm)} className="w-16" />
      <span className="text-xs text-muted-foreground">h</span>
      <TextInput type="number" min={0} max={59} value={mm} disabled={disabled}
        onChange={(e) => upd(hh, Number(e.target.value || 0))} className="w-16" />
      <span className="text-xs text-muted-foreground">m</span>
      <span className="text-[11px] text-muted-foreground ml-2">({formatRuntime(value)})</span>
    </div>
  );
}

function RepeatList<T>({
  items, onChange, disabled, blank, render, addLabel,
}: {
  items: T[]; onChange: (v: T[]) => void; disabled?: boolean;
  blank: () => T; render: (item: T, set: (v: T) => void) => React.ReactNode; addLabel: string;
}) {
  const update = (i: number, v: T) => onChange(items.map((it, idx) => idx === i ? v : it));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="rounded-md border border-border/40 p-2 grid grid-cols-[1fr_auto] gap-2 items-start">
          <div className="min-w-0">{render(it, (v) => update(i, v))}</div>
          {!disabled && (
            <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-rose-400 p-1" aria-label="Remove">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...items, blank()])}
          className="inline-flex items-center gap-1 text-xs rounded-md border border-border/50 px-2 py-1 hover:bg-secondary/30"
        >
          <Plus className="w-3 h-3" /> {addLabel}
        </button>
      )}
    </div>
  );
}

function MetadataTab({
  meta, setMeta, readOnly,
}: { meta: TitleMetadata; setMeta: (m: TitleMetadata) => void; readOnly: boolean }) {
  const upd = <K extends keyof TitleMetadata>(k: K, v: TitleMetadata[K]) => setMeta({ ...meta, [k]: v });
  const synopsisWords = (meta.synopsis || "").trim().split(/\s+/).filter(Boolean).length;
  const overLimit = synopsisWords > SYNOPSIS_WORD_LIMIT;
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1900 + 5 }, (_, i) => String(currentYear + 4 - i));
  const releaseDate = (meta as any).release_date ?? "";

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Synopsis" hint={`${synopsisWords} / ${SYNOPSIS_WORD_LIMIT} words${overLimit ? " — over limit" : ""}`}>
          <TextArea
            rows={5}
            value={meta.synopsis}
            disabled={readOnly}
            onChange={(e) => upd("synopsis", e.target.value)}
            className={overLimit ? "border-rose-500/60" : undefined as any}
          />
        </Field>
        <Field label="Genres" hint="Choose one or more.">
          <TagInput
            value={meta.genres}
            disabled={readOnly}
            suggestions={GENRE_OPTIONS}
            placeholder="Search genres…"
            onChange={(v) => upd("genres", v)}
          />
        </Field>
        <Field label="Keywords" hint="Press Enter or comma to add a tag.">
          <TagInput
            value={meta.keywords}
            disabled={readOnly}
            placeholder="Add a keyword…"
            onChange={(v) => upd("keywords", v)}
          />
        </Field>
        <Field label="Original language">
          <SelectInput value={meta.original_language} disabled={readOnly}
            options={LANGUAGE_OPTIONS}
            placeholder="Select language…"
            onChange={(v) => upd("original_language", v)} />
        </Field>
        <Field label="Production year">
          <SelectInput value={meta.production_year ? String(meta.production_year) : ""} disabled={readOnly}
            options={yearOptions}
            placeholder="Select year…"
            onChange={(v) => upd("production_year", v ? Number(v) : null)} />
        </Field>
        <Field label="Release date">
          <TextInput type="date" value={releaseDate} disabled={readOnly}
            onChange={(e) => setMeta({ ...meta, ...(({ release_date: e.target.value }) as any) })} />
        </Field>
        <Field label="Country of origin">
          <SelectInput value={meta.country_of_origin} disabled={readOnly}
            options={COUNTRY_OPTIONS}
            placeholder="Select country…"
            onChange={(v) => upd("country_of_origin", v)} />
        </Field>
        <Field label="Runtime">
          <RuntimeInput value={meta.runtime_minutes} disabled={readOnly}
            onChange={(total) => upd("runtime_minutes", total)} />
        </Field>
        <Field label="Rights owner" hint="Auto-filled from your profile — editable.">
          <TextInput value={meta.rights_owner} disabled={readOnly}
            placeholder="Legal entity that owns rights"
            onChange={(e) => upd("rights_owner", e.target.value)} />
        </Field>
        <Field label="Production company" hint="Auto-filled from your profile — editable.">
          <TextInput value={meta.production_company} disabled={readOnly}
            placeholder="Banner / production company"
            onChange={(e) => upd("production_company", e.target.value)} />
        </Field>
        <Field label="IMDb ID or URL">
          <TextInput value={meta.imdb_id} disabled={readOnly}
            placeholder="tt1234567 or imdb.com/title/…"
            onChange={(e) => upd("imdb_id", e.target.value)} />
        </Field>
        <Field label="TMDb ID or URL">
          <TextInput value={meta.tmdb_id} disabled={readOnly}
            placeholder="12345 or themoviedb.org/movie/…"
            onChange={(e) => upd("tmdb_id", e.target.value)} />
        </Field>
      </div>

      {/* People */}
      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Cast</h4>
          <RepeatList
            items={meta.cast}
            disabled={readOnly}
            onChange={(v) => upd("cast", v as any)}
            blank={() => ({ name: "", role: "" })}
            addLabel="Add cast member"
            render={(c, set) => (
              <div className="grid sm:grid-cols-2 gap-2">
                <TextInput placeholder="Name" value={c.name} disabled={readOnly}
                  onChange={(e) => set({ ...c, name: e.target.value })} />
                <TextInput placeholder="Character / role" value={c.role} disabled={readOnly}
                  onChange={(e) => set({ ...c, role: e.target.value })} />
              </div>
            )}
          />
        </section>
        <section>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Crew</h4>
          <RepeatList
            items={meta.crew}
            disabled={readOnly}
            onChange={(v) => upd("crew", v as any)}
            blank={() => ({ name: "", role: "" })}
            addLabel="Add crew member"
            render={(c, set) => (
              <div className="grid sm:grid-cols-2 gap-2">
                <TextInput placeholder="Name" value={c.name} disabled={readOnly}
                  onChange={(e) => set({ ...c, name: e.target.value })} />
                <TextInput placeholder="Role (e.g. Director, DOP)" value={c.role} disabled={readOnly}
                  onChange={(e) => set({ ...c, role: e.target.value })} />
              </div>
            )}
          />
        </section>
      </div>

      {/* Festivals + Awards */}
      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Festival information</h4>
          <RepeatList
            items={meta.festivals}
            disabled={readOnly}
            onChange={(v) => upd("festivals", v as any)}
            blank={() => ({ name: "", year: null, award: "", selection_type: "", location: "", url: "" } as any)}
            addLabel="Add festival"
            render={(f: any, set) => (
              <div className="grid sm:grid-cols-2 gap-2">
                <TextInput placeholder="Festival name" value={f.name} disabled={readOnly}
                  onChange={(e) => set({ ...f, name: e.target.value })} />
                <TextInput type="number" min={1900} max={2100} placeholder="Year / edition"
                  value={f.year ?? ""} disabled={readOnly}
                  onChange={(e) => set({ ...f, year: e.target.value ? Number(e.target.value) : null })} />
                <TextInput placeholder="Selection (e.g. Official Selection)" value={f.selection_type ?? ""} disabled={readOnly}
                  onChange={(e) => set({ ...f, selection_type: e.target.value })} />
                <TextInput placeholder="Location (optional)" value={f.location ?? ""} disabled={readOnly}
                  onChange={(e) => set({ ...f, location: e.target.value })} />
                <TextInput placeholder="URL (optional)" value={f.url ?? ""} disabled={readOnly}
                  onChange={(e) => set({ ...f, url: e.target.value })} className="sm:col-span-2" />
              </div>
            )}
          />
        </section>
        <section>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Awards</h4>
          <RepeatList
            items={meta.awards}
            disabled={readOnly}
            onChange={(v) => upd("awards", v as any)}
            blank={() => ({ name: "", year: null, category: "", result: "", notes: "" } as any)}
            addLabel="Add award"
            render={(a: any, set) => (
              <div className="grid sm:grid-cols-2 gap-2">
                <TextInput placeholder="Award / festival" value={a.name} disabled={readOnly}
                  onChange={(e) => set({ ...a, name: e.target.value })} />
                <TextInput placeholder="Category" value={a.category ?? ""} disabled={readOnly}
                  onChange={(e) => set({ ...a, category: e.target.value })} />
                <TextInput type="number" min={1900} max={2100} placeholder="Year"
                  value={a.year ?? ""} disabled={readOnly}
                  onChange={(e) => set({ ...a, year: e.target.value ? Number(e.target.value) : null })} />
                <SelectInput value={a.result ?? ""} disabled={readOnly}
                  options={["Won", "Nominated", "Shortlisted", "Honourable Mention"]}
                  placeholder="Result"
                  onChange={(v) => set({ ...a, result: v })} />
                <TextInput placeholder="Notes (optional)" value={a.notes ?? ""} disabled={readOnly}
                  onChange={(e) => set({ ...a, notes: e.target.value })} className="sm:col-span-2" />
              </div>
            )}
          />
        </section>
      </div>
    </div>
  );
}
