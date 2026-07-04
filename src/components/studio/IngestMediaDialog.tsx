/**
 * IngestMediaDialog — the single primary entry to all ingest modes.
 *
 * Reuses <StudioIngest/> (which internally supports Browser Upload,
 * Camera Card, Connected Drive / Camera-to-Cloud, Archive Intake, Bulk).
 * Replaces multiple scattered upload actions with one dialog.
 *
 * Before opening, the parent runs the Validation Gate (see runIngestValidation
 * below). If validation fails with an insufficient-storage reason, the parent
 * routes to the existing BuyVaultDialog and re-opens ingest after purchase.
 * No new upload pipeline, no new business logic.
 */
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import StudioIngest from "./ingest/StudioIngest";

export type ValidationReason =
  | "no_active_production"
  | "no_permission"
  | "no_storage_plan"
  | "insufficient_storage"
  | "workspace_offline"
  | "billing_blocked";

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: ValidationReason; message: string; cta?: "buy_storage" | "choose_production" | "contact_support" };

/**
 * Runs the pre-ingest validation gate against already-fetched state. Keeps
 * the check side-effect-free so the parent decides how to remediate.
 */
export function runIngestValidation(input: {
  workspaceId: string | null;
  activeProjectId: string | null;
  canWrite: boolean;
  totalGb: number;
  usedGb: number;
  storageLocked: boolean;
  minRequiredGb?: number;
}): ValidationResult {
  const minGb = input.minRequiredGb ?? 1;
  if (!input.workspaceId) {
    return { ok: false, reason: "workspace_offline", message: "Select a workspace to begin ingest.", cta: "contact_support" };
  }
  if (!input.activeProjectId) {
    return { ok: false, reason: "no_active_production", message: "Pick an active production first.", cta: "choose_production" };
  }
  if (!input.canWrite) {
    return { ok: false, reason: "no_permission", message: "You have viewer access to this workspace.", cta: "contact_support" };
  }
  if (input.totalGb <= 0) {
    return { ok: false, reason: "no_storage_plan", message: "Activate a storage plan to start uploading.", cta: "buy_storage" };
  }
  if (input.storageLocked || input.totalGb - input.usedGb < minGb) {
    return { ok: false, reason: "insufficient_storage", message: "Storage is full. Add more storage to continue.", cta: "buy_storage" };
  }
  return { ok: true };
}

export default function IngestMediaDialog({
  open, onOpenChange, activeProjectId, ingestDefaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  activeProjectId?: string;
  ingestDefaults?: { cameraBrand?: string; unit?: string };
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ingest Media</DialogTitle>
          <DialogDescription>
            Browser Upload · Camera Card · Camera-to-Cloud · Hard-disk Import · Archive Intake · Bulk Upload
          </DialogDescription>
        </DialogHeader>
        <StudioIngest
          activeProjectId={activeProjectId}
          activeProjectDefaults={ingestDefaults}
        />
      </DialogContent>
    </Dialog>
  );
}
