/**
 * Studio → Settings → Advanced → Ingest Diagnostics
 *
 * Thin route wrapper that renders the existing IngestDiagnosticsPanel
 * (which internally embeds IngestAlertsManager). No functional changes —
 * the panel was previously rendered inline at the bottom of StudioIngest.
 */
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import IngestDiagnosticsPanel from "@/components/studio/ingest/IngestDiagnosticsPanel";
import RoleDashboardShell from "./RoleDashboardShell";

export default function StudioAdvancedSettings() {
  const { activeId } = useWorkspaces();
  return (
    <RoleDashboardShell
      expectedRole="studio"
      title="Advanced Settings"
      subtitle="Ingest Diagnostics · Transfer Health · Source Health"
    >
      <div className="mb-4">
        <Link
          to="/dashboard/studio"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Production Control Center
        </Link>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-mono">
            Settings › Advanced
          </p>
          <h2 className="font-display text-2xl mt-1">Ingest Diagnostics</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Engine connection, transfer health, per-source status, and alert rules
            for your workspace. Diagnostic-only — the ingest pipeline itself lives
            in the DIT Workspace.
          </p>
        </div>
        <IngestDiagnosticsPanel workspaceId={activeId ?? null} />
      </div>
    </RoleDashboardShell>
  );
}
