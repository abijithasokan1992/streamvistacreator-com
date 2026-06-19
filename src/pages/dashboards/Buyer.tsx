import RoleDashboardShell, { EmptyState } from "./RoleDashboardShell";

export default function BuyerDashboard() {
  return (
    <RoleDashboardShell
      expectedRole="buyer"
      title="Buyer"
      subtitle="Browse the published catalogue and submit acquisition requests to content owners."
    >
      <EmptyState
        title="No licensed titles yet"
        body="The published catalogue and the acquisition-request flow go live in the next phase."
      />
    </RoleDashboardShell>
  );
}
