// Media CMS data helpers — reuses the shared Supabase client and existing RLS.
// All tables here were added additively to the title workspace; there is no
// bespoke server code.
import { supabase } from "@/integrations/supabase/client";

export type TitleKind = "film" | "series" | "season" | "episode" | "collection_entry";
export type MediaVersionType =
  | "master" | "broadcast" | "ott" | "hdr" | "sdr"
  | "proxy" | "trailer" | "screener" | "clip";
export type LocalizationKind =
  | "audio_track" | "subtitle" | "closed_caption" | "dub" | "localized_metadata";
export type AvailabilityStatus = "draft" | "scheduled" | "available" | "expired" | "withdrawn";
export type DistributionReadiness = "not_ready" | "in_prep" | "ready" | "blocked";
export type PublishApproval = "pending" | "approved" | "rejected" | "changes_requested";
export type DeliveryStatus = "not_started" | "queued" | "in_progress" | "delivered" | "failed";

export const MEDIA_VERSION_LABELS: Record<MediaVersionType, string> = {
  master: "Master", broadcast: "Broadcast", ott: "OTT", hdr: "HDR", sdr: "SDR",
  proxy: "Proxy", trailer: "Trailer", screener: "Screener", clip: "Clip",
};
export const LOCALIZATION_LABELS: Record<LocalizationKind, string> = {
  audio_track: "Audio Track", subtitle: "Subtitle", closed_caption: "Closed Caption",
  dub: "Dub Version", localized_metadata: "Localized Metadata",
};

export type Franchise = {
  id: string; name: string; description: string | null;
  owner_user_id: string; workspace_id: string | null; created_at: string;
};
export type Collection = {
  id: string; name: string; description: string | null;
  owner_user_id: string; workspace_id: string | null; created_at: string;
};
export type CollectionItem = {
  id: string; collection_id: string; title_id: string; sort_order: number; note: string | null;
};
export type MediaVersion = {
  id: string; title_id: string; version_type: MediaVersionType; label: string | null;
  source_asset_id: string | null; codec: string | null; container: string | null;
  frame_rate: number | null; aspect_ratio: string | null; bitrate_kbps: number | null;
  audio_layout: string | null; loudness_lufs: number | null;
  hdr_metadata: Record<string, any>; imf_metadata: Record<string, any>;
  tech_metadata: Record<string, any>; notes: string | null;
  created_at: string; updated_at: string;
};
export type Localization = {
  id: string; title_id: string; kind: LocalizationKind; language: string;
  region: string | null; label: string | null; asset_id: string | null;
  is_default: boolean; payload: Record<string, any>;
  created_at: string; updated_at: string;
};
export type PublishingRecord = {
  title_id: string;
  availability: AvailabilityStatus; distribution: DistributionReadiness;
  approval: PublishApproval; delivery: DeliveryStatus;
  available_from: string | null; available_until: string | null;
  notes: string | null; metadata: Record<string, any>;
  updated_at: string;
};

const sb = supabase as any; // types.ts is regenerated after migration; keep loose until then.

/**
 * Silent-deny guard for Creator writes against lock-gated resources.
 *
 * PostgREST returns HTTP 200 with an empty result set when RLS filters every
 * row out of an UPDATE/DELETE — it does NOT surface a 403. Callers that only
 * check `error` will treat that response as success and show a green toast
 * while the row is unchanged on the server.
 *
 * Every Creator UPDATE/DELETE against a lock-gated table MUST route through
 * this helper: the caller pairs `.update(...)` / `.delete(...)` with
 * `.select("id")` and passes the returned rows here. Zero affected rows
 * raises a NOT_EDITABLE error that the UI must surface as an error toast.
 */
function assertMutationAffectedRows(rows: unknown, entity: string): void {
  if (!Array.isArray(rows) || rows.length === 0) {
    const err = new Error(
      `This ${entity} is locked or you do not have permission to modify it. ` +
      `Refresh the page — an admin may have locked or reassigned this record.`,
    );
    (err as any).code = "NOT_EDITABLE";
    throw err;
  }
}

