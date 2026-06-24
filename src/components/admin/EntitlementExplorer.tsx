import { useState } from "react";
import { Loader2, Search, RefreshCw, Crown, HardDrive, FileText, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Snapshot = {
  profile: any;
  entitlement: any;
  subscriptions: any[];
  plan_assignments: any[];
  last_invoice: any;
};

export default function EntitlementExplorer() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ user_id: string; email: string; display_name: string | null }>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const search = async () => {
    if (query.trim().length < 2) {
      toast.error("Type at least 2 characters");
      return;
    }
    setLoading(true);
    setSnapshot(null);
    setSelected(null);
    const { data, error } = await supabase
      .from("user_profiles")
      .select("user_id, email, display_name, full_name")
      .or(`email.ilike.%${query}%,display_name.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(20);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResults(
      (data ?? []).map((r: any) => ({
        user_id: r.user_id,
        email: r.email,
        display_name: r.display_name ?? r.full_name,
      })),
    );
  };

  const loadSnapshot = async (userId: string) => {
    setSelected(userId);
    setSnapshot(null);
    const { data, error } = await supabase.rpc("get_workspace_entitlement_snapshot", {
      p_user_id: userId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setSnapshot(data as Snapshot);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search by email or name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <Button onClick={search} disabled={loading} variant="default">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="ml-2">Search</span>
        </Button>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-4">
        <Card className="p-2 max-h-[600px] overflow-auto">
          {results.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No results yet.</div>
          ) : (
            results.map((r) => (
              <button
                key={r.user_id}
                onClick={() => loadSnapshot(r.user_id)}
                className={`w-full text-left p-2 rounded text-sm hover:bg-muted ${
                  selected === r.user_id ? "bg-muted" : ""
                }`}
              >
                <div className="font-medium truncate">{r.display_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground truncate">{r.email}</div>
              </button>
            ))
          )}
        </Card>

        <Card className="p-4 min-h-[300px]">
          {!selected ? (
            <div className="text-sm text-muted-foreground">Pick a user to view their entitlement snapshot.</div>
          ) : !snapshot ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <section>
                <div className="flex items-center gap-2 font-semibold mb-2">
                  <User className="w-4 h-4" /> Profile
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Email" value={snapshot.profile?.email} />
                  <Field label="Name" value={snapshot.profile?.display_name ?? snapshot.profile?.full_name} />
                  <Field label="Role" value={snapshot.profile?.role} />
                  <Field label="Status" value={snapshot.profile?.account_status} />
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 font-semibold mb-2">
                  <HardDrive className="w-4 h-4" /> Storage entitlement
                </div>
                {snapshot.entitlement ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Plan code" value={snapshot.entitlement.plan_code} />
                    <Field label="Billing status" value={snapshot.entitlement.billing_status} />
                    <Field label="Included GB" value={snapshot.entitlement.included_storage_gb} />
                    <Field label="Paid GB" value={snapshot.entitlement.paid_storage_gb} />
                    <Field label="Admin bonus GB" value={snapshot.entitlement.admin_bonus_storage_gb} />
                    <Field label="Total GB" value={snapshot.entitlement.total_storage_gb} />
                  </div>
                ) : (
                  <div className="text-muted-foreground">No storage entitlement record.</div>
                )}
              </section>

              <section>
                <div className="flex items-center gap-2 font-semibold mb-2">
                  <Crown className="w-4 h-4" /> Plan assignments
                </div>
                {snapshot.plan_assignments?.length ? (
                  <div className="space-y-1">
                    {snapshot.plan_assignments.map((p: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <Badge variant="secondary">{p.plan_code ?? "—"}</Badge>
                        <span className="text-xs text-muted-foreground">{p.status}</span>
                        {p.is_lifetime && <Badge variant="outline" className="text-xs">lifetime</Badge>}
                        {p.is_promotional && <Badge variant="outline" className="text-xs">promo</Badge>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground">No assignments.</div>
                )}
              </section>

              <section>
                <div className="flex items-center gap-2 font-semibold mb-2">
                  <FileText className="w-4 h-4" /> Last manual invoice
                </div>
                {snapshot.last_invoice ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Number" value={snapshot.last_invoice.invoice_number} />
                    <Field label="Status" value={snapshot.last_invoice.status} />
                    <Field label="Surface" value={snapshot.last_invoice.surface} />
                    <Field label="Total ₹" value={(snapshot.last_invoice.total_paise / 100).toFixed(2)} />
                  </div>
                ) : (
                  <div className="text-muted-foreground">No invoices.</div>
                )}
              </section>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-sm truncate">{value ?? "—"}</div>
    </div>
  );
}
