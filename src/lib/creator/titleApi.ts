// Thin API layer for the Creator Dashboard.
// All Oracle / Razorpay / Auth subsystems remain untouched — this only
// orchestrates inserts into content_titles, title_assets, and admin_audit_log.

import { supabase } from "@/integrations/supabase/client";
import {
  uploadFileMultipart,
  MULTIPART_THRESHOLD,
} from "@/lib/ociMultipartUpload";
import {
  ASSET_CATEGORIES,
  type AssetCategory,
  type TitleMetadata,
  emptyMetadata,
  TitleMetadataSchema,
  REQUIRES_CENSOR,
} from "./titleSchema";

export type ContentStatus =
  | "draft"
  | "incomplete"
  | "submitted"
  | "in_review"
  | "qc_review"
  | "legal_review"
  | "changes_requested"
  | "approved"
  | "ready_for_distribution"
  | "rejected"
  | "hold"
  | "published"
  | "archived";

export type TitleTimelineEntry = {
  id: string;
  from_status: ContentStatus | null;
  to_status: ContentStatus;
  note: string | null;
  created_at: string;
  actor_user_id: string | null;
};

export async function fetchTitleTimeline(titleId: string): Promise<TitleTimelineEntry[]> {
  const { data, error } = await (supabase as any)
    .from("content_approvals")
    .select("id,from_status,to_status,note,created_at,actor_user_id")
    .eq("title_id", titleId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as TitleTimelineEntry[];
}

export type TitleRow = {
  id: string;
  owner_user_id: string;
  workspace_id: string | null;
  title: string;
  synopsis: string | null;
  language: string | null;
  genre: string | null;
  duration_minutes: number | null;
  status: ContentStatus;
  locked: boolean;
  locked_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  metadata: TitleMetadata;
  created_at: string;
  updated_at: string;
};

export type TitleAsset = {
  id: string;
  title_id: string;
  upload_id: string;
  category: AssetCategory;
  is_primary: boolean;
  created_at: string;
  upload: {
    id: string;
    file_name: string;
    file_size: number;
    mime_type: string | null;
    status: string;
    object_key: string;
    created_at: string;
  } | null;
};

function parseMetadata(raw: unknown): TitleMetadata {
  const safe = TitleMetadataSchema.safeParse(raw ?? {});
  return safe.success ? safe.data : emptyMetadata();
}

export async function listTitles(userId: string): Promise<TitleRow[]> {
  const { data, error } = await (supabase as any)
    .from("content_titles")
    .select("*")
    .eq("owner_user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, metadata: parseMetadata(r.metadata) }));
}

export async function getTitle(id: string): Promise<TitleRow | null> {
  const { data, error } = await (supabase as any)
    .from("content_titles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, metadata: parseMetadata(data.metadata) };
}

export async function createTitle(
  userId: string,
  workspaceId: string | null,
  name: string,
  format: TitleMetadata["format"] = "feature_film",
): Promise<TitleRow> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Title name is required");
  const meta = { ...emptyMetadata(), format };
  const { data, error } = await (supabase as any)
    .from("content_titles")
    .insert({
      owner_user_id: userId,
      workspace_id: workspaceId,
      title: trimmed,
      status: "draft",
      locked: false,
      metadata: meta,
    })
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, metadata: parseMetadata(data.metadata) };
}

export type FreeTierStatus = {
  is_free: boolean;
  draft_count: number;
  lifecycle_count: number;
  max_drafts: number | null;
  max_submissions: number | null;
  can_create_draft: boolean;
  can_submit: boolean;
};

export async function fetchFreeTierStatus(): Promise<FreeTierStatus | null> {
  const { data, error } = await (supabase as any).rpc("creator_free_tier_status");
  if (error || !data) return null;
  return data as FreeTierStatus;
}

/** Find the user's first active draft (free-tier reuse path). */
export async function findFirstActiveDraft(userId: string): Promise<TitleRow | null> {
  const { data, error } = await (supabase as any)
    .from("content_titles")
    .select("*")
    .eq("owner_user_id", userId)
    .in("status", ["draft", "incomplete", "changes_requested"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { ...data, metadata: parseMetadata(data.metadata) };
}

export async function saveTitleMetadata(
  id: string,
  patch: { title?: string; metadata: TitleMetadata },
): Promise<void> {
  const safe = TitleMetadataSchema.parse(patch.metadata);
  const update: Record<string, unknown> = {
    metadata: safe,
    synopsis: safe.synopsis || null,
    genre: safe.genres[0] ?? null,
    duration_minutes: safe.runtime_minutes || null,
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw new Error("Title name cannot be empty");
    update.title = t;
  }
  const { error } = await (supabase as any).from("content_titles").update(update).eq("id", id);
  if (error) throw error;
}

export async function listAssets(titleId: string): Promise<TitleAsset[]> {
  const { data, error } = await (supabase as any)
    .from("title_assets")
    .select("*, upload:recent_uploads(id,file_name,file_size,mime_type,status,object_key,created_at)")
    .eq("title_id", titleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Audit-log helper — best-effort, never throws. */
async function audit(action: string, details: Record<string, unknown>) {
  try {
    const { data: u } = await supabase.auth.getUser();
    await (supabase as any).from("admin_audit_log").insert({
      admin_user_id: u.user?.id ?? null,
      admin_email: u.user?.email ?? null,
      target_user_id: u.user?.id ?? null,
      target_email: u.user?.email ?? null,
      action,
      details,
    });
  } catch { /* non-fatal */ }
}

export class UploadValidationError extends Error {
  constructor(public step: string, cause?: unknown) {
    super(
      `Upload Failed — ${step}` +
      (cause instanceof Error ? `: ${cause.message}` : ""),
    );
    this.name = "UploadValidationError";
  }
}

export type UploadAssetParams = {
  file: File;
  category: AssetCategory;
  titleId: string;
  workspaceId: string;
  onProgress?: (loaded: number, total: number) => void;
  onTelemetry?: (t: import("@/lib/ociMultipartUpload").UploadTelemetry) => void;
  signal?: AbortSignal;
};

/**
 * Upload a single title asset.
 *
 * Validates the full chain:
 *  1. Oracle Object Storage object created
 *  2. Oracle Database (recent_uploads) row created
 *  3. title_assets row created
 *  4. audit log row written
 *  5. storage usage refreshed
 *
 * Any failure throws an `UploadValidationError` — the caller surfaces
 * "Upload Failed" to the user.
 */
export async function uploadTitleAsset(p: UploadAssetParams): Promise<TitleAsset> {
  const pendingId = `${p.titleId}-${p.category}-${p.file.name}-${p.file.size}-${Date.now()}`;

  // (1) + (2): OCI object + recent_uploads row.
  // The server derives the OCI prefix from titleId + category — we no longer
  // pass a client `subpath`. See oci-multipart CATEGORY_PREFIX.
  let uploadRow: { id: string; file_name: string; status: string } | null = null;
  try {
    if (p.file.size < MULTIPART_THRESHOLD) {
      // Single-shot path: oci-upload edge function (kept untouched).
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const fd = new FormData();
      fd.append("file", p.file);
      fd.append("workspaceId", p.workspaceId);
      fd.append("pendingId", pendingId);
      fd.append("titleId", p.titleId);
      fd.append("category", p.category);
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/oci-upload`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
        signal: p.signal,
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.upload?.id) {
        throw new Error(json?.error || `oci-upload ${resp.status}`);
      }
      uploadRow = json.upload;
      p.onProgress?.(p.file.size, p.file.size);
    } else {
      const res = await uploadFileMultipart({
        file: p.file,
        workspaceId: p.workspaceId,
        pendingId,
        titleId: p.titleId,
        category: p.category,
        onProgress: p.onProgress,
        onTelemetry: p.onTelemetry,
        signal: p.signal,
      });
      uploadRow = res.upload;
    }
  } catch (e) {
    throw new UploadValidationError("Oracle Object Storage upload", e);
  }
  if (!uploadRow?.id) {
    throw new UploadValidationError("Oracle Database record missing");
  }

  // Verify (2) — confirm the recent_uploads row is queryable & completed.
  const { data: verify, error: verifyErr } = await (supabase as any)
    .from("recent_uploads")
    .select("id,status,file_size,user_id")
    .eq("id", uploadRow.id)
    .maybeSingle();
  if (verifyErr || !verify) throw new UploadValidationError("Oracle Database record missing", verifyErr);
  if (verify.status && !["completed", "ready", "done", "uploaded"].includes(String(verify.status))) {
    // Don't block — multipart marks as completed; single-shot may use 'ready'.
    // Only fail if there's an explicit error state.
    if (String(verify.status) === "error" || String(verify.status) === "failed") {
      throw new UploadValidationError(`Oracle Database record in state '${verify.status}'`);
    }
  }

  // (3) title_assets row — use server RPC for atomic ownership/lock/Oracle validation + audit.
  const { data: newAssetId, error: linkErr } = await (supabase as any).rpc(
    "complete_title_asset_upload",
    {
      _title_id: p.titleId,
      _upload_id: uploadRow.id,
      _category: p.category,
      _is_primary: true,
    },
  );
  if (linkErr || !newAssetId) {
    throw new UploadValidationError("title_assets link row", linkErr);
  }

  // (5) storage usage refresh — recent_uploads inserts are already counted
  // by the existing storage triggers; we verify by re-reading the user's
  // storage total. A throw here means the storage subsystem is unreachable.
  const { error: usageErr } = await (supabase as any)
    .from("recent_uploads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", verify.user_id);
  if (usageErr) throw new UploadValidationError("Storage usage refresh", usageErr);

  return {
    id: String(newAssetId),
    title_id: p.titleId,
    upload_id: uploadRow.id,
    category: p.category,
    is_primary: true,
    created_at: new Date().toISOString(),
    upload: uploadRow as any,
  };
}

export type SubmitChecklist = {
  hasTitle: boolean;
  hasSynopsis: boolean;
  hasFilm: boolean;
  hasTrailer: boolean;
  hasPoster: boolean;
  hasCensor: boolean;
  hasOwnership: boolean;
  censorRequired: boolean;
  ready: boolean;
  missing: string[];
};

const MVP_PRIMARY = (assets: TitleAsset[], names: string[]) =>
  assets.some((a) => names.includes(a.category) && a.is_primary);

/** Client-side mirror of title_submission_readiness(). Server is the source of truth. */
export function evaluateChecklist(title: TitleRow, assets: TitleAsset[]): SubmitChecklist {
  const censorRequired = REQUIRES_CENSOR.includes(title.metadata.format);
  const c: SubmitChecklist = {
    hasTitle: !!title.title.trim(),
    hasSynopsis: !!title.metadata.synopsis.trim(),
    hasFilm: MVP_PRIMARY(assets, ["feature_film"]),
    hasTrailer: MVP_PRIMARY(assets, ["trailer"]),
    hasPoster: MVP_PRIMARY(assets, ["poster"]),
    hasCensor: !censorRequired || MVP_PRIMARY(assets, ["censor_certificate", "censor_cert"]),
    hasOwnership: MVP_PRIMARY(assets, ["ownership_documents", "ownership"]),
    censorRequired,
    ready: false,
    missing: [],
  };
  if (!c.hasTitle) c.missing.push("Title name");
  if (!c.hasSynopsis) c.missing.push("Synopsis");
  if (!c.hasFilm) c.missing.push("Feature Film");
  if (!c.hasTrailer) c.missing.push("Trailer");
  if (!c.hasPoster) c.missing.push("Poster");
  if (!c.hasCensor) c.missing.push("Censor Certificate");
  if (!c.hasOwnership) c.missing.push("Ownership Documents");
  c.ready = c.missing.length === 0;
  return c;
}

export type ServerReadiness = {
  ready: boolean;
  missing: string[];
  has: Record<string, boolean>;
};

/** Live submission checklist from the server (title_submission_readiness). */
export async function fetchReadiness(titleId: string): Promise<ServerReadiness | null> {
  const { data, error } = await (supabase as any).rpc("title_submission_readiness", { _title_id: titleId });
  if (error) return null;
  if (!data) return null;
  return {
    ready: !!data.ready,
    missing: Array.isArray(data.missing) ? data.missing : [],
    has: (data.has ?? {}) as Record<string, boolean>,
  };
}

export async function submitTitle(id: string, note?: string): Promise<void> {
  const { error } = await (supabase as any).rpc("submit_title_to_admin", {
    _title_id: id,
    _note: note ?? null,
  });
  if (error) throw new Error(error.message ?? "Submit failed");
}

export { ASSET_CATEGORIES };
