import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowRight, Bot, BriefcaseBusiness, CheckCircle2,
  Clock3, Database, Handshake, Loader2, MapPinned, MessageSquareText,
  RefreshCw, Save, Search, Sparkles, Target, UserRound, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type ActivityStatus = "discovered" | "contacted" | "replied" | "qualified" | "offer" | "approval" | "contract" | "payment" | "delivery" | "won" | "lost" | "blocked";
type Severity = "info" | "warning" | "critical";

type BusinessActivity = {
  id: string;
  title: string;
  company: string;
  contact_name: string;
  contact_channel: string;
  industry: string;
  item_or_service: string;
  status: ActivityStatus;
  summary: string;
  next_action: string;
  amount: number | null;
  currency: string;
  source: string;
  occurred_at: string;
  created_at: string;
};

type Issue = {
  id: string;
  source: string;
  severity: Severity;
  title: string;
  detail: string;
  status: string;
  created_at: string;
};

type Skill = {
  id: string;
  name: string;
  category: string;
  capability: string;
  level: string;
  evidence: string;
  last_used_at: string | null;
  updated_at: string;
};

const STAGES: { key: ActivityStatus; label: string }[] = [
  { key: "discovered", label: "Found" },
  { key: "contacted", label: "Contacted" },
  { key: "replied", label: "Reply" },
  { key: "qualified", label: "Qualified" },
  { key: "offer", label: "Offer" },
  { key: "approval", label: "Approval" },
  { key: "contract", label: "Contract" },
  { key: "payment", label: "Payment" },
  { key: "delivery", label: "Delivery" },
  { key: "won", label: "Won" },
];

const statusTone: Record<ActivityStatus, string> = {
  discovered: "border-slate-500/40 bg-slate-500/10 text-slate-200",
  contacted: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  replied: "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
  qualified: "border-indigo-500/40 bg-indigo-500/10 text-indigo-200",
  offer: "border-violet-500/40 bg-violet-500/10 text-violet-200",
  approval: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  contract: "border-orange-500/40 bg-orange-500/10 text-orange-200",
  payment: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  delivery: "border-teal-500/40 bg-teal-500/10 text-teal-200",
  won: "border-green-500/50 bg-green-500/15 text-green-200",
  lost: "border-zinc-600 bg-zinc-700/20 text-zinc-300",
  blocked: "border-red-500/50 bg-red-500/10 text-red-200",
};

const seedActivities: BusinessActivity[] = [
  {
    id: "seed-shaip",
    title: "Regional video licensing pilot",
    company: "Shaip",
    contact_name: "Anand / Sanjay Kumar",
    contact_channel: "Gmail",
    industry: "AI Data",
    item_or_service: "25–50 hour rights-cleared regional video pilot",
    status: "qualified",
    summary: "Warm vendor and AI-training licensing conversation found in company mail history.",
    next_action: "Complete AI-use rights matrix, sample manifest and amount lock.",
    amount: null,
    currency: "INR",
    source: "Gmail audit",
    occurred_at: "2026-07-13T13:25:53.000Z",
    created_at: "2026-07-13T13:25:53.000Z",
  },
  {
    id: "seed-muvi",
    title: "Buyer network and delivery integration",
    company: "Muvi",
    contact_name: "Aman Anand",
    contact_channel: "Hostinger Mail",
    industry: "OTT / Technology",
    item_or_service: "Buyer API, content delivery and partner workflow",
    status: "replied",
    summary: "Partner response exists; exact API scope and commercial terms remain unverified.",
    next_action: "Extract reply requirements and prepare a no-cost integration scope.",
    amount: null,
    currency: "INR",
    source: "Hostinger inbox",
    occurred_at: "2026-08-04T12:03:12.000Z",
    created_at: "2026-08-04T12:03:12.000Z",
  },
  {
    id: "seed-bahumukham",
    title: "Distribution termination audit",
    company: "Bahumukham rights owner",
    contact_name: "Harshiv Karthik",
    contact_channel: "Hostinger Mail",
    industry: "Film Rights",
    item_or_service: "Rights clearance before re-licensing",
    status: "blocked",
    summary: "Termination-related communication exists. No sale until contract position is verified.",
    next_action: "Read agreement and termination thread; create an owner decision card.",
    amount: null,
    currency: "INR",
    source: "Hostinger inbox",
    occurred_at: "2026-08-05T05:30:36.000Z",
    created_at: "2026-08-05T05:30:36.000Z",
  },
];

const LOCAL_KEY = "streamvista-live-business-control-v1";

function readLocal(): BusinessActivity[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) as BusinessActivity[] : [];
  } catch {
    return [];
  }
}

function saveLocal(rows: BusinessActivity[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(rows));
}

