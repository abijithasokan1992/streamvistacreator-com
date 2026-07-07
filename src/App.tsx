import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, dashboardForRole, useAuth } from "@/hooks/useAuth";

import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import Onboarding from "./pages/Onboarding.tsx";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";
import OAuthConsent from "./pages/OAuthConsent.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Admin from "./pages/Admin.tsx";
import ContentOwnerDashboard from "./pages/dashboards/ContentOwner.tsx";
import StudioDashboard from "./pages/dashboards/StudioDash.tsx";
import BuyerDashboard from "./pages/dashboards/Buyer.tsx";
import AdminErrorBoundary from "./components/admin/AdminErrorBoundary";
import Terms from "./pages/Terms.tsx";
import Privacy from "./pages/Privacy.tsx";
import IPCopyright from "./pages/IPCopyright.tsx";
import Refund from "./pages/Refund.tsx";
import About from "./pages/About.tsx";
import Partners from "./pages/Partners.tsx";
import CheckoutReturn from "./pages/CheckoutReturn.tsx";
import CheckoutStorage from "./pages/CheckoutStorage.tsx";
import PricingPage from "./pages/Pricing.tsx";
import OrderStatus from "./pages/OrderStatus.tsx";
import Review from "./pages/Review.tsx";
import Share from "./pages/Share.tsx";
import NotFound from "./pages/NotFound.tsx";
import C2CSetupManual from "./pages/C2CSetupManual.tsx";
import CameraToCloudGuide from "./pages/blog/CameraToCloudGuide.tsx";
import StreamVistaVsFrameIO from "./pages/blog/StreamVistaVsFrameIO.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import Contact from "./pages/Contact.tsx";
import InvoiceReceipt from "./pages/InvoiceReceipt.tsx";
import ManualInvoiceReceipt from "./pages/ManualInvoiceReceipt.tsx";
import ScreeningRoom from "./pages/ScreeningRoom.tsx";
import MyCreatorProfile from "./pages/profile/MyCreatorProfile.tsx";
import MyStudioProfile from "./pages/profile/MyStudioProfile.tsx";
import StudioAdvancedSettings from "./pages/dashboards/StudioAdvancedSettings.tsx";
import StudioProfileOnboardingGate from "./components/studio/StudioProfileOnboardingGate.tsx";
import IngestEnginePage from "./pages/studio/IngestEngine.tsx";
import MyWorkspace from "./pages/MyWorkspace.tsx";
import AdminHome from "./pages/AdminHome.tsx";
import AdminIntegrations from "./pages/AdminIntegrations.tsx";
import AdminResearch from "./pages/AdminResearch.tsx";
import AdminLegacyRecovery from "./pages/admin/LegacyRecovery.tsx";
import CollegeERP from "./pages/CollegeERP.tsx";
import Connect from "./pages/Connect.tsx";
import Connectors from "./pages/Connectors.tsx";
// Smart Uploads is not MVP-ready — hidden until the checksum + bucket work is production-safe.
// import SmartUploads from "./pages/SmartUploads.tsx";

import ReferralCapture from "./components/ReferralCapture.tsx";
import { RouteAgentDock } from "./components/agents/RouteAgentDock.tsx";
import { AssistantLauncher } from "./components/assistant/AssistantLauncher.tsx";
import WrongPortal from "./components/WrongPortal.tsx";
import OnboardingGate from "./components/OnboardingGate.tsx";
import RoleGate from "./components/RoleGate.tsx";
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

/** Admin subdomain root: authed users go to /admin, guests see the login. */
const AdminRoot = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  return user ? <Navigate to="/admin" replace /> : <Auth />;
};

