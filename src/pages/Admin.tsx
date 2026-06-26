import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, LogOut, ShieldCheck, Crown, RefreshCw, Copy, Check, Wallet, Inbox, Users as UsersIcon, LayoutDashboard, HardDrive, Settings as SettingsIcon, ArrowRight, Code2, ClipboardCheck, Megaphone, Briefcase, Activity } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBackGuard } from "@/hooks/useBackGuard";
import AdminCommandBar, { type AdminDepartment } from "@/components/admin/AdminCommandBar";
import DeptSubNav, { type DeptSubSection } from "@/components/admin/DeptSubNav";

// Kept (MVP 8 buckets)
import PlatformOverview from "@/components/admin/PlatformOverview";
import RolesManager from "@/components/admin/RolesManager";
import UsersAndCredentials from "@/components/admin/UsersAndCredentials";
import AdminTeamManager from "@/components/admin/AdminTeamManager";
import OnboardingApprovals from "@/components/admin/OnboardingApprovals";
import ContentReviewWorkflow from "@/components/admin/ContentReviewWorkflow";
import TitleEditRequestsInbox from "@/components/admin/TitleEditRequestsInbox";
import ProductsAndPlans from "@/components/admin/ProductsAndPlans";
import StudioVaultPricing from "@/components/admin/StudioVaultPricing";
import FreeTierConfig from "@/components/admin/FreeTierConfig";
import GlobalAssetManager from "@/components/admin/GlobalAssetManager";
import AdminInvoices from "@/components/admin/AdminInvoices";
import ManualInvoiceConsole from "@/components/admin/ManualInvoiceConsole";
import BillingOperations from "@/components/admin/BillingOperations";
import AdminFinanceConsole from "@/components/admin/AdminFinanceConsole";
import RazorpayOpsBanner from "@/components/admin/RazorpayOpsBanner";
import RazorpayAuditLog from "@/components/admin/RazorpayAuditLog";
import PaymentTrace from "@/components/admin/PaymentTrace";
import OracleStorageMonitor from "@/components/admin/OracleStorageMonitor";
import AdminStudioVaultPurchases from "@/components/admin/AdminStudioVaultPurchases";
import OracleOciStorageCard from "@/components/admin/OracleOciStorageCard";
import SupportInbox from "@/components/admin/SupportInbox";
import ContactInbox from "@/components/admin/ContactInbox";
import EmailLogMonitor from "@/components/admin/EmailLogMonitor";
import UniversalBroadcast from "@/components/admin/UniversalBroadcast";
import BrandingSettings from "@/components/admin/BrandingSettings";
import CompanyProfileSettings from "@/components/admin/CompanyProfileSettings";
import PartnerLogos from "@/components/admin/PartnerLogos";
import ResendCredentials from "@/components/admin/ResendCredentials";
import AdminCredentials from "@/components/admin/AdminCredentials";
import RazorpayCredentials from "@/components/admin/RazorpayCredentials";
import RazorpayConnectivityStatus from "@/components/admin/RazorpayConnectivityStatus";
import AdminReportsConsole from "@/components/admin/AdminReportsConsole";
import PaymentSecurityEvents from "@/components/admin/PaymentSecurityEvents";
import MarketingCMS from "@/components/admin/MarketingCMS";
import FounderVault from "@/components/admin/FounderVault";

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

const TAB_KEYS = ["overview", "users", "approvals", "homepage", "catalog", "billing", "storage", "comms", "settings", "audit", "vault"] as const;
type TabKey = typeof TAB_KEYS[number];

function pathToTab(path: string, search: URLSearchParams): TabKey {
  const q = search.get("tab") as TabKey | null;
  if (q && (TAB_KEYS as readonly string[]).includes(q)) return q;
  const p = path.toLowerCase();
  // New MVP buckets
  if (p.startsWith("/admin/users") || p.startsWith("/admin/team")) return "users";
  if (p.startsWith("/admin/approvals") || p.startsWith("/admin/content") || p.startsWith("/admin/qc") || p.startsWith("/admin/legal")) return "approvals";
  if (p.startsWith("/admin/homepage") || p.startsWith("/admin/marketing") || p.startsWith("/admin/cms")) return "homepage";
  if (p.startsWith("/admin/catalog") || p.startsWith("/admin/products") || p.startsWith("/admin/plans") || p.startsWith("/admin/rights")) return "catalog";
  if (p.startsWith("/admin/billing") || p.startsWith("/admin/finance") || p.startsWith("/admin/business")) return "billing";
  if (p.startsWith("/admin/storage")) return "storage";
  if (p.startsWith("/admin/comms") || p.startsWith("/admin/support")) return "comms";
  if (p.startsWith("/admin/settings")) return "settings";
  if (p.startsWith("/admin/audit") || p.startsWith("/admin/reports") || p.startsWith("/admin/security")) return "audit";
  if (p.startsWith("/admin/vault") || p.startsWith("/admin/founder-vault")) return "vault";
  return "overview";
}


