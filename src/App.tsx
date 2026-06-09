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
import Admin from "./pages/Admin.tsx";
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
import Share from "./pages/Share.tsx";
import NotFound from "./pages/NotFound.tsx";
import { PaymentTestModeBanner } from "./components/PaymentTestModeBanner.tsx";
import ReferralCapture from "./components/ReferralCapture.tsx";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <PaymentTestModeBanner />
            <ReferralCapture />
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />

                {/* Role-gated dashboards. RLS at the DB enforces the real boundary;
                    these gates just keep the wrong UI off the screen. */}
                <Route path="/admin" element={<Admin />} />
                <Route path="/producer" element={<RoleGate allow={["executive_producer", "admin"]}><Producer /></RoleGate>} />
                <Route path="/vault" element={<RoleGate allow={["creator", "admin"]}><Vault /></RoleGate>} />
                <Route path="/studio" element={<RoleGate allow={["creator", "executive_producer", "admin"]}><Studio /></RoleGate>} />
                <Route path="/client" element={<RoleGate allow={["client", "creator", "executive_producer", "admin"]}><Client /></RoleGate>} />

                <Route path="/launching-special-plan" element={<LaunchingSpecialPlan />} />
                <Route path="/checkout/return" element={<CheckoutReturn />} />
                <Route path="/s/:token" element={<Share />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/ip-copyright" element={<IPCopyright />} />
                <Route path="/dmca" element={<IPCopyright />} />
                <Route path="/refund" element={<Refund />} />
                <Route path="/about" element={<About />} />
                <Route path="/support" element={<About />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