/** Admin subdomain (admin.streamvistacreator.com): only auth + admin console. */
const AdminRoutes = () => (
  <Routes>
    <Route path="/" element={<AdminRoot />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/connectors" element={<Connectors />} />
    <Route path="/admin" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/home" element={<AdminHome />} />
    <Route path="/admin/super" element={<Navigate to="/admin" replace />} />
    <Route path="/admin/users" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/approvals" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/catalog" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/billing" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/storage" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/comms" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/settings" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/integrations" element={<AdminErrorBoundary><AdminIntegrations /></AdminErrorBoundary>} />
    <Route path="/admin/research" element={<AdminErrorBoundary><AdminResearch /></AdminErrorBoundary>} />
    <Route path="/admin/audit" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/homepage" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/qc" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/legal" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/legacy-recovery" element={<AdminErrorBoundary><AdminLegacyRecovery /></AdminErrorBoundary>} />
    {/* Legacy admin paths — Admin.tsx pathToTab maps these to the new buckets */}
    <Route path="/admin/content" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/support" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/reports" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />

    {/* Anything else on the admin host = wrong portal */}
    <Route path="*" element={<WrongPortal expected="public" />} />
  </Routes>
);

/** Public main domain (streamvistacreator.com): everything including /admin. */
const PublicRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/connectors" element={<Connectors />} />

    {/* Linear onboarding wizard — kept for legacy accounts only. */}
    <Route path="/onboarding" element={<Onboarding />} />

    {/* New role-based dashboards (Phase 2 — empty states, no fake cards). */}
    <Route path="/dashboard/content" element={<OnboardingGate><RoleGate allow={["content_owner"]}><ContentOwnerDashboard /></RoleGate></OnboardingGate>} />
    <Route path="/dashboard/studio" element={<OnboardingGate><RoleGate allow={["studio"]}><StudioProfileOnboardingGate><StudioDashboard /></StudioProfileOnboardingGate></RoleGate></OnboardingGate>} />
    <Route path="/dashboard/buyer" element={<OnboardingGate><RoleGate allow={["buyer"]}><BuyerDashboard /></RoleGate></OnboardingGate>} />
    <Route path="/dashboard/profile/creator" element={<OnboardingGate><MyCreatorProfile /></OnboardingGate>} />
    <Route path="/dashboard/studio/profile" element={<OnboardingGate><MyStudioProfile /></OnboardingGate>} />
    <Route path="/dashboard/studio/settings/advanced" element={<OnboardingGate><RoleGate allow={["studio"]}><StudioAdvancedSettings /></RoleGate></OnboardingGate>} />
    <Route path="/studio/ingest/engine" element={<OnboardingGate><RoleGate allow={["studio"]}><IngestEnginePage /></RoleGate></OnboardingGate>} />
    <Route path="/my-workspace" element={<MyWorkspace />} />
    <Route path="/dashboard/localization" element={<CanonicalDashboardRedirect />} />
    <Route path="/dashboard/distribution" element={<CanonicalDashboardRedirect />} />

    {/* Legacy shared dashboard entry — always normalize to the role dashboard. */}
    <Route path="/dashboard" element={<CanonicalDashboardRedirect />} />
    {/* Smart Uploads disabled for MVP — redirect any stray links home. */}
    <Route path="/uploads" element={<Navigate to="/" replace />} />



    {/* Role-gated dashboards. RLS at the DB enforces the real boundary;
        OnboardingGate enforces the linear flow, RoleGate keeps the
        wrong UI off the screen. */}
    <Route path="/producer" element={<CanonicalDashboardRedirect />} />
    <Route path="/vault" element={<CanonicalDashboardRedirect />} />
    <Route path="/studio" element={<CanonicalDashboardRedirect />} />
    <Route path="/client" element={<CanonicalDashboardRedirect />} />
    <Route path="/projects" element={<CanonicalDashboardRedirect />} />
    <Route path="/archive" element={<CanonicalDashboardRedirect />} />
    <Route path="/team" element={<CanonicalDashboardRedirect />} />

    {/* Admin console is also reachable on the main domain until the admin subdomain DNS is fully configured. */}
    <Route path="/admin" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/home" element={<AdminHome />} />
    <Route path="/admin/super" element={<Navigate to="/admin" replace />} />
    <Route path="/admin/users" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/approvals" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/catalog" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/billing" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/storage" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/comms" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/settings" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/integrations" element={<AdminErrorBoundary><AdminIntegrations /></AdminErrorBoundary>} />
    <Route path="/admin/research" element={<AdminErrorBoundary><AdminResearch /></AdminErrorBoundary>} />
    <Route path="/admin/audit" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/homepage" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/qc" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/legal" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/legacy-recovery" element={<AdminErrorBoundary><AdminLegacyRecovery /></AdminErrorBoundary>} />
    {/* Legacy admin paths — Admin.tsx pathToTab maps these to the new buckets */}
    <Route path="/admin/content" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/support" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />
    <Route path="/admin/reports" element={<AdminErrorBoundary><Admin /></AdminErrorBoundary>} />



    <Route path="/checkout/return" element={<CheckoutReturn />} />
    <Route path="/checkout/storage" element={<CheckoutStorage />} />
    <Route path="/billing/status/:topupId" element={<OrderStatus />} />
    <Route path="/s/:token" element={<Share />} />
    <Route path="/review/:token" element={<Review />} />
    <Route path="/screening/:token" element={<ScreeningRoom />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/ip-copyright" element={<IPCopyright />} />
    <Route path="/dmca" element={<IPCopyright />} />
    <Route path="/refund" element={<Refund />} />
    <Route path="/pricing" element={<PricingPage />} />
    <Route path="/about" element={<About />} />

    <Route path="/c2c-setup" element={<C2CSetupManual />} />
    <Route path="/blog/camera-to-cloud-guide" element={<CameraToCloudGuide />} />
    <Route path="/blog/streamvista-vs-frame-io-camera-to-cloud" element={<StreamVistaVsFrameIO />} />
    <Route path="/support" element={<Navigate to="/contact" replace />} />
    <Route path="/contact" element={<Contact />} />
    <Route path="/unsubscribe" element={<Unsubscribe />} />
    <Route path="/invoice/:id" element={<InvoiceReceipt />} />
    <Route path="/invoice/manual/:id" element={<ManualInvoiceReceipt />} />
    <Route path="/college-erp" element={<CollegeERP />} />
    <Route path="/connect" element={<Connect />} />
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
          <BrowserRouter>
            <AuthProvider>
              <SystemMessageProvider>
                <StorageQuotaProvider>
                  <GlobalErrorListener />

                  <ReferralCapture />
                  <ErrorBoundary>
                    <HostAwareRoutes />
                    <RouteAgentDock />
                    <AssistantLauncher />
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
