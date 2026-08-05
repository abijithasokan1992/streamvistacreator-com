import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, dashboardForRole, useAuth } from "@/hooks/useAuth";

import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { GlobalPaymentProvider } from "@/components/payments/GlobalPaymentProvider";
import Onboarding from "./pages/Onboarding.tsx";
import RoleUnknown from "./pages/RoleUnknown.tsx";
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
import CreatorPreview from "./pages/CreatorPreview.tsx";
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
import SubmitContent from "./pages/SubmitContent.tsx";
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
import SuperAdminWorkspace from "./pages/admin/SuperAdminWorkspace.tsx";
import AdminFailedUploadsPlatform from "./pages/admin/FailedUploadsPlatform.tsx";
import AdminControlCenter from "./pages/admin/ControlCenter.tsx";
import AdminDeployments from "./pages/admin/Deployments.tsx";
import MediaOffice from "./pages/admin/MediaOffice.tsx";
import DemoTestReview from "./pages/admin/DemoTestReview.tsx";
import { CookieConsent } from "./components/CookieConsent";
import CollegeERP from "./pages/CollegeERP.tsx";
import Connect from "./pages/Connect.tsx";
import SettingsIntegrationsAI from "./pages/SettingsIntegrationsAI.tsx";
import AccessibilityPage from "./pages/Accessibility.tsx";
import SolutionsAIContentLicensing from "./pages/SolutionsAIContentLicensing.tsx";
import SellYourFilm from "./pages/landing/SellYourFilm.tsx";
import FilmDistribution from "./pages/landing/FilmDistribution.tsx";
import OttContentLicensing from "./pages/landing/OttContentLicensing.tsx";
import ContentOwners from "./pages/landing/ContentOwners.tsx";
import Buyers from "./pages/landing/Buyers.tsx";
import FilmRights from "./pages/landing/FilmRights.tsx";
import RegionalIndianCinema from "./pages/landing/RegionalIndianCinema.tsx";
import GlobalFilmSales from "./pages/landing/GlobalFilmSales.tsx";
import HowItWorks from "./pages/landing/HowItWorks.tsx";
import TrustAndRights from "./pages/landing/TrustAndRights.tsx";
import FilmLicensingCosts from "./pages/landing/FilmLicensingCosts.tsx";

// Creator Portal V2 (Filmhub-inspired) — Phase 1: available alongside legacy dashboard.
import { lazy, Suspense } from "react";
const CreatorShell = lazy(() => import("./components/creator/shell/CreatorShell"));
const CreatorCatalog = lazy(() => import("./pages/creator/CreatorCatalog"));
const CreatorDeliveries = lazy(() => import("./pages/creator/CreatorDeliveries"));
const CreatorDistribution = lazy(() => import("./pages/creator/CreatorDistribution"));
const CreatorMarketplace = lazy(() => import("./pages/creator/CreatorMarketplace"));
const CreatorDeals = lazy(() => import("./pages/creator/CreatorDeals"));
const CreatorRevenue = lazy(() => import("./pages/creator/CreatorRevenue"));
const CreatorInsights = lazy(() => import("./pages/creator/CreatorInsights"));
const CreatorSettings = lazy(() => import("./pages/creator/CreatorSettings"));

const CreatorPortalFallback = () => (
  <div className="min-h-dvh grid place-items-center text-muted-foreground">
    <Loader2 className="w-5 h-5 animate-spin" />
  </div>
);


// Smart Uploads is not MVP-ready — hidden until the checksum + bucket work is production-safe.


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

/**
 * Single source of truth for /admin/* routes — consumed by both AdminRoutes
 * (admin subdomain) and PublicRoutes (main domain) so the two hosts can never
 * drift. Add new admin routes here only.
 */
