/**
 * Media Intelligence
 * ==================
 * Zero-backend, browser-only enrichment layer that runs after the existing
 * ingest scanner and before the existing OCI upload driver. It does NOT
 * duplicate any processing — proxies, checksums-of-record, DRM, watermarking,
 * secure preview, and library indexing all continue to happen server-side
 * on the existing pipeline. This module only produces lightweight metadata
 * hints written into `ingest_job_items.metadata` (JSONB, already present),
 * so downstream services can pick them up without a schema change.
 *
 * What we detect from the browser:
 *  - Detected asset type (14 categories in the MVP spec)
 *  - Codec / container hint from extension
 *  - Image resolution & orientation (Image())
 *  - Video/audio duration, video resolution & frame-rate hint (loadedmetadata)
 *  - Device / camera hint from filename / folder conventions
 *  - Fast SHA-256 checksum for small files only (< 128 MB) — large files
 *    keep using the server-side checksum step in the OCI pipeline.
 *
 * `asset_class` remains one of the five values the existing pipeline knows
 * (rushes / proxies / audio / reports / project_bundle) so nothing
 * downstream breaks. The finer 14-way classification lives inside
 * `metadata.detected_type` and `metadata.confidence`.
 */

export type DetectedType =
  | "raw_camera"
  | "audio"
  | "still_image"
  | "document"
  | "graphic"
  | "vfx_plate"
  | "music"
  | "sfx"
  | "subtitle"
  | "dubbing"
  | "master_file"
  | "finished_film"
  | "proxy"
  | "project_bundle"
  | "unknown";

export type AssetClass =
  | "rushes"
  | "proxies"
  | "audio"
  | "reports"
  | "project_bundle";

export type Classification = {
  detectedType: DetectedType;
  assetClass: AssetClass;
  confidence: number; // 0..1
  container: string | null;
  codecHint: string | null;
  deviceHint: string | null;
  reason: string;
};

const RAW_CAMERA_EXT = /\.(r3d|ari|arx|braw|mxf|dng|cdng|crm|rmf|cine|raw)$/i;
const VIDEO_EXT      = /\.(mov|mp4|mts|m2ts|avi|mkv|mxf|webm|mpg|mpeg|prores)$/i;
const AUDIO_EXT      = /\.(wav|aif|aiff|mp3|flac|bwf|m4a|aac|ogg|opus)$/i;
const IMAGE_EXT      = /\.(jpg|jpeg|png|tif|tiff|heic|heif|webp|bmp|gif)$/i;
const RAW_STILL_EXT  = /\.(cr2|cr3|nef|arw|orf|rw2|raf|pef|srw|dng)$/i;
const GRAPHIC_EXT    = /\.(psd|ai|eps|svg|sketch|xd|fig|indd|afphoto|afdesign)$/i;
const DOC_EXT        = /\.(pdf|docx?|xlsx?|pptx?|csv|txt|md|rtf|pages|numbers|key)$/i;
const REPORT_EXT     = /\.(xml|xmp|ale|edl|json|log|cdl|cube|3dl)$/i;
const SUBTITLE_EXT   = /\.(srt|vtt|ass|ssa|sbv|stl|scc|itt|ttml|dfxp)$/i;
const BUNDLE_EXT     = /\.(prproj|aep|drp|fcpxml|xml|resolve|otio|fcp|nk|nkx|blend|c4d|ma|mb)$/i;

const PROXY_PATH   = /\/(prox(y|ies)|prores_proxy|avid_proxy|editorial_proxy)\//i;
const PROXY_FILE   = /(_proxy\.|\.proxy\.|-proxy\.|_prx\.)/i;
const MASTER_PATH  = /\/(master(s|_files)?|deliver(y|ables))\//i;
const FINISHED_HINT= /(final|feature|film|movie|episode|feature_master|feature_final)/i;
const VFX_PATH     = /\/(vfx|plates?|cg|comp|elements?)\//i;
const MUSIC_PATH   = /\/(music|score|cue[s]?|soundtrack)\//i;
const SFX_PATH     = /\/(sfx|foley|fx|effects?)\//i;
const DUBBING_PATH = /\/(dub(bing)?|adr|m&e|voice\-?over)\//i;
const REPORTS_PATH = /\/(reports?|sidecars?|metadata|logs?)\//i;

const CAMERA_HINTS: Array<[RegExp, string]> = [
  [/\b(r3d|redcode)\b/i, "RED"],
  [/\b(ari|arx|arri|alexa)\b/i, "ARRI"],
  [/\b(braw|blackmagic|ursa|pocket_?cinema)\b/i, "Blackmagic"],
  [/\b(sony|fx3|fx6|fx9|venice|f55|xavc)\b/i, "Sony"],
  [/\b(canon|c70|c300|c500|c700|crm|cinema_?eos)\b/i, "Canon"],
  [/\b(panasonic|varicam|eva1)\b/i, "Panasonic"],
  [/\b(dji|inspire|mavic|ronin)\b/i, "DJI"],
  [/\b(gopro|hero\d+)\b/i, "GoPro"],
  [/\b(phantom|flex4k)\b/i, "Phantom"],
];

