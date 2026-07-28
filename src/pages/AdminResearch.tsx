import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import IntelligenceCenter from "@/components/admin/IntelligenceCenter";

export default function AdminResearch() {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <header>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to admin
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight inline-flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            Business Reports Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Automated Firecrawl-powered scans across buyers, festivals, industry news and brand
            monitoring. Every result is source-linked and reviewed before it enters the platform.
          </p>
        </header>

        <IntelligenceCenter />
      </div>
    </main>
  );
}
