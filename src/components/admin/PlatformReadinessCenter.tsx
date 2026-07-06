import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, RefreshCw, ShieldCheck, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Pillar = "frontend" | "backend" | "security" | "integration" | "production";

interface CapabilityReport {
  id: string;
  label: string;
  pillars: Record<Pillar, { ok: boolean; note: string }>;
}

interface ReadinessResponse {
  generated_at: string;
  capabilities: CapabilityReport[];
}

const PILLAR_ORDER: Pillar[] = ["frontend", "backend", "security", "integration", "production"];
const PILLAR_LABEL: Record<Pillar, string> = {
  frontend: "Frontend Complete",
  backend: "Backend Complete",
  security: "Security Complete",
  integration: "Integration Tested",
  production: "Production Ready",
};

/**
 * Read-only platform readiness matrix. Every state is computed live by the
 * `platform-readiness` edge function from config, health probes and
 * validation records — nothing is hardcoded in this component.
 */
export default function PlatformReadinessCenter() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [data, setData] = useState<ReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke<ReadinessResponse>("platform-readiness");
      if (error) throw error;
      if (!data) throw new Error("Empty response");
      setData(data);
    } catch (e) {
      setError((e as Error).message || "Failed to load readiness snapshot");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin || isSuperAdmin) load();
  }, [isAdmin, isSuperAdmin]);

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
        Platform Readiness Center is visible to Platform Administrators only.
      </div>
    );
  }

  const totalPillars = (data?.capabilities.length ?? 0) * 5;
  const passingPillars =
    data?.capabilities.reduce(
      (n, c) => n + PILLAR_ORDER.filter((p) => c.pillars[p]?.ok).length,
      0,
    ) ?? 0;
  const percent = totalPillars > 0 ? Math.round((passingPillars / totalPillars) * 100) : 0;

  return (
    <section className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold leading-tight">Platform Readiness Center</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Live readiness across five independent pillars per capability. Read-only.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="w-3.5 h-3.5" />
            <span>
              {passingPillars}/{totalPillars} checks passing · {percent}%
            </span>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border/60 bg-secondary/60 text-xs hover:bg-secondary transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="glass rounded-xl p-4 text-sm text-red-300 border border-red-500/30">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="glass rounded-2xl p-10 grid place-items-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {data && (
        <>
          <div className="glass rounded-2xl overflow-hidden border border-border/60">
            <div className="hidden lg:grid grid-cols-[minmax(200px,1.4fr)_repeat(5,1fr)] gap-px bg-border/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <div className="bg-card/60 px-4 py-3">Capability</div>
              {PILLAR_ORDER.map((p) => (
                <div key={p} className="bg-card/60 px-4 py-3">{PILLAR_LABEL[p]}</div>
              ))}
            </div>

            <div className="divide-y divide-border/40">
              {data.capabilities.map((cap) => {
                const passed = PILLAR_ORDER.filter((p) => cap.pillars[p]?.ok).length;
                return (
                  <div
                    key={cap.id}
                    className="lg:grid lg:grid-cols-[minmax(200px,1.4fr)_repeat(5,1fr)] lg:gap-px bg-border/20"
                  >
                    <div className="bg-card/40 px-4 py-4">
                      <div className="font-semibold text-sm text-foreground">{cap.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {passed} of 5 pillars ready
                      </div>
                    </div>
                    {PILLAR_ORDER.map((p) => {
                      const cell = cap.pillars[p];
                      return (
                        <div key={p} className="bg-card/40 px-4 py-4">
                          <div className="lg:hidden text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            {PILLAR_LABEL[p]}
                          </div>
                          <PillarCell ok={cell?.ok ?? false} note={cell?.note ?? ""} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Snapshot generated {new Date(data.generated_at).toLocaleString()}. Every state is derived from
            live database records, configuration, integration availability and validation logs.
          </p>
        </>
      )}
    </section>
  );
}

function PillarCell({ ok, note }: { ok: boolean; note: string }) {
  return (
    <div className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
      ) : (
        <Circle className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-0.5" />
      )}
      <div className="min-w-0">
        <div
          className={cn(
            "text-xs font-medium",
            ok ? "text-emerald-300" : "text-muted-foreground",
          )}
        >
          {ok ? "Ready" : "Not ready"}
        </div>
        <div className="text-[11px] text-muted-foreground/80 mt-0.5 leading-snug">{note}</div>
      </div>
    </div>
  );
}
