import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Sprint 1 commercial lockdown.
 *
 * The Paddle-powered public `/checkout/storage` page is deferred for MVP —
 * Razorpay is the only active self-serve rail and storage top-ups are bought
 * inside the dashboard via `useStorageQuota.upgrade()` (which invokes
 * `create-storage-topup` → Razorpay → `verify-storage-topup`).
 *
 * Keep the route reachable so old links don't 404, but route users to the
 * canonical in-dashboard flow instead of opening Paddle checkout.
 */
export default function CheckoutStorage() {
  const { user, loading } = useAuth();

  useEffect(() => {
    document.title = "Storage add-on — StreamVista";
  }, []);

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth?intent=signin&next=/dashboard/content" replace />;
  }
  return <Navigate to="/dashboard/content?upgrade=storage" replace />;
}
