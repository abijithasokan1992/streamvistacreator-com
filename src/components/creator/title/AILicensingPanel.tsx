import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AI_REVIEW_STATUS_LABEL,
  fetchTitleAILicensing,
  upsertTitleAILicensing,
  type TitleAILicensing,
  type AiTriState,
  type AiRightsAuthorization,
  type AiExclusivity,
} from "@/lib/creator/aiLicensingApi";

interface Props {
  titleId: string;
  workspaceId: string;
  ownerUserId: string;
  readOnly?: boolean;
}

const USE_CASES = [
  "Facial-motion understanding",
  "Lip synchronization",
  "Mouth-movement prediction",
  "Visual-speech technologies",
  "Audio-video alignment research",
];

const CSV = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

export function AILicensingPanel({ titleId, workspaceId, ownerUserId, readOnly = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<TitleAILicensing | null>(null);
  // form draft mirrors editable creator fields only
  const [draft, setDraft] = useState({
    available_for_review: "undecided" as AiTriState,
    rights_holder_authorized: "pending" as AiRightsAuthorization,
    approved_use_cases: [] as string[],
    prohibited_use_cases: "" as string,
    licence_term: "",
    territory: "",
    exclusivity: "unspecified" as AiExclusivity,
    commercial_model: "",
    performer_consent_status: "",
    music_rights_status: "",
    source_master_available: false,
    resolution: "",
    frame_rate: "",
    lip_sync_qc_status: "",
    audio_languages: "" as string,
    subtitle_languages: "" as string,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetchTitleAILicensing(titleId);
        if (!alive) return;
        setRow(r);
        if (r) {
          setDraft({
            available_for_review: r.available_for_review,
            rights_holder_authorized: r.rights_holder_authorized,
            approved_use_cases: r.approved_use_cases ?? [],
            prohibited_use_cases: (r.prohibited_use_cases ?? []).join(", "),
            licence_term: r.licence_term ?? "",
            territory: r.territory ?? "",
            exclusivity: r.exclusivity,
            commercial_model: r.commercial_model ?? "",
            performer_consent_status: r.performer_consent_status ?? "",
            music_rights_status: r.music_rights_status ?? "",
            source_master_available: r.source_master_available,
            resolution: r.resolution ?? "",
            frame_rate: r.frame_rate ?? "",
            lip_sync_qc_status: r.lip_sync_qc_status ?? "",
            audio_languages: (r.audio_languages ?? []).join(", "),
            subtitle_languages: (r.subtitle_languages ?? []).join(", "),
          });
        }
      } catch (e) {
        toast({ title: "Could not load AI licensing", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [titleId]);

  const toggleUseCase = (uc: string) => {
    setDraft((d) => ({
      ...d,
      approved_use_cases: d.approved_use_cases.includes(uc)
        ? d.approved_use_cases.filter((x) => x !== uc)
        : [...d.approved_use_cases, uc],
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await upsertTitleAILicensing({
        title_id: titleId,
        workspace_id: workspaceId,
        owner_user_id: ownerUserId,
        available_for_review: draft.available_for_review,
        rights_holder_authorized: draft.rights_holder_authorized,
        approved_use_cases: draft.approved_use_cases,
        prohibited_use_cases: CSV(draft.prohibited_use_cases),
        licence_term: draft.licence_term || null,
        territory: draft.territory || null,
        exclusivity: draft.exclusivity,
        commercial_model: draft.commercial_model || null,
        performer_consent_status: draft.performer_consent_status || null,
        music_rights_status: draft.music_rights_status || null,
        source_master_available: draft.source_master_available,
        resolution: draft.resolution || null,
        frame_rate: draft.frame_rate || null,
        lip_sync_qc_status: draft.lip_sync_qc_status || null,
        audio_languages: CSV(draft.audio_languages),
        subtitle_languages: CSV(draft.subtitle_languages),
      });
      setRow(saved);
      toast({ title: "AI licensing metadata saved" });
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border/50 p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading AI licensing…
      </div>
    );
  }

  const reviewStatus = row?.review_status ?? "not_submitted";

  return (
    <section className="rounded-lg border border-border/50 bg-card/30 p-6 space-y-6" aria-labelledby="ai-licensing-heading">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 id="ai-licensing-heading" className="font-display font-bold text-lg flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" /> AI Training Licensing (optional)
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Submitting this section does not grant AI training rights. StreamVista reviews rights and only qualifies content after
            documented rights approval and written authorization.
          </p>
        </div>
        <span className="text-[10px] font-mono-tech uppercase tracking-[0.2em] rounded-full border border-border/60 px-3 py-1">
          AI rights status: {AI_REVIEW_STATUS_LABEL[reviewStatus]}
        </span>
      </header>

      {reviewStatus !== "not_submitted" && (
        <div className="rounded-md border border-border/50 bg-background/40 p-3 text-xs text-muted-foreground flex gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Review status is managed by StreamVista administrators. You can continue to update your submission details below.
        </div>
      )}

      <fieldset disabled={readOnly} className="grid md:grid-cols-2 gap-4 disabled:opacity-70">
        <Select label="Available for AI-training review" value={draft.available_for_review}
          onChange={(v) => setDraft((d) => ({ ...d, available_for_review: v as AiTriState }))}
          options={[["undecided","Undecided"],["yes","Yes"],["no","No"]]} />
        <Select label="Rights holder authorized AI use" value={draft.rights_holder_authorized}
          onChange={(v) => setDraft((d) => ({ ...d, rights_holder_authorized: v as AiRightsAuthorization }))}
          options={[["pending","Pending"],["yes","Yes"],["no","No"]]} />
        <div className="md:col-span-2">
          <span className="text-[11px] font-mono-tech uppercase tracking-[0.2em] text-foreground/80">Approved AI use cases</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {USE_CASES.map((uc) => (
              <button type="button" key={uc} onClick={() => toggleUseCase(uc)}
                className={`text-xs rounded-full px-3 py-1.5 border transition ${
                  draft.approved_use_cases.includes(uc)
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60 text-muted-foreground hover:border-primary/40"
                }`}>{uc}</button>
            ))}
          </div>
        </div>
        <Text label="Prohibited AI use cases (comma separated)" value={draft.prohibited_use_cases}
          onChange={(v) => setDraft((d) => ({ ...d, prohibited_use_cases: v }))} />
        <Text label="Licence term" value={draft.licence_term} onChange={(v) => setDraft((d) => ({ ...d, licence_term: v }))} />
        <Text label="Territory" value={draft.territory} onChange={(v) => setDraft((d) => ({ ...d, territory: v }))} />
        <Select label="Exclusivity" value={draft.exclusivity}
          onChange={(v) => setDraft((d) => ({ ...d, exclusivity: v as AiExclusivity }))}
          options={[["unspecified","Unspecified"],["exclusive","Exclusive"],["non_exclusive","Non-exclusive"]]} />
        <Text label="Commercial model" value={draft.commercial_model} onChange={(v) => setDraft((d) => ({ ...d, commercial_model: v }))} />
        <Text label="Performer consent status" value={draft.performer_consent_status} onChange={(v) => setDraft((d) => ({ ...d, performer_consent_status: v }))} />
        <Text label="Music-rights status" value={draft.music_rights_status} onChange={(v) => setDraft((d) => ({ ...d, music_rights_status: v }))} />
        <label className="flex items-center gap-2 text-sm mt-6">
          <input type="checkbox" checked={draft.source_master_available}
            onChange={(e) => setDraft((d) => ({ ...d, source_master_available: e.target.checked }))} />
          Source / master available
        </label>
        <Text label="Resolution" value={draft.resolution} onChange={(v) => setDraft((d) => ({ ...d, resolution: v }))} />
        <Text label="Frame rate" value={draft.frame_rate} onChange={(v) => setDraft((d) => ({ ...d, frame_rate: v }))} />
        <Text label="Lip-sync / QC status" value={draft.lip_sync_qc_status} onChange={(v) => setDraft((d) => ({ ...d, lip_sync_qc_status: v }))} />
        <Text label="Audio languages (comma separated)" value={draft.audio_languages} onChange={(v) => setDraft((d) => ({ ...d, audio_languages: v }))} />
        <Text label="Subtitle languages (comma separated)" value={draft.subtitle_languages} onChange={(v) => setDraft((d) => ({ ...d, subtitle_languages: v }))} />
      </fieldset>

      {!readOnly && (
        <div className="flex justify-end">
          <button type="button" onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save AI licensing details
          </button>
        </div>
      )}
    </section>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-mono-tech uppercase tracking-[0.2em] text-foreground/80">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="text-[11px] font-mono-tech uppercase tracking-[0.2em] text-foreground/80">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export default AILicensingPanel;
