import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { listManagedProjects, type ManagedProjectRow } from "@/lib/managed/managedProjectsApi";
import EmergencyAccessDialog from "@/components/admin/managed/EmergencyAccessDialog";

/**
 * StreamVista Operations workspace — "Managed Projects".
 * Staff work here instead of logging into customer accounts. Every write
 * on a managed title is stamped with the operator's identity in the audit log.
 */
export default function ManagedProjectsPage() {
  const { user, role, loading } = useAuth();
  const [rows, setRows] = useState<ManagedProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emergencyFor, setEmergencyFor] = useState<string | null>(null);

  const canAccess = useMemo(
    () => role === "admin" || role === "super_admin" || role === "managed_ops_lead" || role === "managed_ops_operator",
    [role],
  );

  useEffect(() => {
    if (!user || !canAccess) return;
    (async () => {
      try { setRows(await listManagedProjects()); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    })();
  }, [user?.id, canAccess]);

  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background text-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </main>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!canAccess) return <Navigate to="/admin/home" replace />;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/40 sticky top-0 z-30 bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm font-semibold tracking-tight">StreamVista</Link>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Operations</span>
          </div>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Admin
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">Operations workspace</p>
        <h1 className="font-display text-2xl md:text-3xl mt-2">Managed Projects</h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
          Every action you perform here is stamped with your operator identity in the audit trail.
          Customer ownership never changes.
        </p>

        <div className="mt-6 rounded-2xl border border-border/50 bg-secondary/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/20">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
              )}
              {error && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-destructive text-xs">{error}</td></tr>
              )}
              {rows?.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-xs">No managed projects yet.</td></tr>
              )}
              {rows?.map((r) => (
                <tr key={r.content_title_id} className="border-t border-border/40">
                  <td className="px-4 py-3 font-mono text-xs">{r.owner_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.content_title_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.assigned_operator?.slice(0, 8) ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="h-1.5 w-24 rounded-full bg-secondary/40 overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${r.progress_pct}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3">{r.priority}</td>
                  <td className="px-4 py-3">{r.due_date ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/dashboard/content?section=titles&title=${r.content_title_id}`}
                      className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      Open <ExternalLink className="w-3 h-3" />
                    </Link>
                    {(role === "admin" || role === "super_admin") && (
                      <button
                        onClick={() => setEmergencyFor(r.content_title_id)}
                        className="ml-3 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Emergency access
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {emergencyFor && (
        <EmergencyAccessDialog
          open={!!emergencyFor}
          onOpenChange={(v) => !v && setEmergencyFor(null)}
          contentTitleId={emergencyFor}
        />
      )}
    </main>
  );
}
