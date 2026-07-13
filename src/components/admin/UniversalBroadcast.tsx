import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Send, Users, Filter, ListChecks, AtSign, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type AdminUser = { id: string; email: string | null; profile: { display_name: string | null; studio_name: string | null; plan_tier: string } | null; roles: string[] };

const ROLE_OPTS = ["client", "creator", "executive_producer", "user", "moderator"];
const PLAN_OPTS = ["free", "personal", "professional", "mfi_limited"];

export default function UniversalBroadcast() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [mode, setMode] = useState<"all" | "selected" | "external" | "filter">("filter");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailsText, setEmailsText] = useState("");
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [planFilter, setPlanFilter] = useState<string[]>([]);
  const [subject, setSubject] = useState("You're invited to StreamVista");
  const [message, setMessage] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Accept your invite");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingUsers(true);
      try {
        const { data, error } = await supabase.functions.invoke("admin-asset-manager", { body: { action: "list-users" } });
        if (error) throw error;
        setUsers(data?.users ?? []);
      } catch (e: any) { toast.error(e.message ?? "Failed to load users"); }
      setLoadingUsers(false);
    })();
  }, []);

  const toggleId = (id: string) => {
    setSelectedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleArr = (val: string, arr: string[], set: (v: string[]) => void) => {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const externalEmails = useMemo(() =>
    emailsText.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)),
    [emailsText]);

  const audienceCount = useMemo(() => {
    if (mode === "all") return users.length;
    if (mode === "selected") return selectedIds.size;
    if (mode === "external") return externalEmails.length;
    return users.filter((u) => {
      const roleOk = !roleFilter.length || u.roles.some((r) => roleFilter.includes(r));
      const planOk = !planFilter.length || planFilter.includes(u.profile?.plan_tier ?? "free");
      return roleOk && planOk;
    }).length;
  }, [mode, users, selectedIds, externalEmails, roleFilter, planFilter]);

  const send = async () => {
    if (audienceCount === 0) { toast.error("No recipients in the selected audience"); return; }
    if (audienceCount > 5 && !confirm(`Send invitation to ${audienceCount} recipients?`)) return;
    setSending(true);
    try {
      const audience: any = { mode };
      if (mode === "selected") audience.userIds = Array.from(selectedIds);
      if (mode === "external") audience.emails = externalEmails;
      if (mode === "filter") { audience.roleFilter = roleFilter; audience.planFilter = planFilter; }
      const { data, error } = await supabase.functions.invoke("admin-broadcast-invite", {
        body: { audience, subject, message, ctaLabel },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Sent ${data.sent}/${data.total} · ${data.failed} failed`);
      if (data.failed > 0) console.warn("Broadcast errors", data.errors);
    } catch (e: any) { toast.error(e.message ?? "Broadcast failed"); }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><Mail className="h-5 w-5 text-pink-400" /> Universal Invitation & Broadcast</h3>
          <p className="text-sm text-muted-foreground">One-click signed StreamVista invites to any audience.</p>
        </div>
        <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/40">
          <Users className="h-3 w-3 mr-1" /> {audienceCount} recipients
        </Badge>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur p-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="filter"><Filter className="h-3.5 w-3.5 mr-1" />Filter</TabsTrigger>
            <TabsTrigger value="selected"><ListChecks className="h-3.5 w-3.5 mr-1" />Pick users</TabsTrigger>
            <TabsTrigger value="all"><Users className="h-3.5 w-3.5 mr-1" />All users</TabsTrigger>
            <TabsTrigger value="external"><AtSign className="h-3.5 w-3.5 mr-1" />External</TabsTrigger>
          </TabsList>

          <TabsContent value="filter" className="pt-4 space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Roles</div>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTS.map((r) => (
                  <button key={r} onClick={() => toggleArr(r, roleFilter, setRoleFilter)}
                    className={`px-3 py-1 rounded-full text-xs border transition ${roleFilter.includes(r) ? "bg-purple-500/20 border-purple-500 text-purple-200" : "border-border/60 text-muted-foreground hover:border-purple-500/50"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Plans</div>
              <div className="flex flex-wrap gap-2">
                {PLAN_OPTS.map((p) => (
                  <button key={p} onClick={() => toggleArr(p, planFilter, setPlanFilter)}
                    className={`px-3 py-1 rounded-full text-xs border transition ${planFilter.includes(p) ? "bg-pink-500/20 border-pink-500 text-pink-200" : "border-border/60 text-muted-foreground hover:border-pink-500/50"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">No selection = match anything in that dimension.</p>
          </TabsContent>

          <TabsContent value="selected" className="pt-4">
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border/40 divide-y divide-border/30">
              {loadingUsers && <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.02] cursor-pointer">
                  <Checkbox checked={selectedIds.has(u.id)} onCheckedChange={() => toggleId(u.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{u.profile?.studio_name || u.profile?.display_name || u.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{u.profile?.plan_tier ?? "free"}</Badge>
                  <Badge variant="outline" className="text-[10px]">{u.roles[0]}</Badge>
                </label>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="all" className="pt-4">
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30 text-sm">
              Broadcast to all <b>{users.length}</b> registered StreamVista users.
            </div>
          </TabsContent>

          <TabsContent value="external" className="pt-4">
            <Textarea value={emailsText} onChange={(e) => setEmailsText(e.target.value)}
              placeholder="Paste investor / partner / prospect emails — comma, space or newline separated"
              rows={6} className="font-mono text-xs" />
            <div className="text-xs text-muted-foreground mt-2">{externalEmails.length} valid email{externalEmails.length === 1 ? "" : "s"} detected.</div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur p-4 space-y-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Subject</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Personal message (optional)</label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
            placeholder="A short note that appears inside the cinematic StreamVista email." />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Call-to-action label</label>
          <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Dialog open={preview} onOpenChange={setPreview}>
            <DialogTrigger asChild>
              <Button variant="ghost"><Eye className="h-4 w-4 mr-2" />Preview</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Email preview</DialogTitle></DialogHeader>
              <div className="rounded-lg overflow-hidden border border-border/40 bg-[#06060b]">
                <iframe title="preview" className="w-full h-[560px] bg-[#06060b]"
                  srcDoc={previewHtml({ name: "Friend", inviteUrl: "https://streamvista.in/auth?invite=PREVIEW", message, ctaLabel })} />
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={send} disabled={sending || audienceCount === 0}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send to {audienceCount} recipient{audienceCount === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function previewHtml(p: { name: string; inviteUrl: string; message: string; ctaLabel: string }) {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
  const msg = p.message ? esc(p.message).replace(/\n/g, "<br/>") : "";
  return `<html><body style="margin:0;background:#06060b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial;color:#e8e8ee;">
<div style="background-image:radial-gradient(ellipse at top,rgba(168,85,247,0.22),transparent 60%),radial-gradient(ellipse at bottom,rgba(59,130,246,0.16),transparent 60%);padding:32px 12px;">
<div style="max-width:600px;margin:0 auto;background:#0e0f17;border:1px solid rgba(255,255,255,0.08);border-radius:22px;overflow:hidden;">
<div style="padding:28px 32px 0;"><div style="font-family:Georgia,serif;font-size:22px;font-weight:700;background:linear-gradient(90deg,#a855f7,#ec4899,#f59e0b);-webkit-background-clip:text;background-clip:text;color:transparent;">STREAMVISTA</div></div>
<div style="padding:24px 32px 8px;"><div style="display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.35);font-size:11px;letter-spacing:2px;color:#c4b5fd;text-transform:uppercase;font-weight:700;">Private Invitation</div>
<h1 style="margin:12px 0 8px;font-family:Georgia,serif;font-size:30px;color:#fff;">You're invited to StreamVista.</h1>
<p style="font-size:15px;line-height:1.7;color:#b8b8c8;">Hi ${esc(p.name)}, you've been personally invited by the StreamVista team to join our cinematic creator cloud.</p>
${msg ? `<div style="margin-top:18px;padding:16px 18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;font-size:14px;color:#d4d4dc;">${msg}</div>` : ""}
</div>
<div style="padding:28px 32px;text-align:center;"><a href="${esc(p.inviteUrl)}" style="display:inline-block;padding:16px 36px;background:linear-gradient(90deg,#a855f7,#ec4899);color:#fff;font-weight:700;text-decoration:none;border-radius:999px;">${esc(p.ctaLabel)} →</a></div>
<div style="padding:0 32px 28px;font-size:11px;color:#5b5b6b;text-align:center;">© StreamVista · streamvista.in</div>
</div></div></body></html>`;
}
