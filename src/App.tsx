import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import RoleGate from "@/components/RoleGate";
import OnboardingGate from "@/components/OnboardingGate";
import ErrorBoundary from "@/components/ErrorBoundary";
import Onboarding from "./pages/Onboarding.tsx";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Admin from "./pages/Admin.tsx";
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
import Producer from "./pages/Producer.tsx";
import Client from "./pages/Client.tsx";
import Projects from "./pages/Projects.tsx";
import Review from "./pages/Review.tsx";
import Share from "./pages/Share.tsx";
import NotFound from "./pages/NotFound.tsx";
import IngestTest from "./pages/IngestTest.tsx";
import C2CSetupManual from "./pages/C2CSetupManual.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import { PaymentTestModeBanner } from "./components/PaymentTestModeBanner.tsx";
import ReferralCapture from "./components/ReferralCapture.tsx";
import WrongPortal from "./components/WrongPortal.tsx";
import { SystemMessageProvider } from "./components/system/SystemMessageProvider.tsx";
import GlobalErrorListener from "./components/system/GlobalErrorListener.tsx";
import { useHostMode } from "@/hooks/useHostMode";

const queryClient = new QueryClient();

/** Admin subdomain (admin.streamvistacreator.com): only auth + admin console. */
const AdminRoutes = () => (
  <Routes>
    <Route path="/" element={<Auth />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/admin" element={<Admin />} />
    <Route path="/admin/kammattam" element={<KammattamPopout />} />
    {/* Anything else on the admin host = wrong portal */}
    <Route path="*" element={<WrongPortal expected="public" />} />
  </Routes>
);

/** Public main domain (streamvistacreator.com): everything including /admin. */
const PublicRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/reset-password" element={<ResetPassword />} />

    {/* Linear onboarding wizard — must come BEFORE the dashboards. */}
    <Route path="/onboarding" element={<Onboarding />} />

    {/* Role-gated dashboards. RLS at the DB enforces the real boundary;
        OnboardingGate enforces the linear flow, RoleGate keeps the
        wrong UI off the screen. */}
    <Route path="/producer" element={<OnboardingGate><RoleGate allow={["executive_producer", "admin"]}><Producer /></RoleGate></OnboardingGate>} />
    <Route path="/vault" element={<OnboardingGate><RoleGate allow={["creator", "admin"]}><Vault /></RoleGate></OnboardingGate>} />
    <Route path="/studio" element={<OnboardingGate><RoleGate allow={["creator", "executive_producer", "admin"]}><Studio /></RoleGate></OnboardingGate>} />
    <Route path="/client" element={<OnboardingGate><RoleGate allow={["client", "creator", "executive_producer", "admin"]}><Client /></RoleGate></OnboardingGate>} />
    <Route path="/projects" element={<OnboardingGate><RoleGate allow={["creator", "executive_producer", "admin"]}><Projects /></RoleGate></OnboardingGate>} />

    {/* Admin console is also reachable on the main domain until the admin subdomain DNS is fully configured. */}
    <Route path="/admin" element={<Admin />} />
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
    <Route path="/support" element={<About />} />
    <Route path="/unsubscribe" element={<Unsubscribe />} />
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <SystemMessageProvider>
              <GlobalErrorListener />
              <PaymentTestModeBanner />
              <ReferralCapture />
              <ErrorBoundary>
                <HostAwareRoutes />
              </ErrorBoundary>
            </SystemMessageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
