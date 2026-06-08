import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";

import LaunchingSpecialPlan from "./pages/LaunchingSpecialPlan.tsx";
import CheckoutReturn from "./pages/CheckoutReturn.tsx";
import Vault from "./pages/Vault.tsx";
import Share from "./pages/Share.tsx";
import NotFound from "./pages/NotFound.tsx";
import { PaymentTestModeBanner } from "./components/PaymentTestModeBanner.tsx";
import ReferralCapture from "./components/ReferralCapture.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PaymentTestModeBanner />
          <ReferralCapture />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<Admin />} />
            
            <Route path="/launching-special-plan" element={<LaunchingSpecialPlan />} />
            <Route path="/checkout/return" element={<CheckoutReturn />} />
            <Route path="/vault" element={<Vault />} />
            <Route path="/s/:token" element={<Share />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
