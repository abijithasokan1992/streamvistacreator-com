import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, LogOut, ShieldCheck, Crown, RefreshCw, Mail, Phone, Tag, History, Copy, Check, Briefcase, Wallet, Code2, Megaphone, Inbox, Users as UsersIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBackGuard } from "@/hooks/useBackGuard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PremiumInvitations from "@/components/admin/PremiumInvitations";
import CommissionsTracker from "@/components/admin/CommissionsTracker";
import OracleOciStorageCard from "@/components/admin/OracleOciStorageCard";
import RazorpayAuditLog from "@/components/admin/RazorpayAuditLog";
import FreeTierConfig from "@/components/admin/FreeTierConfig";
import BrandingSettings from "@/components/admin/BrandingSettings";
import SupportInbox from "@/components/admin/SupportInbox";
import OnboardingApprovals from "@/components/admin/OnboardingApprovals";
import PartnerLogos from "@/components/admin/PartnerLogos";
import RolesManager from "@/components/admin/RolesManager";
import RazorpayCredentials from "@/components/admin/RazorpayCredentials";
import RazorpayTestCheckout from "@/components/admin/RazorpayTestCheckout";
import RazorpayConnectivityStatus from "@/components/admin/RazorpayConnectivityStatus";
import ResendCredentials from "@/components/admin/ResendCredentials";
import AdminCredentials from "@/components/admin/AdminCredentials";
import GlobalAssetManager from "@/components/admin/GlobalAssetManager";
import UniversalBroadcast from "@/components/admin/UniversalBroadcast";
import EmailLogMonitor from "@/components/admin/EmailLogMonitor";
import UsersAndCredentials from "@/components/admin/UsersAndCredentials";
import KammattamMeter from "@/components/admin/KammattamMeter";
import MarketingCMS from "@/components/admin/MarketingCMS";
import AiMcpControlCenter from "@/components/admin/AiMcpControlCenter";

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
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  useBackGuard(!!user);
  const [rows, setRows] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(false);
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
    if (!loading && !user) navigate("/auth?next=/admin", { replace: true });
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
            Signed in as <span className="text-foreground">{user?.email}</span>.
            This workspace is managed by an existing administrator. Roles and division
            assignments are issued from inside the admin dashboard — please contact your
            administrator to be granted access.
          </p>
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

            {/* Premium Developer Account Profile Button */}
            <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-border/70 bg-gradient-to-r from-secondary/80 to-secondary/40 hover:from-accent/10 hover:to-secondary/60 transition-all group cursor-default">
              <div className="w-7 h-7 rounded-full bg-gradient-primary grid place-items-center text-[10px] font-bold text-primary-foreground uppercase tracking-wider glow-primary">
                {(user?.email?.split('@')[0] ?? 'A').slice(0, 2)}
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-xs font-semibold text-foreground group-hover:text-accent transition-colors">
                  {(() => {
                    const name = user?.email?.split('@')[0] ?? 'Admin';
                    return name.charAt(0).toUpperCase() + name.slice(1);
                  })()}
                </span>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Dev Account</span>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
            </div>

            
            <button onClick={load} disabled={fetching} className="px-3 py-2 text-sm rounded-md border border-border hover:bg-secondary flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${fetching ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button onClick={signOut} className="px-3 py-2 text-sm rounded-md border border-border hover:bg-secondary flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="container py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Department Console</h1>
          <p className="text-sm text-muted-foreground mt-1">Switch between department windows · all controls are no-code.</p>
        </div>

        <Tabs defaultValue="ops" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 gap-2 h-auto p-1.5 glass rounded-2xl bg-transparent border border-border/50 w-full mb-8">
            <DeptTab value="ops" icon={<Briefcase className="w-4 h-4" />} label="Business & Ops" />
            <DeptTab value="finance" icon={<Wallet className="w-4 h-4" />} label="Finance & Billing" />
            <DeptTab value="dev" icon={<Code2 className="w-4 h-4" />} label="Development" />
            <DeptTab value="marketing" icon={<Megaphone className="w-4 h-4" />} label="Marketing" />
            <DeptTab value="users" icon={<UsersIcon className="w-4 h-4" />} label="Users & Credentials" />
          </TabsList>

          {/* 1. Business & Operations */}
          <TabsContent value="ops" className="space-y-8 mt-0 animate-fade-in">
            <DeptHeader icon={<Briefcase className="w-5 h-5" />} title="Business & Operations" desc="Subscriptions, user roles, branding & CMS controls." />
            <RolesManager />
            <BrandingSettings />
            <PartnerLogos />
            <FreeTierConfig />
            <SupportInbox />
            <OnboardingApprovals />
            <AdminCredentials />
          </TabsContent>

          {/* 2. Finance & Billing */}
          <TabsContent value="finance" className="space-y-8 mt-0 animate-fade-in">
            <DeptHeader icon={<Wallet className="w-5 h-5" />} title="Finance & Billing" desc="Razorpay revenue, commissions, invoices." />
            <KammattamMeter />
            <FinanceOverview rows={rows} />
            <RazorpayCredentials />
            <RazorpayConnectivityStatus />
            <RazorpayTestCheckout />
            <CommissionsTracker />
          </TabsContent>

          {/* 3. Development & Software */}
          <TabsContent value="dev" className="space-y-8 mt-0 animate-fade-in">
            <DeptHeader icon={<Code2 className="w-5 h-5" />} title="Development & Software" desc="Oracle DB, OCI storage, AI/MCP governance & domain deployment." />
            <AiMcpControlCenter />
            <DomainHostingPanel />
            <OracleOciStorageCard />
            <RazorpayAuditLog />
            <GlobalAssetManager />
          </TabsContent>

          {/* 4. Marketing & Research */}
          <TabsContent value="marketing" className="space-y-8 mt-0 animate-fade-in">
            <DeptHeader icon={<Megaphone className="w-5 h-5" />} title="Marketing & Research" desc="Homepage CMS, promo campaigns, premium invites, analytics." />
            <MarketingCMS />
            <UniversalBroadcast />
            <PremiumInvitations />
            <ResendCredentials />
            <EmailLogMonitor />
            <MarketingAnalytics rows={rows} />
          </TabsContent>

          {/* 5. Users & Credentials */}
          <TabsContent value="users" className="space-y-8 mt-0 animate-fade-in">
            <DeptHeader icon={<UsersIcon className="w-5 h-5" />} title="Users & Credentials" desc="Full account lifecycle, role/plan changes, holds, deletions, and admin invites — every action audited." />
            <UsersAndCredentials />
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}