/* ---------- Hierarchy (series → season → episode) ---------- */
export async function listChildren(parentId: string) {
  const { data, error } = await sb
    .from("content_titles")
    .select("id, title, kind, season_number, episode_number, status, updated_at, sort_order")
    .eq("parent_title_id", parentId)
    .order("season_number", { ascending: true, nullsFirst: true })
    .order("episode_number", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createChildTitle(input: {
  parent_id: string; owner_user_id: string; workspace_id: string | null;
  kind: TitleKind; title: string; season_number?: number | null; episode_number?: number | null;
}) {
  const { data, error } = await sb.from("content_titles").insert({
    owner_user_id: input.owner_user_id,
    workspace_id: input.workspace_id,
    parent_title_id: input.parent_id,
    kind: input.kind,
    title: input.title,
    season_number: input.season_number ?? null,
    episode_number: input.episode_number ?? null,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateTitleHierarchy(id: string, patch: {
  kind?: TitleKind; parent_title_id?: string | null;
  season_number?: number | null; episode_number?: number | null;
  franchise_id?: string | null;
}) {
  const { error } = await sb.from("content_titles").update(patch).eq("id", id);
  if (error) throw error;
}

/* ---------- Franchises ---------- */
export async function listFranchises(userId: string): Promise<Franchise[]> {
  const { data, error } = await sb.from("title_franchises")
    .select("*").eq("owner_user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function createFranchise(userId: string, name: string, description?: string) {
  const { data, error } = await sb.from("title_franchises").insert({
    owner_user_id: userId, name, description: description ?? null,
  }).select("*").single();
  if (error) throw error;
  return data as Franchise;
}
export async function deleteFranchise(id: string) {
  const { error } = await sb.from("title_franchises").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Collections ---------- */
export async function listCollections(userId: string): Promise<Collection[]> {
  const { data, error } = await sb.from("title_collections")
    .select("*").eq("owner_user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function createCollection(userId: string, name: string, description?: string) {
  const { data, error } = await sb.from("title_collections").insert({
    owner_user_id: userId, name, description: description ?? null,
  }).select("*").single();
  if (error) throw error;
  return data as Collection;
}
export async function deleteCollection(id: string) {
  const { error } = await sb.from("title_collections").delete().eq("id", id);
  if (error) throw error;
}
export async function listCollectionItems(collectionId: string) {
  const { data, error } = await sb.from("title_collection_items")
    .select("id, title_id, sort_order, note, title:content_titles(id,title,status)")
    .eq("collection_id", collectionId).order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
export async function addTitleToCollection(collectionId: string, titleId: string, sortOrder = 0) {
  const { error } = await sb.from("title_collection_items")
    .insert({ collection_id: collectionId, title_id: titleId, sort_order: sortOrder });
  if (error) throw error;
}
export async function removeTitleFromCollection(itemId: string) {
  const { error } = await sb.from("title_collection_items").delete().eq("id", itemId);
  if (error) throw error;
}

/* ---------- Media Versions ---------- */
export async function listMediaVersions(titleId: string): Promise<MediaVersion[]> {
  const { data, error } = await sb.from("title_media_versions")
    .select("*").eq("title_id", titleId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MediaVersion[];
}
export async function upsertMediaVersion(row: Partial<MediaVersion> & { title_id: string; version_type: MediaVersionType }) {
  const { error, data } = await sb.from("title_media_versions").upsert(row).select("*").single();
  if (error) throw error;
  return data as MediaVersion;
}
export async function deleteMediaVersion(id: string) {
  const { error } = await sb.from("title_media_versions").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Localizations ---------- */
export async function listLocalizations(titleId: string): Promise<Localization[]> {
  const { data, error } = await sb.from("title_localizations")
    .select("*").eq("title_id", titleId).order("kind", { ascending: true }).order("language", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Localization[];
}
export async function upsertLocalization(row: Partial<Localization> & { title_id: string; kind: LocalizationKind; language: string }) {
  const { error, data } = await sb.from("title_localizations").upsert(row).select("*").single();
  if (error) throw error;
  return data as Localization;
}
export async function deleteLocalization(id: string) {
  const { error } = await sb.from("title_localizations").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Publishing ---------- */
export async function getPublishing(titleId: string): Promise<PublishingRecord | null> {
  const { data, error } = await sb.from("title_publishing")
    .select("*").eq("title_id", titleId).maybeSingle();
  if (error) throw error;
  return data as PublishingRecord | null;
}
export async function upsertPublishing(row: Partial<PublishingRecord> & { title_id: string }) {
  const { data, error } = await sb.from("title_publishing").upsert(row).select("*").single();
  if (error) throw error;
  return data as PublishingRecord;
}

/* ---------- Delivery history (read-only view over distribution_deliveries) ---------- */
export type DeliveryRow = {
  id: string; title_id: string; partner_id: string; protocol: string;
  status: string; attempt_no: number;
  bytes_transferred: number | null; duration_ms: number | null;
  dispatched_at: string | null; delivered_at: string | null; failed_at: string | null;
  error_code: string | null; error_message: string | null;
  partner?: { id: string; name: string; protocol: string } | null;
};
export async function listDeliveriesForTitle(titleId: string): Promise<DeliveryRow[]> {
  const { data, error } = await sb.from("distribution_deliveries")
    .select("id, title_id, partner_id, protocol, status, attempt_no, bytes_transferred, duration_ms, dispatched_at, delivered_at, failed_at, error_code, error_message")
    .eq("title_id", titleId)
    .order("dispatched_at", { ascending: false, nullsFirst: false })
    .limit(25);
  if (error) throw error;
  const rows = (data ?? []) as DeliveryRow[];
  const partnerIds = Array.from(new Set(rows.map((r) => r.partner_id).filter(Boolean)));
  if (partnerIds.length === 0) return rows;
  const { data: partners } = await sb.rpc("list_active_distribution_partners");
  const pmap = new Map(((partners as any[]) ?? []).map((p: any) => [p.id, p]));
  return rows.map((r) => ({ ...r, partner: pmap.get(r.partner_id) ?? null }));
}

/* ---------- Collections membership for a specific title ---------- */
export async function listCollectionsContainingTitle(titleId: string) {
  const { data, error } = await sb.from("title_collection_items")
    .select("id, sort_order, collection:title_collections(id,name,description)")
    .eq("title_id", titleId);
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; sort_order: number; collection: Collection | null }>;
}
