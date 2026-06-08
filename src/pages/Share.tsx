import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Lock, Shield, Loader2 } from "lucide-react";

type Info = {
  filename: string;
  size_bytes: number;
  tier: string;
  requires_password: boolean;
  expires_at: string | null;
  downloads_left: number | null;
};

function fmtSize(b: number) {
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

const Share = () => {
  const { token } = useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

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

  const download = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("vault-share", {
      body: { action: "download", token, password },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      setErr((data as any)?.error || "Download failed");
      return;
    }
    const url = (data as any).url as string;
    window.location.href = url;
  };

  return (
    <main className="min-h-dvh bg-background text-foreground grid place-items-center px-4">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <span className="text-sm text-muted-foreground">Cloud X secure share</span>
        </div>

        {err && !info && (
          <div className="text-center py-6">
            <p className="text-destructive font-medium">{err}</p>
            <Link to="/" className="text-sm text-muted-foreground underline mt-3 inline-block">Go home</Link>
          </div>
        )}

        {info && (
          <>
            <div>
              <h1 className="text-xl font-bold break-all">{info.filename}</h1>
              <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                <span>{fmtSize(info.size_bytes)}</span>
                <span>{info.tier === "sovereign" ? "India Secure Storage" : "Standard Storage"}</span>
                {info.expires_at && <span>Expires {new Date(info.expires_at).toLocaleDateString()}</span>}
                {info.downloads_left != null && <span>{info.downloads_left} downloads left</span>}
              </div>
            </div>

            {info.requires_password && (
              <div>
                <Label className="flex items-center gap-1"><Lock className="h-3 w-3" /> Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter share password" />
              </div>
            )}

            {err && <p className="text-sm text-destructive">{err}</p>}

            <Button onClick={download} disabled={busy || (info.requires_password && !password)} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Download
            </Button>
          </>
        )}
      </Card>
    </main>
  );
};

export default Share;
