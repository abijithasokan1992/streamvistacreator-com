import { useEffect, useState } from "react";
import { Loader2, Link2, Copy, Check, Trash2, Plus, Shield, Eye, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Upload = {
  id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number;
  par_url: string | null;
  par_expires_at: string | null;
  object_key: string;
};

type ReviewLink = {
  id: string;
  token: string;
  asset_name: string;
  expires_at: string | null;
  max_views: number | null;
  view_count: number;
  revoked: boolean;
  view_only: boolean;
  password_hash: string | null;
  created_at: string;
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ShareReviewModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  projectName: string;
  workspaceId: string;
}) {
  const { user } = useAuth();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [links, setLinks] = useState<ReviewLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // form state
  const [uploadId, setUploadId] = useState<string>("");
  const [expiresHours, setExpiresHours] = useState<string>("168"); // 7 days
  const [maxViews, setMaxViews] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [viewOnly, setViewOnly] = useState(true);

  const reviewOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const load = async () => {
    if (!user || !workspaceId) return;
    setLoading(true);
    // Pull all workspace uploads that are ready; RLS limits to owner/admin via earlier policy.
    const [uplRes, lnkRes] = await Promise.all([
      (supabase as any)
        .from("recent_uploads")
        .select("id, file_name, mime_type, file_size, par_url, par_expires_at, object_key")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(50),
      (supabase as any)
        .from("review_links")
        .select("id, token, asset_name, expires_at, max_views, view_count, revoked, view_only, password_hash, created_at")
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);
    setLoading(false);
    if (uplRes.error) toast.error(uplRes.error.message);
    setUploads((uplRes.data ?? []) as Upload[]);
    setLinks((lnkRes.data ?? []) as ReviewLink[]);
    if (uplRes.data?.[0]) setUploadId((uplRes.data as Upload[])[0].id);
  };

  useEffect(() => { if (open) load(); }, [open, workspaceId, projectId]);

  const createLink = async () => {
    if (!user) return;
    const upload = uploads.find((u) => u.id === uploadId);
    if (!upload) return toast.error("Pick an asset to share");
    if (!upload.par_url) return toast.error("This asset has no playback URL yet — wait for upload to finish.");

    const hrs = Number(expiresHours);
    const mv = maxViews.trim() ? Math.max(1, Math.floor(Number(maxViews))) : null;
    const expiresAt = hrs > 0 ? new Date(Date.now() + hrs * 3600 * 1000).toISOString() : null;

    let passwordHash: string | null = null;
    let passwordSalt: string | null = null;
    if (password.trim()) {
      passwordSalt = randomSalt();
      passwordHash = await sha256Hex(`${passwordSalt}::${password.trim()}`);
    }

    setCreating(true);
    const { error } = await (supabase as any).from("review_links").insert({
      workspace_id: workspaceId,
      project_id: projectId,
      upload_id: upload.id,
      created_by: user.id,
      asset_name: upload.file_name,
      asset_mime: upload.mime_type,
      asset_size_bytes: upload.file_size,
      asset_object_key: upload.object_key,
      asset_par_url: upload.par_url,
      asset_par_expires_at: upload.par_expires_at,
      password_hash: passwordHash,
      password_salt: passwordSalt,
      expires_at: expiresAt,
      max_views: mv,
      view_only: viewOnly,
    });
    setCreating(false);
    if (error) return toast.error(error.message);

    toast.success("Review link created");
    setPassword("");
    setMaxViews("");
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this review link? It will stop working immediately.")) return;
    const { error } = await (supabase as any)
      .from("review_links")
      .update({ revoked: true })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Link revoked");
    load();
  };

  const copy = async (token: string, id: string) => {
    const url = `${reviewOrigin}/review/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.success("Link copied");
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Share / Review — {projectName}
          </DialogTitle>
          <DialogDescription>
            Generate secure review links with expiry, view limits, and optional password.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading assets…
          </div>
        ) : uploads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            No uploads found in this workspace yet. Upload media first, then come back to create review links.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Create form */}
            <div className="rounded-xl border border-border/60 p-4 space-y-3 bg-card/40">
              <div className="space-y-2">
                <Label htmlFor="rl-asset">Asset</Label>
                <select
                  id="rl-asset"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={uploadId}
                  onChange={(e) => setUploadId(e.target.value)}
                >
                  {uploads.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.file_name}
                      {u.mime_type ? ` · ${u.mime_type}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="rl-expiry" className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Expires in (hrs)
                  </Label>
                  <Input
                    id="rl-expiry"
                    type="number"
                    min={0}
                    value={expiresHours}
                    onChange={(e) => setExpiresHours(e.target.value)}
                    placeholder="0 = no expiry"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rl-views" className="inline-flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Max views
                  </Label>
                  <Input
                    id="rl-views"
                    type="number"
                    min={1}
                    value={maxViews}
                    onChange={(e) => setMaxViews(e.target.value)}
                    placeholder="Unlimited"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rl-pwd" className="inline-flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Password
                  </Label>
                  <Input
                    id="rl-pwd"
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Optional"
                    maxLength={128}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch id="rl-view-only" checked={viewOnly} onCheckedChange={setViewOnly} />
                  <Label htmlFor="rl-view-only" className="text-xs">View only (no download UI)</Label>
                </div>
                <Button onClick={createLink} disabled={creating || !uploadId} className="gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Link
                </Button>
              </div>
            </div>

            {/* Existing links */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Existing review links ({links.length})
              </h3>
              {links.length === 0 ? (
                <p className="text-xs text-muted-foreground">No review links yet for this project.</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {links.map((l) => {
                    const expired = l.expires_at && new Date(l.expires_at).getTime() < Date.now();
                    const exhausted = l.max_views !== null && l.view_count >= l.max_views;
                    const dead = l.revoked || expired || exhausted;
                    return (
                      <li
                        key={l.id}
                        className={`rounded-lg border p-2.5 flex items-center gap-2 ${
                          dead ? "border-destructive/30 opacity-60" : "border-border/60"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{l.asset_name}</div>
                          <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2">
                            <span>{l.view_count}{l.max_views ? `/${l.max_views}` : ""} views</span>
                            {l.expires_at && <span>· exp {new Date(l.expires_at).toLocaleDateString()}</span>}
                            {l.password_hash && <span>· 🔒</span>}
                            {l.revoked && <span className="text-destructive">· revoked</span>}
                            {expired && !l.revoked && <span className="text-destructive">· expired</span>}
                            {exhausted && !l.revoked && !expired && <span className="text-destructive">· limit reached</span>}
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => copy(l.token, l.id)}
                          disabled={dead}
                          title="Copy link"
                        >
                          {copiedId === l.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => revoke(l.id)}
                          disabled={l.revoked}
                          title="Revoke"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
