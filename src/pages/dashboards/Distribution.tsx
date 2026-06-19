import RoleDashboardShell, { EmptyState } from "./RoleDashboardShell";

export default function DistributionDashboard() {
  return (
    <RoleDashboardShell
      expectedRole="distributor"
      title="Distributor"
      subtitle="Distribution windows, territory rights, and syndication schedules."
    >
      <EmptyState
        title="No distribution windows yet"
        body="Windowing and syndication tooling go live in the next phase. Distributor access is invite-only."
      />
    </RoleDashboardShell>
  );
}
