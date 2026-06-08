import { useEffect, useState } from "react";
import { Loader2, Inbox, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Req {
  id: string;
  user_id: string;
  request_type: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
}

const STATUSES = ["open", "in_progress", "resolved", "closed"];

export default function SupportInbox() {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data as Req[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const update = async (id: string, patch: Partial<Req>) => {
    const { error } = await supabase.from("support_requests").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } as Req : x)));
    toast.success("Updated");
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Inbox className="w-5 h-5 text-accent" />
        <h2 className="font-display text-xl font-bold">Support &amp; Service Requests</h2>
        <span className="text-xs text-muted-foreground">({rows.length})</span>
      </div>
      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No requests yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="border border-border/60 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold">{r.subject}</div>
                  <div className="text-xs text-muted-foreground capitalize">{r.request_type} · {new Date(r.created_at).toLocaleString()}</div>
                </div>
                <select value={r.status} onChange={(e) => update(r.id, { status: e.target.value })}
                  className="h-9 px-2 rounded-md bg-secondary/50 border border-border text-xs">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <p className="text-sm mt-2 whitespace-pre-wrap">{r.message}</p>
              <details className="mt-3">
                <summary className="text-xs text-accent cursor-pointer">Reply</summary>
                <textarea defaultValue={r.admin_reply ?? ""} rows={2}
                  onBlur={(e) => e.target.value !== (r.admin_reply ?? "") && update(r.id, { admin_reply: e.target.value })}
                  placeholder="Write a reply (saved on blur)"
                  className="mt-2 w-full px-3 py-2 rounded-md bg-secondary/50 border border-border text-sm" />
                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                  <Send className="w-3 h-3" /> Reply is visible to the user in their account
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
