import StorageLive from "@/components/creator/StorageLive";
import Buy1TBCard from "@/components/shared/Buy1TBCard";

/**
 * Storage — dedicated page answering one question: how much space am I using?
 * Reuses the existing StorageLive panel (real capacity/usage from entitlements)
 * and the shared Buy1TBCard for one-click top-ups. No new backend logic.
 */
export default function StorageSection() {
  return (
    <div className="space-y-6">
      <StorageLive />
      <Buy1TBCard variant="compact" />
    </div>
  );
}
