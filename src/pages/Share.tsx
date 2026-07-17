import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Download, Lock, Shield, Loader2, Eye, Clock, Hash, Play, FileText, Film,
} from "lucide-react";
import { Seo } from "@/components/Seo";

type Info = {
  filename: string;
  size_bytes: number;
  mime_type: string | null;
  tier: string;
  requires_password: boolean;
  expires_at: string | null;
  downloads_left: number | null;
  view_only: boolean;
};

function fmtSize(b: number) {
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

function kindOf(mime: string | null, filename: string): "video" | "audio" | "image" | "other" {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("image/")) return "image";
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["mp4", "mov", "webm", "mkv", "m4v"].includes(ext)) return "video";
  if (["mp3", "wav", "aac", "ogg", "flac", "m4a"].includes(ext)) return "audio";
  if (["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext)) return "image";
  return "other";
}

const Share = () => {
  const { token } = useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const playerRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke("vault-share", {
        body: { action: "info", token },
      });
      if (error || (data as any)?.error) {
        setErr((data as any)?.error || error?.message || "Link unavailable");
      } else {
        setInfo(data as Info);
      }
    })();
  }, [token]);

  const kind = useMemo(() => (info ? kindOf(info.mime_type, info.filename) : "other"), [info]);

  const loadMedia = async () => {
    if (!info) return;
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase.functions.invoke("vault-share", {
      body: { action: "view", token, password },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      setErr((data as any)?.error || "Could not load media");
      return;
    }
    setMediaUrl((data as any).url as string);
    setUnlocked(true);
  };

  const download = async () => {
    if (!info || info.view_only) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("vault-share", {
      body: { action: "download", token, password },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      setErr((data as any)?.error || "Download failed");
      return;
    }
    window.location.href = (data as any).url as string;
  };

  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_hsl(var(--accent)/0.18),_transparent_60%)] bg-background text-foreground">
      <Seo
        title={info ? `${info.filename} · Shared on StreamVista` : "Shared file · StreamVista"}
        description={
          info
            ? `Securely view or download "${info.filename}" (${fmtSize(info.size_bytes)}) shared via StreamVista Cloud X — encrypted in transit and access-logged.`
            : "Securely view or download a file shared via StreamVista Cloud X — encrypted in transit, access-logged, and protected by expiring share links."
        }
        path={`/s/${token ?? ""}`}
      />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,_hsl(var(--primary)/0.15),_transparent_60%)]" />
      <header className="px-4 sm:px-8 py-4 flex items-center justify-between border-b border-white/5 backdrop-blur-xl bg-background/40 sticky top-0 z-10">
        <Link to="/" className="flex items-center gap-2 font-display font-bold">
          <Shield className="h-4 w-4 text-accent" /> Cloud X
        </Link>
        {info && (
          <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-3">
            <span>{info.tier === "sovereign" ? "India Secure Storage" : "Standard Storage"}</span>
            {info.expires_at && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(info.expires_at).toLocaleString()}</span>
            )}
            {info.downloads_left != null && !info.view_only && (
              <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> {info.downloads_left} left</span>
            )}
          </div>
        )}
      </header>

      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-6">
        {err && !info && (
          <Card className="p-8 text-center border-destructive/30 bg-destructive/5">
            <p className="text-destructive font-medium">{err}</p>
            <Link to="/" className="text-sm text-muted-foreground underline mt-3 inline-block">Go home</Link>
          </Card>
        )}

        {info && (
          <>
            {/* Title block */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <h1 className="font-display text-2xl sm:text-3xl font-bold break-words">{info.filename}</h1>
                <div className="text-xs text-muted-foreground mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded-full">{fmtSize(info.size_bytes)}</Badge>
                  {info.view_only && (
                    <Badge className="rounded-full bg-accent/15 text-accent border border-accent/30">
                      <Eye className="h-3 w-3 mr-1" /> View only
                    </Badge>
                  )}
                  {info.requires_password && (
                    <Badge className="rounded-full bg-primary/15 text-primary border border-primary/30">
                      <Lock className="h-3 w-3 mr-1" /> Password protected
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Player / preview */}
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/80 shadow-[0_40px_120px_-40px_hsl(var(--accent)/0.5)] aspect-video grid place-items-center">
              {!unlocked && (
                <div className="absolute inset-0 grid place-items-center text-center p-6 bg-gradient-to-br from-black/60 via-black/40 to-black/70 backdrop-blur-sm">
                  <div className="space-y-4 max-w-sm w-full">
                    <div className="mx-auto h-14 w-14 rounded-full bg-accent/15 grid place-items-center text-accent">
                      {kind === "video" ? <Play className="h-6 w-6" /> : kind === "audio" ? <Film className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                    </div>
                    {info.requires_password && (
                      <div className="text-left">
                        <Label className="flex items-center gap-1 text-xs uppercase tracking-wider">
                          <Lock className="h-3 w-3" /> Enter password
                        </Label>
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Share password"
                          className="mt-1 bg-background/70"
                          onKeyDown={(e) => { if (e.key === "Enter") loadMedia(); }}
                        />
                      </div>
                    )}
                    {err && <p className="text-sm text-destructive">{err}</p>}
                    <Button
                      onClick={loadMedia}
                      disabled={busy || (info.requires_password && !password)}
                      className="w-full bg-gradient-primary text-primary-foreground"
                    >
                      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                      {kind === "other" ? "Preview" : `Play ${kind}`}
                    </Button>
                  </div>
                </div>
              )}

              {unlocked && mediaUrl && kind === "video" && (
                <video
                  ref={playerRef}
                  src={mediaUrl}
                  controls
                  autoPlay
                  controlsList={info.view_only ? "nodownload noremoteplayback" : undefined}
                  onContextMenu={(e) => { if (info.view_only) e.preventDefault(); }}
                  className="w-full h-full"
                />
              )}
              {unlocked && mediaUrl && kind === "audio" && (
                <div className="w-full px-6">
                  <audio src={mediaUrl} controls autoPlay className="w-full" controlsList={info.view_only ? "nodownload" : undefined} />
                </div>
              )}
              {unlocked && mediaUrl && kind === "image" && (
                <img
                  src={mediaUrl}
                  alt={`Shared image preview — ${info.filename}`}
                  onContextMenu={(e) => { if (info.view_only) e.preventDefault(); }}
                  className="w-full h-full object-contain"
                />
              )}
              {unlocked && mediaUrl && kind === "other" && (
                <div className="text-center p-6">
                  <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No inline preview available for this file type.</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 justify-end">
              {err && unlocked && <p className="text-sm text-destructive mr-auto">{err}</p>}
              {info.view_only ? (
                <Badge variant="outline" className="text-xs">
                  <Eye className="h-3 w-3 mr-1" /> Download disabled by sender
                </Badge>
              ) : (
                <Button
                  onClick={download}
                  disabled={busy || (info.requires_password && !password)}
                  variant="secondary"
                  size="lg"
                >
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Download original
                </Button>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
};

export default Share;
