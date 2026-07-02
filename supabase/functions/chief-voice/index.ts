import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encode as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// George — calm, authoritative male voice
const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isFounder } = await userClient.rpc("has_role", { _user_id: userId, _role: "founder" });
    if (!isFounder) return new Response(JSON.stringify({ error: "Founder access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { text, report_id } = await req.json();
    let speech = text as string | undefined;

    if (!speech && report_id) {
      const svc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: report } = await svc.from("agent_reports").select("body").eq("id", report_id).single();
      speech = report?.body;
    }
    if (!speech) return new Response(JSON.stringify({ error: "text or report_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ElevenLabs not connected" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ttsResp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: speech.slice(0, 4500),
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed: 1.0 },
        }),
      },
    );

    if (!ttsResp.ok) {
      const t = await ttsResp.text();
      return new Response(JSON.stringify({ error: "TTS failed", detail: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const buf = await ttsResp.arrayBuffer();
    const audioBase64 = base64Encode(new Uint8Array(buf));

    // Optionally persist on the report
    if (report_id) {
      const svc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await svc.from("agent_reports").update({ audio_base64: audioBase64 }).eq("id", report_id);
    }

    return new Response(JSON.stringify({ audioContent: audioBase64 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
