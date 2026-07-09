/**
 * Distribution Hub client API.
 *
 * Thin wrappers over the existing Supabase client. Reuses existing tables
 * (content_titles, title_media_versions, title_assets, title_localizations,
 * workspace storage) — the packaging engine only *references* those rows;
 * no bytes are re-uploaded here.
 */
import { supabase } from "@/integrations/supabase/client";
import { newCorrelationId, correlationHeaders } from "@/lib/correlation";

export type DistributionProtocol =
  | "api" | "ftp" | "sftp" | "aspera" | "signiant" | "s3" | "http_webhook";

export interface DistributionPartner {
  id: string;
  slug: string;
  name: string;
  protocol: DistributionProtocol;
  description: string | null;
  contact_email: string | null;
  is_active: boolean;
  requires_aspera: boolean;
  requires_signiant: boolean;
  config: Record<string, unknown>;
  default_package_type: string;
  supported_package_types: string[];
  delivery_window: Record<string, unknown> | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DistributionPackage {
  id: string;
  title_id: string;
  workspace_id: string | null;
  owner_user_id: string;
  package_type: string;
  status: "draft" | "building" | "ready" | "archived" | "failed";
  included_media_version_ids: string[];
  included_asset_ids: string[];
  included_localization_ids: string[];
  manifest: Record<string, unknown>;
  size_bytes: number;
  checksum: string | null;
  build_error: string | null;
  built_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DistributionQueueItem {
  id: string;
  package_id: string;
  partner_id: string;
  title_id: string;
  status: "queued" | "dispatching" | "delivered" | "failed" | "cancelled" | "retrying";
  priority: number;
  attempts: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  last_error_code: string | null;
  correlation_id: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DistributionDelivery {
  id: string;
  queue_id: string;
  package_id: string;
  partner_id: string;
  title_id: string;
  attempt_no: number;
  protocol: DistributionProtocol;
  status: "pending" | "in_progress" | "ok" | "failed";
  transport_response: Record<string, unknown>;
  ack_reference: string | null;
  bytes_transferred: number;
  duration_ms: number | null;
  correlation_id: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DistributionDeliveryLog {
  id: string;
  delivery_id: string | null;
  queue_id: string | null;
  title_id: string | null;
  level: "info" | "warn" | "error";
  stage: string;
  message: string;
  payload: Record<string, unknown>;
  correlation_id: string | null;
  created_at: string;
}

const T = (t: string) => (supabase as any).from(t);

/* ---------------- Partners ---------------- */
export async function listPartners(): Promise<DistributionPartner[]> {
  const { data } = await T("distribution_partners")
    .select("*").order("name", { ascending: true });
  return (data ?? []) as DistributionPartner[];
}

export async function upsertPartner(p: Partial<DistributionPartner>): Promise<DistributionPartner | null> {
  const { data } = await T("distribution_partners").upsert(p).select("*").maybeSingle();
  return data as DistributionPartner | null;
}

/* ---------------- Metadata mappings ---------------- */
export async function listPartnerMappings(partnerId: string) {
  const { data } = await T("distribution_metadata_mappings")
    .select("*").eq("partner_id", partnerId).order("target_field", { ascending: true });
  return data ?? [];
}
export async function upsertMapping(row: any) {
  const { data } = await T("distribution_metadata_mappings").upsert(row).select("*").maybeSingle();
  return data;
}
export async function deleteMapping(id: string) {
  await T("distribution_metadata_mappings").delete().eq("id", id);
}

/* ---------------- Packages ---------------- */
export async function listPackagesForTitle(titleId: string): Promise<DistributionPackage[]> {
  const { data } = await T("distribution_packages")
    .select("*").eq("title_id", titleId).order("created_at", { ascending: false });
  return (data ?? []) as DistributionPackage[];
}

export async function createPackage(input: {
  title_id: string;
  workspace_id?: string | null;
  package_type: string;
  included_media_version_ids?: string[];
  included_asset_ids?: string[];
  included_localization_ids?: string[];
}): Promise<DistributionPackage | null> {
  const { data } = await T("distribution_packages").insert(input).select("*").maybeSingle();
  return data as DistributionPackage | null;
}

/**
 * Packaging Engine (client-side manifest build).
 *
 * Assembles a manifest document by pulling metadata from EXISTING tables:
 *   - content_titles         → title-level metadata
 *   - title_media_versions   → technical specs (codec, container, HDR, etc.)
 *   - title_assets           → posters, subtitles, docs
 *   - title_localizations    → dubs, subs, localized meta
 *
 * The manifest is stored on distribution_packages.manifest. The actual
 * bytes remain in OCI Object Storage — no re-upload.
 */
export async function buildPackageManifest(pkgId: string): Promise<DistributionPackage | null> {
  const { data: pkg } = await T("distribution_packages").select("*").eq("id", pkgId).maybeSingle();
  if (!pkg) return null;

  const [{ data: title }, { data: versions }, { data: assets }, { data: locs }] = await Promise.all([
    T("content_titles").select("*").eq("id", pkg.title_id).maybeSingle(),
    T("title_media_versions").select("*").in("id", pkg.included_media_version_ids?.length ? pkg.included_media_version_ids : ["00000000-0000-0000-0000-000000000000"]),
    T("title_assets").select("*").in("id", pkg.included_asset_ids?.length ? pkg.included_asset_ids : ["00000000-0000-0000-0000-000000000000"]),
    T("title_localizations").select("*").in("id", pkg.included_localization_ids?.length ? pkg.included_localization_ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const totalBytes = (versions ?? []).reduce((s: number, v: any) => s + Number(v?.size_bytes ?? 0), 0)
                   + (assets ?? []).reduce((s: number, a: any) => s + Number(a?.size_bytes ?? 0), 0);

  const manifest = {
    version: 1,
    package_type: pkg.package_type,
    generated_at: new Date().toISOString(),
    title: title
      ? {
          id: title.id,
          title: (title as any).title ?? (title as any).name,
          kind: (title as any).kind ?? "film",
          synopsis: (title as any).synopsis ?? null,
          runtime_min: (title as any).runtime_min ?? null,
          genres: (title as any).genres ?? [],
        }
      : null,
    media_versions: (versions ?? []).map((v: any) => ({
      id: v.id, kind: v.kind, codec: v.codec, container: v.container,
      frame_rate: v.frame_rate, aspect_ratio: v.aspect_ratio, bitrate: v.bitrate,
      audio_layout: v.audio_layout, hdr_metadata: v.hdr_metadata, imf_metadata: v.imf_metadata,
      object_key: v.object_key ?? null, size_bytes: v.size_bytes ?? 0,
    })),
    assets: (assets ?? []).map((a: any) => ({
      id: a.id, kind: a.kind, object_key: a.object_key, size_bytes: a.size_bytes,
    })),
    localizations: (locs ?? []).map((l: any) => ({
      id: l.id, language: l.language, kind: l.kind, object_key: l.object_key,
    })),
  };

  const { data } = await T("distribution_packages")
    .update({
      manifest,
      status: "ready",
      built_at: new Date().toISOString(),
      size_bytes: totalBytes,
      build_error: null,
    })
    .eq("id", pkgId)
    .select("*")
    .maybeSingle();
  return data as DistributionPackage | null;
}

/* ---------------- Queue ---------------- */
export async function listQueueForTitle(titleId: string): Promise<DistributionQueueItem[]> {
  const { data } = await T("distribution_queue")
    .select("*").eq("title_id", titleId).order("created_at", { ascending: false });
  return (data ?? []) as DistributionQueueItem[];
}

export async function enqueueDelivery(input: {
  package_id: string; partner_id: string; title_id: string; priority?: number;
}): Promise<DistributionQueueItem | null> {
  const correlation_id = newCorrelationId();
  const { data } = await T("distribution_queue")
    .insert({ ...input, correlation_id, status: "queued" })
    .select("*").maybeSingle();
  return data as DistributionQueueItem | null;
}

export async function cancelQueueItem(id: string) {
  await T("distribution_queue").update({ status: "cancelled" }).eq("id", id);
}

/* ---------------- Retry ---------------- */
export async function retryFailedDeliveries(titleId?: string): Promise<number> {
  const { data } = await (supabase as any).rpc("retry_failed_distribution_deliveries", {
    _title_id: titleId ?? null,
  });
  return (data as number) ?? 0;
}

/* ---------------- Deliveries + Logs ---------------- */
export async function listDeliveriesForTitle(titleId: string): Promise<DistributionDelivery[]> {
  const { data } = await T("distribution_deliveries")
    .select("*").eq("title_id", titleId).order("created_at", { ascending: false });
  return (data ?? []) as DistributionDelivery[];
}

export async function listDeliveryLogs(deliveryId: string): Promise<DistributionDeliveryLog[]> {
  const { data } = await T("distribution_delivery_logs")
    .select("*").eq("delivery_id", deliveryId).order("created_at", { ascending: true });
  return (data ?? []) as DistributionDeliveryLog[];
}

/* ---------------- Dispatch (edge function) ---------------- */
export async function dispatchQueue(queueId: string, correlationId?: string) {
  const cid = correlationId ?? newCorrelationId();
  return supabase.functions.invoke("distribution-dispatch", {
    body: { queue_id: queueId, correlation_id: cid },
    headers: correlationHeaders(cid),
  });
}
