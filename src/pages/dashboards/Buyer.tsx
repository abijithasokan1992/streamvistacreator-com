import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, Send, Plus, Inbox, Film, MessagesSquare, Sparkles, ArrowRight, Clock } from "lucide-react";
import { toast } from "sonner";
import RoleDashboardShell from "./RoleDashboardShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AgreementGate } from "@/components/legal/AgreementGate";

/* ---------------------------------------------------------------------------
   Buyer Workspace v1 — Phase 1
   - Overview (live metrics + recent activity + next actions)
   - Structured New Request (chips / selectors / toggles, no big textareas)
   - My Requests (with detail view + timeline)
   All requests are admin-mediated via existing commercial_requests + events.
--------------------------------------------------------------------------- */

type EnumType = "acquisition" | "licensing" | "screener" | "rights_info" | "distribution";

// Spec-level request categories (richer than the DB enum). Mapped to enum below.
type Category =
  | "screener"
  | "rights_availability"
  | "acquisition_interest"
  | "licensing"
  | "distribution_territory"
  | "dubbing_language"
  | "clip_promo"
  | "remake_adaptation"
  | "catalog_access";

const CATEGORY_LABEL: Record<Category, string> = {
  screener: "Screener",
  rights_availability: "Rights availability",
  acquisition_interest: "Acquisition interest",
  licensing: "Licensing",
  distribution_territory: "Distribution / Territory",
  dubbing_language: "Dubbing / Language rights",
  clip_promo: "Clip / Promo rights",
  remake_adaptation: "Remake / Adaptation",
  catalog_access: "Catalog access",
};

const CATEGORY_TO_ENUM: Record<Category, EnumType> = {
  screener: "screener",
  rights_availability: "rights_info",
  acquisition_interest: "acquisition",
  licensing: "licensing",
  distribution_territory: "distribution",
  dubbing_language: "licensing",
  clip_promo: "licensing",
  remake_adaptation: "acquisition",
  catalog_access: "rights_info",
};

const TERRITORIES = ["India", "South Asia", "Middle East", "SE Asia", "Europe", "UK", "North America", "LATAM", "ANZ", "Worldwide"];
const RIGHTS_CATEGORIES = ["SVOD", "AVOD", "TVOD", "Theatrical", "Broadcast TV", "Airline / Non-theatrical", "Remake / IP", "Clip / Promo"];
const PLATFORM_TYPES = ["OTT platform", "Broadcaster", "Distributor", "Studio", "Brand", "Festival / Curator", "Other"];
const EXCLUSIVITY = ["Exclusive", "Non-exclusive", "Open to either"];
const TERM_BUCKETS = ["< 1 yr", "1–3 yrs", "3–5 yrs", "5+ yrs", "Perpetual"];
const URGENCIES = ["Standard", "Within 30 days", "Within 7 days", "Critical"];
const LANGUAGES = ["Malayalam", "Tamil", "Telugu", "Hindi", "Kannada", "English", "Bengali", "Marathi", "Other"];
const GENRES = ["Drama", "Thriller", "Comedy", "Romance", "Action", "Documentary", "Horror", "Family", "Crime", "Sci-fi"];
const FORMATS = ["Feature", "Series", "Short", "Documentary", "Reality", "Animation"];

const STATE_LABEL: Record<string, string> = {
  pending_admin_review: "Submitted — admin review",
  awaiting_creator_review: "Owner / rights review",
  more_info_required: "Clarification needed",
  rejected: "Closed — not available",
  approved_for_negotiation: "Commercial discussion",
  agreement_pending: "Agreement pending",
  delivery_authorized: "Closed — approved",
  closed: "Closed",
};

const STATE_TONE: Record<string, string> = {
  pending_admin_review: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  awaiting_creator_review: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  more_info_required: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  approved_for_negotiation: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  agreement_pending: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  delivery_authorized: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  closed: "bg-secondary text-muted-foreground border-border/60",
};

