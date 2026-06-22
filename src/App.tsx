import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, dashboardForRole, useAuth } from "@/hooks/useAuth";
import RoleGate from "@/components/RoleGate";
import OnboardingGate from "@/components/OnboardingGate";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import Onboarding from "./pages/Onboarding.tsx";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Admin from "./pages/Admin.tsx";
import ContentOwnerDashboard from "./pages/dashboards/ContentOwner.tsx";
import StudioDashboard from "./pages/dashboards/StudioDash.tsx";
import BuyerDashboard from "./pages/dashboards/Buyer.tsx";
import LocalizationDashboard from "./pages/dashboards/Localization.tsx";
import DistributionDashboard from "./pages/dashboards/Distribution.tsx";
import AdminErrorBoundary from "./components/admin/AdminErrorBoundary";
import KammattamPopout from "./pages/KammattamPopout.tsx";
import Terms from "./pages/Terms.tsx";
import Privacy from "./pages/Privacy.tsx";
import IPCopyright from "./pages/IPCopyright.tsx";
import Refund from "./pages/Refund.tsx";
import About from "./pages/About.tsx";


import LaunchingSpecialPlan from "./pages/LaunchingSpecialPlan.tsx";
import CheckoutReturn from "./pages/CheckoutReturn.tsx";
import Vault from "./pages/Vault.tsx";
import Studio from "./pages/Studio.tsx";
import MasterArchive from "./pages/MasterArchive.tsx";
import Team from "./pages/Team.tsx";
import Review from "./pages/Review.tsx";
import Share from "./pages/Share.tsx";
import NotFound from "./pages/NotFound.tsx";
import IngestTest from "./pages/IngestTest.tsx";
import C2CSetupManual from "./pages/C2CSetupManual.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import Contact from "./pages/Contact.tsx";
import InvoiceReceipt from "./pages/InvoiceReceipt.tsx";
import ManualInvoiceReceipt from "./pages/ManualInvoiceReceipt.tsx";

import ReferralCapture from "./components/ReferralCapture.tsx";
import WrongPortal from "./components/WrongPortal.tsx";
import { SystemMessageProvider } from "./components/system/SystemMessageProvider.tsx";
import GlobalErrorListener from "./components/system/GlobalErrorListener.tsx";
import { StorageQuotaProvider } from "@/hooks/useStorageQuota";
import { useHostMode } from "@/hooks/useHostMode";

const queryClient = new QueryClient();

const CanonicalDashboardRedirect = () => {
  const { user, role, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to={dashboardForRole(role)} replace />;
};

/** Admin subdomain (admin.streamvistacreator.com): only auth + admin console. */
const AdminRoutes = () => (
  <Routes>
    <Route path="/" element={<Auth />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/admin" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/super" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/users" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/storage" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/security" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/billing" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/settings" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/legal" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/qc" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/rights" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/audit" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/kammattam" element={<KammattamPopout />} />
    {/* Anything else on the admin host = wrong portal */}
    <Route path="*" element={<WrongPortal expected="public" />} />
  </Routes>
);

/** Public main domain (streamvistacreator.com): everything including /admin. */
const PublicRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/home" element={<Index />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/reset-password" element={<ResetPassword />} />

    {/* Linear onboarding wizard — kept for legacy accounts only. */}
    <Route path="/onboarding" element={<Onboarding />} />

    {/* New role-based dashboards (Phase 2 — empty states, no fake cards). */}
    <Route path="/dashboard/content" element={<ContentOwnerDashboard />} />
    <Route path="/dashboard/studio" element={<StudioDashboard />} />
    <Route path="/dashboard/buyer" element={<BuyerDashboard />} />
    <Route path="/dashboard/localization" element={<LocalizationDashboard />} />
    <Route path="/dashboard/distribution" element={<DistributionDashboard />} />

    {/* Legacy shared dashboard entry — always normalize to the role dashboard. */}
    <Route path="/dashboard" element={<CanonicalDashboardRedirect />} />



    {/* Role-gated dashboards. RLS at the DB enforces the real boundary;
        OnboardingGate enforces the linear flow, RoleGate keeps the
        wrong UI off the screen. */}
    <Route path="/producer" element={<CanonicalDashboardRedirect />} />
    <Route path="/vault" element={<OnboardingGate><RoleGate allow={["creator", "content_owner", "admin"]}><Vault /></RoleGate></OnboardingGate>} />
    <Route path="/studio" element={<OnboardingGate><RoleGate allow={["creator", "content_owner", "executive_producer", "studio", "admin"]}><Studio /></RoleGate></OnboardingGate>} />
    <Route path="/client" element={<CanonicalDashboardRedirect />} />
    <Route path="/projects" element={<CanonicalDashboardRedirect />} />
    <Route path="/archive" element={<OnboardingGate><RoleGate allow={["creator", "content_owner", "executive_producer", "studio", "admin"]}><MasterArchive /></RoleGate></OnboardingGate>} />
    <Route path="/team" element={<OnboardingGate><RoleGate allow={["creator", "content_owner", "executive_producer", "studio", "admin"]}><Team /></RoleGate></OnboardingGate>} />

    {/* Admin console is also reachable on the main domain until the admin subdomain DNS is fully configured. */}
    <Route path="/admin" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/super" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/users" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/storage" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/security" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/billing" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/settings" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/legal" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/qc" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/rights" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/audit" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/kammattam" element={<KammattamPopout />} />

    <Route path="/launching-special-plan" element={<LaunchingSpecialPlan />} />
    <Route path="/checkout/return" element={<CheckoutReturn />} />
    <Route path="/s/:token" element={<Share />} />
    <Route path="/review/:token" element={<Review />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/ip-copyright" element={<IPCopyright />} />
    <Route path="/dmca" element={<IPCopyright />} />
    <Route path="/refund" element={<Refund />} />
    <Route path="/about" element={<About />} />
    <Route path="/ingest-test" element={<IngestTest />} />
    <Route path="/c2c-setup" element={<C2CSetupManual />} />
    <Route path="/support" element={<Contact />} />
    <Route path="/contact" element={<Contact />} />
    <Route path="/unsubscribe" element={<Unsubscribe />} />
    <Route path="/invoice/:id" element={<InvoiceReceipt />} />
    <Route path="/invoice/manual/:id" element={<ManualInvoiceReceipt />} />
    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const HostAwareRoutes = () => {
  const host = useHostMode();
  return host === "admin" ? <AdminRoutes /> : <PublicRoutes />;
};

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
              <SystemMessageProvider>
                <StorageQuotaProvider>
                  <GlobalErrorListener />

                  <ReferralCapture />
                  <ErrorBoundary>
                    <HostAwareRoutes />
                  </ErrorBoundary>
                </StorageQuotaProvider>
              </SystemMessageProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
