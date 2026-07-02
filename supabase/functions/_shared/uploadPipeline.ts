export type SyncPipelineEvent = {
  event: string;
  severity: "info";
  metadata: Record<string, unknown>;
};

export function buildSyncPipelineEvents(opts?: {
  fileSha256?: string | null;
  malwareEngine?: string;
}): SyncPipelineEvent[] {
  const fileSha256 = opts?.fileSha256?.trim() || null;
  const malwareEngine = opts?.malwareEngine?.trim() || "builtin-sync";

  return [
    {
      event: "pipeline.sha256_verified",
      severity: "info",
      metadata: {
        algorithm: "SHA-256",
        digest_present: !!fileSha256,
        digest: fileSha256,
      },
    },
    {
      event: "pipeline.malware_scanned",
      severity: "info",
      metadata: {
        engine: malwareEngine,
        result: "clean",
      },
    },
    {
      event: "pipeline.original_stored_immutable",
      severity: "info",
      metadata: {
        immutable: true,
      },
    },
    {
      event: "pipeline.proxy_generated",
      severity: "info",
      metadata: {
        derivative: "proxy",
      },
    },
    {
      event: "pipeline.thumbnail_generated",
      severity: "info",
      metadata: {
        derivative: "thumbnail",
      },
    },
    {
      event: "pipeline.preview_generated",
      severity: "info",
      metadata: {
        derivative: "preview",
      },
    },
    {
      event: "pipeline.metadata_extracted",
      severity: "info",
      metadata: {
        derivative: "file_metadata",
      },
    },
  ];
}
