import RoleDashboardShell, { EmptyState } from "./RoleDashboardShell";

export default function StudioDashboard() {
  return (
    <RoleDashboardShell
      expectedRole="studio"
      title="Studio"
      subtitle="Productions, deliverables, and review links for your team."
    >
      <EmptyState
        title="No active productions"
        body="Production and deliverable workflows are wired in the next phase. Your existing review links remain accessible from their original URLs."
      />
    </RoleDashboardShell>
  );
}
