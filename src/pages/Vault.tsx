import { useEffect, useMemo, useState, useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Upload, Copy, Trash2, Shield, Cloud, Loader2, FolderLock, BarChart3, UserCircle2,
  LifeBuoy, Sparkles, Mail, MessageCircle, ChevronRight, Settings2, LogOut, Crown,
  Link2, FileText, Activity,
} from "lucide-react";
import MyAccount from "@/components/dashboard/MyAccount";
import ReferralRewards from "@/components/dashboard/ReferralRewards";
import FirstStepsCard from "@/components/dashboard/FirstStepsCard";
import { UploadManagerProvider, useUploadManager } from "@/components/vault/UploadManager";
import ShareLinkModal, { ShareLinkFile } from "@/components/vault/ShareLinkModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";


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
  view_only: boolean;
};

const MAX_BYTES = 2_684_354_560; // 2.5 GB
const SECTIONS = [
  { id: "files", label: "My Vault", icon: FolderLock },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "account", label: "My Account", icon: UserCircle2 },
  { id: "support", label: "Support", icon: LifeBuoy },
] as const;
type SectionId = typeof SECTIONS[number]["id"];

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

function randomToken() {
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
}

const VaultInner = ({ reloadRef }: { reloadRef?: React.MutableRefObject<() => void> }) => {
  const { user, loading, signOut } = useAuth();
  const { enqueue, pickAndEnqueue } = useUploadManager();
  const [section, setSection] = useState<SectionId>("files");
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [tier, setTier] = useState<Tier>("lite");
  const [password, setPassword] = useState("");
  const [expiryDays, setExpiryDays] = useState<number | "">("");
  const [maxDownloads, setMaxDownloads] = useState<number | "">("");
  const [drag, setDrag] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<ShareLinkFile | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);



  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("shared_files")
      .select("id, filename, size_bytes, tier, share_token, storage_path, expires_at, max_downloads, download_count, revoked, created_at, has_password, view_only")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    setFiles(((data ?? []) as any[]).map((r) => ({
      id: r.id, filename: r.filename, size_bytes: r.size_bytes, tier: r.tier,
      share_token: r.share_token, storage_path: r.storage_path, expires_at: r.expires_at,
      max_downloads: r.max_downloads, download_count: r.download_count, revoked: r.revoked,
      created_at: r.created_at, has_password: !!r.has_password, view_only: !!r.view_only,
    })));
  };

  useEffect(() => { load(); }, [user?.id]);
  useEffect(() => { if (reloadRef) reloadRef.current = load; }, [reloadRef, user?.id]);


  const stats = useMemo(() => {
    const active = files.filter((f) => !f.revoked);
    const totalBytes = files.reduce((s, f) => s + f.size_bytes, 0);
    const totalDownloads = files.reduce((s, f) => s + (f.download_count || 0), 0);
    const protectedCount = files.filter((f) => f.has_password).length;
    return {
      fileCount: files.length,
      activeCount: active.length,
      totalBytes,
      totalDownloads,
      protectedCount,
    };
  }, [files]);

  if (loading) return <div className="min-h-dvh grid place-items-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;


  const handleUpload = (file: File) => {
    if (file.size > MAX_BYTES) { toast.error("File exceeds 2.5 GB limit"); return; }
    enqueue(file, {
      tier,
      password: password || undefined,
      expiryDays,
      maxDownloads,
    });
    setPassword(""); setExpiryDays(""); setMaxDownloads("");
    setUploadOpen(false);
    toast.success(`${file.name} added to upload queue`);
  };

  // Nothing else needed here — the provider owns the upload pipeline via its `config` prop on the outer wrapper.



  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/s/${token}`);
    toast.success("Share link copied");
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




  const UploadDialog = (
    <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <button className="relative h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary text-sm inline-flex items-center gap-2 transition hover:scale-[1.02] hover:shadow-[0_0_40px_-6px_hsl(var(--accent)/0.7)]">
              <Upload className="w-4 h-4" /> Upload File
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent animate-ping opacity-60" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent" />
            </button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Drop a file, paste from clipboard, or ingest from a card — uploads run in the background.</TooltipContent>
      </Tooltip>

      <DialogContent className="max-w-xl glass-strong border-border/60">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Upload to {tier === "lite" ? "Standard Storage" : "India Secure Storage"}</DialogTitle>
        </DialogHeader>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const dropped = Array.from(e.dataTransfer.files || []); dropped.forEach(handleUpload); }}
          onClick={async () => {
            // Prefer FS Access API so we can auto-resume across refresh / power loss.
            const id = await pickAndEnqueue({
              tier, password: password || undefined, expiryDays, maxDownloads,
            });
            if (id) {
              setPassword(""); setExpiryDays(""); setMaxDownloads("");
              setUploadOpen(false);
              toast.success("Added to upload queue — will auto-resume if interrupted");
            } else {
              fileInput.current?.click();
            }
          }}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition ${drag ? "border-accent bg-accent/5 shadow-[0_0_40px_-10px_hsl(var(--accent)/0.6)]" : "border-border/60 hover:border-accent/60 hover:shadow-[0_0_30px_-15px_hsl(var(--accent)/0.5)]"}`}
        >
          <Upload className="h-8 w-8 mx-auto mb-3 text-accent" />
          <p className="font-medium">Drag & drop files, or click to choose</p>
          <p className="text-xs text-muted-foreground mt-1">Multiple files supported · Max 2.5 GB each · Upload keeps running in the background</p>
          <input
            ref={fileInput} type="file" multiple className="hidden"
            onChange={(e) => { const list = Array.from(e.target.files || []); list.forEach(handleUpload); e.currentTarget.value = ""; }}
          />

        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="adv" className="border-border/40">
            <AccordionTrigger className="text-xs uppercase tracking-wider text-muted-foreground hover:no-underline">
              <span className="inline-flex items-center gap-2"><Settings2 className="w-3.5 h-3.5" /> Advanced sharing options</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid sm:grid-cols-3 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Password</Label>
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Optional" className="bg-secondary/40 border-border/60" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Expires (days)</Label>
                  <Input type="number" min={1} value={expiryDays} onChange={(e) => setExpiryDays(e.target.value ? Number(e.target.value) : "")} placeholder="None" className="bg-secondary/40 border-border/60" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Max downloads</Label>
                  <Input type="number" min={1} value={maxDownloads} onChange={(e) => setMaxDownloads(e.target.value ? Number(e.target.value) : "")} placeholder="∞" className="bg-secondary/40 border-border/60" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 mt-4">
                <TierTile active={tier === "lite"} onClick={() => setTier("lite")} icon={<Cloud className="w-4 h-4" />} title="Standard" sub="Free · 5 GB" />
                <TierTile active={tier === "sovereign"} onClick={() => setTier("sovereign")} icon={<Shield className="w-4 h-4" />} title="India Secure" sub="₹499/mo · 500 GB" />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setUploadOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/50 glass sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
              <FolderLock className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <Link to="/" className="font-display font-bold text-sm hover:text-accent transition-colors">Creator Studio</Link>
              <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">{user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="hidden sm:inline-flex px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">Site</Link>
            <button onClick={signOut} className="px-3 py-2 text-sm rounded-md border border-border/60 hover:bg-secondary inline-flex items-center gap-2">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container py-6 lg:py-10">
        <div className="grid lg:grid-cols-[240px_1fr] gap-6 lg:gap-8">
          {/* Side nav */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav className="glass rounded-2xl p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
              {SECTIONS.map((s) => {
                const active = section === s.id;
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.id)}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                      active
                        ? "bg-gradient-primary text-primary-foreground glow-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{s.label}</span>
                    <ChevronRight className={`w-3.5 h-3.5 ml-auto hidden lg:block transition-transform ${active ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`} />
                  </button>
                );
              })}
            </nav>

            {/* Upgrade tile (1-click) */}
            <div className="glass-strong rounded-2xl p-4 mt-4 hidden lg:block">
              <div className="flex items-center gap-2 mb-1.5">
                <Crown className="w-4 h-4 text-accent" />
                <span className="font-display font-semibold text-sm">Go Sovereign</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">India-resident storage, longer expiries, premium support.</p>
              <Link to="/auth?plan=monthly" className="block w-full text-center h-9 leading-9 rounded-lg bg-gradient-primary text-primary-foreground text-xs font-semibold glow-primary">
                Upgrade Plan
              </Link>
            </div>
          </aside>

          {/* Main */}
          <main className="min-w-0 space-y-6 animate-fade-in">
            {section === "files" && (
              <>
                {user && (
                  <FirstStepsCard
                    userId={user.id}
                    variant="creator"
                    onUpload={() => setUploadOpen(true)}
                    onShare={() => setUploadOpen(true)}
                    onInvite={() => setSection("account" as SectionId)}
                  />
                )}
                <SectionHeader
                  title="My Vault"
                  desc="Securely store and share files with one-click links, passwords and expiries."
                  actions={
                    <div className="flex gap-2">
                      {UploadDialog}
                    </div>
                  }
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatPill label="Files" value={String(stats.fileCount)} icon={<FileText className="w-3.5 h-3.5" />} />
                  <StatPill label="Active shares" value={String(stats.activeCount)} icon={<Link2 className="w-3.5 h-3.5" />} />
                  <StatPill label="Storage used" value={fmtSize(stats.totalBytes)} icon={<Cloud className="w-3.5 h-3.5" />} />
                  <StatPill label="Downloads" value={String(stats.totalDownloads)} icon={<Activity className="w-3.5 h-3.5" />} />
                </div>

                <div className="glass rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-lg font-bold">Shared files</h2>
                    {files.length > 0 && (
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{files.length} total</span>
                    )}
                  </div>
                  {files.length === 0 ? (
                    <EmptyState
                      icon={<FolderLock className="w-8 h-8 text-muted-foreground" />}
                      title="No files yet"
                      desc="Upload your first file to generate a secure share link."
                      action={UploadDialog}
                    />
                  ) : (
                    <div className="space-y-2">
                      {files.map((f) => (
                        <FileRow key={f.id} file={f} onShare={(file) => setShareTarget(file)} onRevoke={revoke} onRemove={remove} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {section === "analytics" && (
              <>
                <SectionHeader title="Analytics" desc="Track storage, share activity and growth at a glance." />
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <BigStat label="Total files" value={String(stats.fileCount)} />
                  <BigStat label="Storage used" value={fmtSize(stats.totalBytes)} />
                  <BigStat label="Total downloads" value={String(stats.totalDownloads)} />
                  <BigStat label="Password-protected" value={String(stats.protectedCount)} />
                </div>
                <div className="glass rounded-2xl p-6">
                  <h3 className="font-display text-base font-bold mb-4">Recent activity</h3>
                  {files.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity yet — upload a file to start tracking downloads.</p>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {files.slice(0, 6).map((f) => (
                        <li key={f.id} className="py-3 flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-secondary/40 grid place-items-center shrink-0">
                            <FileText className="w-4 h-4 text-accent" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{f.filename}</div>
                            <div className="text-[11px] text-muted-foreground">{new Date(f.created_at).toLocaleDateString()} · {fmtSize(f.size_bytes)}</div>
                          </div>
                          <span className="text-xs font-mono text-muted-foreground">{f.download_count}{f.max_downloads ? `/${f.max_downloads}` : ""}↓</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}

            {section === "account" && (
              <>
                <SectionHeader
                  title="My Account"
                  desc="Profile, billing, branding & subscription."
                  actions={
                    <Link to="/auth?plan=monthly" className="h-10 px-4 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary text-xs inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Upgrade
                    </Link>
                  }
                />
                <div className="glass rounded-2xl p-2 sm:p-4">
                  <MyAccount />
                </div>
                <ReferralRewards />
              </>
            )}

            {section === "support" && (
              <>
                <SectionHeader title="Support" desc="We're here within 24 hours, IST business days." />
                <div className="grid sm:grid-cols-2 gap-4">
                  <SupportCard
                    icon={<Mail className="w-5 h-5" />}
                    title="Email support"
                    desc="support@streamvistacreator.com"
                    href="mailto:support@streamvistacreator.com"
                    cta="Open mail"
                  />
                  <SupportCard
                    icon={<MessageCircle className="w-5 h-5" />}
                    title="WhatsApp"
                    desc="Fast replies for active subscribers."
                    href="https://wa.me/919000000000"
                    cta="Chat on WhatsApp"
                  />
                </div>
                <div className="glass rounded-2xl p-6">
                  <h3 className="font-display text-base font-bold mb-3">Helpful links</h3>
                  <div className="grid sm:grid-cols-2 gap-2 text-sm">
                    <SupportLink to="/about" label="About StreamVista" />
                    <SupportLink to="/terms" label="Terms of Service" />
                    <SupportLink to="/privacy" label="Privacy Policy" />
                    <SupportLink to="/refund" label="Refund Policy" />
                    <SupportLink to="/dmca" label="DMCA / IP Policy" />
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
      <ShareLinkModal
        file={shareTarget}
        open={!!shareTarget}
        onOpenChange={(o) => { if (!o) setShareTarget(null); }}
        onSaved={load}
      />
    </div>
  );
};

const Vault = () => {
  const { user } = useAuth();
  const reloadRef = useRef<() => void>(() => {});

  const config = useMemo(() => ({
    bucket: "vault",
    getPath: (file: File) => {
      const token = randomToken();
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const uid = user?.id ?? "anon";
      return { path: `${uid}/${token}.${ext}`, shareToken: token };
    },
    postUpload: async (ctx: { storagePath: string; filename: string; size: number; mime: string; shareToken: string }, opts: { tier: "lite" | "sovereign"; password?: string; expiryDays?: number | ""; maxDownloads?: number | "" }) => {
      if (!user) throw new Error("Not signed in");
      const expiresAt = opts.expiryDays
        ? new Date(Date.now() + Number(opts.expiryDays) * 86400000).toISOString()
        : null;
      const { data: inserted, error: dbErr } = await supabase.from("shared_files").insert({
        owner_id: user.id,
        storage_path: ctx.storagePath,
        filename: ctx.filename,
        size_bytes: ctx.size,
        mime_type: ctx.mime || null,
        tier: opts.tier,
        share_token: ctx.shareToken,
        expires_at: expiresAt,
        max_downloads: opts.maxDownloads ? Number(opts.maxDownloads) : null,
      }).select("id").single();
      if (dbErr) throw dbErr;
      if (opts.password && inserted?.id) {
        const { error: pwErr } = await supabase.functions.invoke("vault-share", {
          body: { action: "set-password", fileId: inserted.id, newPassword: opts.password },
        });
        if (pwErr) throw pwErr;
      }
    },
    onUploaded: () => reloadRef.current?.(),
  }), [user?.id]);

  return (
    <UploadManagerProvider config={config}>
      <VaultInner reloadRef={reloadRef} />
    </UploadManagerProvider>
  );
};


export default Vault;


/* ───────── helpers ───────── */

function SectionHeader({ title, desc, actions }: { title: string; desc: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap pb-2 border-b border-border/40">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
      </div>
      {actions}
    </div>
  );
}

function StatPill({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">{icon}{label}</div>
      <div className="font-display text-lg font-bold mt-1">{value}</div>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}

function TierTile({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl p-3 border transition ${active ? "border-accent/60 bg-accent/5" : "border-border/50 hover:border-border"}`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </button>
  );
}

function FileRow({ file: f, onShare, onRevoke, onRemove }: {
  file: SharedFile;
  onShare: (f: SharedFile) => void;
  onRevoke: (id: string) => void;
  onRemove: (f: SharedFile) => void;
}) {
  return (
    <div className="group rounded-xl border border-border/40 bg-secondary/20 hover:bg-secondary/40 transition p-3 flex items-center gap-3 flex-wrap">
      <div className="w-9 h-9 rounded-lg bg-gradient-primary/20 grid place-items-center shrink-0">
        <FileText className="w-4 h-4 text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm truncate">{f.filename}</div>
        <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-2.5 gap-y-1 mt-0.5">
          <span>{fmtSize(f.size_bytes)}</span>
          <span>·</span>
          <span>{f.tier === "sovereign" ? "India Secure" : "Standard"}</span>
          {f.has_password && (<><span>·</span><span>🔒</span></>)}
          {f.view_only && (<><span>·</span><Badge variant="secondary" className="text-[10px] py-0">View only</Badge></>)}
          {f.expires_at && (<><span>·</span><span>exp {new Date(f.expires_at).toLocaleDateString()}</span></>)}
          <span>·</span>
          <span>{f.download_count}{f.max_downloads ? `/${f.max_downloads}` : ""}↓</span>
          {f.revoked && <Badge variant="destructive" className="ml-1">Revoked</Badge>}
        </div>
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className="h-8" onClick={() => onShare(f)} disabled={f.revoked}>
          <Link2 className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Share</span>
        </Button>
        {!f.revoked && (
          <Button size="sm" variant="ghost" className="h-8" onClick={() => onRevoke(f.id)}>Revoke</Button>
        )}
        <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-destructive" onClick={() => onRemove(f)} aria-label={`Delete ${f.filename}`}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="py-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-secondary/40 grid place-items-center mx-auto mb-3">{icon}</div>
      <div className="font-display font-bold text-base">{title}</div>
      <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">{desc}</p>
      {action}
    </div>
  );
}

function SupportCard({ icon, title, desc, href, cta }: { icon: React.ReactNode; title: string; desc: string; href: string; cta: string }) {
  return (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="glass rounded-2xl p-5 block hover:border-accent/50 transition border border-transparent">
      <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent grid place-items-center mb-3">{icon}</div>
      <div className="font-display font-bold">{title}</div>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      <div className="mt-3 text-xs font-semibold text-accent inline-flex items-center gap-1">{cta} <ChevronRight className="w-3.5 h-3.5" /></div>
    </a>
  );
}

function SupportLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="rounded-lg px-3 py-2 border border-border/40 hover:border-accent/50 hover:bg-secondary/40 transition inline-flex items-center justify-between">
      <span>{label}</span> <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
    </Link>
  );
}
