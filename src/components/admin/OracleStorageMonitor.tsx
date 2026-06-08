import { useEffect, useState, useCallback } from "react";
import { Cloud, RefreshCw, AlertTriangle, Loader2, HardDrive, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ORACLE_API_URL,
  ORACLE_BUCKET,
  isOracleConfigured,
  getBucketStats,
  listObjects,
  type OracleBucketStats,
  type OracleObject,
} from "@/lib/oracle-gateway";

const REFRESH_MS = 15000;

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export default function OracleStorageMonitor() {
  const configured = isOracleConfigured();
  const [stats, setStats] = useState<OracleBucketStats | null>(null);
  const [objects, setObjects] = useState<OracleObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (!configured) return;
    setLoading(true); setError(null);
    try {
      const [s, o] = await Promise.all([getBucketStats(), listObjects(ORACLE_BUCKET, 10)]);
      setStats(s);
      setObjects(o.objects ?? []);
      setLastSync(new Date());
    } catch (e: any) {
      setError(e?.message ?? "Failed to reach Oracle API gateway");
    } finally { setLoading(false); }
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [configured, refresh]);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <Cloud className="w-5 h-5 text-accent" /> Oracle OCI Storage
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Bucket <span className="font-mono">{ORACLE_BUCKET}</span> · live via your API gateway
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastSync && <span className="text-[11px] text-muted-foreground">synced {lastSync.toLocaleTimeString()}</span>}
          <Button size="sm" variant="outline" onClick={refresh} disabled={!configured || loading} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {!configured ? (
        <div className="border border-dashed border-border/70 rounded-xl p-5 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-medium">Oracle API gateway not configured.</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Set <code className="font-mono text-foreground">VITE_ORACLE_API_URL</code> (and optionally{" "}
                <code className="font-mono text-foreground">VITE_ORACLE_BUCKET</code>) to your self-hosted Node.js proxy URL.
                The proxy must expose <code className="font-mono">GET /buckets/:bucket/stats</code> and{" "}
                <code className="font-mono">GET /buckets/:bucket/objects?limit=N</code>.
              </p>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Gateway error</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">Endpoint: <span className="font-mono">{ORACLE_API_URL}</span></p>
          </div>
        </div>
      ) : !stats && loading ? (
        <div className="py-12 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-3 mb-5">
            <StatCard icon={<HardDrive className="w-4 h-4" />} label="Total size" value={stats ? formatBytes(stats.approximateSizeBytes) : "—"} />
            <StatCard icon={<Boxes className="w-4 h-4" />} label="Objects" value={stats ? stats.objectCount.toLocaleString() : "—"} />
            <StatCard icon={<Cloud className="w-4 h-4" />} label="Region" value={stats?.region ?? "ap-mumbai-1"} />
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Recent objects</h3>
            {objects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center border border-border/40 rounded-lg">No objects returned.</p>
            ) : (
              <ul className="divide-y divide-border/40 border border-border/40 rounded-lg overflow-hidden">
                {objects.map(o => (
                  <li key={o.name} className="px-3 py-2 text-xs flex items-center justify-between gap-3">
                    <span className="font-mono truncate">{o.name}</span>
                    <span className="text-muted-foreground shrink-0">{formatBytes(o.size)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
      <div className="font-display text-xl font-bold mt-1">{value}</div>
    </div>
  );
}
