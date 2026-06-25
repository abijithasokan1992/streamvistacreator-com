import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trash2, Pencil, Link2, Download, Upload, Search, ShieldCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type Owner = { display_name: string | null; studio_name: string | null; plan_tier: string };
type Upload = {
  id: string; user_id: string; file_name: string; file_size: number;
  mime_type: string | null; bucket: string; namespace: string; region: string;
  object_key: string; status: string; created_at: string; owner: Owner | null;
};
type AdminUser = { id: string; email: string | null; profile: Owner | null; roles: string[] };

function fmtBytes(n: number) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${u[i]}`;
}

export default function GlobalAssetManager() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterUser, setFilterUser] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<Upload | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [sharing, setSharing] = useState<Upload | null>(null);
  const [shareHours, setShareHours] = useState(168);
  const [shareMax, setShareMax] = useState<string>("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [uploadFor, setUploadFor] = useState<string>("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const invoke = async (action: string, payload: any = {}) => {
    const { data, error } = await supabase.functions.invoke("admin-asset-manager", { body: { action, ...payload } });
    if (error || (data && data.error)) throw new Error(error?.message || (data?.error ?? "Request failed"));
    return data;
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const [u, list] = await Promise.all([
        invoke("list", filterUser !== "all" ? { userId: filterUser } : {}),
        users.length ? Promise.resolve({ users }) : invoke("list-users"),
      ]);
      setUploads(u.uploads ?? []);
      if (!users.length) setUsers((list as any).users ?? []);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filterUser]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? uploads.filter((u) =>
      u.file_name.toLowerCase().includes(q) ||
      (u.owner?.display_name ?? "").toLowerCase().includes(q) ||
      (u.owner?.studio_name ?? "").toLowerCase().includes(q),
    ) : uploads;
  }, [uploads, search]);

  const onDelete = async (row: Upload) => {
    if (!confirm(`Permanently delete "${row.file_name}"? This removes the file from Oracle storage AND the database.`)) return;
    try { await invoke("delete", { id: row.id }); toast.success("Deleted"); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };

  const onDownload = async (row: Upload) => {
    try {
      const r = await invoke("download-par", { id: row.id, expiresInMinutes: 30 });
      window.open(r.url, "_blank");
    } catch (e: any) { toast.error(e.message); }
  };

  const submitRename = async () => {
    if (!renaming) return;
    try { await invoke("rename", { id: renaming.id, newName: renameValue }); toast.success("Renamed"); setRenaming(null); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };

  const submitShare = async () => {
    if (!sharing) return;
    try {
      const r = await invoke("create-share", {
        id: sharing.id, expiresInHours: shareHours,
        maxDownloads: shareMax ? Number(shareMax) : null,
      });
      setShareUrl(r.url); toast.success("Share link ready");
    } catch (e: any) { toast.error(e.message); }
  };

  const submitUpload = async () => {
    if (!uploadFor || !uploadFile) { toast.error("Pick user & file"); return; }
    setUploading(true);
    try {
      const par = await invoke("create-upload-par", {
        userId: uploadFor, fileName: uploadFile.name, contentType: uploadFile.type,
      });
      const r = await fetch(par.url, { method: "PUT", body: uploadFile });
      if (!r.ok) throw new Error(`OCI upload failed: ${r.status}`);
      await invoke("register-upload", {
        userId: uploadFor, fileName: uploadFile.name, fileSize: uploadFile.size,
        mimeType: uploadFile.type, objectKey: par.objectKey,
      });
      toast.success("Uploaded into user repository");
      setUploadFile(null); refresh();
    } catch (e: any) { toast.error(e.message); }
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-purple-400" /> Global Asset Manager
          </h3>
          <p className="text-sm text-muted-foreground">God-mode CRUD across the StreamVista Global Repository.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files / studios" className="pl-8 w-60" />
          </div>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All users" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.profile?.studio_name || u.profile?.display_name || u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm"><Upload className="h-4 w-4 mr-2" />Upload for user</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload on behalf of a user</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Select value={uploadFor} onValueChange={setUploadFor}>
                  <SelectTrigger><SelectValue placeholder="Pick user repository" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.profile?.studio_name || u.profile?.display_name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
              </div>
              <DialogFooter>
                <Button onClick={submitUpload} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Upload to repository
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b border-border/40">
          <div className="col-span-4">File</div>
          <div className="col-span-3">Owner</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>
        {filtered.length === 0 && !loading && (
          <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <FileText className="h-4 w-4" /> No files
          </div>
        )}
        {filtered.map((u) => (
          <div key={u.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border/30 hover:bg-white/[0.02] text-sm items-center">
            <div className="col-span-4 truncate">
              <div className="font-medium truncate">{u.file_name}</div>
              <div className="text-xs text-muted-foreground truncate">{u.mime_type || "—"}</div>
            </div>
            <div className="col-span-3 truncate">
              <div className="truncate">{u.owner?.studio_name || u.owner?.display_name || u.user_id.slice(0, 8)}</div>
              <Badge variant="secondary" className="mt-1 text-[10px]">{u.owner?.plan_tier ?? "free"}</Badge>
            </div>
            <div className="col-span-2 text-muted-foreground">{fmtBytes(u.file_size)}</div>
            <div className="col-span-3 flex items-center justify-end gap-1">
              <Button size="icon" variant="ghost" onClick={() => onDownload(u)} title="Download"><Download className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => { setRenaming(u); setRenameValue(u.file_name); }} title="Rename"><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => { setSharing(u); setShareUrl(null); setShareHours(168); setShareMax(""); }} title="Share"><Link2 className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => onDelete(u)} title="Delete" className="text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename file</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter><Button onClick={submitRename}>Rename</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sharing} onOpenChange={(o) => !o && setSharing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate secure share link</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">File: <span className="text-foreground">{sharing?.file_name}</span></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Expires in (hours)</label>
                <Input type="number" value={shareHours} onChange={(e) => setShareHours(Number(e.target.value) || 168)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Max downloads (optional)</label>
                <Input type="number" value={shareMax} onChange={(e) => setShareMax(e.target.value)} placeholder="∞" />
              </div>
            </div>
            {shareUrl && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs break-all">
                <div className="text-emerald-300 mb-1 font-semibold">Share link ready</div>
                <a href={shareUrl} target="_blank" rel="noreferrer" className="text-emerald-200 underline">{shareUrl}</a>
                <Button size="sm" variant="ghost" className="ml-2" onClick={() => { navigator.clipboard.writeText(shareUrl!); toast.success("Copied"); }}>Copy</Button>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={submitShare}><Link2 className="h-4 w-4 mr-2" />Create link</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
