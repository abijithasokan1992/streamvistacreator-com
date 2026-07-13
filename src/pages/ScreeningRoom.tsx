import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, ShieldAlert, ShieldCheck, Lock, Film, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";

type ResolveResult =
  | { ok: true; invite: any; title: any; asset: any | null; playback_url: string | null; playback_url_expires_at: string | null }
  | { ok: false; reason: string };

const denyCopy: Record<string, { title: string; body: string }> = {
  not_found: { title: "Screening link not found", body: "This screening invite does not exist or has been removed." },
  invalid: { title: "Invalid screening link", body: "The link you used is malformed." },
  expired: { title: "Screening access expired", body: "This invite is no longer valid. Please contact StreamVista for a fresh screener." },
  revoked: { title: "Screening access revoked", body: "Access to this screener has been revoked by StreamVista." },
  exhausted: { title: "View limit reached", body: "This invite has reached its maximum number of views." },
};

export default function ScreeningRoom() {
  const { token = "" } = useParams();
  const [state, setState] = useState<{ loading: boolean; data: ResolveResult | null; error: string | null }>({ loading: true, data: null, error: null });
  const [accepted, setAccepted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastPingRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase.rpc as any)("screening_resolve", { _token: token });
        if (cancelled) return;
        if (error) setState({ loading: false, data: null, error: error.message });
        else setState({ loading: false, data: data as ResolveResult, error: null });
      } catch (e: any) {
        setState({ loading: false, data: null, error: String(e?.message ?? e) });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Playback event logging
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !state.data || !state.data.ok) return;
    const log = (kind: string, pct?: number) => {
      (supabase.rpc as any)("screening_log_event", {
        _token: token, _kind: kind, _progress_pct: pct ?? null,
      }).catch(() => {});
    };
    const onPlay = () => log("playback_started", 0);
    const onTime = () => {
      if (!v.duration) return;
      const pct = Math.floor((v.currentTime / v.duration) * 100);
      const now = Date.now();
      if (now - lastPingRef.current > 15000) {
        lastPingRef.current = now;
        log("playback_progress", pct);
      }
    };
    const onEnded = () => log("playback_completed", 100);
    v.addEventListener("play", onPlay);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
    };
  }, [state.data, token]);

  if (state.loading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-black text-white">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const data = state.data;
  if (!data || data.ok === false) {
    const reason = data && data.ok === false ? data.reason : "not_found";
    const copy = denyCopy[reason] ?? denyCopy.not_found;
    return (
      <div className="min-h-dvh grid place-items-center bg-black text-white p-6">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="w-12 h-12 mx-auto text-red-400" />
          <h1 className="text-2xl font-semibold">{copy.title}</h1>
          <p className="text-sm text-white/70">{copy.body}</p>
          <p className="text-xs text-white/70">Need help? support@streamvista.in</p>
        </div>
      </div>
    );
  }

  const { title, invite, asset, playback_url } = data;
  const watermarkText = [
    invite.invite_email,
    invite.buyer_org_name,
    "CONFIDENTIAL — StreamVista",
  ].filter(Boolean).join(" • ");

  return (
    <div className="min-h-dvh bg-black text-white">
      <Seo
        title={data.ok && data.title?.title ? `${data.title.title} · Private screener` : "Private screener · StreamVista"}
        description={
          data.ok && data.title?.title
            ? `Watermarked private screener for "${data.title.title}" on StreamVista — invitation-only, watermarked playback with access logged for the rights holder.`
            : "Watch a watermarked, invitation-only private screener on StreamVista — secure playback with NDA acknowledgement and full access logging."
        }
        path={`/screening/${token}`}
      />
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Film className="w-5 h-5" />
          <div>
            <div className="text-sm font-semibold">{title.title}</div>
            <div className="text-xs text-white/75">
              {title.language || ""} {title.duration_minutes ? `· ${title.duration_minutes} min` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Lock className="w-3.5 h-3.5" /> Private screener · expires {new Date(invite.expires_at).toLocaleString()}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {invite.nda_required && !accepted ? (
          <section className="border border-white/15 rounded-lg p-6 space-y-4 bg-white/5">
            <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" /><h2 className="text-lg font-semibold">Confidentiality acknowledgement</h2></div>
            <ul className="text-sm text-white/70 space-y-1 list-disc pl-5">
              <li>This screener is shared with <span className="text-white">{invite.invite_email}</span> for evaluation only.</li>
              <li>No recording, redistribution, exhibition or download is permitted.</li>
              <li>Access is logged. Your identity is shown on screen during playback.</li>
              <li>Rights remain with StreamVista and the rights holder.</li>
            </ul>
            <button
              onClick={() => setAccepted(true)}
              className="px-4 py-2 rounded bg-white text-black text-sm font-medium hover:bg-white/90"
            >
              I understand — open screener
            </button>
          </section>
        ) : (
          <section className="space-y-4">
            <div className="relative aspect-video bg-black border border-white/10 rounded-lg overflow-hidden">
              {playback_url ? (
                <video
                  ref={videoRef}
                  src={playback_url}
                  controls
                  controlsList="nodownload noremoteplayback"
                  disablePictureInPicture
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-full h-full"
                />
              ) : (
                <div className="grid place-items-center h-full text-sm text-white/60 p-6 text-center">
                  Playback source is not yet available. StreamVista will share an updated link shortly.
                </div>
              )}
              {invite.watermark_enabled && (
                <>
                  <div className="pointer-events-none absolute top-3 right-3 text-[10px] text-white/60 bg-black/40 px-2 py-1 rounded">
                    {watermarkText}
                  </div>
                  <div className="pointer-events-none absolute bottom-3 left-3 text-[10px] text-white/60 bg-black/40 px-2 py-1 rounded">
                    {invite.invite_email} · {new Date().toLocaleString()}
                  </div>
                </>
              )}
            </div>

            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="md:col-span-2 space-y-2">
                <h3 className="font-semibold">{title.title}</h3>
                {title.synopsis && <p className="text-white/70 whitespace-pre-line">{title.synopsis}</p>}
                {title.genre && <p className="text-xs text-white/75">Genre: {title.genre}</p>}
              </div>
              <div className="space-y-2 text-xs text-white/60">
                <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Expires {new Date(invite.expires_at).toLocaleDateString()}</div>
                <div>Invitee: {invite.invite_name || invite.invite_email}</div>
                {invite.buyer_org_name && <div>Organisation: {invite.buyer_org_name}</div>}
                {asset?.label && <div>Source: {asset.label}</div>}
                <div className="pt-2 border-t border-white/10 text-[11px] text-white/70">
                  Activity on this screener is logged for security and commercial follow-up.
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
