import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Award, Copy, Check, Share2, Loader2 } from "lucide-react";

type Referral = {
  id: string;
  referred_email: string | null;
  status: "pending" | "approved" | "rejected";
  reward_type: "storage_tb" | "inr" | null;
  reward_amount: number;
  created_at: string;
};

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function ReferralRewards() {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // get-or-create the user's referral code
      let { data: row } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!row) {
        const ins = await supabase
          .from("referral_codes")
          .insert({ user_id: user.id })
          .select("code")
          .single();
        if (ins.error) {
          // race: re-read
          const re = await supabase.from("referral_codes").select("code").eq("user_id", user.id).maybeSingle();
          row = re.data ?? null;
        } else {
          row = ins.data;
        }
      }

      if (cancelled) return;
      setCode(row?.code ?? null);

      const { data: refs } = await supabase
        .from("referrals")
        .select("id, referred_email, status, reward_type, reward_amount, created_at")
        .eq("referrer_user_id", user.id)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        setReferrals((refs as Referral[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // realtime updates to my referrals
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`my-referrals-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "referrals", filter: `referrer_user_id=eq.${user.id}` },
        async () => {
          const { data: refs } = await supabase
            .from("referrals")
            .select("id, referred_email, status, reward_type, reward_amount, created_at")
            .eq("referrer_user_id", user.id)
            .order("created_at", { ascending: false });
          setReferrals((refs as Referral[]) ?? []);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = code ? `${origin}/?ref=${encodeURIComponent(code)}` : "";

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
    const text = "Join me on StreamVista — simple, secure storage for creators.";
    if (navigator.share) {
      try { await navigator.share({ title: "Crayons Creator Cloud", text, url: shareUrl }); return; } catch { /* user cancelled */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`, "_blank");
  };

  const approved = referrals.filter(r => r.status === "approved");
  const totalStorage = approved.filter(r => r.reward_type === "storage_tb").reduce((s, r) => s + Number(r.reward_amount), 0);
  const totalInr = approved.filter(r => r.reward_type === "inr").reduce((s, r) => s + Number(r.reward_amount), 0);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> Referrals & Rewards</h2>
          <p className="text-sm text-muted-foreground mt-1">Share your link. Earn extra storage or monthly revenue for every successful signup.</p>
        </div>
        <div className="flex gap-4 text-sm">
          <div><div className="text-xs text-muted-foreground">Successful</div><div className="font-bold text-lg">{approved.length}</div></div>
          <div><div className="text-xs text-muted-foreground">Storage earned</div><div className="font-bold text-lg">{totalStorage} TB</div></div>
          <div><div className="text-xs text-muted-foreground">Revenue earned</div><div className="font-bold text-lg">{formatInr(totalInr)}</div></div>
        </div>
      </div>

      {loading ? (
        <div className="py-8 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-secondary/30 p-3 flex items-center gap-2 flex-wrap">
            <code className="text-sm font-mono break-all flex-1 min-w-0">{shareUrl || "—"}</code>
            <Button size="sm" variant="outline" onClick={copy} disabled={!shareUrl} className="gap-1">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
            </Button>
            <Button size="sm" onClick={shareNative} disabled={!shareUrl} className="gap-1">
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
          </div>

          <div className="mt-5">
            <h3 className="font-medium text-sm mb-2">Your referrals</h3>
            {referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No referrals yet. Share your link to start earning.</p>
            ) : (
              <ul className="divide-y divide-border border border-border rounded-lg">
                {referrals.map(r => (
                  <li key={r.id} className="flex items-center justify-between gap-3 p-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.referred_email ?? "Anonymous signup"}</div>
                      <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status === "approved" && (
                        <span className="text-xs text-muted-foreground">
                          {r.reward_type === "storage_tb" ? `+${r.reward_amount} TB` : r.reward_type === "inr" ? `+${formatInr(Number(r.reward_amount))}` : "—"}
                        </span>
                      )}
                      <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                        {r.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
