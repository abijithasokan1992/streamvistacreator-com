// Client wrapper for the external Oracle OCI API Gateway (self-hosted Node.js proxy).
// Set VITE_ORACLE_API_URL in your environment to enable. The proxy handles the
// Oracle SDK auth/signing server-side; the browser only sees JSON over HTTPS.

export const ORACLE_API_URL: string =
  (import.meta.env.VITE_ORACLE_API_URL as string | undefined)?.replace(/\/$/, "") || "";

export const ORACLE_BUCKET: string =
  (import.meta.env.VITE_ORACLE_BUCKET as string | undefined) || "bucket-20260526-1544";

export const isOracleConfigured = () => Boolean(ORACLE_API_URL);

export interface OracleBucketStats {
  bucket: string;
  namespace?: string;
  objectCount: number;
  approximateSizeBytes: number;
  region?: string;
  updatedAt?: string;
}

export interface OracleObject {
  name: string;
  size: number;
  timeCreated?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!ORACLE_API_URL) throw new Error("Oracle API Gateway URL not configured (VITE_ORACLE_API_URL).");
  const res = await fetch(`${ORACLE_API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Oracle gateway ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const getBucketStats = (bucket = ORACLE_BUCKET) =>
  request<OracleBucketStats>(`/buckets/${encodeURIComponent(bucket)}/stats`);

export const listObjects = (bucket = ORACLE_BUCKET, limit = 25) =>
  request<{ objects: OracleObject[] }>(`/buckets/${encodeURIComponent(bucket)}/objects?limit=${limit}`);
