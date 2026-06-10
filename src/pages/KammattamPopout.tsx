import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import KammattamMeter from "@/components/admin/KammattamMeter";
import { useAuth } from "@/hooks/useAuth";

export default function KammattamPopout() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/auth?next=/admin/kammattam", { replace: true });
  }, [user, isAdmin, loading, navigate]);

  return (
    <main className="min-h-dvh p-4 bg-background">
      <KammattamMeter popout />
    </main>
  );
}
