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

  // Detect free vs paid creator to drive commercial UI gating.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchFreeTierStatus();
        if (!cancelled) setIsFree(s?.is_free ?? true);
      } catch { /* default to free on failure */ }
    })();
    return () => { cancelled = true; };
  }, []);

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
    <div className="fixed inset-0 z-50 bg-background">
      <div className="bg-background w-full h-dvh flex flex-col">
        {/* === Workspace command shell — 3-zone header === */}
        <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm">
          {/* Row 1 · title/status (left) · actions (right) */}
          <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 lg:px-8 py-3">
            <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary/30 shrink-0" aria-label="Close workspace">
              <X className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">Title Workspace</p>
              {readOnly ? (
                <p className="font-display font-semibold text-lg sm:text-xl truncate">{title?.title ?? "Loading…"}</p>
              ) : (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Untitled"
                  className="w-full bg-transparent font-display font-semibold text-lg sm:text-xl outline-none border-b border-transparent focus:border-border/60"
                />
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {title && <StatusBadge status={title.status} />}
                {isFree && (
                  <span className="text-[10px] uppercase tracking-wider rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5">Free</span>
                )}
                {!isFree && (
                  <span className="text-[10px] uppercase tracking-wider rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 px-1.5 py-0.5">Premium</span>
                )}
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
                      <span className="text-amber-300">● Unsaved changes</span>
                    ) : autoSavedAt ? (
                      <><Check className="w-3 h-3 text-emerald-400" /> Auto-saved</>
                    ) : null}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {mode === "edit" && (!titleLocked || lockState.unlocks.length > 0) && (
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-md border border-border/60 text-xs px-3.5 py-2 hover:bg-secondary/30 disabled:opacity-50 font-medium"
                >
                  {saving ? "Saving…" : titleLocked ? "Save unlocked" : "Save"}
                </button>
              )}
              {mode === "edit" && !titleLocked && (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !ready}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground text-xs font-semibold px-3.5 py-2 disabled:opacity-40"
                  title={ready ? "Submit for review" : `Missing: ${missing.join(", ")}`}
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Submit to Admin</span>
                  <span className="sm:hidden">Submit</span>
                </button>
              )}
            </div>
          </div>

          {/* Row 2 · workspace tab navigation */}
          <div className="px-2 sm:px-4 lg:px-6 overflow-x-auto">
            <div className="flex gap-1 py-1.5 min-w-max">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative text-sm px-4 py-2 rounded-md whitespace-nowrap font-medium transition-colors",
                    tab === t.id
                      ? "text-foreground bg-accent/15"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/30",
                  )}
                >
                  {t.label}
                  {tab === t.id && (
                    <span className="absolute -bottom-1.5 left-3 right-3 h-0.5 bg-accent rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Locked banner + section unlocks + edit request */}
        {titleLocked && (
          <div className="px-4 sm:px-6 lg:px-8 py-3 border-b border-border/40 bg-amber-500/5">
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

        {/* Body — full workspace width */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-6 max-w-[1600px] mx-auto w-full">
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
                    {/* 1. Trailer */}
                    <AssetTab cat="trailer" label="Trailer"
                      assets={byCat(["trailer"])} titleId={title.id}
                      locked={assetsLockedFor("trailer")} onUploaded={reload} accept="video/*" />
                    {/* 2. Poster — 4-slot artwork grid (slot 1 live, slots 2-4 reserved). */}
                    <PosterGrid
                      titleId={title.id}
                      assets={byCat(["poster"])}
                      locked={assetsLockedFor("poster")}
                      onUploaded={reload}
                    />
                    {/* 3. Master File */}
                    <AssetTab cat="feature_film" label="Master File"
                      assets={byCat(["feature_film"])} titleId={title.id}
                      locked={assetsLockedFor("feature_film")} onUploaded={reload} accept="video/*" />
                    {/* 4. Existing Contracts (renamed from Ownership Documents) */}
                    <AssetTab cat="ownership_documents" label="Existing Contracts"
                      description="Contracts, agreements, chain-of-title and existing rights paperwork."
                      assets={byCat(["ownership_documents", "ownership"])} titleId={title.id}
                      locked={assetsLockedFor("ownership_documents")} onUploaded={reload}
                      accept="application/pdf,image/*" />
                  </div>
                )}
                {tab === "legal" && (
                  <div className="space-y-8">
                    <AssetTab cat="censor_certificate" label="Censor Certificate"
                      assets={byCat(["censor_certificate", "censor_cert"])} titleId={title.id}
                      locked={assetsLockedFor("censor_certificate")} onUploaded={reload} accept="application/pdf,image/*" />
                    <RightsAvailabilityPanel meta={meta} setMeta={setMeta} readOnly={metadataLocked} isFree={isFree} />
                  </div>
                )}
                {tab === "submission" && (
                  <SubmissionTab title={title} readiness={readiness} local={localChecklist!} assets={assets} meta={meta} onJumpTab={setTab} isFree={isFree} />
                )}
              </>
            )}
          </div>
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
  title, readiness, local, assets, meta, onJumpTab, isFree,
}: {
  title: TitleRow;
  readiness: ServerReadiness | null;
  local: ReturnType<typeof evaluateChecklist>;
  assets: TitleAsset[];
  meta: TitleMetadata | null;
  onJumpTab: (t: TabId) => void;
  isFree: boolean;
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
  // Free creators don't see premium-only commercial fields, so we don't gate
  // their submission on them either.
  const baseItems: { key: string; label: string; ok: boolean; goto: TabId }[] = [
    { key: "title", label: "Add a title name",                 ok: !!local.hasTitle,                              goto: "metadata" },
    { key: "synopsis", label: "Add a synopsis",                ok: !!local.hasSynopsis,                           goto: "metadata" },
    { key: "genres", label: "Pick at least one genre",         ok: (meta?.genres?.length ?? 0) > 0,               goto: "metadata" },
    { key: "language", label: "Set the original language",     ok: !!meta?.original_language?.trim(),             goto: "metadata" },
    { key: "runtime", label: "Set the runtime",                ok: (meta?.runtime_minutes ?? 0) > 0,              goto: "metadata" },
    { key: "rights_owner", label: "Confirm rights owner",      ok: !!meta?.rights_owner?.trim(),                  goto: "metadata" },
    { key: "feature_film", label: "Upload the master file",    ok: !!(has.feature_film ?? local.hasFilm),         goto: "assets" },
    { key: "poster", label: "Upload poster artwork",           ok: !!(has.poster ?? local.hasPoster),             goto: "assets" },
    { key: "censor_certificate", label: "Upload censor certificate", ok: !!(has.censor_certificate ?? local.hasCensor), goto: "legal" },
    { key: "ownership_documents", label: "Upload existing contracts", ok: !!(has.ownership_documents ?? local.hasOwnership), goto: "assets" },
  ];
  const premiumItems: { key: string; label: string; ok: boolean; goto: TabId }[] = [
    { key: "engagement_mode", label: "Choose a commercial path (Free / Premium)", ok: engagementSet, goto: "legal" },
    { key: "rights_available", label: "Mark at least one right as available",     ok: rightsAvailableCount > 0,  goto: "legal" },
    { key: "territory_available", label: "Mark at least one territory as available", ok: territoriesAvailableCount > 0, goto: "legal" },
  ];
  const items = isFree ? baseItems : [...baseItems, ...premiumItems];
  const done = items.filter((i) => i.ok).length;
  const total = items.length;
  const pct = Math.round((done / total) * 100);
  const missing = items.filter((i) => !i.ok);

  const posterAsset = assets.find((a) => a.category === "poster" && a.is_primary);

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6 min-w-0">
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
      {/* Right-rail · Commercial Path summary (always visible in Submission). */}
      <aside className="lg:sticky lg:top-4 self-start space-y-4">
        <CommercialSummaryCard meta={meta} isFree={isFree} />
      </aside>
    </div>
  );
}

