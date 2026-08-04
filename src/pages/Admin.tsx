import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, LogOut, ShieldCheck, Crown, RefreshCw, Copy, Check, Wallet, Inbox, Users as UsersIcon, LayoutDashboard, HardDrive, LifeBuoy, Settings as SettingsIcon, ArrowRight, Package, FileText, ClipboardCheck, Megaphone, Code2, Image as ImageIcon, Briefcase, Activity, Server, Network, Rocket, Cloud, Film } from "lucide-react";
import MissionControl from "@/components/admin/MissionControl";
import AiOpsAssistant from "@/components/admin/AiOpsAssistant";
import ActionCenter from "@/components/admin/ActionCenter";
import PriorityInbox from "@/components/admin/PriorityInbox";
import QuickActions from "@/components/admin/QuickActions";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBackGuard } from "@/hooks/useBackGuard";
import AdminCommandBar, { type AdminDepartment } from "@/components/admin/AdminCommandBar";
import DeptSubNav, { type DeptSubSection } from "@/components/admin/DeptSubNav";
import { useQueryClient } from "@tanstack/react-query";

// Kept (MVP 8 buckets)
import PlatformOverview from "@/components/admin/PlatformOverview";
import PlatformReadinessCenter from "@/components/admin/PlatformReadinessCenter";
import RolesManager from "@/components/admin/RolesManager";
import UsersAndCredentials from "@/components/admin/UsersAndCredentials";
import AdminTeamManager from "@/components/admin/AdminTeamManager";
import OnboardingApprovals from "@/components/admin/OnboardingApprovals";
import ContentReviewWorkflow from "@/components/admin/ContentReviewWorkflow";
import QCLegalValidationSurface from "@/components/admin/QCLegalValidationSurface";
import TitleEditRequestsInbox from "@/components/admin/TitleEditRequestsInbox";
import ProductsAndPlans from "@/components/admin/ProductsAndPlans";
import StudioVaultPricing from "@/components/admin/StudioVaultPricing";
import FreeTierConfig from "@/components/admin/FreeTierConfig";
import GlobalAssetManager from "@/components/admin/GlobalAssetManager";
import AdminInvoices from "@/components/admin/AdminInvoices";
import ManualInvoiceConsole from "@/components/admin/ManualInvoiceConsole";
import BillingOperations from "@/components/admin/BillingOperations";
import AdminFinanceConsole from "@/components/admin/AdminFinanceConsole";
import RevenueStatementImport from "@/components/admin/RevenueStatementImport";
import RazorpayOpsBanner from "@/components/admin/RazorpayOpsBanner";
import RazorpayAuditLog from "@/components/admin/RazorpayAuditLog";
import PaymentTrace from "@/components/admin/PaymentTrace";
import OracleStorageMonitor from "@/components/admin/OracleStorageMonitor";
import AdminStudioVaultPurchases from "@/components/admin/AdminStudioVaultPurchases";
import OracleOciStorageCard from "@/components/admin/OracleOciStorageCard";
import FailedUploadsInspector from "@/components/admin/FailedUploadsInspector";
import InfrastructureHealth from "@/components/admin/InfrastructureHealth";
import EmailRetryAuditPanel from "@/components/admin/EmailRetryAuditPanel";
import AdminRunbook from "@/components/admin/AdminRunbook";
import ProductionReadinessReport from "@/components/admin/ProductionReadinessReport";
import MetricsDashboard from "@/components/admin/MetricsDashboard";
import AdminTestRunner from "@/components/admin/AdminTestRunner";
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
import AiMcpControlCenter from "@/components/admin/AiMcpControlCenter";
import McpHealthCenter from "@/components/admin/McpHealthCenter";
import PartnerNetworkHub from "@/components/admin/PartnerNetworkHub";
import BusinessIntelligenceHub from "@/components/admin/BusinessIntelligenceHub";
import StorageTopUpsPanel from "@/components/admin/StorageTopUpsPanel";
import DealOperationsConsole from "@/components/admin/DealOperationsConsole";
import CommercialControlTower from "@/components/admin/CommercialControlTower";
import FindContentSection from "@/components/buyer/sections/FindContentSection";

import OrganizationsConsole from "@/components/admin/ecosystem/OrganizationsConsole";
import InvitationsConsole from "@/components/admin/ecosystem/InvitationsConsole";
import ChannelPartnersConsole from "@/components/admin/ecosystem/ChannelPartnersConsole";

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
const DEPT_KEYS = ["mission", "content", "users", "business", "cloud", "platform"] as const;
type DeptKey = typeof DEPT_KEYS[number];

