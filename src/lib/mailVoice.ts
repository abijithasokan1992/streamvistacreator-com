// Plays the StreamVista "you have a mail" lady-voice notification.
// Pre-warms the audio on first import so the actual play call is instant.

import { supabase } from "@/integrations/supabase/client";

const FN = "auth-mail-voice";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const url = `${SUPABASE_URL}/functions/v1/${FN}`;

let cachedBlobUrl: string | null = null;
let inflight: Promise<string> | null = null;

async function ensureAudio(): Promise<string> {
  if (cachedBlobUrl) return cachedBlobUrl;
  if (inflight) return inflight;
  inflight = (async () => {
    const resp = await fetch(url, {
      headers: ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {},
    });
    if (!resp.ok) throw new Error(`mail voice fetch failed: ${resp.status}`);
    const blob = await resp.blob();
    cachedBlobUrl = URL.createObjectURL(blob);
    return cachedBlobUrl;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Kick off TTS fetch ahead of time so playback is instant. */
export function prewarmMailVoice() {
  void ensureAudio().catch(() => {/* silent */});
  // Touch supabase to keep tree-shake happy (also primes auth headers fetch path)
  void supabase;
}

/** Play the "You have a mail from StreamVista" notification. */
export async function playMailVoice() {
  try {
    const src = await ensureAudio();
    const audio = new Audio(src);
    audio.volume = 0.95;
    await audio.play();
  } catch (e) {
    console.warn("mail voice playback failed", e);
  }
}
