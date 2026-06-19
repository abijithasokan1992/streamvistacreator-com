import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { X, Loader2, Send, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getTitle, listAssets, saveTitleMetadata, submitTitle, evaluateChecklist,
  type TitleRow, type TitleAsset,
} from "@/lib/creator/titleApi";
import {
  type TitleMetadata, type AssetCategory, CATEGORY_LABEL,
} from "@/lib/creator/titleSchema";
import { AssetUploader, AssetList } from "./AssetUploader";
import { StatusBadge } from "./StatusBadge";

type TabId =
  | "overview" | "film" | "trailer" | "poster" | "metadata"
  | "artwork" | "captions" | "documents" | "licenses" | "rights"
  | "sales" | "status";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview",  label: "Overview" },
  { id: "film",      label: "Film File" },
  { id: "trailer",   label: "Trailer" },
  { id: "poster",    label: "Poster" },
  { id: "metadata",  label: "Metadata" },
  { id: "artwork",   label: "Artwork" },
  { id: "captions",  label: "Captions" },
  { id: "documents", label: "Documents" },
  { id: "licenses",  label: "Licenses" },
  { id: "rights",    label: "Rights" },
  { id: "sales",     label: "Sales Pitch" },
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
  const [tab, setTab] = useState<TabId>("overview");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [meta, setMeta] = useState<TitleMetadata | null>(null);

  const readOnly = mode === "view" || !!title?.locked;

  const reload = useCallback(async () => {
    const [t, a] = await Promise.all([getTitle(titleId), listAssets(titleId)]);
    setTitle(t);
    setAssets(a);
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

  const checklist = useMemo(() => (title ? evaluateChecklist(title, assets) : null), [title, assets]);

  const handleSubmit = async () => {
    if (!title) return;
    if (!checklist?.ready) {
      toast.error(`Missing: ${checklist?.missing.join(", ")}`);
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

  const byCat = (c: AssetCategory) => assets.filter((a) => a.category === c);

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
                disabled={submitting || !checklist?.ready}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground text-xs px-3 py-1.5 disabled:opacity-40"
                title={checklist?.ready ? "Submit for review" : `Missing: ${checklist?.missing.join(", ")}`}
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Submit to Admin
              </button>
            )}
          </div>
        </div>

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
                <OverviewTab title={title} checklist={checklist!} assets={assets} />
              )}
              {tab === "metadata" && (
                <MetadataTab meta={meta} setMeta={setMeta} readOnly={readOnly} />
              )}
              {tab === "rights" && (
                <RightsTab meta={meta} setMeta={setMeta} readOnly={readOnly} />
              )}
              {tab === "status" && <StatusTab title={title} />}

              {/* Asset-tab pattern */}
              {tab === "film" && (
                <AssetTab cat="feature_film" label="Feature Film" assets={byCat("feature_film")} titleId={title.id} locked={readOnly} onUploaded={reload} accept="video/*" />
              )}
              {tab === "trailer" && (
                <AssetTab cat="trailer" label="Trailer" assets={byCat("trailer")} titleId={title.id} locked={readOnly} onUploaded={reload} accept="video/*" />
              )}
              {tab === "poster" && (
                <AssetTab cat="poster" label="Poster" assets={byCat("poster")} titleId={title.id} locked={readOnly} onUploaded={reload} accept="image/*" />
              )}
              {tab === "artwork" && (
                <AssetTab cat="artwork" label="Artwork" assets={byCat("artwork")} titleId={title.id} locked={readOnly} onUploaded={reload} accept="image/*" />
              )}
              {tab === "captions" && (
                <div className="space-y-6">
                  <AssetTab cat="captions" label="Captions" assets={byCat("captions")} titleId={title.id} locked={readOnly} onUploaded={reload} accept=".srt,.vtt,.scc,.ttml,.xml" />
                  <AssetTab cat="subtitle" label="Subtitle Files" assets={byCat("subtitle")} titleId={title.id} locked={readOnly} onUploaded={reload} accept=".srt,.vtt,.ass,.idx,.sub" />
                  <AssetTab cat="audio" label="Audio Tracks" assets={byCat("audio")} titleId={title.id} locked={readOnly} onUploaded={reload} accept="audio/*" />
                </div>
              )}
              {tab === "documents" && (
                <div className="space-y-6">
                  <AssetTab cat="censor_cert" label="Censor Certificate" assets={byCat("censor_cert")} titleId={title.id} locked={readOnly} onUploaded={reload} accept="application/pdf,image/*" />
                  <AssetTab cat="legal" label="Legal Documents" assets={byCat("legal")} titleId={title.id} locked={readOnly} onUploaded={reload} accept="application/pdf" />
                  <AssetTab cat="ownership" label="Ownership Documents" assets={byCat("ownership")} titleId={title.id} locked={readOnly} onUploaded={reload} accept="application/pdf" />
                </div>
              )}
              {tab === "licenses" && (
                <AssetTab cat="legal" label="License Agreements" assets={byCat("legal")} titleId={title.id} locked={readOnly} onUploaded={reload} accept="application/pdf" />
              )}
              {tab === "sales" && (
                <AssetTab cat="sales" label="Sales Materials" assets={byCat("sales")} titleId={title.id} locked={readOnly} onUploaded={reload} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Sub-tabs ---------------- */

function OverviewTab({ title, checklist, assets }: { title: TitleRow; checklist: ReturnType<typeof evaluateChecklist>; assets: TitleAsset[] }) {
  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-sm font-semibold">Submission checklist</h3>
        <ul className="mt-2 text-xs space-y-1">
          <CheckItem ok={checklist.hasTitle} label="Title name" />
          <CheckItem ok={checklist.hasSynopsis} label="Synopsis" />
          <CheckItem ok={checklist.hasFilm} label="Feature Film uploaded" />
          <CheckItem ok={checklist.hasPoster} label="Poster uploaded" />
          <CheckItem
            ok={checklist.hasCensor}
            label={checklist.censorRequired ? "Censor Certificate (required for feature films)" : "Censor Certificate (not required for this format)"}
          />
        </ul>
        {!checklist.censorRequired && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Trailers, shorts, teasers and work-in-progress formats do not require a censor certificate. Admin may waive on a case-by-case basis.
          </p>
        )}
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

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn("inline-block w-1.5 h-1.5 rounded-full", ok ? "bg-emerald-400" : "bg-amber-400")} />
      <span className={cn(ok ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </li>
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

/* ----- Metadata tab: kept compact; full structured input ----- */

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
      <Field label="Genres">
        <CSVInput value={meta.genres} disabled={readOnly} onChange={(v) => upd("genres", v)} />
      </Field>
      <Field label="Keywords">
        <CSVInput value={meta.keywords} disabled={readOnly} onChange={(v) => upd("keywords", v)} />
      </Field>
      <Field label="Format">
        <select
          disabled={readOnly}
          value={meta.format}
          onChange={(e) => upd("format", e.target.value as TitleMetadata["format"])}
          className="w-full bg-background border border-border/40 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="feature_film">Feature Film</option>
          <option value="trailer">Trailer</option>
          <option value="short">Short</option>
          <option value="teaser">Teaser</option>
          <option value="wip">Work in Progress</option>
          <option value="series">Series</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Runtime (minutes)">
        <TextInput type="number" min={0} value={meta.runtime_minutes} disabled={readOnly}
          onChange={(e) => upd("runtime_minutes", Number(e.target.value || 0))} />
      </Field>
      <Field label="Production Company">
        <TextInput value={meta.production_company} disabled={readOnly} onChange={(e) => upd("production_company", e.target.value)} />
      </Field>
      <Field label="Owner">
        <TextInput value={meta.owner} disabled={readOnly} onChange={(e) => upd("owner", e.target.value)} />
      </Field>
      <Field label="Countries">
        <CSVInput value={meta.countries} disabled={readOnly} onChange={(v) => upd("countries", v)} />
      </Field>
      <Field label="Tags">
        <CSVInput value={meta.tags} disabled={readOnly} onChange={(v) => upd("tags", v)} />
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
      <Field label="IMDb ID">
        <TextInput value={meta.imdb_id} disabled={readOnly} onChange={(e) => upd("imdb_id", e.target.value)} />
      </Field>
      <Field label="TMDb ID">
        <TextInput value={meta.tmdb_id} disabled={readOnly} onChange={(e) => upd("tmdb_id", e.target.value)} />
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
      <Field label="Ratings system">
        <TextInput value={meta.ratings.system} disabled={readOnly}
          onChange={(e) => upd("ratings", { ...meta.ratings, system: e.target.value })} />
      </Field>
      <Field label="Advisory">
        <TextArea rows={2} value={meta.advisory} disabled={readOnly} onChange={(e) => upd("advisory", e.target.value)} />
      </Field>
      <Field label="Copyright">
        <TextInput value={meta.copyright} disabled={readOnly} onChange={(e) => upd("copyright", e.target.value)} />
      </Field>
    </div>
  );
}

function RightsTab({
  meta, setMeta, readOnly,
}: { meta: TitleMetadata; setMeta: (m: TitleMetadata) => void; readOnly: boolean }) {
  const upd = (patch: Partial<TitleMetadata["rights"]>) =>
    setMeta({ ...meta, rights: { ...meta.rights, ...patch } });
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Territories">
        <CSVInput
          value={meta.rights.territories}
          disabled={readOnly}
          onChange={(v) => upd({ territories: v })}
          placeholder="IN, US, EU…"
        />
      </Field>
      <Field label="Exclusivity">
        <select
          disabled={readOnly}
          value={meta.rights.exclusivity}
          onChange={(e) => upd({ exclusivity: e.target.value as TitleMetadata["rights"]["exclusivity"] })}
          className="w-full bg-background border border-border/40 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="unspecified">Unspecified</option>
          <option value="exclusive">Exclusive</option>
          <option value="non_exclusive">Non-exclusive</option>
        </select>
      </Field>
      <Field label="Windows">
        <TextArea rows={4} value={meta.rights.windows} disabled={readOnly} onChange={(e) => upd({ windows: e.target.value })} />
      </Field>
      <Field label="Rights notes">
        <TextArea rows={4} value={meta.rights.notes} disabled={readOnly} onChange={(e) => upd({ notes: e.target.value })} />
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