// Map legacy department + tab keys onto the new 6-workspace IA.
const LEGACY_TAB_TO_DEPT: Record<string, DeptKey> = {
  overview: "mission",
  dashboard: "mission",
  operations: "content",
  approvals: "content",
  catalog: "content",
  pipeline: "content",
  users: "users",
  accounts: "users",
  ecosystem: "users",
  onboarding: "users",
  invitations: "users",
  organizations: "users",
  partners: "users",
  comms: "users",
  commerce: "business",
  billing: "business",
  storage: "cloud",
  homepage: "platform",
  settings: "platform",
  audit: "platform",
  vault: "platform",
  system: "platform",
};

function pathToDept(path: string, search: URLSearchParams): DeptKey {
  const q = search.get("dept") as DeptKey | null;
  if (q && (DEPT_KEYS as readonly string[]).includes(q)) return q;
  const legacyDept = search.get("dept");
  if (legacyDept && LEGACY_TAB_TO_DEPT[legacyDept]) return LEGACY_TAB_TO_DEPT[legacyDept];
  const legacyTab = search.get("tab");
  if (legacyTab && LEGACY_TAB_TO_DEPT[legacyTab]) return LEGACY_TAB_TO_DEPT[legacyTab];
  const p = path.toLowerCase();
  if (p.startsWith("/admin/ecosystem") || p.startsWith("/admin/approvals") || p.startsWith("/admin/onboarding") || p.startsWith("/admin/invitations") || p.startsWith("/admin/partners") || p.startsWith("/admin/organizations") || p.startsWith("/admin/users") || p.startsWith("/admin/team") || p.startsWith("/admin/roles") || p.startsWith("/admin/support") || p.startsWith("/admin/comms")) return "users";
  if (p.startsWith("/admin/operations") || p.startsWith("/admin/content") || p.startsWith("/admin/qc") || p.startsWith("/admin/legal") || p.startsWith("/admin/pipeline") || p.startsWith("/admin/catalog")) return "content";
  if (p.startsWith("/admin/commerce") || p.startsWith("/admin/products") || p.startsWith("/admin/plans") || p.startsWith("/admin/billing") || p.startsWith("/admin/finance") || p.startsWith("/admin/entitlements") || p.startsWith("/admin/rights")) return "business";
  if (p.startsWith("/admin/storage") || p.startsWith("/admin/delivery") || p.startsWith("/admin/vault-delivery") || p.startsWith("/admin/cloud")) return "cloud";
  if (p.startsWith("/admin/system") || p.startsWith("/admin/homepage") || p.startsWith("/admin/cms") || p.startsWith("/admin/marketing") || p.startsWith("/admin/settings") || p.startsWith("/admin/audit") || p.startsWith("/admin/reports") || p.startsWith("/admin/security") || p.startsWith("/admin/vault") || p.startsWith("/admin/founder-vault") || p.startsWith("/admin/email") || p.startsWith("/admin/platform")) return "platform";
  return "mission";
}


