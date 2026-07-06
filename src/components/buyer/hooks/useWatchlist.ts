import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Client-side watchlist for buyers. No schema change: persisted to
 * localStorage, scoped per authenticated user id. Reflects "titles I'm
 * tracking" — a lightweight bookmark, not a rights claim.
 */
export type WatchItem = {
  id: string;                 // marketplace title id (featured_films.id)
  title: string;
  posterUrl?: string | null;
  contentType?: string | null;
  addedAt: string;
};

const key = (uid: string) => `sv.buyer.watchlist.${uid}`;

function read(uid: string): WatchItem[] {
  try {
    const raw = localStorage.getItem(key(uid));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function useWatchlist() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [items, setItems] = useState<WatchItem[]>([]);

  useEffect(() => {
    if (!uid) { setItems([]); return; }
    setItems(read(uid));
    const onStorage = (e: StorageEvent) => {
      if (e.key === key(uid)) setItems(read(uid));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [uid]);

  const persist = useCallback((next: WatchItem[]) => {
    if (!uid) return;
    try { localStorage.setItem(key(uid), JSON.stringify(next)); } catch { /* ignore quota */ }
    setItems(next);
  }, [uid]);

  const has = useCallback((id: string) => items.some(i => i.id === id), [items]);

  const add = useCallback((item: Omit<WatchItem, "addedAt">) => {
    if (!uid || items.some(i => i.id === item.id)) return;
    persist([{ ...item, addedAt: new Date().toISOString() }, ...items]);
  }, [items, persist, uid]);

  const remove = useCallback((id: string) => {
    persist(items.filter(i => i.id !== id));
  }, [items, persist]);

  const toggle = useCallback((item: Omit<WatchItem, "addedAt">) => {
    if (items.some(i => i.id === item.id)) remove(item.id);
    else add(item);
  }, [items, add, remove]);

  return { items, has, add, remove, toggle };
}
