import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Mail, Phone, Tag, Inbox, CheckCircle2, MessageSquare, XCircle,
  Search, RefreshCw, Filter, History, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  client_name: string;
  professional_role: string;
  contact_phone: string | null;
  business_email: string | null;
  selected_cycle: string;
  base_price: number;
  final_price: number;
  promo_code: string | null;
  onboarding_status: string;
  payment_status: string;
  razorpay_payment_id: string | null;
  created_at: string;
}

type StatusKey = "all" | "pending" | "contacted" | "activated" | "rejected";

const FILTERS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "contacted", label: "Contacted" },
  { key: "activated", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted/40 text-muted-foreground border-border/60",
  contacted: "bg-accent/15 text-accent border-accent/40",
  activated: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  rejected: "bg-destructive/15 text-destructive border-destructive/40",
};

export default function OnboardingApprovals() {
  const { isAdmin, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusKey>("pending");
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("onboarding_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error("Could not load onboarding requests");
    setRows((data as Row[]) ?? []);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  // Realtime
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("approvals-onboarding")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "onboarding_requests" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRows(prev => [payload.new as Row, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setRows(prev => prev.map(r => r.id === (payload.new as Row).id ? (payload.new as Row) : r));
          } else if (payload.eventType === "DELETE") {
            setRows(prev => prev.filter(r => r.id !== (payload.old as Row).id));
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  const updateStatus = async (id: string, status: string) => {
    setBusyId(id);
    const prev = rows.find(r => r.id === id)?.onboarding_status;
    setRows(r => r.map(x => x.id === id ? { ...x, onboarding_status: status } : x));
    const { error } = await supabase
      .from("onboarding_requests")
      .update({ onboarding_status: status })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      setRows(r => r.map(x => x.id === id ? { ...x, onboarding_status: prev ?? "pending" } : x));
      toast.error(error.message);
      return;
    }
  };

  const approve = async (r: Row) => {
    await updateStatus(r.id, "activated");
    toast.success(`Approved · ${r.client_name}`, {
      description: r.business_email ? `Workspace activated for ${r.business_email}` : "Workspace activated",
    });
  };
  const reject = async (r: Row) => {
    await updateStatus(r.id, "rejected");
    toast.message(`Marked rejected · ${r.client_name}`);
  };
  const contactEmail = async (r: Row) => {
    if (!r.business_email) return toast.error("No email on file");
    await updateStatus(r.id, "contacted");
    const subject = encodeURIComponent(`StreamVista Cloud X · Onboarding for ${r.client_name}`);
    const body = encodeURIComponent(
      `Hi ${r.client_name.split(" ")[0] ?? r.client_name},\n\n` +
      `Thanks for requesting onboarding to StreamVista Cloud X. We've reviewed your ${r.selected_cycle} plan request and would like to schedule your activation.\n\n` +
      `Please reply with a convenient time slot.\n\n— StreamVista OPC Team`,
    );
    window.open(`mailto:${r.business_email}?subject=${subject}&body=${body}`, "_blank");
  };
  const contactWhatsApp = async (r: Row) => {
    if (!r.contact_phone) return toast.error("No phone on file");
    await updateStatus(r.id, "contacted");
    const phone = r.contact_phone.replace(/[^\d+]/g, "");
    const msg = encodeURIComponent(
      `Hi ${r.client_name.split(" ")[0] ?? r.client_name}, this is the StreamVista Cloud X onboarding team. We're ready to activate your ${r.selected_cycle} workspace — when would you like to get started?`,
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  const counts = useMemo(() => ({
    all: rows.length,
    pending: rows.filter(r => r.onboarding_status === "pending").length,
    contacted: rows.filter(r => r.onboarding_status === "contacted").length,
    activated: rows.filter(r => r.onboarding_status === "activated").length,
    rejected: rows.filter(r => r.onboarding_status === "rejected").length,
  }), [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(r => filter === "all" ? true : r.onboarding_status === filter)
      .filter(r => !q ? true :
        [r.client_name, r.business_email, r.contact_phone, r.professional_role, r.promo_code]
          .filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
  }, [rows, filter, query]);

  if (!isAdmin) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
        Onboarding approvals are admin-only. Signed in as{" "}
        <span className="text-foreground">{user?.email ?? "guest"}</span>.
      </div>
    );
  }

  return (
    <section className="glass rounded-2xl p-6 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <Inbox className="w-5 h-5 text-accent" /> Onboarding Approvals
          </h2>
          <p className="text-xs text-muted-foreground mt-1 font-mono-tech uppercase tracking-[0.16em]">
            {counts.pending} awaiting · {counts.activated} approved · {counts.contacted} in conversation
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="h-10 px-4 rounded-xl border border-border hover:bg-secondary text-sm flex items-center gap-2 disabled:opacity-60"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
        </button>
      </header>

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
          <Filter className="w-3.5 h-3.5" /> Status
        </div>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 h-8 rounded-full text-xs font-semibold border transition-colors",
              filter === f.key
                ? "bg-gradient-primary text-primary-foreground border-transparent glow-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            {f.label}
            <span className="ml-1.5 opacity-70">{counts[f.key]}</span>
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, email, phone…"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-secondary/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* List */}
      <div className="grid gap-3">
        {visible.map(r => {
          const isBusy = busyId === r.id;
          const status = r.onboarding_status;
          return (
            <article
              key={r.id}
              className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl p-5 grid lg:grid-cols-[1.5fr_1fr_auto] gap-5 items-start animate-fade-in"
            >
              {/* Identity */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-bold text-lg leading-tight">{r.client_name}</h3>
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.16em] font-mono-tech border",
                    STATUS_TONE[status] ?? STATUS_TONE.pending,
                  )}>
                    {status === "activated" ? "approved" : status}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.professional_role} · {new Date(r.created_at).toLocaleString()}
                </div>
                <div className="flex flex-wrap gap-2 text-xs pt-1">
                  {r.business_email && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/60">
                      <Mail className="w-3 h-3" /> {r.business_email}
                    </span>
                  )}
                  {r.contact_phone && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/60">
                      <Phone className="w-3 h-3" /> {r.contact_phone}
                    </span>
                  )}
                  {r.promo_code && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent/10 text-accent">
                      <Tag className="w-3 h-3" /> {r.promo_code}
                    </span>
                  )}
                </div>
              </div>

              {/* Plan */}
              <div className="text-sm space-y-1">
                <div className="text-[10px] uppercase tracking-[0.18em] font-mono-tech text-muted-foreground">Plan</div>
                <div className="font-semibold capitalize">{r.selected_cycle}</div>
                <div className="text-muted-foreground text-xs">
                  ₹{Number(r.final_price).toLocaleString("en-IN")}
                  <span className="opacity-70"> · base ₹{Number(r.base_price).toLocaleString("en-IN")}</span>
                </div>
                <span className={cn(
                  "inline-block px-2 py-0.5 rounded text-[10px] font-mono-tech uppercase tracking-[0.14em] mt-1",
                  r.payment_status === "paid"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : r.payment_status === "failed"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-muted/40 text-muted-foreground",
                )}>
                  Pay · {r.payment_status}
                </span>
              </div>

              {/* Actions */}
              <div className="lg:w-56 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => approve(r)}
                    disabled={isBusy || status === "activated"}
                    title="Approve & activate workspace"
                    className="col-span-2 h-10 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold glow-primary disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {status === "activated" ? "Approved" : "Approve"}
                  </button>
                  <button
                    onClick={() => contactEmail(r)}
                    disabled={!r.business_email}
                    title="Email creator"
                    className="h-9 rounded-lg border border-border hover:bg-secondary text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <Mail className="w-3.5 h-3.5" /> Email
                  </button>
                  <button
                    onClick={() => contactWhatsApp(r)}
                    disabled={!r.contact_phone}
                    title="WhatsApp creator"
                    className="h-9 rounded-lg border border-border hover:bg-secondary text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                  <button
                    onClick={() => reject(r)}
                    disabled={isBusy || status === "rejected"}
                    title="Reject request"
                    className="col-span-2 h-9 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
                <AuditTrail requestId={r.id} clientName={r.client_name} />
              </div>
            </article>
          );
        })}

        {!loading && visible.length === 0 && (
          <div className="text-center py-16 text-sm text-muted-foreground">
            {rows.length === 0
              ? "No onboarding requests yet."
              : "No requests match this filter."}
          </div>
        )}
        {loading && rows.length === 0 && (
          <div className="py-16 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        )}
      </div>
    </section>
  );
}

