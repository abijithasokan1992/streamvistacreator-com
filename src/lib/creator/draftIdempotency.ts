// Stable, client-generated draft UUIDs used to make title creation idempotent
// across retries and rapid double-clicks. The value is persisted in
// localStorage keyed by the owner + a caller-supplied slot (e.g. "new-title").
//
// The server column `content_titles.client_draft_id` is optional at runtime —
// callers must feature-detect it and fall back gracefully. See
// `insertTitleWithClientDraftId` in titleApi.ts.

const KEY_PREFIX = "sv:draft-id:";

function randomUuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // RFC4122 v4 fallback for non-crypto environments (tests).
  const rnd = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return `${rnd()}${rnd()}-${rnd()}-4${rnd().slice(1)}-a${rnd().slice(1)}-${rnd()}${rnd()}${rnd()}`;
}

/**
 * Return an existing stable draft id for this owner/slot, or mint one and
 * persist it. Slots let a single owner scope multiple concurrent drafts
 * (e.g. "new-title", "import:tmdb:12345").
 */
export function getOrCreateDraftId(ownerId: string, slot: string): string {
  if (!ownerId || !slot) throw new Error("draft id requires owner and slot");
  const key = `${KEY_PREFIX}${ownerId}:${slot}`;
  try {
    const existing = globalThis.localStorage?.getItem(key);
    if (existing && /^[0-9a-f-]{8,}$/i.test(existing)) return existing;
  } catch { /* SSR / private mode */ }
  const id = randomUuid();
  try { globalThis.localStorage?.setItem(key, id); } catch { /* noop */ }
  return id;
}

/** Clear the stored draft id (call after successful submission or discard). */
export function clearDraftId(ownerId: string, slot: string): void {
  try { globalThis.localStorage?.removeItem(`${KEY_PREFIX}${ownerId}:${slot}`); } catch { /* noop */ }
}
