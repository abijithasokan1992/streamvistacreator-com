import StorageLive from "@/components/creator/StorageLive";
import Buy1TBCard from "@/components/shared/Buy1TBCard";

/**
 * WorkspaceStorageCard — full storage module for the workspace overview.
 * Reuses the existing StorageLive (compact) capacity/usage panel driven by
 * `workspace_storage_entitlements` + `workspace_storage_usage`, and the
 * shared Buy1TBCard for one-click 1 TB top-ups.
 */
export default function WorkspaceStorageCard() {
  return (
    <div className="space-y-4">
      <StorageLive compact />
      <Buy1TBCard variant="compact" />
    </div>
  );
}
