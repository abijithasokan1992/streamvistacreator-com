import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, LogOut, ShieldCheck, Crown, RefreshCw, Copy, Check, Wallet, Inbox, Users as UsersIcon, LayoutDashboard, HardDrive, LifeBuoy, Settings as SettingsIcon, ArrowRight, Package, FileText, ClipboardCheck, Megaphone, Code2, Image as ImageIcon, Briefcase, Activity, Server } from "lucide-react";
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
import CommunicationCenter from "@/components/admin/CommunicationCenter";
import IntelligenceCenter from "@/components/admin/IntelligenceCenter";
import BrandingSettings from "@/components/admin/BrandingSettings";
import CompanyProfileSettings from "@/components/admin/CompanyProfileSettings";
import PartnerLogos from "@/components/admin/PartnerLogos";

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

// ============================================================
// New department-based IA. Sub-sections live inside each dept.
// Legacy `?tab=` and `/admin/<old>` URLs are still resolved
// by mapping them to the equivalent new department.
// ============================================================
const DEPT_KEYS = ["dashboard", "operations", "accounts", "commerce", "storage", "comms", "system"] as const;
type DeptKey = typeof DEPT_KEYS[number];

const LEGACY_TAB_TO_DEPT: Record<string, DeptKey> = {
  overview: "dashboard",
  users: "accounts",
  approvals: "operations",
  catalog: "commerce",
  billing: "commerce",
  storage: "storage",
  comms: "comms",
  homepage: "system",
  settings: "system",
  audit: "system",
  vault: "system",
};

function pathToDept(path: string, search: URLSearchParams): DeptKey {
  const q = search.get("dept") as DeptKey | null;
  if (q && (DEPT_KEYS as readonly string[]).includes(q)) return q;
  const legacyTab = search.get("tab");
  if (legacyTab && LEGACY_TAB_TO_DEPT[legacyTab]) return LEGACY_TAB_TO_DEPT[legacyTab];
  const p = path.toLowerCase();
  if (p.startsWith("/admin/operations") || p.startsWith("/admin/approvals") || p.startsWith("/admin/content") || p.startsWith("/admin/qc") || p.startsWith("/admin/legal") || p.startsWith("/admin/pipeline")) return "operations";
  if (p.startsWith("/admin/accounts") || p.startsWith("/admin/users") || p.startsWith("/admin/team") || p.startsWith("/admin/roles")) return "accounts";
  if (p.startsWith("/admin/commerce") || p.startsWith("/admin/catalog") || p.startsWith("/admin/products") || p.startsWith("/admin/plans") || p.startsWith("/admin/billing") || p.startsWith("/admin/finance") || p.startsWith("/admin/entitlements") || p.startsWith("/admin/rights")) return "commerce";
  if (p.startsWith("/admin/storage") || p.startsWith("/admin/delivery") || p.startsWith("/admin/vault-delivery")) return "storage";
  if (p.startsWith("/admin/comms") || p.startsWith("/admin/support") || p.startsWith("/admin/email") || p.startsWith("/admin/notifications")) return "comms";
  if (p.startsWith("/admin/system") || p.startsWith("/admin/homepage") || p.startsWith("/admin/cms") || p.startsWith("/admin/marketing") || p.startsWith("/admin/settings") || p.startsWith("/admin/audit") || p.startsWith("/admin/reports") || p.startsWith("/admin/security") || p.startsWith("/admin/vault") || p.startsWith("/admin/founder-vault")) return "system";
  return "dashboard";
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


      <AdminMainPanel
        isSuperAdmin={isSuperAdmin}
        location={location}
        searchParams={searchParams}
        navigate={navigate}
      />
    </main>
  );
}

/* ============================================================
 * Department + sub-section registry
 * Sub-sections render existing admin components untouched —
 * only their grouping/parent location changes.
 * ============================================================ */
