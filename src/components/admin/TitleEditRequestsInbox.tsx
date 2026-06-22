import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Inbox, RefreshCw, Unlock, X, RotateCcw } from "lucide-react";

const SECTIONS = [
  "basic_metadata", "synopsis", "cast_crew",
  "legal_documents", "master_file", "trailer", "poster",
  "subtitles_audio", "rights", "delivery",
];

type Req = {
  id: string;
  title_id: string;
  creator_user_id: string;
  request_type: string;
  message: string | null;
  requested_sections: string[];
  status: "open" | "approved" | "rejected" | "closed";
  admin_response: string | null;
  handled_at: string | null;
  created_at: string;
  title?: { title: string; status: string } | null;
};

export default function TitleEditRequestsInbox() {
  const [tab, setTab] = useState<"open" | "approved" | "rejected" | "all">("open");
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Req | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [response, setResponse] = useState("");
  const [unlocks, setUnlocks] = useState<string[]>([]);
  const [expiryDays, setExpiryDays] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any)
      .from("title_edit_requests")
      .select("id, title_id, creator_user_id, request_type, message, requested_sections, status, admin_response, handled_at, created_at, title:content_titles(title, status)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (tab !== "all") q = q.eq("status", tab);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data || []) as Req[]);
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const openHandle = (r: Req) => {
    setActive(r);
    setDecision("approved");
    setResponse("");
    setUnlocks([...r.requested_sections]);
    setExpiryDays("");
  };

  const submit = async () => {
    if (!active) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc("admin_handle_title_edit_request", {
      _request_id: active.id,
      _decision: decision,
      _response: response || null,
      _unlock_sections: decision === "approved" ? unlocks : [],
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }

    // Optional expiry: patch unlocks if days set
    if (decision === "approved" && expiryDays && Number(expiryDays) > 0 && unlocks.length > 0) {
      const expires = new Date(Date.now() + Number(expiryDays) * 86400_000).toISOString();
      await (supabase as any)
        .from("title_section_unlocks")
        .update({ expires_at: expires })
        .eq("title_id", active.title_id)
        .in("section_key", unlocks)
        .eq("status", "open")
        .is("closed_at", null);
    }
    toast.success(decision === "approved" ? "Approved & sections unlocked" : "Rejected");
    setActive(null);
    load();
  };

  const reopen = async (r: Req) => {
    // Allow admin to reopen a handled request for re-evaluation by setting status back to open.
    setBusy(true);
    const { error } = await (supabase as any)
      .from("title_edit_requests")
      .update({ status: "open", handled_at: null, handled_by_admin: null })
      .eq("id", r.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Request reopened");
    load();
  };

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1; return acc;
  }, {});

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-accent" />
          <CardTitle className="text-base">Title Edit Requests</CardTitle>
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="open">Open {counts.open ? `(${counts.open})` : ""}</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="grid place-items-center py-10"><Loader2 className="w-4 h-4 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No requests in this view.</p>
        ) : (
          <div className="rounded-md border border-border/40 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-secondary/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-2">When</th>
                  <th className="text-left px-2 py-2">Title</th>
                  <th className="text-left px-2 py-2">Type</th>
                  <th className="text-left px-2 py-2">Sections</th>
                  <th className="text-left px-2 py-2">Status</th>
                  <th className="text-right px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/30 align-top">
                    <td className="px-2 py-2 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium truncate max-w-[200px]">{r.title?.title || r.title_id.slice(0, 8)}</div>
                      {r.message && <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 max-w-[260px]">{r.message}</div>}
                    </td>
                    <td className="px-2 py-2 capitalize">{r.request_type.replace(/_/g, " ")}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {r.requested_sections.map((s) => (
                          <span key={s} className="text-[10px] rounded bg-secondary/30 px-1.5 py-0.5">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Badge variant={r.status === "open" ? "default" : r.status === "approved" ? "secondary" : "outline"}>
                        {r.status}
                      </Badge>
                      {r.admin_response && (
                        <div className="text-[10px] text-muted-foreground mt-1 max-w-[180px] line-clamp-2">{r.admin_response}</div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right space-x-1 whitespace-nowrap">
                      {r.status === "open" ? (
                        <Button size="sm" variant="outline" onClick={() => openHandle(r)}>
                          Handle
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => reopen(r)} disabled={busy}>
                          <RotateCcw className="w-3 h-3 mr-1" /> Reopen
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Handle edit request</DialogTitle>
            <DialogDescription>
              {active?.title?.title || active?.title_id} · {active?.request_type}
            </DialogDescription>
          </DialogHeader>
          {active && (
            <div className="space-y-3">
              <div className="rounded-md border border-border/40 bg-secondary/10 p-2 text-xs">
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Creator note</div>
                {active.message || "—"}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant={decision === "approved" ? "default" : "outline"} size="sm" onClick={() => setDecision("approved")}>
                  <Unlock className="w-3 h-3 mr-1" /> Approve & unlock
                </Button>
                <Button variant={decision === "rejected" ? "default" : "outline"} size="sm" onClick={() => setDecision("rejected")}>
                  <X className="w-3 h-3 mr-1" /> Reject
                </Button>
              </div>

              {decision === "approved" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Sections to unlock</label>
                    <div className="grid grid-cols-2 gap-1.5 mt-1 max-h-40 overflow-auto pr-1">
                      {SECTIONS.map((s) => (
                        <label key={s} className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox
                            checked={unlocks.includes(s)}
                            onCheckedChange={() =>
                              setUnlocks((u) => u.includes(s) ? u.filter((x) => x !== s) : [...u, s])
                            }
                          />
                          {s.replace(/_/g, " ")}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Unlock expires after (days, optional)</label>
                    <Input type="number" min={0} value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} placeholder="e.g. 7" />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs text-muted-foreground">Response to creator</label>
                <Textarea rows={3} value={response} onChange={(e) => setResponse(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Submit decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