/**
 * CommercialSummaryCard — locked commercial overview shown in Submission.
 * Free creators see a concise locked summary (Worldwide / Non-exclusive /
 * Revenue Share / managed by StreamVista). Paid creators see the same
 * overview plus a pointer back to the full rights matrix.
 */
function CommercialSummaryCard({ meta, isFree }: { meta: TitleMetadata | null; isFree: boolean }) {
  const c = meta?.commercial;
  if (isFree) {
    return (
      <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BadgeCheck className="w-4 h-4 text-emerald-300" />
          <h3 className="text-sm font-semibold">Commercial Path</h3>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-emerald-300">Free submission</span>
        </div>
        <dl className="text-xs space-y-2">
          <Row label="Deal model" value="Revenue Share" />
          <Row label="Territory" value={<span className="inline-flex items-center gap-1"><Globe2 className="w-3 h-3" /> Worldwide</span>} />
          <Row label="Exclusivity" value="Non-exclusive" />
          <Row label="Handling" value="Managed by StreamVista internal review & sales workflow" />
        </dl>
        <p className="text-[11px] text-muted-foreground border-t border-border/30 pt-2">
          Submit the title — StreamVista handles the commercial routing and review flow on your behalf.
        </p>
      </section>
    );
  }
  const rightsAvailable = c ? Object.values(c.rights).filter((v) => v === "available").length : 0;
  const territoriesAvailable = c ? Object.values(c.territories).filter((v) => v === "available").length : 0;
  return (
    <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-300" />
        <h3 className="text-sm font-semibold">Commercial Path</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-amber-300">Premium / managed</span>
      </div>
      <dl className="text-xs space-y-2">
        <Row label="Engagement" value={c?.engagement_mode?.replace(/_/g, " ") || "—"} />
        <Row label="Deal model" value={c?.deal_model?.replace(/_/g, " ") || "—"} />
        <Row label="Exclusivity" value={c?.exclusivity?.replace(/_/g, " ") || "—"} />
        <Row label="Rights available" value={`${rightsAvailable} marked`} />
        <Row label="Territories available" value={`${territoriesAvailable} marked`} />
        {c?.min_deal_value ? <Row label="Min deal value" value={`₹${c.min_deal_value.toLocaleString()}`} /> : null}
      </dl>
      <p className="text-[11px] text-muted-foreground border-t border-border/30 pt-2">
        Configure the full rights matrix in <span className="text-foreground">Legal & Rights</span>.
      </p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground capitalize">{value}</dd>
    </div>
  );
}

