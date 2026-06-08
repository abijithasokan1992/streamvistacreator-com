import { useEffect, useState, useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Copy, Trash2, Shield, Cloud, Loader2 } from "lucide-react";

type Tier = "lite" | "sovereign";

type SharedFile = {
  id: string;
  filename: string;
  size_bytes: number;
  tier: string;
  share_token: string;
  storage_path: string;
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  revoked: boolean;
  created_at: string;
  has_password: boolean;
};

const MAX_BYTES = 2_684_354_560; // 2.5 GB

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

function randomToken() {
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
}

const Vault = () => {
  const { user, loading } = useAuth();
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [tier, setTier] = useState<Tier>("lite");
  const [password, setPassword] = useState("");
  const [expiryDays, setExpiryDays] = useState<number | "">("");
  const [maxDownloads, setMaxDownloads] = useState<number | "">("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("shared_files")
      .select("id, filename, size_bytes, tier, share_token, storage_path, expires_at, max_downloads, download_count, revoked, created_at, password_hash")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    setFiles(((data ?? []) as any[]).map((r) => ({
      id: r.id, filename: r.filename, size_bytes: r.size_bytes, tier: r.tier,
      share_token: r.share_token, storage_path: r.storage_path, expires_at: r.expires_at,
      max_downloads: r.max_downloads, download_count: r.download_count, revoked: r.revoked,
      created_at: r.created_at, has_password: !!r.password_hash,
    })));
  };

  useEffect(() => { load(); }, [user?.id]);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;

  const handleUpload = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error("File exceeds 2.5 GB limit");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const token = randomToken();
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const path = `${user.id}/${token}.${ext}`;

      const { error: upErr } = await supabase.storage.from("vault").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
      if (upErr) throw upErr;
      setProgress(100);

      const expiresAt = expiryDays ? new Date(Date.now() + Number(expiryDays) * 86400000).toISOString() : null;

      const { data: inserted, error: dbErr } = await supabase.from("shared_files").insert({
        owner_id: user.id,
        storage_path: path,
        filename: file.name,
        size_bytes: file.size,
        mime_type: file.type || null,
        tier,
        share_token: token,
        expires_at: expiresAt,
        max_downloads: maxDownloads ? Number(maxDownloads) : null,
      }).select("id").single();
      if (dbErr) throw dbErr;

      // Hash + store password server-side with per-file salt (PBKDF2).
      if (password && inserted?.id) {
        const { error: pwErr } = await supabase.functions.invoke("vault-share", {
          body: { action: "set-password", fileId: inserted.id, newPassword: password },
        });
        if (pwErr) throw pwErr;
      }

      toast.success("Uploaded — share link ready");
      setPassword(""); setExpiryDays(""); setMaxDownloads("");
      load();
    } catch (e) {
      console.error("Vault upload error", e);
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("shared_files").update({ revoked: true }).eq("id", id);
    if (error) toast.error("Revoke failed"); else { toast.success("Revoked"); load(); }
  };

  const remove = async (f: SharedFile) => {
    if (!confirm(`Delete ${f.filename}?`)) return;
    await supabase.storage.from("vault").remove([f.storage_path]);
    await supabase.from("shared_files").delete().eq("id", f.id);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-xl">Cloud X · Vault</Link>
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Secure File Vault</h1>
          <p className="text-muted-foreground">Upload up to 2.5 GB per file. Share with link + password + expiry.</p>
        </div>

        {/* Tier picker */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card
            onClick={() => setTier("lite")}
            className={`p-5 cursor-pointer transition border-2 ${tier === "lite" ? "border-primary" : "border-border"}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="h-5 w-5" />
              <h3 className="font-semibold">Cloud X Lite</h3>
              <Badge variant="secondary">Free · 5 GB</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Fast global storage. Great for previews and proofs.</p>
          </Card>
          <Card
            onClick={() => setTier("sovereign")}
            className={`p-5 cursor-pointer transition border-2 ${tier === "sovereign" ? "border-primary" : "border-border"}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5" />
              <h3 className="font-semibold">Cloud X Sovereign</h3>
              <Badge>₹499/mo · 500 GB</Badge>
            </div>
            <p className="text-sm text-muted-foreground">India-sovereign node. Password + expiry + download caps.</p>
          </Card>
        </div>

        {/* Upload */}
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Upload a file</h2>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault(); setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleUpload(f);
            }}
            onClick={() => fileInput.current?.click()}
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition ${drag ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">{uploading ? "Uploading…" : "Drag & drop or click to choose"}</p>
            <p className="text-xs text-muted-foreground mt-1">Max 2.5 GB · tier: {tier === "lite" ? "Cloud X Lite" : "Cloud X Sovereign"}</p>
            {uploading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> {progress}%
              </div>
            )}
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.currentTarget.value = ""; }}
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mt-5">
            <div>
              <Label>Password (optional)</Label>
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Recipient password" />
            </div>
            <div>
              <Label>Expires in (days)</Label>
              <Input type="number" min={1} value={expiryDays} onChange={(e) => setExpiryDays(e.target.value ? Number(e.target.value) : "")} placeholder="No expiry" />
            </div>
            <div>
              <Label>Max downloads</Label>
              <Input type="number" min={1} value={maxDownloads} onChange={(e) => setMaxDownloads(e.target.value ? Number(e.target.value) : "")} placeholder="Unlimited" />
            </div>
          </div>
        </Card>

        {/* File list */}
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Your shared files</h2>
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files yet.</p>
          ) : (
            <div className="space-y-3">
              {files.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-4 border border-border rounded-lg p-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{f.filename}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      <span>{fmtSize(f.size_bytes)}</span>
                      <span>{f.tier === "sovereign" ? "Sovereign" : "Lite"}</span>
                      {f.has_password && <span>🔒 Password</span>}
                      {f.expires_at && <span>Expires {new Date(f.expires_at).toLocaleDateString()}</span>}
                      <span>{f.download_count}{f.max_downloads ? `/${f.max_downloads}` : ""} downloads</span>
                      {f.revoked && <Badge variant="destructive">Revoked</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyLink(f.share_token)} disabled={f.revoked}>
                      <Copy className="h-4 w-4 mr-1" /> Link
                    </Button>
                    {!f.revoked && (
                      <Button size="sm" variant="outline" onClick={() => revoke(f.id)}>Revoke</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(f)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Vault;