export default function Admin() {
  const { user, isAdmin, isSuperAdmin, isQcReviewer, isLegalReviewer, loading, signOut } = useAuth();
  const isReviewer = isQcReviewer || isLegalReviewer;
  const canEnter = isAdmin || isReviewer;
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

  if (!canEnter) {
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

            {!isReviewer && <PriorityInbox />}
            <a
              href="/admin/control-center"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10"
            >
              <Activity className="w-3.5 h-3.5" /> Control Center
            </a>
            <a
              href="/admin/office"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90"
            >
              <Film className="w-3.5 h-3.5" /> Media Office
            </a>
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
        isReviewer={isReviewer}
        reviewerKind={isQcReviewer ? "qc" : isLegalReviewer ? "legal" : null}
        location={location}
        searchParams={searchParams}
        navigate={navigate}
      />

      {/* Single-operator surface: assistant + universal action center.
          Hidden for reviewers (they are pinned to a single queue).      */}
      {!isReviewer && (
        <>
          <AiOpsAssistant />
          <ActionCenter />
        </>
      )}
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
    { id: "mcp-health", label: "MCP Health", hint: "AI Agent connector health & OAuth audit", content: (
      <div className="space-y-6"><McpHealthCenter /><AiMcpControlCenter /></div>
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
      id: "mission",
      label: "Mission Control",
      icon: <Rocket className="w-4 h-4" />,
      desc: "What needs action, what's healthy, what changed today.",
      sections: [
        { id: "mission", label: "Mission Control", hint: "Live operations dashboard", content: <MissionControl /> },
        { id: "launch", label: "Launch Readiness", hint: "Aggregated production readiness report", content: <ProductionReadinessReport /> },
        { id: "overview", label: "Platform Overview", hint: "Historical metrics", content: <PlatformOverview /> },
        { id: "readiness", label: "Readiness Matrix", hint: "5-pillar readiness matrix", content: <PlatformReadinessCenter /> },
        { id: "jump", label: "Quick Jumps", hint: "Fast navigation", content: <QuickNav navigate={navigate} /> },
      ],
    },
    {
      id: "content",
      label: "Content",
      icon: <Film className="w-4 h-4" />,
      desc: "Titles, QC, legal review, publishing and catalog.",
      sections: [
        { id: "approvals", label: "Content Review", hint: "Title QC & legal review", content: (
          <ContentReviewWorkflow initialTab={args.reviewInitialTab} />
        )},
        { id: "publish", label: "Release Content", hint: "Approved → Ready for Distribution", content: (
          <ContentReviewWorkflow initialTab="approved" />
        )},
        { id: "titles-catalog", label: "Titles Catalog", hint: "All titles, assets and metadata", content: <GlobalAssetManager /> },
        { id: "qc-queue", label: "Content Quality Review", hint: "Review technical quality", content: (
          <QCLegalValidationSurface initialPanel="qc" />
        )},
        { id: "legal-queue", label: "Rights & Legal Review", hint: "Review rights and legal documents", content: (
          <QCLegalValidationSurface initialPanel="legal" />
        )},
        { id: "pipeline", label: "Pipeline", hint: "Title edits & QC flow", content: <TitleEditRequestsInbox /> },
        { id: "catalog-ops", label: "Catalog & Assets", hint: "Global assets", content: <GlobalAssetManager /> },
      ],
    },
    {
      id: "users",
      label: "Users",
      icon: <UsersIcon className="w-4 h-4" />,
      desc: "Creators, studios, buyers, organizations, invitations, support.",
      sections: [
        { id: "users", label: "User Directory", hint: "Creators, studios, buyers", content: <UsersAndCredentials /> },
        { id: "roles", label: "Role Management (has_role)", hint: "Assign app_role, backs has_role() checks", content: <RolesManager /> },
        { id: "storage-topups", label: "Storage Top-ups", hint: "Grant / reduce bonus storage (GB)", content: <StorageTopUpsPanel /> },
        { id: "organizations", label: "Organizations", hint: "Creators · Studios · Buyers · Partners", content: <OrganizationsConsole /> },
        { id: "invitations", label: "Invitations", hint: "Role-aware invites", content: <InvitationsConsole /> },
        { id: "channel-partners", label: "Channel Partners", hint: "Publish to /partners", content: <ChannelPartnersConsole /> },
        { id: "onboarding", label: "Onboarding", hint: "Approvals & activations", content: <OnboardingApprovals /> },
        { id: "team", label: "Internal Team", hint: "Admin staff", content: <AdminTeamManager /> },
        { id: "support", label: "Support & Messages", hint: "Tickets, contact, broadcasts", content: (
          <div className="space-y-6"><CommunicationCenter /></div>
        )},
      ],
    },
    {
      id: "business",
      label: "Business",
      icon: <Briefcase className="w-4 h-4" />,
      desc: "Plans, subscriptions, payments, invoices, rights, licensing.",
      sections: [
        { id: "marketplace", label: "Content Marketplace", hint: "Live buyer-facing catalog", content: (
          <div className="space-y-4">
            <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
              Read-only preview of the live Content Marketplace. Requests routed to
              <code className="mx-1">/dashboard/buyer</code> for full buyer flow.
            </div>
            <FindContentSection onRequestForTitle={() => { window.location.href = "/dashboard/buyer"; }} />
          </div>
        )},
        { id: "signed-deals", label: "Signed Deals", hint: "Offers · contracts · licensing lifecycle", content: <DealOperationsConsole /> },
        { id: "subscription-plans", label: "Subscription Plans", hint: "Products & pricing plans", content: <ProductsAndPlans /> },
        { id: "pricing-calculator", label: "Pricing Calculator", hint: "Commercial offer builder", content: <CommercialControlTower /> },
        { id: "plans", label: "Plans & Pricing (full)", hint: "Products, vault pricing, free tier", content: (
          <div className="space-y-6"><ProductsAndPlans /><StudioVaultPricing /><FreeTierConfig /></div>
        )},
        { id: "billing", label: "Billing & Payments", hint: "Invoices and payments & finance", content: (
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
        { id: "revenue-statements", label: "Partner Earnings Reports", hint: "Add revenue data · map to titles · compute creator share", content: <RevenueStatementImport /> },
        { id: "vault", label: "Purchased Content", hint: "Studio Vault revenue", content: <AdminStudioVaultPurchases /> },
        { id: "intelligence", label: "Market Insights", hint: "Buyer & competitor insights", content: <IntelligenceCenter /> },
        { id: "bi", label: "Business Reports", hint: "Uploads · Revenue · Rights · Delivery · AI Insights · Automation", content: <BusinessIntelligenceHub /> },
      ],
    },
    {
      id: "cloud",
      label: "Cloud",
      icon: <Cloud className="w-4 h-4" />,
      desc: "Uploads, storage, Oracle Cloud, delivery, backups.",
      sections: [
        { id: "storage", label: "Storage", hint: "OCI monitor", content: <OracleStorageMonitor /> },
        { id: "failed-uploads", label: "Failed Uploads", hint: "Structural diagnostics", content: <FailedUploadsInspector /> },
        { id: "advanced", label: "OCI Advanced", hint: "Credentials & buckets", content: <OracleOciStorageCard /> },
        { id: "partner-network", label: "Partner Network", hint: "Directory · Profiles · Templates · Connectors · Credentials · Contacts · History", content: <PartnerNetworkHub /> },
      ],
    },
    {
      id: "platform",
      label: "Platform",
      icon: <SettingsIcon className="w-4 h-4" />,
      desc: "System settings, audit, email, AI, security, homepage CMS.",
      sections: [
        { id: "mission-shortcut", label: "Mission Control", hint: "Live operations dashboard", content: <MissionControl /> },
        { id: "health", label: "Infrastructure Health", hint: "Live probes · no cached state", content: <InfrastructureHealth /> },
        { id: "metrics", label: "Metrics", hint: "Latency percentiles, throughput, failure rates", content: <MetricsDashboard /> },
        { id: "tests", label: "Test Runner", hint: "Live smoke + integration tests", content: <AdminTestRunner /> },
        { id: "runbook", label: "Runbook", hint: "In-app operations playbooks", content: <AdminRunbook /> },
        ...systemSections,
        { id: "email", label: "Email Logs", hint: "Raw email delivery log", content: <EmailLogMonitor /> },
        { id: "email-retry-audit", label: "Email Retry Audit", hint: "Sweeper run history · pending-remaining invariant", content: <EmailRetryAuditPanel /> },
        { id: "backup", label: "Backup Management", hint: "Oracle Cloud storage tiers, archives, restores", content: (
          <div className="space-y-6">
            <OracleStorageMonitor />
            <OracleOciStorageCard />
          </div>
        )},
      ],
    },
  ];
}

function AdminMainPanel({
  isSuperAdmin, isReviewer = false, reviewerKind = null, location, searchParams, navigate,
}: {
  isSuperAdmin: boolean;
  isReviewer?: boolean;
  reviewerKind?: "qc" | "legal" | null;
  location: { pathname: string };
  searchParams: URLSearchParams;
  navigate: (p: string) => void;
}) {
  const pathTab = location.pathname.toLowerCase().startsWith("/admin/qc") ? "qc_review"
    : location.pathname.toLowerCase().startsWith("/admin/legal") ? "legal_review"
    : undefined;

  // Reviewers are pinned to Operations · Approvals with the correct review tab.
  const reviewerDefaultTab = reviewerKind === "qc" ? "qc_review" : reviewerKind === "legal" ? "legal_review" : undefined;
  const reviewInitialTab = pathTab ?? reviewerDefaultTab;

  const initial: DeptKey = isReviewer ? "content" : pathToDept(location.pathname, searchParams);
  const [dept, setDept] = useState<DeptKey>(initial);
  const [sectionByDept, setSectionByDept] = useState<Record<string, string>>(() => {
    if (isReviewer) return { content: "approvals" };
    const s = searchParams.get("section");
    return s ? { [initial]: s } : {};
  });

  const allDepartments = useMemo(
    () => buildDepartments({ isSuperAdmin, navigate, reviewInitialTab }),
    [isSuperAdmin, navigate, reviewInitialTab],
  );

  // Reviewers see only the Content workspace, and only the Approvals sub-section.
  const departments = useMemo(() => {
    if (!isReviewer) return allDepartments;
    const ops = allDepartments.find((d) => d.id === "content");
    if (!ops) return allDepartments;
    return [{
      ...ops,
      desc: reviewerKind === "legal" ? "Legal review queue." : "QC review queue.",
      sections: ops.sections.filter((s) => s.id === "approvals"),
    }];
  }, [allDepartments, isReviewer, reviewerKind]);

  const cmdDepartments: AdminDepartment[] = useMemo(
    () => departments.map((d) => ({
      id: d.id,
      label: d.label,
      sections: d.sections.map((s) => ({ id: s.id, label: s.label, hint: s.hint })),
    })),
    [departments],
  );

  const queryClient = useQueryClient();

  const jumpTo = (deptId: string, sectionId: string) => {
    setDept(deptId as DeptKey);
    setSectionByDept((prev) => ({ ...prev, [deptId]: sectionId }));
    // Update URL so deep links work
    const url = new URL(window.location.href);
    url.searchParams.set("dept", deptId);
    url.searchParams.set("section", sectionId);
    window.history.replaceState(null, "", url.toString());
    // Force-refresh server state so the destination panel never renders
    // against a frozen browser cache. Broadcasts a signal for any panel
    // that manages its own fetching outside react-query.
    try { queryClient.invalidateQueries(); } catch { /* noop */ }
    try {
      window.dispatchEvent(new CustomEvent("admin:revalidate", {
        detail: { dept: deptId, section: sectionId, at: Date.now() },
      }));
    } catch { /* noop */ }
  };

  // Priority Inbox + Quick Actions dispatch this event to route the operator
  // to the exact department + sub-section without duplicating routing logic.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { dept?: string; section?: string } | undefined;
      if (detail?.dept && detail?.section) jumpTo(detail.dept, detail.section);
    };
    window.addEventListener("admin:jump", handler as EventListener);
    return () => window.removeEventListener("admin:jump", handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On mount and whenever the active department/section changes, invalidate
  // caches so switching tabs always pulls fresh server state.
  useEffect(() => {
    try { queryClient.invalidateQueries(); } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dept, sectionByDept[dept]]);


  const current = departments.find((d) => d.id === dept) ?? departments[0];

  return (
    <section className="container py-10 xl:pr-[340px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            {isReviewer
              ? (reviewerKind === "legal" ? "Legal Reviewer Console" : "QC Reviewer Console")
              : isSuperAdmin ? "Platform Owner · Media Operations" : "Admin Console"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isReviewer
              ? "Review queue is scoped to your assignments. All decisions are audited."
              : "Departments on the left. Sub-sections appear inside each department."}
          </p>
        </div>
        {!isReviewer && <AdminCommandBar departments={cmdDepartments} onJump={jumpTo} />}
      </div>

      {!isReviewer && <QuickActions onJump={jumpTo} />}



      <Tabs
        value={dept}
        onValueChange={(v) => setDept(v as DeptKey)}
        className="w-full"
      >
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 h-auto p-1.5 glass rounded-2xl bg-transparent border border-border/50 w-full mb-6">
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
    { path: "/admin/ecosystem?dept=ecosystem&section=onboarding", icon: <ClipboardCheck className="w-5 h-5" />, label: "Ecosystem",     desc: "Orgs · invites · partners · onboarding" },
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
  const DEFAULT_PRIMARY = "https://streamvista.in";
  const DEFAULT_EXTRA = "https://streamvista.in, https://streamvista-creator.lovable.app";
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
  const isProduction = currentOrigin.includes("streamvista.in");
  const isDeprecated = DEPRECATED.some(d => currentOrigin.startsWith(d));
  const envBadge = isDeprecated
    ? { label: "NO LONGER USED", cls: "bg-red-500/15 text-red-300 border-red-500/30" }
    : isProduction
    ? { label: "PRODUCTION", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" }
    : isPreview
    ? { label: "TEST WEBSITE", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" }
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
      toast.error("This domain is deprecated. Use https://streamvista.in instead.");
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
              <input value={primary} onChange={e => setPrimary(e.target.value)} placeholder="https://streamvista.in" className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Additional origins (comma-separated)</label>
              <input value={extra} onChange={e => setExtra(e.target.value)} placeholder="https://streamvista.in, https://streamvista-creator.lovable.app" className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
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
