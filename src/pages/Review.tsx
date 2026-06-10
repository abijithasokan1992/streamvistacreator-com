import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Lock, ShieldCheck, AlertTriangle, Film, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Seo } from "@/components/Seo";

type InfoState = {
  filename: string;
  mime: string | null;
  size: number | null;
  requires_password: boolean;
  view_only: boolean;
  expires_at: string | null;
  max_views: number | null;
  view_count: number;
};

type UnlockedState = {
  filename: string;
  mime: string | null;
  size: number | null;
  playback_url: string;
  view_only: boolean;
  expires_at: string | null;
};

export default function Review() {
  const { token = "" } = useParams<{ token: string }>();
  const [info, setInfo] = useState<InfoState | null>(null);
  const [unlocked, setUnlocked] = useState<UnlockedState | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: invokeErr } = await supabase.functions.invoke("review-link", {
        body: { action: "info", token },
      });
      if (cancelled) return;
      setLoading(false);
      if (invokeErr || (data as any)?.error) {
        setError((data as any)?.error || invokeErr?.message || "This link is no longer valid.");
        return;
      }
      setInfo(data as InfoState);
      // No password required → auto-unlock to play immediately
      if (!(data as InfoState).requires_password) {
        await doUnlock();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const doUnlock = async (pwd?: string) => {
    setUnlocking(true);
    setError(null);
    const { data, error: invokeErr } = await supabase.functions.invoke("review-link", {
      body: { action: "unlock", token, password: pwd ?? password },
    });
    setUnlocking(false);
    if (invokeErr || (data as any)?.error) {
      setError((data as any)?.error || invokeErr?.message || "Could not unlock this review.");
      return;
    }
    setUnlocked(data as UnlockedState);
  };

  const isVideo = (mime: string | null | undefined) => !!mime && mime.startsWith("video/");
  const isImage = (mime: string | null | undefined) => !!mime && mime.startsWith("image/");
  const isAudio = (mime: string | null | undefined) => !!mime && mime.startsWith("audio/");

  return (
    <div className="min-h-dvh bg-black text-zinc-100">
      <Seo title="Private Review · StreamVista" description="Secure review link" path={`/review/${token}`} />
      <header className="border-b border-zinc-900 px-4 sm:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 grid place-items-center">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <span className="text-xs font-mono tracking-widest uppercase text-zinc-400">
            Private Review
          </span>
        </div>
        <span className="text-[10px] font-mono text-zinc-600">StreamVista · Secure Link</span>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-8">
        {loading ? (
          <div className="flex items-center gap-2 text-zinc-400 py-20 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Verifying review link…
          </div>
        ) : error && !unlocked ? (
          <div className="border border-red-900/60 bg-red-950/30 rounded-2xl p-8 text-center max-w-md mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <h1 className="text-lg font-bold text-red-200 mb-2">Link unavailable</h1>
            <p className="text-sm text-red-200/80">{error}</p>
          </div>
        ) : unlocked ? (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold truncate">{unlocked.filename}</h1>
                <p className="text-[11px] font-mono text-zinc-500">
                  {unlocked.mime ?? "asset"}
                  {unlocked.size ? ` · ${(unlocked.size / 1024 / 1024).toFixed(1)} MB` : ""}
                </p>
              </div>
              {unlocked.view_only && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-amber-400 border border-amber-500/30 px-2 py-1 rounded-full">
                  <Eye className="w-3 h-3" /> View only
                </span>
              )}
            </div>

            <div className="rounded-2xl overflow-hidden border border-zinc-900 bg-zinc-950 shadow-2xl">
              {isVideo(unlocked.mime) ? (
                <video
                  src={unlocked.playback_url}
                  controls
                  controlsList={unlocked.view_only ? "nodownload noremoteplayback" : undefined}
                  disablePictureInPicture={unlocked.view_only}
                  onContextMenu={(e) => unlocked.view_only && e.preventDefault()}
                  className="w-full max-h-[75vh] bg-black"
                />
              ) : isImage(unlocked.mime) ? (
                <img
                  src={unlocked.playback_url}
                  alt={unlocked.filename}
                  onContextMenu={(e) => unlocked.view_only && e.preventDefault()}
                  className="w-full max-h-[75vh] object-contain bg-black"
                />
              ) : isAudio(unlocked.mime) ? (
                <div className="p-10 flex flex-col items-center gap-4">
                  <Film className="w-10 h-10 text-zinc-500" />
                  <audio src={unlocked.playback_url} controls className="w-full max-w-md" />
                </div>
              ) : (
                <div className="p-10 text-center space-y-3">
                  <Film className="w-10 h-10 text-zinc-500 mx-auto" />
                  <p className="text-sm text-zinc-400">
                    Preview not available for this file type.
                  </p>
                  {!unlocked.view_only && (
                    <a
                      href={unlocked.playback_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-amber-400 underline"
                    >
                      Open in new tab
                    </a>
                  )}
                </div>
              )}
            </div>

            {unlocked.expires_at && (
              <p className="text-[10px] text-zinc-500 font-mono text-center">
                This link expires on {new Date(unlocked.expires_at).toLocaleString()}.
              </p>
            )}
          </div>
        ) : info?.requires_password ? (
          <form
            onSubmit={(e) => { e.preventDefault(); doUnlock(); }}
            className="max-w-md mx-auto border border-zinc-900 bg-zinc-950 rounded-2xl p-6 space-y-4"
          >
            <div className="text-center space-y-1">
              <div className="inline-flex p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-full">
                <Lock className="w-4 h-4 text-amber-400" />
              </div>
              <h1 className="text-base font-bold">Password required</h1>
              <p className="text-xs text-zinc-400">
                Enter the password your studio shared with you to view "{info.filename}".
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwd" className="text-xs text-zinc-400">Password</Label>
              <Input
                id="pwd"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
                className="bg-zinc-900 border-zinc-800 text-zinc-100"
              />
            </div>
            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}
            <Button type="submit" disabled={unlocking || !password} className="w-full gap-2">
              {unlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Unlock Review
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2 text-zinc-400 py-20 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Preparing playback…
          </div>
        )}
      </main>
    </div>
  );
}