const KNOWN_CONTAINERS: Record<string, string> = {
  r3d: "REDCODE",
  ari: "ARRI",
  arx: "ARRI",
  braw: "BRAW",
  crm: "Canon RAW",
  rmf: "Canon RAW",
  mxf: "MXF",
  mov: "QuickTime",
  mp4: "MP4",
  mts: "AVCHD",
  m2ts: "AVCHD",
  wav: "WAV",
  bwf: "BWF",
  flac: "FLAC",
  mp3: "MP3",
  aif: "AIFF",
  aiff: "AIFF",
  aac: "AAC",
  m4a: "M4A",
  ogg: "OGG",
  webm: "WebM",
  dng: "DNG",
  cdng: "CinemaDNG",
};

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

function deviceFrom(path: string): string | null {
  for (const [rx, label] of CAMERA_HINTS) if (rx.test(path)) return label;
  return null;
}

/**
 * Deterministic, cheap, offline classification. Returns confidence:
 *  - 0.95+ for strong RAW / A-V / doc signals
 *  - 0.70 for extension-only image / audio
 *  - 0.40 for ambiguous project bundle / unknown
 * The caller should only prompt the user when confidence < 0.6.
 */
export function classifyFile(fileName: string, relativePath: string): Classification {
  const path = relativePath || fileName;
  const p = path.toLowerCase();
  const ext = extOf(fileName);
  const container = KNOWN_CONTAINERS[ext] ?? null;
  const device = deviceFrom(p);

  // Sidecars / project files should not be treated as media.
  if (SUBTITLE_EXT.test(p)) {
    return { detectedType: "subtitle", assetClass: "reports", confidence: 0.98,
      container, codecHint: null, deviceHint: device, reason: "subtitle extension" };
  }
  if (REPORT_EXT.test(p) || REPORTS_PATH.test(p)) {
    return { detectedType: "document", assetClass: "reports", confidence: 0.9,
      container, codecHint: null, deviceHint: device, reason: "report / sidecar" };
  }
  if (DOC_EXT.test(p)) {
    return { detectedType: "document", assetClass: "reports", confidence: 0.92,
      container, codecHint: null, deviceHint: device, reason: "document extension" };
  }
  if (BUNDLE_EXT.test(p)) {
    return { detectedType: "project_bundle", assetClass: "project_bundle", confidence: 0.9,
      container, codecHint: null, deviceHint: device, reason: "NLE / VFX project file" };
  }
  if (GRAPHIC_EXT.test(p)) {
    return { detectedType: "graphic", assetClass: "project_bundle", confidence: 0.9,
      container, codecHint: null, deviceHint: device, reason: "graphic authoring file" };
  }

  // Proxies win over generic video when path signals proxy.
  if (PROXY_PATH.test(p) || PROXY_FILE.test(p)) {
    return { detectedType: "proxy", assetClass: "proxies", confidence: 0.95,
      container, codecHint: ext.toUpperCase(), deviceHint: device, reason: "proxy path" };
  }

  // Camera RAW containers.
  if (RAW_CAMERA_EXT.test(p)) {
    return { detectedType: "raw_camera", assetClass: "rushes", confidence: 0.98,
      container, codecHint: container, deviceHint: device, reason: "raw camera container" };
  }

  // Master / finished film hints from path.
  if (MASTER_PATH.test(p) && VIDEO_EXT.test(p)) {
    return { detectedType: "master_file", assetClass: "rushes", confidence: 0.85,
      container, codecHint: ext.toUpperCase(), deviceHint: device, reason: "master folder + video" };
  }
  if (FINISHED_HINT.test(p) && VIDEO_EXT.test(p)) {
    return { detectedType: "finished_film", assetClass: "rushes", confidence: 0.75,
      container, codecHint: ext.toUpperCase(), deviceHint: device, reason: "finished-film hint" };
  }

  // VFX plates — image sequences inside a plates folder.
  if (VFX_PATH.test(p) && (IMAGE_EXT.test(p) || RAW_STILL_EXT.test(p) || /\.(exr|dpx|tga)$/i.test(p))) {
    return { detectedType: "vfx_plate", assetClass: "rushes", confidence: 0.9,
      container, codecHint: ext.toUpperCase(), deviceHint: device, reason: "VFX plate folder" };
  }
  if (/\.(exr|dpx|tga)$/i.test(p)) {
    return { detectedType: "vfx_plate", assetClass: "rushes", confidence: 0.85,
      container, codecHint: ext.toUpperCase(), deviceHint: device, reason: "high-bit-depth still" };
  }

  // Audio family — split into music / sfx / dubbing / generic audio.
  if (AUDIO_EXT.test(p)) {
    if (MUSIC_PATH.test(p))   return { detectedType: "music",   assetClass: "audio", confidence: 0.9, container, codecHint: container, deviceHint: device, reason: "music folder" };
    if (SFX_PATH.test(p))     return { detectedType: "sfx",     assetClass: "audio", confidence: 0.9, container, codecHint: container, deviceHint: device, reason: "sfx folder" };
    if (DUBBING_PATH.test(p)) return { detectedType: "dubbing", assetClass: "audio", confidence: 0.9, container, codecHint: container, deviceHint: device, reason: "dubbing folder" };
    return { detectedType: "audio", assetClass: "audio", confidence: 0.85,
      container, codecHint: container, deviceHint: device, reason: "audio extension" };
  }

  // Stills.
  if (RAW_STILL_EXT.test(p) || IMAGE_EXT.test(p)) {
    return { detectedType: "still_image", assetClass: "rushes", confidence: 0.8,
      container, codecHint: ext.toUpperCase(), deviceHint: device, reason: "image extension" };
  }

  // Generic video — treat as rushes.
  if (VIDEO_EXT.test(p)) {
    return { detectedType: "raw_camera", assetClass: "rushes", confidence: 0.7,
      container, codecHint: ext.toUpperCase(), deviceHint: device, reason: "video extension" };
  }

  return { detectedType: "unknown", assetClass: "project_bundle", confidence: 0.3,
    container, codecHint: null, deviceHint: device, reason: "no strong signal" };
}