const ADMIN_ROUTES: { path: string; element: JSX.Element }[] = [
  { path: "/admin", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
  { path: "/admin/control-center", element: <AdminErrorBoundary><AdminControlCenter /></AdminErrorBoundary> },
  { path: "/admin/deployments", element: <AdminErrorBoundary><AdminDeployments /></AdminErrorBoundary> },
  { path: "/admin/office", element: <AdminErrorBoundary><MediaOffice /></AdminErrorBoundary> },
  { path: "/admin/demo-test", element: <AdminErrorBoundary><DemoTestReview /></AdminErrorBoundary> },
  { path: "/admin/home", element: <AdminHome /> },
  { path: "/admin/super", element: <AdminErrorBoundary><SuperAdminWorkspace /></AdminErrorBoundary> },
  { path: "/admin/users", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
  { path: "/admin/approvals", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
  { path: "/admin/ecosystem", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
  { path: "/admin/catalog", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
  { path: "/admin/billing", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
  { path: "/admin/storage", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
  { path: "/admin/comms", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
  { path: "/admin/settings", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
  { path: "/admin/integrations", element: <AdminErrorBoundary><AdminIntegrations /></AdminErrorBoundary> },
  { path: "/admin/research", element: <AdminErrorBoundary><AdminResearch /></AdminErrorBoundary> },
  { path: "/admin/audit", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
  { path: "/admin/homepage", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
  { path: "/admin/qc", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
  { path: "/admin/legal", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
  { path: "/admin/legacy-recovery", element: <AdminErrorBoundary><AdminLegacyRecovery /></AdminErrorBoundary> },
  { path: "/admin/failed-uploads", element: <AdminErrorBoundary><AdminFailedUploadsPlatform /></AdminErrorBoundary> },
  { path: "/admin/content", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
  { path: "/admin/support", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
  { path: "/admin/reports", element: <AdminErrorBoundary><Admin /></AdminErrorBoundary> },
];

const renderAdminRoutes = () =>
  ADMIN_ROUTES.map((r) => <Route key={r.path} path={r.path} element={r.element} />);

/** Admin subdomain (admin.streamvista.in): only auth + admin console. */
const AdminRoutes = () => (
  <Routes>
    <Route path="/" element={<AdminRoot />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/connectors" element={<Navigate to="/connect" replace />} />
    {renderAdminRoutes()}
    <Route path="*" element={<WrongPortal expected="public" />} />
  </Routes>
);

/** Public main domain (streamvista.in): everything including /admin. */
const PublicRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/connectors" element={<Navigate to="/connect" replace />} />
    <Route path="/settings/integrations/ai-assistants" element={<SettingsIntegrationsAI />} />
    <Route path="/solutions/ai-content-licensing" element={<SolutionsAIContentLicensing />} />
    <Route path="/onboarding" element={<Onboarding />} />
    <Route path="/auth/role-unknown" element={<RoleUnknown />} />
    <Route path="/dashboard/content" element={<OnboardingGate><RoleGate allow={["content_owner"]}><ContentOwnerDashboard /></RoleGate></OnboardingGate>} />
    <Route path="/dashboard/studio" element={<OnboardingGate><RoleGate allow={["studio"]}><StudioProfileOnboardingGate><StudioDashboard /></StudioProfileOnboardingGate></RoleGate></OnboardingGate>} />
    <Route path="/dashboard/buyer" element={<OnboardingGate><RoleGate allow={["buyer"]}><BuyerDashboard /></RoleGate></OnboardingGate>} />
    <Route path="/dashboard/profile/creator" element={<OnboardingGate><MyCreatorProfile /></OnboardingGate>} />
    <Route path="/dashboard/studio/profile" element={<OnboardingGate><MyStudioProfile /></OnboardingGate>} />
    <Route path="/dashboard/studio/settings/advanced" element={<OnboardingGate><RoleGate allow={["studio"]}><StudioAdvancedSettings /></RoleGate></OnboardingGate>} />
    <Route path="/studio/ingest/engine" element={<OnboardingGate><RoleGate allow={["studio"]}><IngestEnginePage /></RoleGate></OnboardingGate>} />
    <Route path="/my-workspace" element={<OnboardingGate><MyWorkspace /></OnboardingGate>} />
    {/* Dormant Phase-2 roles now route to canonical dashboards via
        toDashboardRole(); the standalone /dashboard/localization and
        /dashboard/distribution routes were removed to prevent an infinite
        <Navigate replace> loop against CanonicalDashboardRedirect. */}
    <Route path="/dashboard" element={<CanonicalDashboardRedirect />} />
    {/* Legacy shell paths kept as redirects so old magic-links, bookmarks and
        emailed URLs still land on the user's canonical dashboard instead of
        404-ing. Safe to delete once inbound traffic drops to zero. */}
    <Route path="/uploads" element={<Navigate to="/" replace />} />
    <Route
      path="/creator"
      element={
        <OnboardingGate>
          <RoleGate allow={["content_owner", "creator", "studio"]}>
            <Suspense fallback={<CreatorPortalFallback />}>
              <CreatorShell />
            </Suspense>
          </RoleGate>
        </OnboardingGate>
      }
    >
      <Route index element={<Navigate to="/creator/catalog" replace />} />
      <Route path="catalog" element={<Suspense fallback={<CreatorPortalFallback />}><CreatorCatalog /></Suspense>} />
      <Route path="deliveries" element={<Suspense fallback={<CreatorPortalFallback />}><CreatorDeliveries /></Suspense>} />
      <Route path="deliveries/:titleId" element={<Suspense fallback={<CreatorPortalFallback />}><CreatorDeliveries /></Suspense>} />
      <Route path="distribution" element={<Suspense fallback={<CreatorPortalFallback />}><CreatorDistribution /></Suspense>} />
      <Route path="marketplace" element={<Suspense fallback={<CreatorPortalFallback />}><CreatorMarketplace /></Suspense>} />
      <Route path="deals" element={<Suspense fallback={<CreatorPortalFallback />}><CreatorDeals /></Suspense>} />
      <Route path="revenue" element={<Suspense fallback={<CreatorPortalFallback />}><CreatorRevenue /></Suspense>} />
      <Route path="insights" element={<Suspense fallback={<CreatorPortalFallback />}><CreatorInsights /></Suspense>} />
      <Route path="settings" element={<Suspense fallback={<CreatorPortalFallback />}><CreatorSettings /></Suspense>} />
    </Route>
    <Route path="/producer" element={<CanonicalDashboardRedirect />} />
    <Route path="/vault" element={<CanonicalDashboardRedirect />} />
    <Route path="/studio" element={<CanonicalDashboardRedirect />} />
    <Route path="/client" element={<CanonicalDashboardRedirect />} />
    <Route path="/projects" element={<CanonicalDashboardRedirect />} />
    <Route path="/archive" element={<CanonicalDashboardRedirect />} />
    <Route path="/team" element={<CanonicalDashboardRedirect />} />
    {renderAdminRoutes()}
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
    <Route path="/partners" element={<Partners />} />
    <Route path="/creator-preview" element={<CreatorPreview />} />
    <Route path="/c2c-setup" element={<C2CSetupManual />} />
    <Route path="/blog/camera-to-cloud-guide" element={<CameraToCloudGuide />} />
    <Route path="/blog/streamvista-vs-frame-io-camera-to-cloud" element={<StreamVistaVsFrameIO />} />
    <Route path="/support" element={<Navigate to="/contact" replace />} />
    <Route path="/contact" element={<Contact />} />
    <Route path="/submit-content" element={<SubmitContent />} />
    <Route path="/unsubscribe" element={<Unsubscribe />} />
    <Route path="/invoice/:id" element={<InvoiceReceipt />} />
    <Route path="/invoice/manual/:id" element={<ManualInvoiceReceipt />} />
    <Route path="/college-erp" element={<CollegeERP />} />
    <Route path="/connect" element={<Connect />} />
    <Route path="/accessibility" element={<AccessibilityPage />} />
    <Route path="/sell-your-film" element={<SellYourFilm />} />
    <Route path="/film-distribution" element={<FilmDistribution />} />
    <Route path="/ott-content-licensing" element={<OttContentLicensing />} />
    <Route path="/content-owners" element={<ContentOwners />} />
    <Route path="/buyers" element={<Buyers />} />
    <Route path="/film-rights" element={<FilmRights />} />
    <Route path="/regional-indian-cinema" element={<RegionalIndianCinema />} />
    <Route path="/global-film-sales" element={<GlobalFilmSales />} />
    <Route path="/how-it-works" element={<HowItWorks />} />
    <Route path="/trust-and-rights" element={<TrustAndRights />} />
    <Route path="/guides/film-licensing-costs-and-agreements" element={<FilmLicensingCosts />} />
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
                  <GlobalPaymentProvider>
                    <GlobalErrorListener />
                    <a href="#main-content" className="skip-to-content">
                      Skip to main content
                    </a>
                    <ReferralCapture />
                    <ErrorBoundary>
                      <HostAwareRoutes />
                      <RouteAgentDock />
                      <AssistantLauncher />
                      <CookieConsent />
                    </ErrorBoundary>
                  </GlobalPaymentProvider>
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
