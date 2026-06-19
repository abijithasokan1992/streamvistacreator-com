import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function UpgradeSection() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<any>(null);
  const [allocation, setAllocation] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [a, alloc, prof] = await Promise.all([
        (supabase as any).from("plan_assignments")
          .select("*, plan:plans(*)").eq("user_id", user.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        (supabase as any).from("storage_allocations").select("*")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        (supabase as any).from("user_profiles").select("plan_tier, topup_tb").eq("user_id", user.id).maybeSingle(),
      ]);
      setPlan(a.data); setAllocation(alloc.data); setProfile(prof.data);
    })();
  }, [user]);

  const submitRequest = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("support_requests").insert({
        user_id: user.id,
        category: "upgrade",
        subject: "Plan upgrade request",
        message: note || "Please contact me about upgrading my plan.",
        status: "open",
      });
      if (error) throw error;
      toast.success("Upgrade request submitted. Our team will reach out.");
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit request.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/40 bg-secondary/5 p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Crown className="w-3.5 h-3.5" /> Current Plan</div>
          <div className="text-xl font-semibold font-display mt-2">
            {plan?.plan?.name || profile?.plan_tier || "Free"}
          </div>
          {plan?.status && <p className="text-[11px] text-muted-foreground mt-1">Status: {plan.status}</p>}
        </div>
        <div className="rounded-xl border border-border/40 bg-secondary/5 p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Database className="w-3.5 h-3.5" /> Storage Allocation</div>
          <div className="text-xl font-semibold font-display mt-2">
            {allocation?.granted_gb != null
              ? `${allocation.granted_gb} GB`
              : profile?.topup_tb
                ? `${(profile.topup_tb + 1)} TB`
                : "Default"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Includes plan baseline plus admin grants.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-secondary/5 p-5">
        <h3 className="text-sm font-semibold">Request an upgrade</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Tell us what you need (more storage, higher plan, custom terms). Our team will follow up by email.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Optional context…"
          className="mt-3 w-full bg-background border border-border/40 rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={submitRequest}
          disabled={busy}
          className="mt-3 inline-flex rounded-md bg-accent text-accent-foreground text-xs px-3 py-1.5 disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit Upgrade Request"}
        </button>
      </div>
    </div>
  );
}
