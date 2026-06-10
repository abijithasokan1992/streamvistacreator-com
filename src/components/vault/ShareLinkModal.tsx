import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Copy, Eye, Download, Lock, Clock, Hash, Link2, Loader2, Shield, ExternalLink, Mail, Send,
} from "lucide-react";

export type ShareLinkFile = {
  id: string;
  filename: string;
  share_token: string;
  expires_at: string | null;
  max_downloads: number | null;
  view_only?: boolean;
  has_password: boolean;
  recipient_email?: string | null;
};

interface Props {
  file: ShareLinkFile | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
  studioName?: string;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

const ShareLinkModal = ({ file, open, onOpenChange, onSaved, studioName }: Props) => {
  const [pwd, setPwd] = useState("");
  const [clearPwd, setClearPwd] = useState(false);
  const [expires, setExpires] = useState<string>("");
  const [maxDl, setMaxDl] = useState<string>("");
  const [viewOnly, setViewOnly] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const link = useMemo(
    () => (file ? `${window.location.origin}/s/${file.share_token}` : ""),
    [file],
  );

  useEffect(() => {
    if (!file) return;
    setPwd("");
    setClearPwd(false);
    setExpires(toLocalInput(file.expires_at));
    setMaxDl(file.max_downloads != null ? String(file.max_downloads) : "");
    setViewOnly(!!file.view_only);
    setRecipient(file.recipient_email || "");
  }, [file?.id]);

  if (!file) return null;

  const copy = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard");
  };

  const save = async () => {
    setSaving(true);
    try {
      // 1. Update DB-side fields (RLS allows owner UPDATE).
      const expiresIso = expires ? new Date(expires).toISOString() : null;
      const maxDownloads = maxDl.trim() === "" ? null : Math.max(1, parseInt(maxDl, 10) || 0);
      const trimmedEmail = recipient.trim();
      const { error: upErr } = await supabase
        .from("shared_files")
        .update({
          expires_at: expiresIso,
          max_downloads: maxDownloads,
          view_only: viewOnly,
          recipient_email: trimmedEmail === "" ? null : trimmedEmail,
        })
        .eq("id", file.id);
      if (upErr) throw upErr;

      // 2. Password is owner-only via the edge function (hashes server-side).
      if (clearPwd) {
        const { error } = await supabase.functions.invoke("vault-share", {
          body: { action: "set-password", fileId: file.id, newPassword: "" },
        });
        if (error) throw error;
      } else if (pwd.length > 0) {
        const { error } = await supabase.functions.invoke("vault-share", {
          body: { action: "set-password", fileId: file.id, newPassword: pwd },
        });
        if (error) throw error;
      }

      toast.success("Share settings saved");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not save share settings");
    } finally {
      setSaving(false);
    }
  };

  const sendToClient = async () => {
    const email = recipient.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid client email address first.");
      return;
    }
    setSending(true);
    try {
      // Persist the recipient (and current settings) so the link is auto-listed
      // on the client's dashboard, then dispatch the email.
      const expiresIso = expires ? new Date(expires).toISOString() : file.expires_at;
      const { error: upErr } = await supabase
        .from("shared_files")
        .update({ recipient_email: email })
        .eq("id", file.id);
      if (upErr) throw upErr;

      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "client-review-invite",
          recipientEmail: email,
          idempotencyKey: `client-review-invite-${file.id}-${email}`,
          templateData: {
            studioName: studioName || "Your studio",
            filename: file.filename,
            shareUrl: link,
            expiresAt: expiresIso,
            hasPassword: !!file.has_password || pwd.length > 0,
            viewOnly,
          },
        },
      });
      if (error) throw error;
      toast.success(`Invite sent to ${email}`);
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message || "Could not send the invite email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg border-white/10 bg-background/60 backdrop-blur-2xl shadow-[0_30px_120px_-30px_hsl(var(--accent)/0.5)]"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-lg bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Shield className="h-5 w-5 text-accent" />
            Secure Share Link
          </DialogTitle>
          <p className="text-xs text-muted-foreground truncate" title={file.filename}>
            {file.filename}
          </p>
        </DialogHeader>

        {/* Link row */}
        <div className="rounded-xl border border-white/10 bg-secondary/30 p-2 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground ml-1" />
          <Input
            value={link}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            className="bg-transparent border-0 focus-visible:ring-0 text-xs"
          />
          <Button size="sm" variant="secondary" onClick={copy}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Copy
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <a href={link} target="_blank" rel="noreferrer" aria-label="Open share page">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>

        {/* Send to client */}
        <div className="rounded-xl border border-accent/30 bg-accent/[0.04] p-4 space-y-3">
          <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-accent">
            <Mail className="h-3.5 w-3.5" /> Send to client
          </Label>
          <p className="text-xs text-muted-foreground -mt-1">
            Email the link directly to your client. We'll also auto-list this review
            on their <code className="text-accent">/client</code> dashboard so they
            don't have to paste anything.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              autoComplete="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="client@example.com"
              className="flex-1"
            />
            <Button
              onClick={sendToClient}
              disabled={sending || !recipient.trim()}
              className="bg-gradient-primary text-primary-foreground"
            >
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send invite
            </Button>
          </div>
          {file.recipient_email && (
            <p className="text-[11px] text-muted-foreground">
              Currently addressed to <span className="text-foreground font-medium">{file.recipient_email}</span>.
              Change the address above and click Save to update — or Send invite to re-send.
            </p>
          )}
        </div>


        {/* View-only vs download */}
        <div className="rounded-xl border border-white/10 bg-secondary/20 p-4 flex items-start gap-3">
          <div className={`mt-0.5 h-9 w-9 rounded-lg grid place-items-center ${viewOnly ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"}`}>
            {viewOnly ? <Eye className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="view-only" className="font-semibold cursor-pointer">
                {viewOnly ? "View only" : "Download allowed"}
              </Label>
              <Switch id="view-only" checked={viewOnly} onCheckedChange={setViewOnly} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {viewOnly
                ? "Recipients can stream the media in the player but cannot trigger a download."
                : "Recipients can stream and download the file."}
            </p>
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Password protection
            {file.has_password && !clearPwd && (
              <Badge variant="secondary" className="ml-1 text-[10px]">Active</Badge>
            )}
          </Label>
          <Input
            type="password"
            value={pwd}
            disabled={clearPwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder={file.has_password ? "Enter new password to replace" : "Leave blank for no password"}
          />
          {file.has_password && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={clearPwd}
                onChange={(e) => setClearPwd(e.target.checked)}
                className="accent-accent"
              />
              Remove password protection
            </label>
          )}
        </div>

        {/* Expiry + cap */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Expires
            </Label>
            <Input
              type="datetime-local"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              <Hash className="h-3.5 w-3.5" /> Download cap
            </Label>
            <Input
              type="number"
              min={1}
              value={maxDl}
              onChange={(e) => setMaxDl(e.target.value)}
              placeholder="Unlimited"
              disabled={viewOnly}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
            Save & secure
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareLinkModal;
