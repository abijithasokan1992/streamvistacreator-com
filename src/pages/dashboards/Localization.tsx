import RoleDashboardShell, { EmptyState } from "./RoleDashboardShell";

export default function LocalizationDashboard() {
  return (
    <RoleDashboardShell
      expectedRole="localization_partner"
      title="Localization Partner"
      subtitle="Subtitle and dub tasks assigned to your team."
    >
      <EmptyState
        title="No assignments yet"
        body="Tasks assigned by content owners or admins will appear here. Localization is invite-only access."
      />
    </RoleDashboardShell>
  );
}
