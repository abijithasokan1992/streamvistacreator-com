import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crown, Lock, Unlock, Upload, FolderPlus, RefreshCw, Trash2, Download, Pencil, Folder, FileText, Loader2, ShieldCheck, KeyRound, ChevronRight, Home } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const BUCKET = "founder-vault";
const SESSION_KEY = "fv.unlocked.v1";
const IDLE_MS = 10 * 60 * 1000; // 10 min auto-lock

type Entry = {
  name: string;
  id: string | null;
  isFolder: boolean;
  size: number | null;
  updated_at: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};

function fmtBytes(n: number | null) {
  if (!n && n !== 0) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export default function FounderVault() {
  const { user, isSuperAdmin } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [passwordSet, setPasswordSet] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [usedBytes, setUsedBytes] = useState<number>(0);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const idleTimer = useRef<number | null>(null);

  // Restore session unlock (per-tab only)
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") setUnlocked(true);
  }, []);

  // Check whether vault password has been initialized
  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      const { data } = await supabase.from("founder_vault_config").select("password_hash").eq("key", "primary").maybeSingle();
      setPasswordSet(!!data?.password_hash);
    })();
  }, [isSuperAdmin]);

  const resetIdle = useCallback(() => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      lock("idle");
    }, IDLE_MS);
  }, []);

  // Wire idle auto-lock
  useEffect(() => {
    if (!unlocked) return;
    const handler = () => resetIdle();
    ["mousemove", "keydown", "click", "scroll"].forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetIdle();
    return () => {
      ["mousemove", "keydown", "click", "scroll"].forEach(e => window.removeEventListener(e, handler));
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [unlocked, resetIdle]);

  const refreshList = useCallback(async () => {
    if (!unlocked) return;
    setLoadingList(true);
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
    setLoadingList(false);
    if (error) { toast.error(error.message); return; }
    const rows: Entry[] = (data ?? []).filter(r => r.name && r.name !== ".emptyFolderPlaceholder").map(r => ({
      name: r.name,
      id: r.id ?? null,
      isFolder: r.id === null,
      size: (r as any).metadata?.size ?? null,
      updated_at: (r as any).updated_at ?? null,
    }));
    setEntries(rows);
  }, [prefix, unlocked]);

  const refreshUsage = useCallback(async () => {
    if (!unlocked) return;
    // Walk entire bucket (small founder vault assumption). Recursively sum sizes.
    let total = 0;
    const walk = async (p: string) => {
      const { data, error } = await supabase.storage.from(BUCKET).list(p, { limit: 1000 });
      if (error || !data) return;
      for (const r of data) {
        if (!r.name || r.name === ".emptyFolderPlaceholder") continue;
        if (r.id === null) {
          await walk(p ? `${p}/${r.name}` : r.name);
        } else {
          total += (r as any).metadata?.size ?? 0;
        }
      }
    };
    await walk("");
    setUsedBytes(total);
  }, [unlocked]);

  const refreshAudit = useCallback(async () => {
    if (!unlocked) return;
    const { data } = await supabase.from("founder_vault_audit").select("id, action, details, created_at").order("created_at", { ascending: false }).limit(15);
    setAudit((data as AuditRow[]) ?? []);
  }, [unlocked]);

  useEffect(() => { void refreshList(); }, [refreshList]);
  useEffect(() => { void refreshUsage(); void refreshAudit(); }, [unlocked, refreshUsage, refreshAudit]);

  if (!isSuperAdmin) {
    return (
      <div className="glass-strong rounded-3xl p-8 text-center">
        <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h2 className="font-display text-xl font-bold mb-1">Restricted</h2>
        <p className="text-sm text-muted-foreground">The Founder Vault is reserved for the Platform Owner.</p>
      </div>
    );
  }

  async function initPassword() {
    if (pw.length < 10) return toast.error("Use at least 10 characters");
    if (pw !== pw2) return toast.error("Passwords don't match");
    const { error } = await supabase.rpc("founder_vault_set_password", { new_password: pw });
    if (error) return toast.error(error.message);
    toast.success("Vault passphrase set");
    setPasswordSet(true);
    setPw(""); setPw2("");
  }

  async function unlock() {
    if (!pw) return;
    setVerifying(true);
    const { data, error } = await supabase.rpc("founder_vault_verify_password", { candidate: pw });
    setVerifying(false);
    if (error) return toast.error(error.message);
    if (!data) { toast.error("Incorrect passphrase"); setPw(""); return; }
    sessionStorage.setItem(SESSION_KEY, "1");
    setUnlocked(true);
    setPw("");
  }

  function lock(reason: "manual" | "idle" = "manual") {
    sessionStorage.removeItem(SESSION_KEY);
    setUnlocked(false);
    setEntries([]);
    setAudit([]);
    void supabase.rpc("founder_vault_log", { action: reason === "idle" ? "auto_lock" : "manual_lock", details: {} });
    if (reason === "idle") toast.info("Vault locked due to inactivity");
  }

  async function rotatePassword() {
    const next = prompt("New passphrase (min 10 chars):");
    if (!next) return;
    if (next.length < 10) return toast.error("Too short");
    const { error } = await supabase.rpc("founder_vault_set_password", { new_password: next });
    if (error) return toast.error(error.message);
    toast.success("Passphrase rotated. Re-unlock next session.");
  }

  // -- Folder navigation
  const crumbs = useMemo(() => {
    const parts = prefix ? prefix.split("/").filter(Boolean) : [];
    return parts.map((p, i) => ({ label: p, path: parts.slice(0, i + 1).join("/") }));
  }, [prefix]);

  async function createFolder() {
    const name = prompt("Folder name:");
    if (!name) return;
    const clean = name.replace(/[\\/]/g, "").trim();
    if (!clean) return;
    const path = `${prefix ? prefix + "/" : ""}${clean}/.emptyFolderPlaceholder`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, new Blob([""]), { upsert: false });
    if (error) return toast.error(error.message);
    await supabase.rpc("founder_vault_log", { action: "folder_create", details: { path: clean, parent: prefix } });
    await refreshList();
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || !files.length) return;
    for (const f of Array.from(files)) {
      const path = `${prefix ? prefix + "/" : ""}${f.name}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, f, { upsert: false, contentType: f.type || undefined });
      if (error) { toast.error(`${f.name}: ${error.message}`); continue; }
      await supabase.rpc("founder_vault_log", { action: "upload", details: { path, size: f.size, type: f.type } });
    }
    toast.success("Upload complete");
    await Promise.all([refreshList(), refreshUsage(), refreshAudit()]);
  }

  async function download(e: Entry) {
    const path = `${prefix ? prefix + "/" : ""}${e.name}`;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Failed");
    await supabase.rpc("founder_vault_log", { action: "download", details: { path } });
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function rename(e: Entry) {
    const next = prompt("New name:", e.name);
    if (!next || next === e.name) return;
    const from = `${prefix ? prefix + "/" : ""}${e.name}`;
    const to = `${prefix ? prefix + "/" : ""}${next}`;
    const { error } = await supabase.storage.from(BUCKET).move(from, to);
    if (error) return toast.error(error.message);
    await supabase.rpc("founder_vault_log", { action: "rename", details: { from, to } });
    await refreshList();
  }

  async function move(e: Entry) {
    const next = prompt("New folder path (relative, blank = root):", prefix);
    if (next === null) return;
    const cleanFolder = next.replace(/^\/+|\/+$/g, "");
    const from = `${prefix ? prefix + "/" : ""}${e.name}`;
    const to = `${cleanFolder ? cleanFolder + "/" : ""}${e.name}`;
    if (from === to) return;
    const { error } = await supabase.storage.from(BUCKET).move(from, to);
    if (error) return toast.error(error.message);
    await supabase.rpc("founder_vault_log", { action: "move", details: { from, to } });
    await refreshList();
  }

  async function removeEntry(e: Entry) {
    // Re-confirm passphrase for delete
    const confirmPw = prompt(`Re-enter vault passphrase to delete "${e.name}":`);
    if (!confirmPw) return;
    const { data: ok, error: vErr } = await supabase.rpc("founder_vault_verify_password", { candidate: confirmPw });
    if (vErr || !ok) return toast.error("Passphrase check failed");
    const base = `${prefix ? prefix + "/" : ""}${e.name}`;
    if (e.isFolder) {
      // Recursively remove
      const remove = async (p: string) => {
        const { data } = await supabase.storage.from(BUCKET).list(p, { limit: 1000 });
        const paths: string[] = [];
        for (const r of data ?? []) {
          if (!r.name) continue;
          if (r.id === null) await remove(`${p}/${r.name}`);
          else paths.push(`${p}/${r.name}`);
        }
        if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
      };
      await remove(base);
      await supabase.storage.from(BUCKET).remove([`${base}/.emptyFolderPlaceholder`]);
    } else {
      const { error } = await supabase.storage.from(BUCKET).remove([base]);
      if (error) return toast.error(error.message);
    }
    await supabase.rpc("founder_vault_log", { action: "delete", details: { path: base, isFolder: e.isFolder } });
    toast.success("Deleted");
    await Promise.all([refreshList(), refreshUsage(), refreshAudit()]);
  }

  // ============ RENDER ============

  // First-time setup
  if (passwordSet === false) {
    return (
      <div className="glass-strong rounded-3xl p-8 max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Crown className="w-7 h-7 text-amber-300" />
          <h2 className="font-display text-2xl font-bold">Initialize Founder Vault</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Set a separate passphrase for the private Platform Owner vault. This is independent from your account password and is required every time the vault is opened.
        </p>
        <div className="space-y-3">
          <input type="password" autoComplete="new-password" placeholder="New passphrase (min 10 chars)" value={pw} onChange={e => setPw(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 text-sm" />
          <input type="password" autoComplete="new-password" placeholder="Confirm passphrase" value={pw2} onChange={e => setPw2(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 text-sm" />
          <button onClick={initPassword} className="h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary text-sm">Set passphrase</button>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="glass-strong rounded-3xl p-8 max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-7 h-7 text-amber-300" />
          <h2 className="font-display text-2xl font-bold">Unlock Founder Vault</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Private storage for the Platform Owner. Enter your vault passphrase to access masters, contracts, investor & legal documents.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); void unlock(); }} className="space-y-3">
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="Vault passphrase"
            value={pw}
            onChange={e => setPw(e.target.value)}
            className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 text-sm"
          />
          <button type="submit" disabled={verifying || !pw} className="h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary text-sm inline-flex items-center gap-2 disabled:opacity-60">
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />} Unlock
          </button>
        </form>
        <button onClick={rotatePassword} className="mt-6 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <KeyRound className="w-3.5 h-3.5" /> Rotate passphrase
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status / actions bar */}
      <div className="glass rounded-2xl p-5 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-400/30 grid place-items-center">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display font-bold text-base flex items-center gap-2">
              Founder Vault
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 inline-flex items-center gap-1">
                <Unlock className="w-3 h-3" /> Unlocked
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">Internal private storage · {fmtBytes(usedBytes)} used · auto-locks after 10 min idle</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="h-9 px-3 rounded-lg bg-gradient-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5">
            <Upload className="w-4 h-4" /> Upload
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { void uploadFiles(e.target.files); e.target.value = ""; }} />
          <button onClick={createFolder} className="h-9 px-3 rounded-lg border border-border/60 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-secondary">
            <FolderPlus className="w-4 h-4" /> New folder
          </button>
          <button onClick={() => { void refreshList(); void refreshUsage(); void refreshAudit(); }} className="h-9 px-3 rounded-lg border border-border/60 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-secondary">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => lock("manual")} className="h-9 px-3 rounded-lg border border-amber-400/40 text-amber-300 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-amber-500/10">
            <Lock className="w-4 h-4" /> Lock vault
          </button>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
        <button onClick={() => setPrefix("")} className="inline-flex items-center gap-1 hover:text-foreground">
          <Home className="w-3.5 h-3.5" /> founder-vault
        </button>
        {crumbs.map(c => (
          <span key={c.path} className="inline-flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            <button onClick={() => setPrefix(c.path)} className="hover:text-foreground">{c.label}</button>
          </span>
        ))}
      </div>

      {/* Listing */}
      <div className="glass rounded-2xl overflow-hidden">
        {loadingList ? (
          <div className="py-12 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Empty folder. Upload a file or create a subfolder.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border/40">
              <tr>
                <th className="text-left py-2.5 px-4">Name</th>
                <th className="text-right py-2.5 px-4 w-24">Size</th>
                <th className="text-right py-2.5 px-4 w-44">Modified</th>
                <th className="text-right py-2.5 px-4 w-56">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.name} className="border-b border-border/20 hover:bg-secondary/20">
                  <td className="py-2.5 px-4">
                    {e.isFolder ? (
                      <button onClick={() => setPrefix(prefix ? `${prefix}/${e.name}` : e.name)} className="inline-flex items-center gap-2 font-semibold hover:text-accent">
                        <Folder className="w-4 h-4 text-amber-300" /> {e.name}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" /> {e.name}
                      </span>
                    )}
                  </td>
                  <td className="text-right px-4 text-muted-foreground">{e.isFolder ? "—" : fmtBytes(e.size)}</td>
                  <td className="text-right px-4 text-muted-foreground text-xs">{e.updated_at ? new Date(e.updated_at).toLocaleString() : "—"}</td>
                  <td className="text-right px-4">
                    <div className="inline-flex items-center gap-1">
                      {!e.isFolder && (
                        <button onClick={() => download(e)} title="Download" className="p-1.5 rounded hover:bg-secondary"><Download className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={() => rename(e)} title="Rename" className="p-1.5 rounded hover:bg-secondary"><Pencil className="w-3.5 h-3.5" /></button>
                      {!e.isFolder && (
                        <button onClick={() => move(e)} title="Move" className="p-1.5 rounded hover:bg-secondary"><Folder className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={() => removeEntry(e)} title="Delete (requires re-auth)" className="p-1.5 rounded hover:bg-red-500/10 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Audit */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-sm">Recent vault activity</h3>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Last 15 events</span>
        </div>
        {audit.length === 0 ? (
          <div className="text-xs text-muted-foreground">No events yet.</div>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {audit.map(a => (
              <li key={a.id} className="flex items-center justify-between gap-3 border-b border-border/20 pb-1.5">
                <span className="font-mono text-foreground">{a.action}</span>
                <span className="text-muted-foreground truncate flex-1 px-3">{Object.keys(a.details || {}).length ? JSON.stringify(a.details) : ""}</span>
                <span className="text-muted-foreground/80 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-[10px] text-muted-foreground/70 text-center">
        Signed in as {user?.email}. All vault actions are audit-logged.
      </div>
    </div>
  );
}