export default function Admin() {
  const { user, isAdmin, isSuperAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  useBackGuard(!!user);
  const [rows, setRows] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profile, setProfile] = useState<{
    full_name: string | null;
    display_name: string | null;
    job_title: string | null;
    organization_name: string | null;
    avatar_url: string | null;
  } | null>(null);

  useEffect(() => {
    if (!user?.id) { setProfile(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("full_name, display_name, job_title, organization_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setProfile((data as any) ?? null);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const identityName =
    profile?.full_name?.trim() ||
    profile?.display_name?.trim() ||
    user?.email ||
    "Admin";
  const initials =
    (profile?.full_name || profile?.display_name || user?.email || "A")
      .split(/\s+|@|\./)
      .filter(Boolean)
      .slice(0, 2)
      .map(s => s[0]?.toUpperCase())
      .join("") || "A";


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
        <div className="container flex items-center justify-between gap-4 h-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary shrink-0">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-sm leading-tight truncate">{identityName}</div>
              {profile?.job_title && (
                <div className="text-[11px] text-muted-foreground leading-tight truncate">{profile.job_title}</div>
              )}
              {profile?.organization_name && (
                <div className="text-[10px] text-muted-foreground/80 leading-tight truncate">{profile.organization_name}</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md border border-border/70 bg-secondary/40 text-xs">
              <span className="font-mono text-foreground">/admin</span>
              <button onClick={copyAdmin} aria-label="Copy admin panel link" className="text-muted-foreground hover:text-accent transition-colors">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {isSuperAdmin && (
              <div className="hidden md:flex items-center gap-1.5">
                <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-amber-300/10 text-amber-300 border border-amber-400/40">
                  <Crown className="inline w-3 h-3 mr-1 -mt-0.5" />Platform Owner
                </span>
                <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-fuchsia-500/20 to-purple-400/10 text-fuchsia-300 border border-fuchsia-400/40">
                  Super Admin
                </span>
              </div>
            )}

            {/* Profile chip */}
            <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-border/70 bg-gradient-to-r from-secondary/80 to-secondary/40 hover:from-accent/10 hover:to-secondary/60 transition-all group">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={identityName} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-primary grid place-items-center text-[10px] font-bold text-primary-foreground uppercase tracking-wider glow-primary">
                  {initials}
                </div>
              )}
              <div className="flex flex-col leading-none">
                <span className="text-xs font-semibold text-foreground group-hover:text-accent transition-colors truncate max-w-[160px]">
                  {identityName}
                </span>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider truncate max-w-[160px]" title={user?.email ?? undefined}>
                  {isSuperAdmin ? "Super Admin" : isAdmin ? "Administrator" : "Member"}
                </span>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
            </div>

            <ThemeToggle />
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
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            {isSuperAdmin ? "Platform Owner · Media Operations" : "Admin Console"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSuperAdmin
              ? "Operate the platform: pipeline, storage, revenue, and platform health at a glance."
              : "All controls grouped by operational area."}
          </p>
        </div>

        <Tabs
          key={location.pathname + (searchParams.get("tab") ?? "")}
          defaultValue={pathToTab(location.pathname, searchParams)}
          className="w-full"
        >
          <TabsList className={`grid grid-cols-2 sm:grid-cols-3 ${isSuperAdmin ? "lg:grid-cols-11" : "lg:grid-cols-10"} gap-1.5 sm:gap-2 h-auto p-1 sm:p-1.5 glass rounded-2xl bg-transparent border border-border/50 w-full mb-6 sm:mb-8`}>
            <DeptTab value="overview"  icon={<LayoutDashboard className="w-4 h-4" />} label="Home" />
            <DeptTab value="users"     icon={<UsersIcon className="w-4 h-4" />}       label="Users & Roles" />
            <DeptTab value="approvals" icon={<ClipboardCheck className="w-4 h-4" />}  label="Approvals" />
            <DeptTab value="homepage"  icon={<ImageIcon className="w-4 h-4" />}       label="Homepage CMS" />
            <DeptTab value="catalog"   icon={<Package className="w-4 h-4" />}         label="Catalog" />
            <DeptTab value="billing"   icon={<Wallet className="w-4 h-4" />}          label="Billing" />
            <DeptTab value="storage"   icon={<HardDrive className="w-4 h-4" />}       label="Storage" />
            <DeptTab value="comms"     icon={<Inbox className="w-4 h-4" />}           label="Comms" />
            <DeptTab value="settings"  icon={<SettingsIcon className="w-4 h-4" />}    label="Settings" />
            <DeptTab value="audit"     icon={<FileText className="w-4 h-4" />}        label="Audit" />
            {isSuperAdmin && (
              <DeptTab value="vault"   icon={<Crown className="w-4 h-4" />}           label="Founder Vault" />
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-8 mt-0 animate-fade-in">
            <PlatformOverview />
            <QuickNav navigate={navigate} />
          </TabsContent>

          <TabsContent value="users" className="space-y-8 mt-0 animate-fade-in">
            <DeptHeader icon={<UsersIcon className="w-5 h-5" />} title="Users & Roles" desc="Creators, studios, buyers and internal staff. Roles, invitations and team permissions." />
            <RolesManager />
            <UsersAndCredentials />
            <AdminTeamManager />
          </TabsContent>

          <TabsContent value="approvals" className="space-y-8 mt-0 animate-fade-in">
            <DeptHeader icon={<ClipboardCheck className="w-5 h-5" />} title="Approvals" desc="Onboarding requests, title submissions and edit requests waiting on review." />
            <OnboardingApprovals />
            <ContentReviewWorkflow />
            <TitleEditRequestsInbox />
          </TabsContent>

          <TabsContent value="homepage" className="space-y-8 mt-0 animate-fade-in">
            <DeptHeader icon={<ImageIcon className="w-5 h-5" />} title="Homepage CMS" desc="Hero banners, Successfully Licensed Contents carousel, cinematic reel, ad zones and news shown on the public homepage." />
            <MarketingCMS />
          </TabsContent>

          <TabsContent value="catalog" className="space-y-8 mt-0 animate-fade-in">
            <DeptHeader icon={<Package className="w-5 h-5" />} title="Catalog" desc="Plans, pricing, free-tier limits and shared marketing assets." />
            <ProductsAndPlans />
            <StudioVaultPricing />
            <FreeTierConfig />
            <GlobalAssetManager />
          </TabsContent>

          <TabsContent value="billing" className="space-y-8 mt-0 animate-fade-in">
            <DeptHeader icon={<Wallet className="w-5 h-5" />} title="Billing" desc="Invoices, manual invoices, finance ops and Razorpay activity." />
            <RazorpayOpsBanner />
            <AdminFinanceConsole />
            <BillingOperations />
            <AdminInvoices />
            <ManualInvoiceConsole />
            <PaymentTrace />
            <RazorpayAuditLog />
          </TabsContent>

          <TabsContent value="storage" className="space-y-8 mt-0 animate-fade-in">
            <DeptHeader icon={<HardDrive className="w-5 h-5" />} title="Storage" desc="Storage health, Global Repository purchases and OCI admin." />
            <OracleStorageMonitor />
            <AdminStudioVaultPurchases />
            <details className="rounded-2xl border border-border/40 bg-secondary/10 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
                Advanced storage settings · OCI credentials & buckets
              </summary>
              <div className="pt-4">
                <OracleOciStorageCard />
              </div>
            </details>
          </TabsContent>

          <TabsContent value="comms" className="space-y-8 mt-0 animate-fade-in">
            <DeptHeader icon={<Inbox className="w-5 h-5" />} title="Comms" desc="Support inbox, contact form, email log and broadcast." />
            <SupportInbox />
            <ContactInbox />
            <EmailLogMonitor />
            <UniversalBroadcast />
          </TabsContent>

          <TabsContent value="settings" className="space-y-8 mt-0 animate-fade-in">
            <DeptHeader icon={<SettingsIcon className="w-5 h-5" />} title="Settings" desc="Branding, company profile and developer credentials." />
            <BrandingSettings />
            <CompanyProfileSettings />
            <PartnerLogos />
            <details className="rounded-2xl border border-border/40 bg-secondary/10 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
                Advanced · domain hosting & developer credentials
              </summary>
              <div className="pt-4 space-y-6">
                <DomainHostingPanel />
                <RazorpayCredentials />
                <RazorpayConnectivityStatus />
                <ResendCredentials />
                <AdminCredentials />
              </div>
            </details>
          </TabsContent>

          <TabsContent value="audit" className="space-y-8 mt-0 animate-fade-in">
            <DeptHeader icon={<FileText className="w-5 h-5" />} title="Audit" desc="Finance reports, management summary and payment security events." />
            <AdminReportsConsole />
            <PaymentSecurityEvents />
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="vault" className="space-y-8 mt-0 animate-fade-in">
              <DeptHeader icon={<Crown className="w-5 h-5" />} title="Founder Vault" desc="Private Platform Owner storage — masters, contracts, investor & legal documents. Separately passphrase-locked and audit-logged." />
              <FounderVault />
            </TabsContent>
          )}
        </Tabs>
      </section>
    </main>
  );
}

function QuickNav({ navigate }: { navigate: (p: string) => void }) {
  const tiles = [
    { path: "/admin/users",     icon: <UsersIcon className="w-5 h-5" />,      label: "Users & Roles", desc: "Roles, invites, team" },
    { path: "/admin/approvals", icon: <ClipboardCheck className="w-5 h-5" />, label: "Approvals",     desc: "Onboarding & titles" },
    { path: "/admin/homepage",  icon: <ImageIcon className="w-5 h-5" />,      label: "Homepage CMS",  desc: "Hero banners, licensed contents" },
    { path: "/admin/catalog",   icon: <Package className="w-5 h-5" />,        label: "Catalog",       desc: "Plans, pricing, assets" },
    { path: "/admin/billing",   icon: <Wallet className="w-5 h-5" />,         label: "Billing",       desc: "Invoices, Razorpay" },
    { path: "/admin/storage",   icon: <HardDrive className="w-5 h-5" />,      label: "Storage",       desc: "Uploads, Global Repository, OCI" },
    { path: "/admin/comms",     icon: <Inbox className="w-5 h-5" />,          label: "Comms",         desc: "Support, contact, email" },
    { path: "/admin/settings",  icon: <SettingsIcon className="w-5 h-5" />,   label: "Settings",      desc: "Branding, credentials" },
    { path: "/admin/audit",     icon: <FileText className="w-5 h-5" />,       label: "Audit",         desc: "Reports & security" },
  ];
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-lg font-semibold">Jump to a section</h3>
        <span className="text-xs text-muted-foreground">Open the right department to act on pending work.</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(t => (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            className="group flex items-center gap-3 text-left rounded-2xl border border-border/50 bg-secondary/20 hover:bg-accent/10 hover:border-accent/40 transition-all p-4"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0">{t.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{t.label}</div>
              <div className="text-[11px] text-muted-foreground truncate">{t.desc}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
          </button>
        ))}
      </div>
    </section>
  );
}

function DeptTab({ value, icon, label }: { value: string; icon: React.ReactNode; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] sm:h-12 px-2 rounded-xl text-[11px] sm:text-sm font-semibold data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:glow-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all"
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

function DomainHostingPanel() {
  const DEFAULT_PRIMARY = "https://streamvistacreator.com";
  const DEFAULT_EXTRA = "https://www.streamvistacreator.com, https://streamvista-creator.lovable.app";
  const DEPRECATED = [
    "https://app.crayonspictures.com",
    "https://www.app.crayonspictures.com",
    "https://https-app-crayonspictures-com.lovable.app",
  ];
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const isPreview =
    currentOrigin.includes(".lovable.app") ||
    currentOrigin.includes(".lovableproject.com") ||
    currentOrigin.includes("localhost");
  const isProduction = currentOrigin.includes("streamvistacreator.com");
  const isDeprecated = DEPRECATED.some(d => currentOrigin.startsWith(d));
  const envBadge = isDeprecated
    ? { label: "DEPRECATED DOMAIN", cls: "bg-red-500/15 text-red-300 border-red-500/30" }
    : isProduction
    ? { label: "PRODUCTION", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" }
    : isPreview
    ? { label: "PREVIEW", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" }
    : { label: "UNKNOWN", cls: "bg-secondary text-muted-foreground border-border" };

  const [primary, setPrimary] = useState(DEFAULT_PRIMARY);
  const [extra, setExtra] = useState(DEFAULT_EXTRA);
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
        const p = data.primary_domain?.trim();
        setPrimary(p && !DEPRECATED.includes(p) ? p : DEFAULT_PRIMARY);
        setExtra((data.extra_origins ?? []).filter((o: string) => !DEPRECATED.includes(o)).join(", "));
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
    const extra_origins = extra.split(",").map(normalize).filter(Boolean);
    if (DEPRECATED.includes(primary_domain) || extra_origins.some(o => DEPRECATED.includes(o))) {
      setSaving(false);
      toast.error("This domain is deprecated. Use https://streamvistacreator.com instead.");
      return;
    }
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
        <p className="text-xs text-muted-foreground mt-1">
          Manage the primary domain that powers links, emails and CORS. Current origin:{" "}
          <span className="font-mono text-foreground">{currentOrigin}</span>
          <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] tracking-wider ${envBadge.cls}`}>{envBadge.label}</span>
        </p>
      </div>

      {loading ? (
        <div className="py-8 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Primary domain</label>
              <input value={primary} onChange={e => setPrimary(e.target.value)} placeholder="https://streamvistacreator.com" className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Additional origins (comma-separated)</label>
              <input value={extra} onChange={e => setExtra(e.target.value)} placeholder="https://www.streamvistacreator.com, https://streamvista-creator.lovable.app" className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
            </div>
          </div>
          <button
            onClick={onSave}
            disabled={saving}
            className="h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary text-sm disabled:opacity-60 inline-flex items-center gap-2"
          >{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save & Apply</button>
        </>
      )}
    </div>
  );
}
