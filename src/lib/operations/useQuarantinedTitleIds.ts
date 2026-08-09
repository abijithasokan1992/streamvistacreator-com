import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Cached fetch of the quarantined title IDs (Batch 2 quarantine —
 * metadata.is_test = true). Fetched once per session and shared across
 * every operational surface that needs to defensively exclude joins to
 * quarantined titles (distribution offers, revenue lines, royalty
 * allocations, buyer mapping, deal memos).
 *
 * Returns `null` while loading, then a stable readonly array. Callers
 * that would rather block until known can gate their query on
 * `ids !== null`.
 */
let cachedPromise: Promise<readonly string[]> | null = null;
let cachedValue: readonly string[] | null = null;
const QUARANTINE_LOOKUP_TIMEOUT_MS = 2000;

export function primeQuarantinedTitleIdsCache(ids: readonly string[]): void {
  cachedValue = ids;
  cachedPromise = Promise.resolve(ids);
}

export function resetQuarantinedTitleIdsCache(): void {
  cachedValue = null;
  cachedPromise = null;
}

async function loadOnce(): Promise<readonly string[]> {
  if (cachedPromise) return cachedPromise;
  cachedPromise = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), QUARANTINE_LOOKUP_TIMEOUT_MS);
    try {
      const { data, error } = await (supabase as any)
        .from("content_titles")
        .select("id")
        .eq("metadata->>is_test", "true")
        .abortSignal(controller.signal);
      if (error) throw error;
      const ids = Object.freeze((data ?? []).map((r: { id: string }) => r.id));
      cachedValue = ids;
      return ids;
    } catch {
      // Fail-open quickly: owner-level production filters remain active and
      // operational surfaces must not hang indefinitely on a quarantine lookup.
      cachedValue = Object.freeze([]);
      return cachedValue;
    } finally {
      window.clearTimeout(timeout);
    }
  })();
  return cachedPromise;
}

export function useQuarantinedTitleIds(): readonly string[] | null {
  const [ids, setIds] = useState<readonly string[] | null>(cachedValue);
  useEffect(() => {
    if (cachedValue) return;
    let alive = true;
    loadOnce().then((v) => alive && setIds(v));
    return () => {
      alive = false;
    };
  }, []);
  return ids;
}

/** Non-hook accessor for imperative code (edge helpers, RPC prep). */
export async function fetchQuarantinedTitleIds(): Promise<readonly string[]> {
  return loadOnce();
}
