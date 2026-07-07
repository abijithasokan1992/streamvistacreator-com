/**
 * Upload-failure classifier.
 *
 * Turns raw errors from the OCI multipart driver, edge functions, or the
 * browser network stack into a stable, structural diagnostic tuple:
 *
 *   { category, code, detail, httpStatus? }
 *
 * These values are what we persist onto `ingest_job_items.metadata` and
 * what the admin Failed-Uploads inspector renders — never the raw message
 * alone. Keeping the taxonomy narrow keeps triage cheap: every failure
 * lands in exactly one of five structural buckets.
 */

export type UploadErrorCategory =
  | "csp_violation"        // browser blocked the request via Content Security Policy
  | "signed_url_expired"   // OCI PAR / signed URL or multipart session no longer valid
  | "auth_token"           // Supabase/JWT/authorization missing, expired, or rejected
  | "network_timeout"      // DNS, socket, TLS, offline, aborted-by-timeout, connectivity drop
  | "other";               // structural fallback — quota / MIME / server 5xx / unclassified

export interface UploadDiagnostic {
  category: UploadErrorCategory;
  /** Stable machine code — safe for dashboards, alerts, and analytics. */
  code: string;
  /** Human-readable structural detail, safe to show admins verbatim. */
  detail: string;
  /** HTTP status when the failure originated from an HTTP response. */
  httpStatus?: number;
  /** Raw underlying message, capped for storage. */
  raw?: string;
}

const HTTP_STATUS_RE = /\b(4\d\d|5\d\d)\b/;

function extractStatus(msg: string, hint?: number): number | undefined {
  if (typeof hint === "number") return hint;
  const m = msg.match(HTTP_STATUS_RE);
  return m ? Number(m[1]) : undefined;
}

/** Classify any thrown value from the upload pipeline. Never throws. */
export function classifyUploadError(err: unknown, httpHint?: number): UploadDiagnostic {
  const rawMsg = err instanceof Error ? err.message : String(err ?? "");
  const raw = rawMsg.slice(0, 800);
  const m = rawMsg.toLowerCase();
  const status = extractStatus(rawMsg, httpHint);

  // --- 1) CSP violations ---------------------------------------------------
  // The browser surfaces these as "Refused to connect to …" / "violates the
  // following Content Security Policy directive" / "blocked by CSP".
  if (
    m.includes("content security policy") ||
    m.includes("violates the following content security policy") ||
    m.includes("refused to connect") ||
    m.includes("blocked by csp") ||
    m.includes("csp violation")
  ) {
    return {
      category: "csp_violation",
      code: "CSP_BLOCKED",
      detail:
        "Browser Content Security Policy blocked the request to object storage. " +
        "The CSP `connect-src` directive must allow the OCI endpoint used for signed uploads.",
      httpStatus: status,
      raw,
    };
  }

  // --- 2) Signed URL / multipart session expiration ------------------------
  // OCI PAR expiry, multipart upload id reclaimed, or edge function reporting
  // upload_not_found / UploadNotFound (HTTP 410 or 404 with the OCI body).
  if (
    m.includes("upload_session_expired") ||
    m.includes("uploadnotfound") ||
    m.includes("upload_not_found") ||
    m.includes("upload session expired") ||
    m.includes("par expired") ||
    m.includes("signed url expired") ||
    m.includes("expired signature") ||
    m.includes("signature expired") ||
    m.includes("request has expired") ||
    m.includes("preauthrequestexpired") ||
    (status === 410) ||
    (status === 403 && (m.includes("expire") || m.includes("preauth")))
  ) {
    return {
      category: "signed_url_expired",
      code: "SIGNED_URL_EXPIRED",
      detail:
        "The signed upload URL or multipart session was no longer valid when the part " +
        "reached object storage. Sessions are typically reclaimed after 24h of inactivity " +
        "or when the pre-authenticated request TTL elapses.",
      httpStatus: status,
      raw,
    };
  }

  // --- 3) Auth / token errors ---------------------------------------------
  // Supabase session missing, JWT expired, OCI request signature rejected as
  // NotAuthenticated / NotAuthorized (401/403 that are NOT expiration).
  if (
    m.includes("not signed in") ||
    m.includes("invalid token") ||
    m.includes("jwt expired") ||
    m.includes("jwt is expired") ||
    m.includes("invalid jwt") ||
    m.includes("unauthenticated") ||
    m.includes("notauthenticated") ||
    m.includes("not authorized") ||
    m.includes("notauthorized") ||
    m.includes("signature does not match") ||
    m.includes("invalid signature") ||
    m.includes("missing authorization") ||
    status === 401 ||
    (status === 403 && !m.includes("expire"))
  ) {
    return {
      category: "auth_token",
      code: "AUTH_TOKEN_REJECTED",
      detail:
        "Authentication was rejected before or during the upload. Either the user's " +
        "Supabase JWT expired mid-transfer, or the OCI request signature was refused " +
        "(check tenancy/user OCID + fingerprint alignment).",
      httpStatus: status,
      raw,
    };
  }

  // --- 4) Network drops / timeouts ---------------------------------------
  // Fetch failures, DNS/TLS/socket, offline, aborted timeouts, 408/429/5xx
  // transient network conditions between the browser and OCI.
  if (
    m.includes("failed to fetch") ||
    m.includes("network error") ||
    m.includes("networkerror") ||
    m.includes("network request failed") ||
    m.includes("timed out") ||
    m.includes("timeout") ||
    m.includes("etimedout") ||
    m.includes("econnreset") ||
    m.includes("econnrefused") ||
    m.includes("enotfound") ||
    m.includes("dns error") ||
    m.includes("getaddrinfo") ||
    m.includes("connection reset") ||
    m.includes("connection refused") ||
    m.includes("connection closed") ||
    m.includes("connection failed") ||
    m.includes("tls handshake") ||
    m.includes("oci_connection_failed") ||
    m.includes("offline") ||
    (m.includes("aborted") && m.includes("timeout")) ||
    status === 408 ||
    status === 429 ||
    (typeof status === "number" && status >= 500)
  ) {
    return {
      category: "network_timeout",
      code: status ? `NETWORK_${status}` : "NETWORK_DROP",
      detail:
        "The transport between the browser and object storage failed. This covers DNS, " +
        "TLS handshake, socket resets, request timeouts, offline drops, and transient " +
        "5xx/408/429 responses — none of which indicate a permanent rejection.",
      httpStatus: status,
      raw,
    };
  }

  // --- 5) Structural fallback ---------------------------------------------
  return {
    category: "other",
    code: status ? `HTTP_${status}` : "UNCLASSIFIED",
    detail: rawMsg
      ? `Unclassified structural failure: ${rawMsg.slice(0, 240)}`
      : "Unclassified structural failure with no message available.",
    httpStatus: status,
    raw,
  };
}

export const UPLOAD_CATEGORY_LABELS: Record<UploadErrorCategory, string> = {
  csp_violation: "CSP Violation",
  signed_url_expired: "Signed URL Expired",
  auth_token: "Auth / Token Rejected",
  network_timeout: "Network Drop / Timeout",
  other: "Other / Structural",
};
