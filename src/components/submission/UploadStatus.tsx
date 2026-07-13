import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, AlertTriangle, Upload } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type UploadStatusValue = "idle" | "uploading" | "verifying" | "complete" | "failed";

interface Props {
  status: UploadStatusValue;
  /** 0..100 */
  percent?: number;
  fileName?: string;
  bytesUploaded?: number;
  bytesTotal?: number;
  errorMessage?: string;
  className?: string;
}

function formatBytes(n?: number): string {
  if (!n) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v.toFixed(v >= 10 || u === 0 ? 0 : 1)} ${units[u]}`;
}

/**
 * Deterministic upload status card. No AI.
 * Consumers pass raw progress; this only renders.
 */
export function UploadStatus({
  status,
  percent = 0,
  fileName,
  bytesUploaded,
  bytesTotal,
  errorMessage,
  className,
}: Props) {
  const { t } = useTranslation();
  const label = {
    idle: t("submission.upload.idle", "Ready to upload"),
    uploading: t("submission.upload.uploading", "Uploading…"),
    verifying: t("submission.upload.verifying", "Verifying file…"),
    complete: t("submission.upload.complete", "Upload complete"),
    failed: t("submission.upload.failed", "Upload failed"),
  }[status];

  const Icon = {
    idle: Upload,
    uploading: Loader2,
    verifying: Loader2,
    complete: CheckCircle2,
    failed: AlertTriangle,
  }[status];

  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm",
        status === "complete" && "border-emerald-500/40 bg-emerald-500/5",
        status === "failed" && "border-destructive/50 bg-destructive/5",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4",
            (status === "uploading" || status === "verifying") && "animate-spin",
            status === "complete" && "text-emerald-500",
            status === "failed" && "text-destructive",
          )}
          aria-hidden
        />
        <span className="font-medium">{label}</span>
        {fileName && (
          <span className="ml-auto truncate text-xs text-muted-foreground">{fileName}</span>
        )}
      </div>
      {(status === "uploading" || status === "verifying") && (
        <div className="mt-2 space-y-1">
          <Progress value={percent} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{percent}%</span>
            {bytesTotal !== undefined && (
              <span>
                {formatBytes(bytesUploaded)} / {formatBytes(bytesTotal)}
              </span>
            )}
          </div>
        </div>
      )}
      {status === "failed" && errorMessage && (
        <p className="mt-2 text-xs text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}