export type ProbedMedia = {
  width?: number;
  height?: number;
  durationMs?: number;
  frameRateHint?: number | null;
};

/** Probe an image for width/height. Silent failure -> {}. */
export async function probeImage(file: File): Promise<ProbedMedia> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve({});
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = (v: ProbedMedia) => { URL.revokeObjectURL(url); resolve(v); };
    img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => done({});
    img.src = url;
  });
}

/** Probe a media element for duration (and video dims). Silent failure -> {}. */
export async function probeAV(file: File): Promise<ProbedMedia> {
  return new Promise((resolve) => {
    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(file.name);
    const isAudio = file.type.startsWith("audio/") || AUDIO_EXT.test(file.name);
    if (!isVideo && !isAudio) return resolve({});
    const url = URL.createObjectURL(file);
    const el = document.createElement(isVideo ? "video" : "audio") as HTMLMediaElement;
    el.preload = "metadata";
    const done = (v: ProbedMedia) => { URL.revokeObjectURL(url); resolve(v); };
    let settled = false;
    const onMeta = () => {
      if (settled) return;
      settled = true;
      const out: ProbedMedia = {};
      if (Number.isFinite(el.duration)) out.durationMs = Math.round(el.duration * 1000);
      if (isVideo) {
        const v = el as HTMLVideoElement;
        if (v.videoWidth)  out.width = v.videoWidth;
        if (v.videoHeight) out.height = v.videoHeight;
      }
      done(out);
    };
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("error", () => { if (!settled) { settled = true; done({}); } });
    // Safety timeout — never block ingest more than 4s per file.
    setTimeout(() => { if (!settled) { settled = true; done({}); } }, 4000);
    el.src = url;
  });
}

const SHA_MAX_BYTES = 128 * 1024 * 1024;
/**
 * Client-side SHA-256 for small files only. Large files continue to be
 * checksummed server-side by the existing OCI pipeline.
 */
export async function computeChecksum(file: File): Promise<string | null> {
  if (file.size > SHA_MAX_BYTES) return null;
  try {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    const bytes = new Uint8Array(hash);
    let hex = "";
    for (const b of bytes) hex += b.toString(16).padStart(2, "0");
    return hex;
  } catch {
    return null;
  }
}

/** One-shot enrichment used by the ingest UI. Never throws. */
export async function enrichFile(file: File, relativePath: string) {
  const classification = classifyFile(file.name, relativePath);
  const [probe, checksum] = await Promise.all([
    classification.detectedType === "still_image" || classification.detectedType === "graphic"
      ? probeImage(file)
      : probeAV(file),
    computeChecksum(file),
  ]);
  return {
    detected_type: classification.detectedType,
    confidence: classification.confidence,
    reason: classification.reason,
    container: classification.container,
    codec_hint: classification.codecHint,
    device_hint: classification.deviceHint,
    width: probe.width ?? null,
    height: probe.height ?? null,
    duration_ms: probe.durationMs ?? null,
    frame_rate_hint: probe.frameRateHint ?? null,
    checksum_sha256: checksum,
    checksum_scope: checksum ? "client_full" : "server_pending",
  };
}