function buildDepartments(args: {
  isSuperAdmin: boolean;
  navigate: (p: string) => void;
  reviewInitialTab?: "submitted" | "qc_review" | "legal_review";
}): Array<{ id: DeptKey; label: string; icon: JSX.Element; desc: string; sections: DeptSubSection[] }> {
  const { isSuperAdmin, navigate } = args;

  const systemSections: DeptSubSection[] = [
    { id: "homepage", label: "Homepage CMS", hint: "Hero, carousel, ad zones", content: <MarketingCMS /> },
    { id: "settings", label: "Settings", hint: "Branding, company profile, partners", content: (
      <div className="space-y-6">
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
            
            <AdminCredentials />
          </div>
        </details>
      </div>
    )},
    { id: "audit", label: "Audit", hint: "Finance reports, payment security", content: (
      <div className="space-y-6"><AdminReportsConsole /><PaymentSecurityEvents /></div>
    )},
  ];
  if (isSuperAdmin) {
    systemSections.push({
      id: "founder-vault",
      label: "Founder Vault",
      hint: "Platform Owner private storage",
      content: <FounderVault />,
    });
  }

  return [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-4 h-4" />,
      desc: "Platform health and quick jumps.",
      sections: [
        { id: "overview", label: "Overview", hint: "Platform metrics", content: (
          <div className="space-y-8"><PlatformOverview /><QuickNav navigate={navigate} /></div>
        )},
      ],
    },
    {
      id: "operations",
      label: "Operations",
      icon: <ClipboardCheck className="w-4 h-4" />,
      desc: "Approvals, pipeline and catalog ops.",
      sections: [
        { id: "approvals", label: "Approvals", hint: "Onboarding & content review", content: (
          <div className="space-y-6"><OnboardingApprovals /><ContentReviewWorkflow initialTab={args.reviewInitialTab} /></div>
        )},
        { id: "pipeline", label: "Pipeline", hint: "Title edits & QC flow", content: <TitleEditRequestsInbox /> },
        { id: "catalog-ops", label: "Catalog Ops", hint: "Global assets", content: <GlobalAssetManager /> },
      ],
    },
    {
      id: "accounts",
      label: "Accounts",
      icon: <UsersIcon className="w-4 h-4" />,
      desc: "Users, organizations, roles & access.",
      sections: [
        { id: "users", label: "Users", hint: "Creators, studios, buyers", content: <UsersAndCredentials /> },
        { id: "organizations", label: "Organizations", hint: "Internal team", content: <AdminTeamManager /> },
        { id: "roles", label: "Roles & Access", hint: "Role assignments", content: <RolesManager /> },
      ],
    },
    {
      id: "commerce",
      label: "Commerce",
      icon: <Briefcase className="w-4 h-4" />,
      desc: "Plans, billing, entitlements and commercial requests.",
      sections: [
        { id: "plans", label: "Plans & Pricing", hint: "Products, vault pricing, free tier", content: (
          <div className="space-y-6"><ProductsAndPlans /><StudioVaultPricing /><FreeTierConfig /></div>
        )},
        { id: "billing", label: "Billing", hint: "Invoices and finance ops", content: (
          <div className="space-y-6">
            <RazorpayOpsBanner />
            <AdminFinanceConsole />
            <BillingOperations />
            <AdminInvoices />
            <ManualInvoiceConsole />
            <PaymentTrace />
            <RazorpayAuditLog />
          </div>
        )},
      ],
    },
    {
      id: "storage",
      label: "Storage & Delivery",
      icon: <HardDrive className="w-4 h-4" />,
      desc: "Storage health, uploads and vault delivery.",
      sections: [
        { id: "storage-health", label: "Storage", hint: "OCI monitor", content: <OracleStorageMonitor /> },
        { id: "vault-purchases", label: "Vault / Delivery", hint: "Studio Vault purchases", content: <AdminStudioVaultPurchases /> },
        { id: "storage-advanced", label: "Advanced", hint: "OCI credentials & buckets", content: <OracleOciStorageCard /> },
      ],
    },
    {
      id: "comms",
      label: "Comms",
      icon: <Inbox className="w-4 h-4" />,
      desc: "Unified Communication Center.",
      sections: [
        { id: "center", label: "Center", hint: "Inbox · Notifications · Invitations · Broadcast · Support · Activity", content: <CommunicationCenter /> },
        { id: "intelligence", label: "✦ Intelligence", hint: "AI-powered market, buyer and competitor intelligence", content: <IntelligenceCenter /> },
        { id: "email", label: "Email log", hint: "Raw email delivery log", content: <EmailLogMonitor /> },
      ],
    },
    {
      id: "system",
      label: "System",
      icon: <SettingsIcon className="w-4 h-4" />,
      desc: "Homepage CMS, settings, audit, and Founder Vault.",
      sections: systemSections,
    },
  ];
}

function AdminMainPanel({
  isSuperAdmin, location, searchParams, navigate,
}: {
  isSuperAdmin: boolean;
  location: { pathname: string };
  searchParams: URLSearchParams;
  navigate: (p: string) => void;
}) {
  const initial = pathToDept(location.pathname, searchParams);
  const [dept, setDept] = useState<DeptKey>(initial);
  const [sectionByDept, setSectionByDept] = useState<Record<string, string>>(() => {
    const s = searchParams.get("section");
    return s ? { [initial]: s } : {};
  });

  const reviewInitialTab: "qc_review" | "legal_review" | undefined =
    location.pathname.toLowerCase().startsWith("/admin/qc") ? "qc_review"
    : location.pathname.toLowerCase().startsWith("/admin/legal") ? "legal_review"
    : undefined;

  const departments = useMemo(
    () => buildDepartments({ isSuperAdmin, navigate, reviewInitialTab }),
    [isSuperAdmin, navigate, reviewInitialTab],
  );

  const cmdDepartments: AdminDepartment[] = useMemo(
    () => departments.map((d) => ({
      id: d.id,
      label: d.label,
      sections: d.sections.map((s) => ({ id: s.id, label: s.label, hint: s.hint })),
    })),
    [departments],
  );

  const jumpTo = (deptId: string, sectionId: string) => {
    setDept(deptId as DeptKey);
    setSectionByDept((prev) => ({ ...prev, [deptId]: sectionId }));
    // Update URL so deep links work
    const url = new URL(window.location.href);
    url.searchParams.set("dept", deptId);
    url.searchParams.set("section", sectionId);
    window.history.replaceState(null, "", url.toString());
  };

  const current = departments.find((d) => d.id === dept) ?? departments[0];

  return (
    <section className="container py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            {isSuperAdmin ? "Platform Owner · Media Operations" : "Admin Console"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Departments on the left. Sub-sections appear inside each department.
          </p>
        </div>
        <AdminCommandBar departments={cmdDepartments} onJump={jumpTo} />
      </div>

      <Tabs
        value={dept}
        onValueChange={(v) => setDept(v as DeptKey)}
        className="w-full"
      >
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 h-auto p-1.5 glass rounded-2xl bg-transparent border border-border/50 w-full mb-6">
          {departments.map((d) => (
            <DeptTab key={d.id} value={d.id} icon={d.icon} label={d.label} />
          ))}
        </TabsList>

        {departments.map((d) => (
          <TabsContent key={d.id} value={d.id} className="mt-0 animate-fade-in">
            <DeptHeader icon={d.icon} title={d.label} desc={d.desc} />
            <div className="mt-6">
              <DeptSubNav
                sections={d.sections}
                activeId={sectionByDept[d.id]}
                onActiveChange={(id) =>
                  setSectionByDept((prev) => ({ ...prev, [d.id]: id }))
                }
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </section>
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
