import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Loader2, Send, Lock, ShieldCheck, Clock, CheckCircle2, Circle, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
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

type TabId =
  | "overview" | "metadata"
  | "film" | "trailer" | "poster" | "censor" | "ownership"
  | "status";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview",  label: "Overview" },
  { id: "metadata",  label: "Metadata" },
  { id: "film",      label: "Feature Film" },
  { id: "trailer",   label: "Trailer" },
  { id: "poster",    label: "Poster" },
  { id: "censor",    label: "Censor Certificate" },
  { id: "ownership", label: "Ownership Documents" },
  { id: "status",    label: "Status" },
];

export function TitleEditor({
  titleId, mode, onClose, onSubmitted,
}: {
  titleId: string;
  mode: "edit" | "view";
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [title, setTitle] = useState<TitleRow | null>(null);
  const [assets, setAssets] = useState<TitleAsset[]>([]);
  const [readiness, setReadiness] = useState<ServerReadiness | null>(null);
  const [timeline, setTimeline] = useState<TitleTimelineEntry[]>([]);
  const [tab, setTab] = useState<TabId>("overview");
  const [saving, setSaving] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [meta, setMeta] = useState<TitleMetadata | null>(null);

  const readOnly = mode === "view" || !!title?.locked;
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
      toast.error("Free plan allows 1 submission. Upgrade to submit more titles.");
      return;
    }
    setSubmitting(true);
    try {
      await submitTitle(title.id);
      onSubmitted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed.");
    } finally { setSubmitting(false); }
  };

  const byCat = (cats: AssetCategory[]) => assets.filter((a) => cats.includes(a.category));

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-stretch">
      <div className="bg-background border-l border-border/50 w-full max-w-5xl ml-auto h-dvh flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border/40">
          <div className="min-w-0 flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary/30" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              {readOnly ? (
                <p className="font-semibold truncate">{title?.title ?? "Loading…"}</p>
              ) : (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-transparent font-semibold text-base outline-none border-b border-transparent focus:border-border/60"
                />
              )}
              <div className="flex items-center gap-2 mt-0.5">
                {title && <StatusBadge status={title.status} />}
                {title?.locked && (
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!readOnly && (
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md border border-border/50 text-xs px-3 py-1.5 hover:bg-secondary/30 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            )}
            {!readOnly && (
              <button
                onClick={handleSubmit}
                disabled={submitting || !ready}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground text-xs px-3 py-1.5 disabled:opacity-40"
                title={ready ? "Submit for review" : `Missing: ${missing.join(", ")}`}
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Submit to Admin
              </button>
            )}
          </div>
        </div>

        {/* Locked banner */}
        {title?.locked && (
          <div className="px-5 py-3 border-b border-border/40 bg-amber-500/5">
            <div className="flex items-center gap-2 text-sm">
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
            </div>
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
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {!title || !meta ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
            </div>
          ) : (
            <>
              {tab === "overview" && (
                <OverviewTab title={title} readiness={readiness} local={localChecklist!} assets={assets} meta={meta} timeline={timeline} />
              )}
              {tab === "metadata" && (
                <MetadataTab meta={meta} setMeta={setMeta} readOnly={readOnly} />
              )}
              {tab === "status" && <StatusTab title={title} timeline={timeline} />}

              {tab === "film" && (
                <AssetTab cat="feature_film" label="Feature Film"
                  assets={byCat(["feature_film"])} titleId={title.id}
                  locked={readOnly} onUploaded={reload} accept="video/*" />
              )}
              {tab === "trailer" && (
                <AssetTab cat="trailer" label="Trailer"
                  assets={byCat(["trailer"])} titleId={title.id}
                  locked={readOnly} onUploaded={reload} accept="video/*" />
              )}
              {tab === "poster" && (
                <AssetTab cat="poster" label="Poster"
                  assets={byCat(["poster"])} titleId={title.id}
                  locked={readOnly} onUploaded={reload} accept="image/*" />
              )}
              {tab === "censor" && (
                <AssetTab cat="censor_certificate" label="Censor Certificate"
                  assets={byCat(["censor_certificate", "censor_cert"])} titleId={title.id}
                  locked={readOnly} onUploaded={reload} accept="application/pdf,image/*" />
              )}
              {tab === "ownership" && (
                <AssetTab cat="ownership_documents" label="Ownership Documents"
                  assets={byCat(["ownership_documents", "ownership"])} titleId={title.id}
                  locked={readOnly} onUploaded={reload} accept="application/pdf,image/*" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Sub-tabs ---------------- */

const JOURNEY_STAGES: { key: ContentStatus; label: string }[] = [
  { key: "draft", label: "Created" },
  { key: "submitted", label: "Submitted" },
  { key: "in_review", label: "In Review" },
  { key: "qc_review", label: "QC Review" },
  { key: "legal_review", label: "Legal Review" },
  { key: "approved", label: "Approved" },
  { key: "ready_for_distribution", label: "Ready For Distribution" },
];

const NEXT_STEP: Record<string, { next: string; eta: string }> = {
  draft:                  { next: "Complete metadata and upload assets, then Submit.", eta: "Self-paced" },
  incomplete:             { next: "Complete missing requirements and Submit.", eta: "Self-paced" },
  submitted:              { next: "Review team assignment.", eta: "1–3 business days" },
  in_review:              { next: "Quality Control review.", eta: "1–2 business days" },
  qc_review:              { next: "Legal review.", eta: "1–2 business days" },
  legal_review:           { next: "Final approval decision.", eta: "1–2 business days" },
  approved:               { next: "Marked Ready for Distribution.", eta: "Within 1 business day" },
  ready_for_distribution: { next: "Distribution & publishing.", eta: "Scheduled by ops" },
  changes_requested:      { next: "Apply changes and re-submit.", eta: "Self-paced" },
  hold:                   { next: "Awaiting review team follow-up.", eta: "Variable" },
  rejected:               { next: "See review note for details.", eta: "—" },
  published:              { next: "Archived (legacy state).", eta: "—" },
  archived:               { next: "Archived.", eta: "—" },
};

function FilmJourney({ status, timeline }: { status: ContentStatus; timeline: TitleTimelineEntry[] }) {
  const visitedSet = new Set<string>(["draft", ...timeline.map(t => t.to_status)]);
  const stages = JOURNEY_STAGES;
  const currentIdx = (() => {
    const i = stages.findIndex(s => s.key === status);
    return i === -1 ? 0 : i;
  })();
  return (
    <div className="rounded-lg border border-border/40 p-4 bg-card/30">
      <div className="text-xs font-semibold mb-3 text-foreground/90">Film Journey</div>
      <ol className="flex flex-wrap items-center gap-2">
        {stages.map((s, i) => {
          const done = visitedSet.has(s.key) || i < currentIdx;
          const current = s.key === status;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span className={cn(
                "inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border",
                current ? "bg-accent/15 border-accent/40 text-accent-foreground font-medium"
                : done ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                       : "bg-secondary/20 border-border/40 text-muted-foreground"
              )}>
                {done ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                {s.label}
              </span>
              {i < stages.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function readinessScore(local: ReturnType<typeof evaluateChecklist>, readiness: ServerReadiness | null) {
  const has = readiness?.has ?? {};
  const items = [
    !!local.hasTitle,
    !!local.hasSynopsis,
    !!(has.feature_film ?? local.hasFilm),
    !!(has.trailer ?? local.hasTrailer),
    !!(has.poster ?? local.hasPoster),
    !!(has.censor_certificate ?? local.hasCensor),
    !!(has.ownership_documents ?? local.hasOwnership),
  ];
  const done = items.filter(Boolean).length;
  return Math.round((done / items.length) * 100);
}

function metadataQuality(meta: TitleMetadata | null) {
  if (!meta) return 0;
  const checks = [
    !!meta.synopsis?.trim(),
    (meta.genres?.length ?? 0) > 0,
    !!meta.original_language?.trim(),
    !!meta.country_of_origin?.trim(),
    (meta.runtime_minutes ?? 0) > 0,
    !!meta.rights_owner?.trim(),
    !!meta.production_company?.trim(),
    (meta.cast?.length ?? 0) > 0,
    (meta.crew?.length ?? 0) > 0,
    !!meta.production_year,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function ScoreCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const tone = value >= 90 ? "text-emerald-300" : value >= 60 ? "text-sky-300" : "text-amber-300";
  return (
    <div className="rounded-lg border border-border/40 p-3 bg-card/30">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-semibold mt-1", tone)}>{value}%</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      <div className="mt-2 h-1.5 rounded-full bg-secondary/40 overflow-hidden">
        <div className={cn(
          "h-full transition-all",
          value >= 90 ? "bg-emerald-400" : value >= 60 ? "bg-sky-400" : "bg-amber-400"
        )} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function OverviewTab({
  title, readiness, local, assets, meta, timeline,
}: {
  title: TitleRow;
  readiness: ServerReadiness | null;
  local: ReturnType<typeof evaluateChecklist>;
  assets: TitleAsset[];
  meta: TitleMetadata | null;
  timeline: TitleTimelineEntry[];
}) {
  const has = readiness?.has ?? {
    feature_film: local.hasFilm,
    trailer: local.hasTrailer,
    poster: local.hasPoster,
    censor_certificate: local.hasCensor,
    ownership_documents: local.hasOwnership,
  };
  const verified = (cat: string) =>
    assets.some((a) => a.category === cat && a.is_primary && a.upload?.status === "verified");

  const rows: { key: string; label: string }[] = [
    { key: "title", label: "Title name" },
    { key: "synopsis", label: "Synopsis" },
    { key: "feature_film", label: "Feature Film" },
    { key: "trailer", label: "Trailer" },
    { key: "poster", label: "Poster" },
    { key: "censor_certificate", label: "Censor Certificate" },
    { key: "ownership_documents", label: "Ownership Documents" },
  ];

  const state = (r: { key: string; label: string }) => {
    if (r.key === "title") return { uploaded: local.hasTitle, verified: local.hasTitle };
    if (r.key === "synopsis") return { uploaded: local.hasSynopsis, verified: local.hasSynopsis };
    return { uploaded: !!has[r.key], verified: verified(r.key) };
  };

  const score = readinessScore(local, readiness);
  const metaScore = metadataQuality(meta);
  const verifiedCount = ["feature_film","trailer","poster","censor_certificate","ownership_documents"]
    .filter(verified).length;
  const deliveryScore = Math.round((verifiedCount / 5) * 100);
  const rightsScore = Math.round(
    ([!!meta?.rights_owner?.trim(), !!meta?.production_company?.trim(), has.ownership_documents, has.censor_certificate]
      .filter(Boolean).length / 4) * 100
  );
  const next = NEXT_STEP[title.status] ?? { next: "—", eta: "—" };

  return (
    <div className="space-y-5">
      <FilmJourney status={title.status} timeline={timeline} />

      <section>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          <ScoreCard label="Submission Readiness" value={score} hint={score === 100 ? "Ready to submit" : `${local.missing.length} missing`} />
          <ScoreCard label="Metadata Quality" value={metaScore} />
          <ScoreCard label="Rights Information" value={rightsScore} />
          <ScoreCard label="Delivery Readiness" value={deliveryScore} hint={`${verifiedCount}/5 verified`} />
        </div>
      </section>

      <section className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
        <div className="text-[10px] uppercase tracking-wider text-sky-300 font-semibold">What Happens Next</div>
        <div className="mt-2 grid sm:grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Current Status</div>
            <div className="mt-1"><StatusBadge status={title.status} /></div>
          </div>
          <div>
            <div className="text-muted-foreground">Next Step</div>
            <div className="mt-1 text-foreground/90">{next.next}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Expected Time</div>
            <div className="mt-1 text-foreground/90">{next.eta}</div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Submission readiness</h3>
        <p className="text-[11px] text-muted-foreground mt-1">
          Live checklist from <code className="text-[10px]">title_submission_readiness()</code>.
        </p>
        <div className="mt-3 rounded-lg border border-border/40 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-secondary/10 text-muted-foreground">
              <tr>
                <th className="text-left font-normal px-3 py-2">Requirement</th>
                <th className="text-left font-normal px-3 py-2">Uploaded</th>
                <th className="text-left font-normal px-3 py-2">Verified</th>
                <th className="text-left font-normal px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = state(r);
                return (
                  <tr key={r.key} className="border-t border-border/30">
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2">{s.uploaded ? "✓" : "—"}</td>
                    <td className="px-3 py-2">{s.verified ? "✓" : "—"}</td>
                    <td className="px-3 py-2">
                      {title.locked ? (
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      ) : s.verified ? (
                        <span className="text-emerald-300">Ready</span>
                      ) : s.uploaded ? (
                        <span className="text-sky-300">Pending verification</span>
                      ) : (
                        <span className="text-muted-foreground">Missing</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Snapshot</h3>
        <dl className="grid sm:grid-cols-2 gap-3 mt-2 text-xs">
          <div><dt className="text-muted-foreground">Format</dt><dd>{title.metadata.format}</dd></div>
          <div><dt className="text-muted-foreground">Runtime</dt><dd>{title.metadata.runtime_minutes || 0} min</dd></div>
          <div><dt className="text-muted-foreground">Genres</dt><dd>{title.metadata.genres.join(", ") || "—"}</dd></div>
          <div><dt className="text-muted-foreground">Production company</dt><dd>{title.metadata.production_company || "—"}</dd></div>
          <div><dt className="text-muted-foreground">Total files</dt><dd>{assets.length}</dd></div>
        </dl>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full bg-background border border-border/40 rounded-md px-3 py-1.5 text-sm disabled:opacity-60" />;
}
function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="w-full bg-background border border-border/40 rounded-md px-3 py-2 text-sm disabled:opacity-60" />;
}
function CSVInput({ value, onChange, disabled, placeholder }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean; placeholder?: string }) {
  return (
    <TextInput
      value={value.join(", ")}
      placeholder={placeholder ?? "Comma separated"}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
    />
  );
}

function MetadataTab({
  meta, setMeta, readOnly,
}: { meta: TitleMetadata; setMeta: (m: TitleMetadata) => void; readOnly: boolean }) {
  const upd = <K extends keyof TitleMetadata>(k: K, v: TitleMetadata[K]) => setMeta({ ...meta, [k]: v });
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Synopsis">
        <TextArea rows={5} value={meta.synopsis} disabled={readOnly} onChange={(e) => upd("synopsis", e.target.value)} />
      </Field>
      <Field label="Notes">
        <TextArea rows={5} value={meta.notes} disabled={readOnly} onChange={(e) => upd("notes", e.target.value)} />
      </Field>
      <Field label="Genre (comma separated)">
        <CSVInput value={meta.genres} disabled={readOnly} onChange={(v) => upd("genres", v)} />
      </Field>
      <Field label="Keywords">
        <CSVInput value={meta.keywords} disabled={readOnly} onChange={(v) => upd("keywords", v)} />
      </Field>
      <Field label="Original Language">
        <TextInput value={meta.original_language} disabled={readOnly}
          placeholder="e.g. Malayalam, Tamil, English"
          onChange={(e) => upd("original_language", e.target.value)} />
      </Field>
      <Field label="Production Year">
        <TextInput type="number" min={1900} max={2100} value={meta.production_year ?? ""} disabled={readOnly}
          onChange={(e) => upd("production_year", e.target.value ? Number(e.target.value) : null)} />
      </Field>
      <Field label="Country Of Origin">
        <TextInput value={meta.country_of_origin} disabled={readOnly}
          placeholder="e.g. India"
          onChange={(e) => upd("country_of_origin", e.target.value)} />
      </Field>
      <Field label="Runtime (minutes)">
        <TextInput type="number" min={0} value={meta.runtime_minutes} disabled={readOnly}
          onChange={(e) => upd("runtime_minutes", Number(e.target.value || 0))} />
      </Field>
      <Field label="Rights Owner">
        <TextInput value={meta.rights_owner} disabled={readOnly}
          onChange={(e) => upd("rights_owner", e.target.value)} />
      </Field>
      <Field label="Production Company">
        <TextInput value={meta.production_company} disabled={readOnly} onChange={(e) => upd("production_company", e.target.value)} />
      </Field>
      <Field label="IMDb ID">
        <TextInput value={meta.imdb_id} disabled={readOnly} onChange={(e) => upd("imdb_id", e.target.value)} />
      </Field>
      <Field label="TMDb ID">
        <TextInput value={meta.tmdb_id} disabled={readOnly} onChange={(e) => upd("tmdb_id", e.target.value)} />
      </Field>
      <Field label="Cast (comma separated names)">
        <CSVInput
          value={meta.cast.map((c) => c.name)}
          disabled={readOnly}
          onChange={(v) => upd("cast", v.map((name) => ({ name, role: "" })))}
        />
      </Field>
      <Field label="Crew (comma separated names)">
        <CSVInput
          value={meta.crew.map((c) => c.name)}
          disabled={readOnly}
          onChange={(v) => upd("crew", v.map((name) => ({ name, role: "" })))}
        />
      </Field>
      <Field label="Festival Information">
        <TextArea
          rows={3}
          value={meta.festivals.map((f) => `${f.name}${f.year ? ` (${f.year})` : ""}${f.award ? ` — ${f.award}` : ""}`).join("\n")}
          disabled={readOnly}
          onChange={(e) => upd("festivals",
            e.target.value.split("\n").map((s) => s.trim()).filter(Boolean).map((line) => ({ name: line, year: null, award: "" })),
          )}
        />
      </Field>
      <Field label="Awards">
        <TextArea
          rows={3}
          value={meta.awards.map((a) => `${a.name}${a.year ? ` (${a.year})` : ""}`).join("\n")}
          disabled={readOnly}
          onChange={(e) => upd("awards",
            e.target.value.split("\n").map((s) => s.trim()).filter(Boolean).map((line) => ({ name: line, year: null })),
          )}
        />
      </Field>
    </div>
  );
}

function StatusTab({ title, timeline }: { title: TitleRow; timeline: TitleTimelineEntry[] }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Current status:</span>
        <StatusBadge status={title.status} />
      </div>
      <ul className="text-xs space-y-1.5 text-muted-foreground">
        <li>Created: {new Date(title.created_at).toLocaleString()}</li>
        <li>Last updated: {new Date(title.updated_at).toLocaleString()}</li>
        {title.submitted_at && <li>Submitted: {new Date(title.submitted_at).toLocaleString()}</li>}
        {title.approved_at && <li>Approved: {new Date(title.approved_at).toLocaleString()}</li>}
        {title.published_at && <li>Published (legacy): {new Date(title.published_at).toLocaleString()}</li>}
        {title.locked && <li className="text-amber-300">Locked — content, metadata, documents and rights are read-only.</li>}
      </ul>
      <div>
        <div className="text-xs font-semibold mb-2">Review History</div>
        {timeline.length === 0 ? (
          <div className="text-xs text-muted-foreground">No status changes yet.</div>
        ) : (
          <ol className="space-y-2">
            {timeline.slice().reverse().map((t) => (
              <li key={t.id} className="rounded-md border border-border/40 p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {(t.from_status ?? "—").replace(/_/g," ")} → {t.to_status.replace(/_/g," ")}
                  </span>
                  <span className="text-muted-foreground">{new Date(t.created_at).toLocaleString()}</span>
                </div>
                {t.note && <div className="text-muted-foreground mt-1">{t.note}</div>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
