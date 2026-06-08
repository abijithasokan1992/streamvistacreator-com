import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from "sonner";
import { Award, Copy, Check, Share2, Loader2, Send, UserPlus, Percent } from "lucide-react";

type IntroInvite = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: "pending" | "accepted" | "expired";
  rate: number;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

const PAGE_SIZE = 10;
const FROM_EMAIL = "abijithasokan@crayonspictures.com";

export default function ReferralRewards() {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [invites, setInvites] = useState<IntroInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [tab, setTab] = useState<"accepted" | "pending" | "expired">("pending");
  const [page, setPage] = useState(1);

  // load referral code + invites
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      let { data: row } = await supabase
        .from("referral_codes").select("code").eq("user_id", user.id).maybeSingle();
      if (!row) {
        const ins = await supabase.from("referral_codes").insert({ user_id: user.id }).select("code").single();
        row = ins.error
          ? (await supabase.from("referral_codes").select("code").eq("user_id", user.id).maybeSingle()).data ?? null
          : ins.data;
      }
      if (cancelled) return;
      setCode(row?.code ?? null);

      const { data } = await (supabase as any)
        .from("intro_invites").select("*")
        .eq("inviter_user_id", user.id)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setInvites((data as IntroInvite[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`my-intro-invites-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "intro_invites", filter: `inviter_user_id=eq.${user.id}` },
        async () => {
          const { data } = await (supabase as any).from("intro_invites").select("*")
            .eq("inviter_user_id", user.id).order("created_at", { ascending: false });
          setInvites((data as IntroInvite[]) ?? []);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const baseUrl = "https://streamvistacreator.com";
  const shareUrl = useMemo(() =>
    code ? `${baseUrl}/?utm_campaign=referral&utm_source=link&ref=${encodeURIComponent(code)}` : "",
    [code]);


  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Referral link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Copy failed"); }
  };

  const shareNative = async () => {
    if (!shareUrl) return;
    const text = "Join me on StreamVista — agency-grade storage for creators.";
    if (navigator.share) {
      try { await navigator.share({ title: "StreamVista", text, url: shareUrl }); return; } catch {}
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`, "_blank");
  };

  const sendIntro = async () => {
    if (!user) return;
    const fn = firstName.trim(), ln = lastName.trim(), em = email.trim().toLowerCase();
    if (!fn) return toast.error("First name is required");
    if (!/^\S+@\S+\.\S+$/.test(em)) return toast.error("Enter a valid email");
    setSubmitting(true);
    const { data, error } = await (supabase as any)
      .from("intro_invites")
      .insert({ inviter_user_id: user.id, first_name: fn, last_name: ln, email: em })
      .select("token").single();
    setSubmitting(false);
    if (error) return toast.error(error.message);

    // Compose intro email via user's mail client (consistent with PremiumInvitations pattern)
    const inviteUrl = `${baseUrl}/?utm_campaign=referral&utm_source=intro&ref=${encodeURIComponent(code ?? "")}&invite=${data.token}`;
    const subject = `${fn}, an invite to join me on StreamVista`;
    const body = [
      `Hi ${fn},`, ``,
      `I'd like to introduce you to StreamVista — the secure creator cloud I'm using to back up and share my work.`,
      ``,
      `Sign up with my personal link and you'll get a smooth onboarding experience:`,
      inviteUrl, ``,
      `Let me know what you think!`, ``,
      `— Sent via StreamVista`,
    ].join("\n");
    window.location.href =
      `mailto:${encodeURIComponent(em)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    setFirstName(""); setLastName(""); setEmail("");
    toast.success("Intro queued — opening your email client");
  };

  // Auto-expire client-side: surface pending past expires_at into "Expired" tab.
  const enriched = useMemo(() => invites.map(i => ({
    ...i,
    status: (i.status === "pending" && new Date(i.expires_at) < new Date()) ? "expired" as const : i.status,
  })), [invites]);

  const filtered = enriched.filter(i => i.status === tab);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [tab]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const acceptedCount = enriched.filter(i => i.status === "accepted").length;
  const pendingCount  = enriched.filter(i => i.status === "pending").length;
  const expiredCount  = enriched.filter(i => i.status === "expired").length;

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" /> Refer & Earn
          </h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <Percent className="h-3.5 w-3.5" /> Introduce your friends, teammates, and fellow creators to StreamVista Cloud X. Earn <b className="text-foreground mx-1">10%</b> of every referred user's revenue for <b className="text-foreground mx-1">5 years</b>.
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <Stat label="Accepted" value={acceptedCount} />
          <Stat label="Pending" value={pendingCount} />
          <Stat label="Rate" value="10%" />
        </div>
      </div>

      {loading ? (
        <div className="py-8 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Share link */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Your tracking link</Label>
            <div className="mt-2 rounded-lg border border-border bg-secondary/30 p-3 flex items-center gap-2 flex-wrap">
              <code className="text-xs font-mono break-all flex-1 min-w-0">{shareUrl || "—"}</code>
              <Button size="sm" variant="outline" onClick={copy} disabled={!shareUrl} className="gap-1">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
              </Button>
              <Button size="sm" onClick={shareNative} disabled={!shareUrl} className="gap-1">
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
            </div>
          </div>

          {/* Intro form */}
          <div className="rounded-lg border border-border p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-1">
              <UserPlus className="h-4 w-4 text-primary" /> Invite a teammate to StreamVista Cloud X
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              We'll open a pre-filled email from your account so the prospect hears it from you directly.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="intro-fn">First name</Label>
                <Input id="intro-fn" value={firstName} onChange={e => setFirstName(e.target.value)} maxLength={60} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="intro-ln">Last name</Label>
                <Input id="intro-ln" value={lastName} onChange={e => setLastName(e.target.value)} maxLength={60} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="intro-em">Email address</Label>
                <Input id="intro-em" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={255} />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={sendIntro} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send Intro
              </Button>
            </div>
          </div>

          {/* Tabbed invites table */}
          <div>
            <h3 className="font-medium text-sm mb-2">Your invites</h3>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList>
                <TabsTrigger value="accepted">Accepted ({acceptedCount})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
                <TabsTrigger value="expired">Expired ({expiredCount})</TabsTrigger>
              </TabsList>
              <TabsContent value={tab} className="mt-3">
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-[1.2fr_1.6fr_0.6fr_0.9fr] gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider bg-muted/40 text-muted-foreground">
                    <div>Name</div><div>Email</div><div>Rate</div><div>Date</div>
                  </div>
                  {pageRows.length === 0 ? (
                    <div className="px-3 py-6 text-sm text-muted-foreground text-center">No {tab} invites yet.</div>
                  ) : pageRows.map(r => (
                    <div key={r.id} className="grid grid-cols-[1.2fr_1.6fr_0.6fr_0.9fr] gap-2 px-3 py-2.5 text-sm border-t border-border items-center">
                      <div className="truncate">{[r.first_name, r.last_name].filter(Boolean).join(" ")}</div>
                      <div className="truncate text-muted-foreground">{r.email}</div>
                      <div><Badge variant="secondary">10%</Badge></div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.accepted_at ?? r.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <Pagination className="mt-3">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage(p => Math.max(1, p - 1)); }} />
                      </PaginationItem>
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink href="#" isActive={page === i + 1}
                            onClick={(e) => { e.preventDefault(); setPage(i + 1); }}>
                            {i + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage(p => Math.min(totalPages, p + 1)); }} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Emails are sent from your own address ({FROM_EMAIL.includes("@") ? "your mail client" : FROM_EMAIL}) so the prospect knows it came from you.
            Commissions accrue automatically once your invitee subscribes — track them anytime in <b>My Account → Statements</b>.
          </p>
        </>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-bold text-lg">{value}</div>
    </div>
  );
}
