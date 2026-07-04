// Thin client helper that reuses the existing `oracle-proxy` edge function
// (action: "create-par") to mint a short-lived OCI Pre-Authenticated Request
// URL for previewing a single object. No new SDK, no new backend function.
//
// NOTE: `oracle-proxy` currently gates non-internal callers to admin users.
// Non-admin flows should keep using the PAR URLs already minted by the
// upload/ingest pipeline (e.g. `par_url` on `title_assets`) rather than
// calling this helper directly.

import { supabase } from "@/integrations/supabase/client";

export interface SecurePreviewUrlOptions {
  /** OCI bucket name. Defaults to the bucket configured server-side. */
  bucketName?: string;
  /** Full object key, e.g. "users/<uid>/foo.mp4". */
  objectName: string;
  /** Hours until the PAR expires. Defaults to 1. */
  expireHours?: number;
}

/**
 * Generate a short-lived read-only PAR URL for a single object via the
 * existing oracle-proxy edge function.
 */
export async function generateSecurePreviewUrl(
  opts: SecurePreviewUrlOptions,
): Promise<string> {
  const expireHours = opts.expireHours ?? 1;
  const expiresAt = new Date(Date.now() + expireHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase.functions.invoke("oracle-proxy", {
    body: {
      action: "create-par",
      name: `preview-${Date.now()}`,
      objectName: opts.objectName,
      accessType: "ObjectRead",
      expiresAt,
      // bucketName is accepted server-side only if the proxy is extended to
      // read it; today the proxy uses site_config.oracle_bucket. Passed here
      // for forward-compatibility.
      ...(opts.bucketName ? { bucketName: opts.bucketName } : {}),
    },
  });

  if (error) {
    console.error("generateSecurePreviewUrl: invoke failed", error);
    throw new Error("Storage service re-authentication required.");
  }
  if (!data?.ok || !data?.url) {
    console.error("generateSecurePreviewUrl: proxy error", data);
    throw new Error(data?.error || "Failed to mint preview URL.");
  }
  return data.url as string;
}