function formatMoney(value: number | null, currency = "INR") {
  if (value == null) return "Not locked";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function timeAgo(iso: string) {
  const delta = Date.now() - Date.parse(iso);
  if (Number.isNaN(delta)) return "unknown";
  const minutes = Math.max(0, Math.floor(delta / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ControlCenter() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<BusinessActivity[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [storageMode, setStorageMode] = useState<"database" | "local">("database");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    title: "", company: "", contact_name: "", contact_channel: "Gmail",
    industry: "Film Rights", item_or_service: "", status: "discovered" as ActivityStatus,
    summary: "", next_action: "", amount: "", source: "Manual owner log",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [activityRes, issueRes, skillRes, agentRes] = await Promise.all([
      supabase.from("business_activity_events").select("*").order("occurred_at", { ascending: false }).limit(250),
      supabase.from("business_control_issues").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("business_skill_registry").select("*").order("updated_at", { ascending: false }).limit(100),
      supabase.from("agent_events").select("id,severity,agent,title,summary,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(100),
    ]);

    if (activityRes.error) {
      const local = readLocal();
      const merged = [...local, ...seedActivities].filter((row, index, all) => all.findIndex(x => x.id === row.id) === index);
      setActivities(merged.sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at)));
      setStorageMode("local");
    } else {
      setActivities((activityRes.data ?? []) as BusinessActivity[]);
      setStorageMode("database");
    }

    const platformIssues: Issue[] = (agentRes.data ?? [])
      .filter((row: { severity?: string }) => row.severity === "critical" || row.severity === "warn")
      .map((row: { id: string; severity: string; agent: string | null; title: string | null; summary: string | null; created_at: string }) => ({
        id: `agent-${row.id}`,
        source: row.agent ?? "Agent",
        severity: row.severity === "critical" ? "critical" : "warning",
        title: row.title ?? "Agent event",
        detail: row.summary ?? "No detail supplied",
        status: "open",
        created_at: row.created_at,
      }));
    setIssues([...(issueRes.data ?? []) as Issue[], ...platformIssues]);
    setSkills((skillRes.data ?? []) as Skill[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return activities;
    return activities.filter(row => [row.title, row.company, row.contact_name, row.industry, row.item_or_service, row.summary, row.next_action]
      .join(" ").toLowerCase().includes(needle));
  }, [activities, query]);

  const last24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return activities.filter(row => Date.parse(row.occurred_at) >= cutoff);
  }, [activities]);

  const metrics = useMemo(() => ({
    active: activities.filter(row => !["won", "lost"].includes(row.status)).length,
    replies: activities.filter(row => ["replied", "qualified", "offer", "approval", "contract", "payment", "delivery", "won"].includes(row.status)).length,
    approvals: activities.filter(row => row.status === "approval").length,
    blocked: activities.filter(row => row.status === "blocked").length + issues.filter(row => row.status !== "resolved").length,
    pipeline: activities.reduce((sum, row) => sum + (row.amount ?? 0), 0),
  }), [activities, issues]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.company.trim()) {
      toast.error("Title and company/person are required.");
      return;
    }
    setSaving(true);
    const row: BusinessActivity = {
      id: crypto.randomUUID(),
      title: form.title.trim(), company: form.company.trim(), contact_name: form.contact_name.trim(),
      contact_channel: form.contact_channel.trim(), industry: form.industry.trim(), item_or_service: form.item_or_service.trim(),
      status: form.status, summary: form.summary.trim(), next_action: form.next_action.trim(),
      amount: form.amount ? Number(form.amount) : null, currency: "INR", source: form.source,
      occurred_at: new Date().toISOString(), created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("business_activity_events").insert({
      title: row.title, company: row.company, contact_name: row.contact_name,
      contact_channel: row.contact_channel, industry: row.industry, item_or_service: row.item_or_service,
      status: row.status, summary: row.summary, next_action: row.next_action,
      amount: row.amount, currency: row.currency, source: row.source, occurred_at: row.occurred_at,
      created_by: user?.id,
    });

    if (error) {
      const local = [row, ...readLocal()];
      saveLocal(local);
      setStorageMode("local");
      setActivities(prev => [row, ...prev]);
      toast.warning("Database table unavailable. Saved safely in this browser; migration is included in the branch.");
    } else {
      toast.success("Activity saved to the business audit database.");
      await load();
    }
    setForm(prev => ({ ...prev, title: "", company: "", contact_name: "", item_or_service: "", summary: "", next_action: "", amount: "" }));
    setSaving(false);
  };

  if (authLoading) return <div className="min-h-dvh grid place-items-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <main className="min-h-dvh bg-[#070b12] text-slate-100">
      <div className="mx-auto max-w-[1600px] p-4 md:p-6 space-y-5">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-[#0c1422] to-[#0a0f18] p-5 md:p-7 shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                <Activity className="h-4 w-4 animate-pulse" /> Live Founder Control
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">StreamVista Business Movement Map</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400 md:text-base">Real leads, conversations, requirements, approvals, errors, delivery and revenue movement. Nothing is marked complete without evidence.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1.5 text-xs ${storageMode === "database" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-amber-500/40 bg-amber-500/10 text-amber-200"}`}>
                <Database className="mr-1 inline h-3.5 w-3.5" /> {storageMode === "database" ? "Database persistence" : "Browser fallback"}
              </span>
              <Button variant="outline" onClick={() => void load()} disabled={loading} className="border-white/15 bg-white/5">
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Active movements", metrics.active, BriefcaseBusiness],
            ["Reply / interest", metrics.replies, MessageSquareText],
            ["Approval waiting", metrics.approvals, Clock3],
            ["Errors / blockers", metrics.blocked, AlertTriangle],
            ["Amount locked", formatMoney(metrics.pipeline), Target],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <Icon className="h-5 w-5 text-cyan-300" />
              <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">{String(label)}</p>
              <p className="mt-1 text-2xl font-bold">{String(value)}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 md:p-6 overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-xl font-semibold">Live route</h2><p className="text-sm text-slate-500">Google Maps-style commercial journey. Pulsing nodes have current activity.</p></div>
            <MapPinned className="h-6 w-6 text-cyan-300" />
          </div>
          <div className="mt-6 overflow-x-auto pb-4">
            <div className="flex min-w-[1100px] items-center">
              {STAGES.map((stage, index) => {
                const count = activities.filter(row => row.status === stage.key).length;
                return (
                  <div key={stage.key} className="flex flex-1 items-center">
                    <div className="flex min-w-20 flex-col items-center text-center">
                      <div className={`relative grid h-12 w-12 place-items-center rounded-full border ${count ? "border-cyan-400 bg-cyan-400/15 shadow-[0_0_28px_rgba(34,211,238,.28)]" : "border-white/15 bg-white/5"}`}>
                        {count > 0 && <span className="absolute inset-0 animate-ping rounded-full border border-cyan-400/40" />}
                        <span className="relative text-sm font-bold">{count}</span>
                      </div>
                      <span className="mt-2 text-xs text-slate-400">{stage.label}</span>
                    </div>
                    {index < STAGES.length - 1 && <div className="relative h-px flex-1 bg-gradient-to-r from-cyan-500/70 to-white/10"><span className="absolute -top-1 right-0 h-2 w-2 animate-pulse rounded-full bg-cyan-300" /></div>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.5fr_.8fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div><h2 className="text-xl font-semibold">People, companies and conversations</h2><p className="text-sm text-slate-500">Who saw what, what they said, what we have, and what happens next.</p></div>
              <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search company, title, service…" className="w-full pl-9 md:w-72 bg-black/20" /></div>
            </div>
            <div className="mt-5 space-y-3">
              {loading && <div className="py-16 text-center text-slate-500"><Loader2 className="mx-auto mb-2 animate-spin" />Loading live records…</div>}
              {!loading && filtered.map(row => (
                <article key={row.id} className="rounded-2xl border border-white/10 bg-black/15 p-4 hover:border-cyan-500/30 transition-colors">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${statusTone[row.status]}`}>{row.status}</span>
                        <span className="text-xs text-slate-500">{row.industry}</span>
                        <span className="text-xs text-slate-600">· {timeAgo(row.occurred_at)}</span>
                      </div>
                      <h3 className="mt-2 text-lg font-semibold">{row.title}</h3>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                        <span><BriefcaseBusiness className="mr-1 inline h-4 w-4" />{row.company}</span>
                        {row.contact_name && <span><UserRound className="mr-1 inline h-4 w-4" />{row.contact_name}</span>}
                        <span><MessageSquareText className="mr-1 inline h-4 w-4" />{row.contact_channel}</span>
                      </div>
                    </div>
                    <div className="text-left lg:text-right"><p className="text-xs text-slate-500">Commercial amount</p><p className="font-semibold text-emerald-300">{formatMoney(row.amount, row.currency)}</p></div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
                    <div className="rounded-xl bg-white/[0.03] p-3"><p className="text-xs text-slate-500">Item / service</p><p className="mt-1">{row.item_or_service || "Not recorded"}</p></div>
                    <div className="rounded-xl bg-white/[0.03] p-3"><p className="text-xs text-slate-500">What happened</p><p className="mt-1">{row.summary || "No summary"}</p></div>
                    <div className="rounded-xl bg-cyan-500/[0.05] p-3"><p className="text-xs text-cyan-400">Next action</p><p className="mt-1">{row.next_action || "Decision needed"}</p></div>
                  </div>
                  <p className="mt-3 text-[11px] text-slate-600">Evidence source: {row.source}</p>
                </article>
              ))}
              {!loading && filtered.length === 0 && <div className="py-16 text-center text-slate-500">No matching business movement found.</div>}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 md:p-5">
              <h2 className="text-lg font-semibold">Add real activity</h2>
              <p className="mt-1 text-xs text-slate-500">Meeting, mail, call, buyer request, error or deal movement.</p>
              <form onSubmit={submit} className="mt-4 space-y-3">
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Activity title *" className="bg-black/20" />
                <div className="grid grid-cols-2 gap-2"><Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Company / person *" className="bg-black/20" /><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder="Contact name" className="bg-black/20" /></div>
                <div className="grid grid-cols-2 gap-2"><Input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="Industry" className="bg-black/20" /><Input value={form.contact_channel} onChange={e => setForm({ ...form, contact_channel: e.target.value })} placeholder="Channel" className="bg-black/20" /></div>
                <Input value={form.item_or_service} onChange={e => setForm({ ...form, item_or_service: e.target.value })} placeholder="Item / service requested" className="bg-black/20" />
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ActivityStatus })} className="h-10 w-full rounded-md border border-input bg-black/20 px-3 text-sm">{Object.keys(statusTone).map(status => <option key={status} value={status}>{status}</option>)}</select>
                <Textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="What did they say / what happened?" className="bg-black/20" />
                <Textarea value={form.next_action} onChange={e => setForm({ ...form, next_action: e.target.value })} placeholder="Next action and delivery promise" className="bg-black/20" />
                <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="Amount only after approval" className="bg-black/20" />
                <Button type="submit" disabled={saving} className="w-full"><Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save to audit timeline"}</Button>
              </form>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 md:p-5">
              <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">24-hour report</h2><Clock3 className="h-5 w-5 text-cyan-300" /></div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-2xl font-bold">{last24h.length}</p><p className="text-[11px] text-slate-500">Movements</p></div>
                <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-2xl font-bold">{last24h.filter(r => ["replied", "qualified", "offer"].includes(r.status)).length}</p><p className="text-[11px] text-slate-500">Buyer signals</p></div>
                <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-2xl font-bold">{last24h.filter(r => r.status === "blocked").length}</p><p className="text-[11px] text-slate-500">New blockers</p></div>
                <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-2xl font-bold">{last24h.filter(r => r.status === "won").length}</p><p className="text-[11px] text-slate-500">Wins</p></div>
              </div>
              <div className="mt-4 space-y-2">{last24h.slice(0, 5).map(row => <div key={row.id} className="flex items-center gap-2 text-xs"><ArrowRight className="h-3.5 w-3.5 text-cyan-400" /><span className="truncate">{row.company}: {row.title}</span></div>)}{last24h.length === 0 && <p className="text-sm text-slate-500">No verified movement recorded in the last 24 hours.</p>}</div>
            </section>

            <section className="rounded-3xl border border-red-500/20 bg-red-500/[0.025] p-4 md:p-5">
              <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Errors and mistakes</h2><AlertTriangle className="h-5 w-5 text-red-300" /></div>
              <div className="mt-4 space-y-2">{issues.slice(0, 8).map(issue => <div key={issue.id} className="rounded-xl border border-white/10 bg-black/15 p-3"><div className="flex items-center gap-2">{issue.severity === "critical" ? <XCircle className="h-4 w-4 text-red-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}<p className="text-sm font-medium">{issue.title}</p></div><p className="mt-1 text-xs text-slate-500">{issue.detail}</p><p className="mt-2 text-[10px] text-slate-600">{issue.source} · {timeAgo(issue.created_at)}</p></div>)}{issues.length === 0 && <div className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />No recorded critical issue.</div>}</div>
            </section>

            <section className="rounded-3xl border border-violet-500/20 bg-violet-500/[0.025] p-4 md:p-5">
              <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Agent skills and capability</h2><Sparkles className="h-5 w-5 text-violet-300" /></div>
              <div className="mt-4 space-y-2">{skills.slice(0, 8).map(skill => <div key={skill.id} className="rounded-xl bg-white/[0.035] p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{skill.name}</p><span className="text-[10px] uppercase text-violet-300">{skill.level}</span></div><p className="mt-1 text-xs text-slate-500">{skill.capability}</p><p className="mt-2 text-[10px] text-slate-600">Evidence: {skill.evidence || "not recorded"}</p></div>)}{skills.length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-slate-500"><Bot className="mb-2 h-4 w-4" />Skill registry is ready; database migration must be applied before shared persistence becomes active.</div>}</div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