type RowTerms = {
  category?: Category;
  territory?: string;
  rights_category?: string;
  platform_type?: string;
  exclusivity?: string;
  term_bucket?: string;
  screener_needed?: boolean;
  nda_ready?: boolean;
  urgency?: string;
  languages?: string[];
  genres?: string[];
  formats?: string[];
  notes?: string;
};

type Row = {
  id: string;
  request_type: EnumType;
  state: string;
  title_query: string | null;
  message: string | null;
  admin_notes: string | null;
  terms: RowTerms | null;
  title_id: string | null;
  created_at: string;
  updated_at: string;
};

export default function BuyerDashboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"overview" | "requests" | "new">("overview");
  const [needsGate, setNeedsGate] = useState(false);
  const [screenerCount, setScreenerCount] = useState<number>(0);

  // Deep-link prefill
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("type") as Category | null;
    if (t && t in CATEGORY_LABEL) {
      setTab("new");
    }
  }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data, error }, screeners] = await Promise.all([
      supabase
        .from("commercial_requests")
        .select("id,request_type,state,title_query,message,admin_notes,terms,title_id,created_at,updated_at")
        .eq("buyer_user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("screening_invites")
        .select("id", { count: "exact", head: true })
        .eq("buyer_user_id", user.id),
    ]);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data as unknown as Row[]) ?? []);
    setScreenerCount(screeners.count ?? 0);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const counts = useMemo(() => {
    const open = rows.filter(r => !["closed", "rejected", "delivery_authorized"].includes(r.state)).length;
    const active = rows.filter(r => ["awaiting_creator_review", "approved_for_negotiation", "agreement_pending"].includes(r.state)).length;
    return { total: rows.length, open, active };
  }, [rows]);

  const recent = useMemo(() => rows.slice(0, 5), [rows]);

  return (
    <RoleDashboardShell
      expectedRole="buyer"
      title="Buyer workspace"
      subtitle="Acquisition, licensing, screener and rights — all admin-mediated. No public catalog."
    >
      {needsGate && (
        <AgreementGate
          type="buyer_request_confidentiality"
          onAccepted={() => { setNeedsGate(false); toast.success("NDA accepted. Please resubmit."); }}
          onCancel={() => setNeedsGate(false)}
          context={{ surface: "buyer_dashboard" }}
        />
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requests">My requests</TabsTrigger>
          <TabsTrigger value="new"><Plus className="w-3.5 h-3.5 mr-1" /> New request</TabsTrigger>
        </TabsList>

        {/* ----------------------------- Overview ----------------------------- */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric icon={Inbox} label="Open requests" value={counts.open} />
            <Metric icon={Film} label="Approved screeners" value={screenerCount} />
            <Metric icon={MessagesSquare} label="Active conversations" value={counts.active} />
            <Metric icon={Sparkles} label="Matched titles" value={"—"} sub="Curated in Phase 2" />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <section className="lg:col-span-2 rounded-2xl border border-border/40 bg-secondary/10 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-base">Recent activity</h2>
                <Button size="sm" variant="ghost" onClick={() => setTab("requests")}>View all <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
              </div>
              {loading ? (
                <div className="py-8 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>
              ) : recent.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No activity yet. Submit your first request to begin.</p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {recent.map(r => (
                    <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{r.title_query || "Untitled brief"}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(r.updated_at).toLocaleString()}
                        </div>
                      </div>
                      <StateBadge state={r.state} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-border/40 bg-secondary/10 p-5">
              <h2 className="font-display text-base mb-3">Next actions</h2>
              <ul className="space-y-2.5 text-sm">
                <NextAction
                  label="Submit a new acquisition or screener request"
                  onClick={() => setTab("new")}
                />
                <NextAction
                  label="Review admin updates on open requests"
                  onClick={() => setTab("requests")}
                  disabled={counts.open === 0}
                />
                <NextAction
                  label="Browse approved screeners"
                  onClick={() => window.location.assign("/screening")}
                  disabled={screenerCount === 0}
                />
              </ul>
              <Button className="mt-4 w-full" onClick={() => setTab("new")}>
                <Plus className="w-4 h-4 mr-1.5" /> New request
              </Button>
            </section>
          </div>
        </TabsContent>

        {/* ----------------------------- My requests ---------------------------- */}
        <TabsContent value="requests" className="mt-6">
          {loading ? (
            <div className="py-12 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/10 p-10 text-center">
              <h2 className="font-semibold">No requests yet</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Submit an acquisition, licensing, screener or rights enquiry. Admin reviews every request before looping in the title owner.
              </p>
              <Button className="mt-5" onClick={() => setTab("new")}><Plus className="w-4 h-4 mr-1.5" /> New request</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map(r => <RequestCard key={r.id} row={r} />)}
            </div>
          )}
        </TabsContent>

        {/* ----------------------------- New request ---------------------------- */}
        <TabsContent value="new" className="mt-6">
          <NewRequestForm
            onSubmitted={() => { setTab("requests"); load(); }}
            onNeedsGate={() => setNeedsGate(true)}
          />
        </TabsContent>
      </Tabs>
    </RoleDashboardShell>
  );
}

/* --------------------------------- atoms --------------------------------- */

function Metric({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/10 p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="font-display text-2xl mt-1.5">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap ${STATE_TONE[state] ?? "bg-secondary text-muted-foreground border-border/60"}`}>
      {STATE_LABEL[state] ?? state}
    </span>
  );
}

function NextAction({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <li>
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full text-left flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 hover:bg-secondary/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        <span className="text-sm">{label}</span>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </li>
  );
}

/* ----------------------------- Chip selectors ----------------------------- */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition ${active
        ? "bg-accent text-accent-foreground border-accent"
        : "bg-secondary/20 border-border/50 hover:border-accent/50"}`}
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
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => <Chip key={o} active={isActive(o)} onClick={() => toggle(o)}>{o}</Chip>)}
      </div>
    </div>
  );
}

/* ---------------------------- New request form ---------------------------- */

function NewRequestForm({ onSubmitted, onNeedsGate }: { onSubmitted: () => void; onNeedsGate: () => void }) {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category>("acquisition_interest");
  const [titleQuery, setTitleQuery] = useState("");
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
      category,
      territory,
      rights_category: rightsCat,
      platform_type: platformType ?? undefined,
      exclusivity: exclusivity ?? undefined,
      term_bucket: termBucket ?? undefined,
      screener_needed: screenerNeeded,
      nda_ready: ndaReady,
      urgency,
      languages,
      genres,
      formats,
      notes: notes.trim() || undefined,
    };

    const summaryBits = [
      CATEGORY_LABEL[category],
      territory,
      rightsCat,
      exclusivity,
      termBucket,
      languages.join("/") || null,
      genres.join("/") || null,
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
    <div className="rounded-2xl border border-border/40 bg-secondary/10 p-6 max-w-3xl space-y-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-accent" />
        All commercial requests are reviewed by StreamVista admin before any rights or contact is shared.
      </div>

      <ChipGroup
        label="Request type"
        options={Object.keys(CATEGORY_LABEL) as Category[]}
        value={category}
        onChange={(v) => setCategory((v as Category) ?? "acquisition_interest")}
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Title (optional)
          </label>
          <Input
            value={titleQuery}
            onChange={e => setTitleQuery(e.target.value)}
            placeholder="e.g. Crimson Coast (2024)"
            maxLength={200}
          />
          <p className="text-[10px] text-muted-foreground">Leave blank if you're scoping by language/genre — admin will map.</p>
        </div>

        <div className="grid gap-1.5">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Urgency</label>
          <Select value={urgency} onValueChange={setUrgency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {URGENCIES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
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

      <div className="grid gap-1.5">
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Note to admin (optional, short)</label>
        <Input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="One line — budget range, partner, festival window, etc."
          maxLength={240}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button onClick={submit} disabled={submitting}>
          {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
          Submit request
        </Button>
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
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

/* ----------------------------- Request card ----------------------------- */

function RequestCard({ row }: { row: Row }) {
  const t = row.terms ?? {};
  const cat = t.category ? CATEGORY_LABEL[t.category] : row.request_type;
  return (
    <details className="rounded-xl border border-border/40 bg-secondary/10 p-4 group">
      <summary className="cursor-pointer flex flex-wrap items-center gap-2 justify-between list-none">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{cat}</Badge>
            <StateBadge state={row.state} />
            {t.urgency && t.urgency !== "Standard" && (
              <Badge className="text-[10px] bg-orange-500/20 text-orange-200 border-orange-500/30">{t.urgency}</Badge>
            )}
          </div>
          <div className="font-medium mt-1.5 truncate">{row.title_query || "Untitled brief"}</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {t.territory && <MiniChip>{t.territory}</MiniChip>}
            {t.rights_category && <MiniChip>{t.rights_category}</MiniChip>}
            {t.exclusivity && <MiniChip>{t.exclusivity}</MiniChip>}
            {t.term_bucket && <MiniChip>{t.term_bucket}</MiniChip>}
            {t.languages?.map(l => <MiniChip key={l}>{l}</MiniChip>)}
          </div>
          {row.admin_notes && (
            <p className="text-xs text-foreground mt-2 border-l-2 border-accent/40 pl-2">
              <span className="text-[10px] uppercase tracking-wider text-accent">Admin · </span>
              {row.admin_notes}
            </p>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {new Date(row.updated_at).toLocaleString()}
          <div className="underline opacity-70 group-open:opacity-100 mt-0.5">View timeline</div>
        </div>
      </summary>
      <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
        <DetailBlock label="Commercial summary">
          <ul className="space-y-1">
            <DetailItem k="Type" v={cat} />
            <DetailItem k="Territory" v={t.territory} />
            <DetailItem k="Rights" v={t.rights_category} />
            <DetailItem k="Platform" v={t.platform_type} />
            <DetailItem k="Exclusivity" v={t.exclusivity} />
            <DetailItem k="Term" v={t.term_bucket} />
            <DetailItem k="Screener" v={t.screener_needed ? "Requested" : "Not required"} />
            <DetailItem k="NDA" v={t.nda_ready ? "Ready" : "Not yet"} />
            {t.notes && <DetailItem k="Note" v={t.notes} />}
          </ul>
        </DetailBlock>
        <DetailBlock label="Timeline">
          <RequestTimeline requestId={row.id} />
        </DetailBlock>
      </div>
    </details>
  );
}

function MiniChip({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/40 border border-border/50">{children}</span>;
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/30 bg-background/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{label}</div>
      {children}
    </div>
  );
}

function DetailItem({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <li className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right text-foreground/90">{v}</span>
    </li>
  );
}

function RequestTimeline({ requestId }: { requestId: string }) {
  const [events, setEvents] = useState<Array<{ id: string; from_state: string | null; to_state: string; note: string | null; created_at: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("commercial_request_events")
        .select("id,from_state,to_state,note,created_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setLoaded(true);
      if (error) return;
      setEvents((data as never) ?? []);
    })();
    return () => { cancelled = true; };
  }, [requestId]);
  if (!loaded) return <div className="text-[11px] text-muted-foreground">Loading…</div>;
  if (events.length === 0) return <div className="text-[11px] text-muted-foreground">Submitted · awaiting admin review.</div>;
  return (
    <ol className="space-y-1.5 border-l border-border/40 pl-3">
      {events.map(e => (
        <li key={e.id} className="text-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
          <div>
            <span className="text-foreground">{STATE_LABEL[e.to_state] ?? e.to_state}</span>
            {e.from_state && <span className="text-muted-foreground"> · from {STATE_LABEL[e.from_state] ?? e.from_state}</span>}
          </div>
          {e.note && <div className="text-muted-foreground italic">"{e.note}"</div>}
        </li>
      ))}
    </ol>
  );
}
