// Public TTS endpoint that returns a short "You have a mail from StreamVista"
// lady-voice MP3. Cached in module scope per cold start + with long Cache-Control
// so the browser reuses the same blob across plays.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Sarah — warm, friendly lady voice
const VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
const PHRASE = "You have a mail from StreamVista. Please check your inbox.";

let cachedAudio: Uint8Array | null = null;

async function synthesize(): Promise<Uint8Array> {
  if (cachedAudio) return cachedAudio;
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) throw new Error("ElevenLabs not connected");

  const resp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: PHRASE,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.8,
          style: 0.35,
          use_speaker_boost: true,
          speed: 1.0,
        },
      }),
    },
  );
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`TTS failed: ${resp.status} ${err}`);
  }
  cachedAudio = new Uint8Array(await resp.arrayBuffer());
  return cachedAudio;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const audio = await synthesize();
    return new Response(audio, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