interface AuditEntry {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_email: string | null;
  created_at: string;
}

function AuditTrail({ requestId, clientName }: { requestId: string; clientName: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("onboarding_audit_log")
      .select("*")
      .eq("onboarding_request_id", requestId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setEntries((data as AuditEntry[]) ?? []);
  };

  return (
    <Dialog onOpenChange={(o) => { if (o) load(); }}>
      <DialogTrigger asChild>
        <button className="w-full h-8 rounded-lg border border-border/60 hover:bg-secondary text-[11px] flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground">
          <History className="w-3 h-3" /> Audit trail
          <ExternalLink className="w-3 h-3 opacity-50" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Audit trail · {clientName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No status changes recorded yet.</p>
        ) : (
          <ul className="space-y-3 max-h-[60vh] overflow-y-auto">
            {entries.map(e => (
              <li key={e.id} className="border border-border rounded-lg p-3 text-sm">
                <div className="flex justify-between gap-2 text-xs text-muted-foreground mb-1">
                  <span className="uppercase tracking-wider">{e.field_name.replace("_", " ")}</span>
                  <span>{new Date(e.created_at).toLocaleString()}</span>
                </div>
                <div className="font-medium">
                  <span className="text-muted-foreground">{e.old_value ?? "—"}</span>
                  <span className="mx-2 opacity-50">→</span>
                  <span className="text-foreground">{e.new_value ?? "—"}</span>
                </div>
                {e.changed_by_email && (
                  <div className="text-[11px] text-muted-foreground mt-1">by {e.changed_by_email}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