function DeptTab({ value, icon, label }: { value: string; icon: React.ReactNode; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="flex items-center justify-center gap-2 h-12 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:glow-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all"
    >
      {icon}<span className="truncate">{label}</span>
    </TabsTrigger>
  );
}

function DeptHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4 pb-2 border-b border-border/40">
      <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0">{icon}</div>
      <div>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function FinanceOverview({ rows }: { rows: Row[] }) {
  const paid = rows.filter(r => r.payment_status === "paid");
  const revenue = paid.reduce((s, r) => s + Number(r.final_price || 0), 0);
  const pending = rows.filter(r => r.payment_status !== "paid" && r.payment_status !== "failed").length;
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      <MetricCard label="Total Revenue (paid)" value={`₹${revenue.toLocaleString("en-IN")}`} />
      <MetricCard label="Paid Orders" value={paid.length.toString()} />
      <MetricCard label="Pending Payments" value={pending.toString()} />
    </div>
  );
}

function MarketingAnalytics({ rows }: { rows: Row[] }) {
  const withPromo = rows.filter(r => r.promo_code).length;
  const conversion = rows.length ? Math.round((rows.filter(r => r.payment_status === "paid").length / rows.length) * 100) : 0;
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      <MetricCard label="Total Leads" value={rows.length.toString()} />
      <MetricCard label="Promo Redemptions" value={withPromo.toString()} />
      <MetricCard label="Lead → Paid %" value={`${conversion}%`} />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}

function DomainHostingPanel() {
  const DEFAULT_PRIMARY = "https://app.crayonspictures.com";
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const [primary, setPrimary] = useState(DEFAULT_PRIMARY);
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("primary_domain, extra_origins")
        .eq("id", true)
        .maybeSingle();
      if (!error && data) {
        setPrimary(data.primary_domain?.trim() || DEFAULT_PRIMARY);
        setExtra((data.extra_origins ?? []).join(", "));
      }
      setLoading(false);
    })();
  }, []);

  const normalize = (s: string) => {
    const t = s.trim().replace(/\/$/, "");
    if (!t) return "";
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  };

  const onSave = async () => {
    setSaving(true);
    const primary_domain = normalize(primary);
    const extra_origins = extra
      .split(",").map(normalize).filter(Boolean);
    const { error } = await supabase
      .from("site_config")
      .upsert({ id: true, primary_domain, extra_origins }, { onConflict: "id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved. Edge functions pick up the new origin within ~60s.");
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold flex items-center gap-2"><Code2 className="w-5 h-5 text-accent" /> Domain & Hosting</h2>
        <p className="text-xs text-muted-foreground mt-1">Manage the primary domain that powers links, emails and CORS. Current origin: <span className="font-mono text-foreground">{currentOrigin}</span></p>
      </div>
      {loading ? (
        <div className="py-8 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Primary domain</label>
              <input value={primary} onChange={e => setPrimary(e.target.value)} placeholder="https://app.crayonspictures.com" className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Additional origins (comma-separated)</label>
              <input value={extra} onChange={e => setExtra(e.target.value)} placeholder="https://www.crayonspictures.com" className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
            </div>
          </div>
          <button
            onClick={onSave}
            disabled={saving}
            className="h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary text-sm disabled:opacity-60 inline-flex items-center gap-2"
          >{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save & Apply</button>
        </>
      )}
      <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">DNS records (point your registrar here):</p>
        <p>A · @ → <span className="font-mono text-foreground">185.158.133.1</span></p>
        <p>A · www → <span className="font-mono text-foreground">185.158.133.1</span></p>
        <p>TXT · _lovable → from Project Settings → Domains</p>
      </div>
    </div>
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
