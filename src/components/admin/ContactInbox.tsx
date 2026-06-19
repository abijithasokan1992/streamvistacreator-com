import { useEffect, useState } from "react";
import { Inbox, Loader2, Mail, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Row = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  message: string;
  status: "new" | "read" | "replied" | "archived";
  created_at: string;
  user_id: string | null;
};

const STATUS_FLOW: Row["status"][] = ["new", "read", "replied", "archived"];

export default function ContactInbox() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Row["status"]>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast({ title: "Failed to load messages", description: error.message, variant: "destructive" });
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const setStatus = async (id: string, status: Row["status"]) => {
    const { error } = await supabase.from("contact_messages").update({ status }).eq("id", id);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
  };

  const newCount = rows.filter((r) => r.status === "new").length;

  return (
    <section className="rounded-2xl border border-border/40 bg-secondary/10 p-5 md:p-6">
      <header className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-accent/10 text-accent grid place-items-center">
            <Inbox className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base">Contact Inbox</h3>
            <p className="text-xs text-muted-foreground">
              Messages from the public <code className="text-[10px]">/contact</code> page.
              {newCount > 0 && <span className="ml-2 text-accent">{newCount} new</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="h-8 px-2 rounded-md bg-background border border-border/60 text-xs"
          >
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={load}
            className="h-8 px-2 rounded-md bg-background border border-border/60 text-xs inline-flex items-center gap-1.5 hover:border-accent/50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </header>

      {loading ? (
        <div className="py-12 grid place-items-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No messages {filter === "all" ? "yet" : `with status “${filter}”`}.
        </div>
      ) : (
        <ul className="divide-y divide-border/40 rounded-lg overflow-hidden border border-border/40">
          {rows.map((r) => {
            const isOpen = openId === r.id;
            return (
              <li key={r.id} className="bg-background/50">
                <button
                  onClick={() => {
                    setOpenId(isOpen ? null : r.id);
                    if (!isOpen && r.status === "new") setStatus(r.id, "read");
                  }}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-secondary/30 transition"
                >
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                    r.status === "new" ? "bg-accent" :
                    r.status === "read" ? "bg-yellow-500/70" :
                    r.status === "replied" ? "bg-emerald-500/70" :
                    "bg-muted-foreground/40"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm truncate">
                        {r.name} <span className="text-muted-foreground font-normal">· {r.email}</span>
                      </div>
                      <time className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(r.created_at).toLocaleString()}
                      </time>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {[r.company, r.role].filter(Boolean).join(" · ") || "—"}
                    </div>
                    {!isOpen && (
                      <p className="text-xs text-muted-foreground/80 truncate mt-1">{r.message}</p>
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 -mt-1 space-y-3">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed border-l-2 border-accent/40 pl-3 text-foreground/90">
                      {r.message}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={`mailto:${r.email}?subject=Re:%20Your%20message%20to%20StreamVista`}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-accent/10 text-accent text-xs hover:bg-accent/20"
                      >
                        <Mail className="w-3.5 h-3.5" /> Reply
                      </a>
                      {STATUS_FLOW.map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatus(r.id, s)}
                          disabled={r.status === s}
                          className={`h-7 px-2.5 rounded-md text-xs border ${
                            r.status === s
                              ? "bg-secondary/60 border-border/60 text-foreground/60 cursor-default"
                              : "bg-background border-border/60 hover:border-accent/50"
                          }`}
                        >
                          Mark {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
