import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Activity, FileText, Users, RefreshCw, PlayCircle, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ManualInvoiceConsole from "@/components/admin/ManualInvoiceConsole";
import EntitlementExplorer from "@/components/admin/EntitlementExplorer";

type ArchiveJob = {
  id: string;
  status: string;
  source_tier: string | null;
  target_tier: string | null;
  total_bytes: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

export default function AdminOperations() {
  const [recentJobs, setRecentJobs] = useState<ArchiveJob[]>([]);
  const [stats, setStats] = useState({ pendingInvoices: 0, runningJobs: 0, archived30d: 0 });
  const [running, setRunning] = useState<string | null>(null);

  const loadOverview = async () => {
    const [jobs, pending, archived] = await Promise.all([
      supabase.from("archive_jobs").select("id,status,source_tier,target_tier,total_bytes,error_message,created_at,completed_at").order("created_at", { ascending: false }).limit(20),
      supabase.from("manual_invoices").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
      supabase.from("archive_jobs").select("id", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", new Date(Date.now() - 30 * 86400_000).toISOString()),
    ]);
    setRecentJobs(jobs.data ?? []);
    setStats({
      pendingInvoices: pending.count ?? 0,
      runningJobs: (jobs.data ?? []).filter((j) => j.status === "running" || j.status === "queued").length,
      archived30d: archived.count ?? 0,
    });
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const trigger = async (fn: "archive-sweep" | "egress-sweep") => {
    setRunning(fn);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body: {} });
      if (error) throw error;
      toast.success(`${fn} ran`, { description: JSON.stringify(data).slice(0, 160) });
      await loadOverview();
    } catch (e: any) {
      toast.error(`${fn} failed`, { description: e?.message ?? String(e) });
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container max-w-7xl mx-auto p-4 flex items-center gap-4">
          <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Admin
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Operations</h1>
            <p className="text-xs text-muted-foreground">OCI lifecycle, egress invoicing, and entitlement controls.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={loadOverview}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto p-4 space-y-6">
        {/* Overview tiles */}
        <div className="grid md:grid-cols-3 gap-4">
          <StatTile icon={<FileText className="w-4 h-4" />} label="Invoices pending review" value={stats.pendingInvoices} />
          <StatTile icon={<Activity className="w-4 h-4" />} label="Archive jobs in flight" value={stats.runningJobs} />
          <StatTile icon={<Users className="w-4 h-4" />} label="Files archived (30d)" value={stats.archived30d} />
        </div>

        {/* Sweep controls */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="font-semibold text-sm">Lifecycle sweeps</div>
              <div className="text-xs text-muted-foreground">
                Run manually — both are also scheduled via pg_cron (daily archive, monthly egress).
              </div>
            </div>
            <Button size="sm" onClick={() => trigger("archive-sweep")} disabled={running !== null}>
              {running === "archive-sweep" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <PlayCircle className="w-4 h-4 mr-1" />}
              Run archive sweep
            </Button>
            <Button size="sm" variant="secondary" onClick={() => trigger("egress-sweep")} disabled={running !== null}>
              {running === "egress-sweep" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <PlayCircle className="w-4 h-4 mr-1" />}
              Stage egress invoices
            </Button>
          </div>
        </Card>

        <Tabs defaultValue="invoices" className="w-full">
          <TabsList>
            <TabsTrigger value="invoices">Manual invoice queue</TabsTrigger>
            <TabsTrigger value="entitlements">Entitlement explorer</TabsTrigger>
            <TabsTrigger value="jobs">Recent archive jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="mt-4">
            <ManualInvoiceConsole />
          </TabsContent>

          <TabsContent value="entitlements" className="mt-4">
            <EntitlementExplorer />
          </TabsContent>

          <TabsContent value="jobs" className="mt-4">
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-3">Created</th>
                    <th className="p-3">Source → Target</th>
                    <th className="p-3">Bytes</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No jobs yet.</td></tr>
                  ) : recentJobs.map((j) => (
                    <tr key={j.id} className="border-t">
                      <td className="p-3 font-mono text-xs">{new Date(j.created_at).toLocaleString()}</td>
                      <td className="p-3">{j.source_tier ?? "—"} → {j.target_tier ?? "—"}</td>
                      <td className="p-3 font-mono text-xs">{j.total_bytes ?? 0}</td>
                      <td className="p-3"><Badge variant={j.status === "completed" ? "default" : j.status === "failed" ? "destructive" : "secondary"}>{j.status}</Badge></td>
                      <td className="p-3 text-xs text-muted-foreground truncate max-w-[280px]">{j.error_message ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{icon}{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </Card>
  );
}
