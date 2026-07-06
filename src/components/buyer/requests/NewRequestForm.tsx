import { useState } from "react";
import { Loader2, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  CATEGORY_LABEL, CATEGORY_TO_ENUM, TERRITORIES, RIGHTS_CATEGORIES, PLATFORM_TYPES,
  EXCLUSIVITY, TERM_BUCKETS, URGENCIES, LANGUAGES, GENRES, FORMATS,
  type Category, type RowTerms,
} from "./shared";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-xs px-2.5 py-1 rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        active
          ? "bg-accent text-accent-foreground border-accent"
          : "bg-secondary/20 border-border/50 hover:border-accent/50"
      }`}
    >
      {children}
    </button>
  );
}

function ChipGroup<T extends string>({ label, options, value, onChange, multi }: {
  label: string;
  options: readonly T[];
  value: T | T[] | null;
  onChange: (v: T | T[] | null) => void;
  multi?: boolean;
}) {
  const isActive = (o: T) => Array.isArray(value) ? value.includes(o) : value === o;
  const toggle = (o: T) => {
    if (multi) {
      const arr = Array.isArray(value) ? value : [];
      onChange(arr.includes(o) ? arr.filter(x => x !== o) as T[] : [...arr, o] as T[]);
    } else {
      onChange(value === o ? null : o);
    }
  };
  return (
    <div className="grid gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map(o => <Chip key={o} active={isActive(o)} onClick={() => toggle(o)}>{o}</Chip>)}
      </div>
    </div>
  );
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

export function NewRequestForm({
  onSubmitted,
  onNeedsGate,
  defaultCategory,
  defaultTitle,
}: {
  onSubmitted: () => void;
  onNeedsGate: () => void;
  defaultCategory?: Category;
  defaultTitle?: string;
}) {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category>(defaultCategory ?? "acquisition_interest");
  const [titleQuery, setTitleQuery] = useState(defaultTitle ?? "");
  const [territory, setTerritory] = useState<string | null>(null);
  const [rightsCat, setRightsCat] = useState<string | null>(null);
  const [platformType, setPlatformType] = useState<string | null>(null);
  const [exclusivity, setExclusivity] = useState<string | null>(null);
  const [termBucket, setTermBucket] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<string>("Standard");
  const [screenerNeeded, setScreenerNeeded] = useState(true);
  const [ndaReady, setNdaReady] = useState(true);
  const [languages, setLanguages] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const titleOptional = category !== "catalog_access";

  const submit = async () => {
    if (!user) return;
    if (titleOptional && !titleQuery.trim() && languages.length === 0 && genres.length === 0) {
      toast.error("Add a title, or pick at least a language/genre so admin can scope your brief.");
      return;
    }
    if (!territory) { toast.error("Pick a target territory."); return; }
    if (!rightsCat) { toast.error("Pick a rights category."); return; }

    setSubmitting(true);
    const terms: RowTerms = {
      category, territory, rights_category: rightsCat,
      platform_type: platformType ?? undefined,
      exclusivity: exclusivity ?? undefined,
      term_bucket: termBucket ?? undefined,
      screener_needed: screenerNeeded,
      nda_ready: ndaReady,
      urgency, languages, genres, formats,
      notes: notes.trim() || undefined,
    };
    const summaryBits = [
      CATEGORY_LABEL[category], territory, rightsCat, exclusivity, termBucket,
      languages.join("/") || null, genres.join("/") || null,
    ].filter(Boolean).join(" · ");

    const payload: Record<string, unknown> = {
      buyer_user_id: user.id,
      request_type: CATEGORY_TO_ENUM[category],
      title_query: titleQuery.trim() || null,
      message: notes.trim() || null,
      interest_summary: summaryBits,
      terms,
    };

    const { error } = await supabase.from("commercial_requests").insert(payload as never);
    setSubmitting(false);
    if (error) {
      if (/has_accepted_agreement|policy/i.test(error.message)) { onNeedsGate(); return; }
      toast.error(error.message);
      return;
    }
    toast.success("Request submitted. Admin will review shortly.");
    onSubmitted();
  };

  return (
    <div className="rounded-2xl border border-border/40 bg-secondary/10 p-5 sm:p-6 max-w-3xl space-y-5">
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden />
        <span>All commercial requests are reviewed by StreamVista admin before any rights or contact is shared.</span>
      </div>

      <ChipGroup
        label="Request type"
        options={Object.keys(CATEGORY_LABEL) as Category[]}
        value={category}
        onChange={(v) => setCategory((v as Category) ?? "acquisition_interest")}
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="grid gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Title (optional)</span>
          <Input
            value={titleQuery}
            onChange={e => setTitleQuery(e.target.value)}
            placeholder="e.g. Crimson Coast (2024)"
            maxLength={200}
          />
          <span className="text-[10px] text-muted-foreground">Leave blank if you're scoping by language/genre — admin will map.</span>
        </label>

        <label className="grid gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Urgency</span>
          <Select value={urgency} onValueChange={setUrgency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {URGENCIES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      </div>

      <ChipGroup label="Target territory" options={TERRITORIES} value={territory} onChange={(v) => setTerritory(v as string | null)} />
      <ChipGroup label="Rights category" options={RIGHTS_CATEGORIES} value={rightsCat} onChange={(v) => setRightsCat(v as string | null)} />

      <div className="grid sm:grid-cols-2 gap-4">
        <ChipGroup label="Platform type" options={PLATFORM_TYPES} value={platformType} onChange={(v) => setPlatformType(v as string | null)} />
        <ChipGroup label="Exclusivity" options={EXCLUSIVITY} value={exclusivity} onChange={(v) => setExclusivity(v as string | null)} />
      </div>

      <ChipGroup label="Term" options={TERM_BUCKETS} value={termBucket} onChange={(v) => setTermBucket(v as string | null)} />

      <div className="grid sm:grid-cols-3 gap-4">
        <ChipGroup label="Languages" options={LANGUAGES} value={languages} onChange={(v) => setLanguages(v as string[])} multi />
        <ChipGroup label="Genres" options={GENRES} value={genres} onChange={(v) => setGenres(v as string[])} multi />
        <ChipGroup label="Format" options={FORMATS} value={formats} onChange={(v) => setFormats(v as string[])} multi />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <ToggleRow label="Screener needed" hint="Request a watermarked screener for evaluation" value={screenerNeeded} onChange={setScreenerNeeded} />
        <ToggleRow label="NDA ready" hint="Confirm you can execute an NDA on first ask" value={ndaReady} onChange={setNdaReady} />
      </div>

      <label className="grid gap-1.5">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Note to admin (optional, short)</span>
        <Input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="One line — budget range, partner, festival window, etc."
          maxLength={240}
        />
      </label>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button onClick={submit} disabled={submitting}>
          {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
          Submit request
        </Button>
      </div>
    </div>
  );
}
