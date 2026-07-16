import { useState } from "react";
import { Cloud, Copy, Loader2, ShieldCheck, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type MintResult = {
  ok: true;
  url: string;
  expires_at: string;
  prefix: string;
} | { ok: false; error: string; code?: string };

/**
 * Studio-facing card: mints a short-lived, write-only Oracle Cloud
 * Pre-Authenticated Request (PAR) URL scoped to `c2c-ingest/studio_{uid}/`.
 * Cameras / field devices can PUT directly to that URL — no OCI credentials
 * ever leave the backend, and the URL cannot list or read the bucket.
 */
export default function CameraToCloudLinkCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Extract<MintResult, { ok: true }> | null>(null);
  const [copied, setCopied] = useState(false);
  const [ttlHours, setTtlHours] = useState<24 | 72 | 168>(24);

  async function mint() {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-c2c-link", {
        body: { ttl_hours: ttlHours, label: "shoot" },
      });
      if (error) throw new Error(error.message || "Request failed");
      const res = data as MintResult;
      if (!res?.ok) {
        throw new Error((res as any)?.error || "Failed to mint link");
      }
      setResult(res);
      toast.success("Camera-to-Cloud link ready");
    } catch (e) {
      toast.error((e as Error).message || "Could not create link");
    } finally {
      setLoading(false);
    }
  }

  async function copyUrl() {
    if (!result?.url) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copy failed — select the URL manually");
    }
  }

  const expiresLabel = result
    ? new Date(result.expires_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  return (
    <Card className="p-6 border-border/50">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-accent/10 p-2 shrink-0">
          <Cloud className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-lg leading-tight">Camera-to-Cloud Link</h3>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              Write-only
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a secure, expiring URL your camera or field device can upload
            directly to. Files land in your isolated studio prefix — no credentials
            leave StreamVista.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Expires in:</span>
            {[24, 72, 168].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setTtlHours(h as 24 | 72 | 168)}
                className={`px-2.5 py-1 rounded-md text-xs border transition ${
                  ttlHours === h
                    ? "bg-accent text-accent-foreground border-accent"
                    : "border-border/60 hover:bg-secondary/40"
                }`}
              >
                {h === 168 ? "7 days" : `${h}h`}
              </button>
            ))}
            <Button
              onClick={mint}
              disabled={loading}
              size="sm"
              className="ml-auto"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Minting…</>
              ) : (
                "Generate link"
              )}
            </Button>
          </div>

          {result && (
            <div className="mt-4 rounded-lg border border-border/50 bg-secondary/20 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-mono">{result.prefix}</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="flex-1 min-w-0 text-[11px] font-mono break-all bg-background/60 rounded p-2 border border-border/40">
                  {result.url}
                </code>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={copyUrl}
                  className="shrink-0"
                  aria-label="Copy URL"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                Valid until {expiresLabel}
              </div>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground mt-3">
            Cameras <span className="font-mono">PUT</span> to{" "}
            <span className="font-mono">{"{link}/{filename}"}</span>. The link can
            write but not read or list your bucket.
          </p>
        </div>
      </div>
    </Card>
  );
}
