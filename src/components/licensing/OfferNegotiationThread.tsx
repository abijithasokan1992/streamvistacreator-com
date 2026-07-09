import { useEffect, useState } from "react";
import { Loader2, MessageSquarePlus, Handshake } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { addOfferRound, listOfferRounds, type OfferRound } from "@/lib/licensing/licensingApi";

/**
 * Multi-round offer / counter-offer thread attached to a commercial_requests row.
 * RLS: buyer sees their own; owner sees rounds on their titles; admins see all.
 */
export function OfferNegotiationThread({
  commercialRequestId,
  party,
  className,
}: {
  commercialRequestId: string;
  party: "buyer" | "admin" | "owner";
  className?: string;
}) {
  const { user } = useAuth();
  const [rounds, setRounds] = useState<OfferRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");

  const load = async () => {
    try {
      setLoading(true);
      setRounds(await listOfferRounds(commercialRequestId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load negotiation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [commercialRequestId]);

  const submit = async () => {
    if (!user) return;
    if (!message.trim() && !amount.trim()) {
      toast.error("Add an amount or a message");
      return;
    }
    setSaving(true);
    try {
      const paise = amount.trim() ? Math.round(parseFloat(amount) * 100) : null;
      await addOfferRound({
        commercial_request_id: commercialRequestId,
        party,
        actor_user_id: user.id,
        message: message.trim() || undefined,
        amount_paise: Number.isFinite(paise as number) ? (paise as number) : null,
        currency,
        status: "proposed",
      });
      setMessage(""); setAmount("");
      toast.success("Round added");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add round");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold inline-flex items-center gap-1.5">
          <Handshake className="w-4 h-4 text-accent" aria-hidden /> Offer & negotiation
        </h4>
        <Badge variant="outline" className="text-[10px]">{rounds.length} round{rounds.length !== 1 ? "s" : ""}</Badge>
      </div>

      {loading ? (
        <div className="py-6 grid place-items-center"><Loader2 className="w-4 h-4 animate-spin text-accent" aria-hidden /></div>
      ) : rounds.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/50 bg-secondary/10 p-3">
          No rounds yet. Add a proposal below.
        </p>
      ) : (
        <ol className="space-y-2 list-none">
          {rounds.map(r => (
            <li key={r.id} className="rounded-lg border border-border/40 bg-secondary/10 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Round {r.round_no} · <span className="capitalize">{r.party}</span></span>
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              {r.amount_paise != null && (
                <div className="mt-1 text-sm font-medium">
                  {(r.amount_paise / 100).toLocaleString(undefined, { style: "currency", currency: r.currency ?? "INR" })}
                </div>
              )}
              {r.message && <p className="mt-1 whitespace-pre-wrap">{r.message}</p>}
              <Badge variant="outline" className="mt-1 text-[10px] capitalize">{r.status}</Badge>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-3 grid gap-2 rounded-lg border border-border/40 bg-secondary/5 p-3">
        <div className="grid grid-cols-[1fr_100px] gap-2">
          <Input
            inputMode="decimal"
            placeholder="Offer amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Offer amount"
          />
          <Input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            aria-label="Currency"
          />
        </div>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message, terms, exclusivity, term…"
          rows={3}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden /> : <MessageSquarePlus className="w-3.5 h-3.5 mr-1.5" aria-hidden />}
            Add round
          </Button>
        </div>
      </div>
    </div>
  );
}
