import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { X, Loader2, Send, Lock, ShieldCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getTitle, listAssets, saveTitleMetadata, submitTitle,
  evaluateChecklist, fetchReadiness,
  type TitleRow, type TitleAsset, type ServerReadiness,
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
  const [tab, setTab] = useState<TabId>("overview");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [meta, setMeta] = useState<TitleMetadata | null>(null);

  const readOnly = mode === "view" || !!title?.locked;

  const reload = useCallback(async () => {
    const [t, a, r] = await Promise.all([
      getTitle(titleId),
      listAssets(titleId),
      fetchReadiness(titleId),
    ]);
    setTitle(t);
    setAssets(a);
    setReadiness(r);
    if (t) {
      setName(t.title);
      setMeta(t.metadata);
    }
  }, [titleId]);

  useEffect(() => { reload(); }, [reload]);

  const save = async () => {
    if (!title || !meta) return;
    setSaving(true);
    try {
      await saveTitleMetadata(title.id, { title: name, metadata: meta });
      toast.success("Saved.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally { setSaving(false); }
  };

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
                <OverviewTab title={title} readiness={readiness} local={localChecklist!} assets={assets} />
              )}
              {tab === "metadata" && (
                <MetadataTab meta={meta} setMeta={setMeta} readOnly={readOnly} />
              )}
              {tab === "status" && <StatusTab title={title} />}

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

function OverviewTab({
  title, readiness, local, assets,
}: {
  title: TitleRow;
  readiness: ServerReadiness | null;
  local: ReturnType<typeof evaluateChecklist>;
  assets: TitleAsset[];
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

  return (
    <div className="space-y-5">
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

function StatusTab({ title }: { title: TitleRow }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Current status:</span>
        <StatusBadge status={title.status} />
      </div>
      <ul className="text-xs space-y-1.5 text-muted-foreground">
        <li>Created: {new Date(title.created_at).toLocaleString()}</li>
        <li>Last updated: {new Date(title.updated_at).toLocaleString()}</li>
        {title.submitted_at && <li>Submitted: {new Date(title.submitted_at).toLocaleString()}</li>}
        {title.approved_at && <li>Approved: {new Date(title.approved_at).toLocaleString()}</li>}
        {title.published_at && <li>Published: {new Date(title.published_at).toLocaleString()}</li>}
        {title.locked && <li className="text-amber-300">Locked — content, metadata, documents and rights are read-only.</li>}
      </ul>
      <p className="text-xs text-muted-foreground">
        Statuses: Draft · Incomplete · Submitted · Under Review · QC Review · Legal Review · Changes Requested · Approved · Rejected · Hold · Published · Archived.
      </p>
    </div>
  );
}
