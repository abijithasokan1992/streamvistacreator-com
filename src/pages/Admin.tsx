import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, LogOut, ShieldCheck, Crown, RefreshCw, Mail, Phone, Tag, History, Copy, Check, Briefcase, Wallet, Code2, Megaphone, Inbox } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PremiumInvitations from "@/components/admin/PremiumInvitations";
import CommissionsTracker from "@/components/admin/CommissionsTracker";
import OracleStorageMonitor from "@/components/admin/OracleStorageMonitor";
import FreeTierConfig from "@/components/admin/FreeTierConfig";
import BrandingSettings from "@/components/admin/BrandingSettings";
import SupportInbox from "@/components/admin/SupportInbox";

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

const STATUSES = ["pending", "contacted", "activated", "rejected"];

export default function Admin() {
  const { user, isAdmin, loading, signOut, refreshRole } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [copied, setCopied] = useState(false);

  const adminUrl = typeof window !== "undefined" ? `${window.location.origin}/admin` : "/admin";
  const copyAdmin = async () => {
    try {
      await navigator.clipboard.writeText(adminUrl);
      setCopied(true);
      toast.success("Admin link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Copy failed"); }
  };

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  const load = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("onboarding_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setFetching(false);
    if (error) { toast.error("Could not load requests"); return; }
    setRows((data as Row[]) ?? []);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  // Realtime: notify admin of new onboarding requests
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-onboarding-inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "onboarding_requests" },
        (payload) => {
          const row = payload.new as Row;
          setRows(prev => [row, ...prev.filter(r => r.id !== row.id)]);
          toast.success(`New onboarding request · ${row.client_name}`, {
            description: `${row.professional_role} · ${row.selected_cycle} · ₹${Number(row.final_price).toLocaleString("en-IN")}${row.business_email ? ` · ${row.business_email}` : ""}${row.contact_phone ? ` · ${row.contact_phone}` : ""}`,
            duration: 10000,
            action: {
              label: "View",
              onClick: () => {
                document.getElementById(`req-${row.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              },
            },
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  const claimAdmin = async () => {
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_admin_if_none");
    setClaiming(false);
    if (error) return toast.error(error.message);
    if (data) { toast.success("You are now admin"); await refreshRole(); }
    else toast.error("An admin already exists. Ask them to grant you access.");
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("onboarding_requests").update({ onboarding_status: status }).eq("id", id);
    if (error) return toast.error(error.message);
    setRows(r => r.map(x => x.id === id ? { ...x, onboarding_status: status } : x));
    toast.success("Status updated");
  };

  if (loading) return <div className="min-h-dvh grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (!isAdmin) {
    return (
      <main className="min-h-dvh grid place-items-center px-4">
        <div className="glass-strong rounded-3xl p-10 max-w-md text-center animate-fade-in">
          <Crown className="w-12 h-12 mx-auto text-accent mb-4" />
          <h1 className="font-display text-2xl font-bold mb-2">No Admin Access</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Signed in as <span className="text-foreground">{user?.email}</span>. If you're the first user, claim admin to bootstrap the control panel.
          </p>
          <button onClick={claimAdmin} disabled={claiming} className="w-full h-12 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary disabled:opacity-60 flex items-center justify-center gap-2">
            {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Claim Admin Role
          </button>
          <button onClick={signOut} className="mt-3 w-full h-10 rounded-xl border border-border text-sm font-medium hover:bg-secondary">Sign out</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh">
      <header className="border-b border-border/50 glass sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div title="Crayons Creator Portal">
              <div className="font-display font-bold text-sm">Admin</div>
              <div className="text-[11px] text-muted-foreground">{user?.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md border border-border/70 bg-secondary/40 text-xs">
              <span className="font-mono text-foreground">/admin</span>
              <button onClick={copyAdmin} aria-label="Copy admin panel link" className="text-muted-foreground hover:text-accent transition-colors">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <Link to="/" className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">Site</Link>
            <button onClick={load} disabled={fetching} className="px-3 py-2 text-sm rounded-md border border-border hover:bg-secondary flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${fetching ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button onClick={signOut} className="px-3 py-2 text-sm rounded-md border border-border hover:bg-secondary flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="container py-10 space-y-10">
        <BrandingSettings />
        <FreeTierConfig />
        <SupportInbox />
        <PremiumInvitations />
        <CommissionsTracker />
        <OracleStorageMonitor />



        <div className="flex items-baseline justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold">Onboarding Requests</h1>
            <p className="text-sm text-muted-foreground mt-1">{rows.length} total · live from the database</p>
          </div>
        </div>

        <div className="grid gap-4">
          {rows.map(r => (
            <div key={r.id} id={`req-${r.id}`} className="glass rounded-2xl p-6 grid md:grid-cols-[1.4fr_1fr_auto] gap-6 items-start animate-fade-in scroll-mt-24">
              <div>
                <div className="font-display font-bold text-lg">{r.client_name}</div>
                <div className="text-xs text-muted-foreground mb-3">{r.professional_role} · {new Date(r.created_at).toLocaleString()}</div>
                <div className="flex flex-wrap gap-3 text-xs">
                  {r.business_email && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/60"><Mail className="w-3 h-3" /> {r.business_email}</span>}
                  {r.contact_phone && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/60"><Phone className="w-3 h-3" /> {r.contact_phone}</span>}
                  {r.promo_code && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent/10 text-accent"><Tag className="w-3 h-3" /> {r.promo_code}</span>}
                </div>
              </div>

              <div className="text-sm space-y-1">
                <div className="text-muted-foreground text-xs uppercase tracking-wider">Plan</div>
                <div className="font-semibold capitalize">{r.selected_cycle}</div>
                <div className="text-muted-foreground">₹{Number(r.final_price).toLocaleString("en-IN")} <span className="text-xs">(base ₹{Number(r.base_price).toLocaleString("en-IN")})</span></div>
                <div className="mt-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${r.payment_status === "paid" ? "bg-green-500/15 text-green-400" : r.payment_status === "failed" ? "bg-destructive/15 text-destructive" : "bg-muted/50 text-muted-foreground"}`}>
                    Payment: {r.payment_status}
                  </span>
                </div>
              </div>

              <div className="md:w-44 space-y-2">
                <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Onboarding</div>
                <Select value={r.onboarding_status} onValueChange={v => setStatus(r.id, v)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
                <AuditTrail requestId={r.id} clientName={r.client_name} />
              </div>
            </div>
          ))}
          {rows.length === 0 && !fetching && (
            <div className="text-center py-20 text-muted-foreground">No onboarding requests yet.</div>
          )}
        </div>
      </section>
    </main>
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
        <button className="w-full h-9 rounded-md border border-border hover:bg-secondary text-xs flex items-center justify-center gap-1.5">
          <History className="w-3.5 h-3.5" /> Audit trail
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
                  <span className="mx-2 text-accent">→</span>
                  <span>{e.new_value ?? "—"}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">by {e.changed_by_email ?? "system"}</div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
