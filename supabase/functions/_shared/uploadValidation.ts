// Shared server-side upload validation for OCI-backed upload paths.
//
// Used by both `oci-upload` (single-shot) and `oci-multipart` (init) so the
// allowed-type / forbidden-type contract is identical across paths and is
// enforced by the server, not by client-side checks the user can bypass.
//
// Returns null when the upload is allowed, or a { code, message } object
// the caller should send back as a 415 response.

const FORBIDDEN_EXTENSIONS = new Set([
  // executables / scripts
  "exe", "msi", "dll", "scr", "bat", "cmd", "ps1", "sh", "bash", "zsh",
  "com", "vbs", "vbe", "js", "jse", "jar", "wsf", "wsh", "hta", "cpl",
  "msc", "apk", "ipa",
  // server-side templates / shells that could be served back
  "php", "phtml", "asp", "aspx", "jsp",
  // raw html (uploads are not a web host)
  "html", "htm", "xhtml", "svg",
]);

const FORBIDDEN_MIME_PREFIXES = [
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-sh",
  "application/x-shellscript",
  "application/x-bat",
  "application/x-executable",
  "application/x-dosexec",
  "application/java-archive",
  "application/x-httpd-php",
  "application/x-perl",
  "application/x-python",
  "text/html",
  "text/x-shellscript",
  "image/svg+xml",
];

// Allowlist by category family — when a category is supplied, the MIME must
// fall in the matching family. Unknown categories are permissive (size +
// forbidden-list still apply).
const CATEGORY_FAMILY: Record<string, "video" | "image" | "audio" | "document" | "subtitle"> = {
  trailer: "video", feature_film: "video", master: "video", prores: "video", dcp: "video",
  poster: "image", artwork: "image",
  audio: "audio", audio_tracks: "audio",
  subtitle: "subtitle", captions: "subtitle",
  censor_certificate: "document", censor_cert: "document",
  ownership_documents: "document", ownership: "document",
  legal: "document", sales: "document",
};

const FAMILY_MIME_PREFIX: Record<string, string[]> = {
  video: ["video/", "application/mp4", "application/mxf", "application/dash+xml", "application/vnd.apple.mpegurl"],
  image: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/tiff", "image/avif"],
  audio: ["audio/", "application/ogg"],
  subtitle: ["text/vtt", "text/srt", "application/x-subrip", "text/plain"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "text/plain", "text/csv",
    "image/jpeg", "image/png", // scanned docs
  ],
};

export interface UploadValidationFailure {
  code: "forbidden_file_type" | "category_mime_mismatch";
  message: string;
}

export function validateUploadKind(opts: {
  fileName: string;
  mimeType: string;
  category?: string | null;
}): UploadValidationFailure | null {
  const name = (opts.fileName || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop()! : "";
  const mime = (opts.mimeType || "application/octet-stream").toLowerCase();

  if (ext && FORBIDDEN_EXTENSIONS.has(ext)) {
    return {
      code: "forbidden_file_type",
      message: `Upload Not Allowed — file type .${ext} is blocked for security reasons.`,
    };
  }
  for (const pref of FORBIDDEN_MIME_PREFIXES) {
    if (mime === pref || mime.startsWith(pref + ";") || mime.startsWith(pref + "/")) {
      return {
        code: "forbidden_file_type",
        message: `Upload Not Allowed — MIME type "${mime}" is blocked for security reasons.`,
      };
    }
  }

  const cat = (opts.category || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const family = cat ? CATEGORY_FAMILY[cat] : undefined;
  if (family) {
    const allow = FAMILY_MIME_PREFIX[family] ?? [];
    // application/octet-stream is permitted only when the extension itself
    // is recognised for the family — XHR sometimes drops the MIME hint.
    const looksOctet = mime === "application/octet-stream" || mime === "";
    const matches = allow.some((p) => mime === p || mime.startsWith(p));
    if (!matches && !looksOctet) {
      return {
        code: "category_mime_mismatch",
        message: `Upload Not Allowed — "${mime}" is not a valid file for category "${cat}".`,
      };
    }
  }

  return null;
}
