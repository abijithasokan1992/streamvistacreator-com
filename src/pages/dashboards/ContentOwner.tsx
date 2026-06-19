import RoleDashboardShell, { EmptyState } from "./RoleDashboardShell";

export default function ContentOwnerDashboard() {
  return (
    <RoleDashboardShell
      expectedRole="content_owner"
      title="Content Owner"
      subtitle="Upload titles, manage rights, and route content through the approval lifecycle."
    >
      <EmptyState
        title="No titles yet"
        body="When you add your first title it will appear here. Title management, content lock, and approval queue go live in the next phase."
      />
    </RoleDashboardShell>
  );
}