function AssetTab({
  cat, label, description, assets, titleId, locked, onUploaded, accept,
}: {
  cat: AssetCategory; label: string; description?: string;
  assets: TitleAsset[]; titleId: string; locked: boolean;
  onUploaded: () => void; accept?: string;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold">{label}</h3>
      <p className="text-xs text-muted-foreground mt-1">
        {description ?? `Category: ${CATEGORY_LABEL[cat]}.`}
      </p>
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

/**
 * PosterGrid — Renders 4 artwork slots. Slot 1 is the live primary poster
 * uploader; slots 2-4 are visual placeholders for future artwork variants
 * (alt poster, banner, square) without changing the existing single-poster
 * schema.
 */
function PosterGrid({
  titleId, assets, locked, onUploaded,
}: {
  titleId: string; assets: TitleAsset[]; locked: boolean; onUploaded: () => void;
}) {
  const primary = assets.find((a) => a.is_primary) ?? assets[0];
  const u: any = primary?.upload ?? null;
  const fileName: string | null = u?.file_name ?? null;
  const fileSizeMb: string | null = u?.file_size
    ? `${(Number(u.file_size) / (1024 * 1024)).toFixed(1)} MB`
    : null;
  const placeholders = [
    { label: "Alt poster", hint: "Secondary key art" },
    { label: "Banner", hint: "Horizontal hero art" },
    { label: "Square", hint: "Tile / thumbnail" },
  ];
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Poster</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">4 artwork slots</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Primary poster lives in slot 1. Additional artwork slots are reserved for upcoming variants.
      </p>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Slot 1 — live primary poster */}
        <div className="rounded-lg border border-border/60 bg-card/40 p-2 flex flex-col">
          <div className="aspect-[2/3] rounded-md border border-border/40 bg-secondary/10 overflow-hidden grid place-items-center text-[10px] text-muted-foreground">
            {fileName ? (
              <div className="p-2 text-center w-full">
                <ImageIcon className="w-5 h-5 mx-auto text-accent" />
                <div className="mt-1 font-medium text-foreground truncate">{fileName}</div>
                {fileSizeMb && <div className="mt-0.5 text-[10px]">{fileSizeMb}</div>}
                <div className="mt-0.5 inline-flex items-center gap-1 text-emerald-400 text-[10px]">
                  <CheckCircle2 className="w-3 h-3" /> Attached
                </div>
              </div>
            ) : (
              <span className="text-center px-2">Primary poster<br/><span className="text-muted-foreground/70">Upload below</span></span>
            )}
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-wider text-accent">Primary</div>
        </div>
        {/* Slots 2-4 — visual placeholders */}
        {placeholders.map((p) => (
          <div key={p.label} className="rounded-lg border border-dashed border-border/50 bg-background/30 p-2 flex flex-col opacity-70">
            <div className="aspect-[2/3] rounded-md border border-border/30 bg-secondary/5 grid place-items-center text-center px-2">
              <div>
                <ImageIcon className="w-5 h-5 mx-auto text-muted-foreground/60" />
                <div className="mt-1 text-[10px] text-muted-foreground">{p.hint}</div>
              </div>
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> {p.label}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <AssetUploader
          titleId={titleId}
          category="poster"
          locked={locked}
          accept="image/*"
          label="Upload primary poster"
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
        <Field label="Certification" hint="Censor / age rating issued for the title.">
          <SelectInput
            value={(meta as any).certification ?? ""}
            disabled={readOnly}
            options={["U", "U/A", "A", "S", "Unrated / Not certified", "Other"]}
            placeholder="Select certification…"
            onChange={(v) => {
              const map: Record<string, string> = {
                "U": "U", "U/A": "U/A", "A": "A", "S": "S",
                "Unrated / Not certified": "unrated", "Other": "other",
              };
              setMeta({ ...meta, ...({ certification: (map[v] ?? "") } as any) });
            }}
          />
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

      {/* Awards */}
      <div className="grid md:grid-cols-2 gap-6">
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
