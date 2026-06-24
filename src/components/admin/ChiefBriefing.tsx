import { useEffect, useRef, useState } from "react";
import { Crown, Mic, Loader2, RefreshCw, AlertTriangle, Info, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AgentChat } from "@/components/agents/AgentChat";
import { toast } from "sonner";

type EventRow = {
  id: string;
  agent: "home" | "creator" | "studio" | "buyer" | "chief";
  severity: "info" | "warn" | "critical";
  title: string;
  summary: string | null;
  created_at: string;
};

type Report = { id: string; title: string; body: string; created_at: string };

const SEV_ICON = { info: Info, warn: AlertTriangle, critical: Zap };
const SEV_TONE: Record<EventRow["severity"], string> = {
  info: "text-muted-foreground border-border",
  warn: "text-amber-500 border-amber-500/40",
  critical: "text-destructive border-destructive/50",
};

export default function ChiefBriefing() {
  const { user } = useAuth();
  const [isFounder, setIsFounder] = useState<boolean | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [generating, setGenerating] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Founder check
  useEffect(() => {
    if (!user) { setIsFounder(false); return; }
    supabase.rpc("has_role", { _user_id: user.id, _role: "founder" as any })
      .then(({ data }) => setIsFounder(Boolean(data)));
  }, [user]);

  // Load + subscribe
  useEffect(() => {
    if (!isFounder) return;
    supabase.from("agent_events")
      .select("id,agent,severity,title,summary,created_at")
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => setEvents((data as EventRow[]) ?? []));

    const ch = supabase
      .channel("agent_events_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_events" }, (payload) => {
        setEvents((prev) => [payload.new as EventRow, ...prev].slice(0, 50));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [isFounder]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("chief-report", { body: {} });
      if (error) throw error;
      setReport(data.report);
      toast.success("Briefing generated");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate briefing");
    } finally {
      setGenerating(false);
    }
  };

  const speak = async () => {
    if (!report) return;
    setSpeaking(true);
    try {
      const { data, error } = await supabase.functions.invoke("chief-voice", {
        body: { report_id: report.id, text: report.body },
      });
      if (error) throw error;
      const url = `data:audio/mpeg;base64,${data.audioContent}`;
      audioRef.current?.pause();
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => setSpeaking(false);
      a.onerror = () => setSpeaking(false);
      await a.play();
    } catch (e: any) {
      toast.error(e?.message ?? "Voice generation failed");
      setSpeaking(false);
    }
  };

  if (isFounder === null) {
    return <div className="p-6 text-sm text-muted-foreground inline-flex gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Checking founder access…</div>;
  }
  if (!isFounder) {
    return (
      <div className="p-6 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 text-sm">
          <Crown className="w-4 h-4 text-primary" />
          <span className="font-black uppercase tracking-wider">Chief AI · Sovereign</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          This control surface is restricted to <strong className="text-foreground">Abijith Asokan</strong> — Founder, Managing Director & Architect.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary font-black">
              <Crown className="w-3.5 h-3.5" /> Chief AI · Sovereign
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-1">
              Reporting to Abijith Asokan
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Founder · Managing Director · Architect — top decision maker.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Generate briefing
            </Button>
            <Button onClick={speak} disabled={!report || speaking} variant="secondary">
              {speaking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mic className="w-4 h-4 mr-2" />}
              {speaking ? "Speaking…" : "🔊 Speak to Abijith"}
            </Button>
          </div>
        </div>

        {report && (
          <div className="mt-4 rounded-lg border border-border bg-background/60 p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{report.title}</div>
            <p className="text-sm mt-2 leading-relaxed whitespace-pre-wrap">{report.body}</p>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-black uppercase tracking-wider">Live agent feed</div>
            <Badge variant="outline" className="text-[10px]">{events.length}</Badge>
          </div>
          <ScrollArea className="h-[420px] pr-2">
            <div className="space-y-2">
              {events.length === 0 && (
                <div className="text-sm text-muted-foreground">No agent activity yet. As Vista, Aria, Orion and Atlas observe events, they will stream in here in real time.</div>
              )}
              {events.map((e) => {
                const Icon = SEV_ICON[e.severity];
                return (
                  <div key={e.id} className={`rounded-md border bg-background p-2.5 ${SEV_TONE[e.severity]}`}>
                    <div className="flex items-center gap-2 text-xs">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="uppercase tracking-wider font-black">{e.agent}</span>
                      <span className="ml-auto text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-sm font-semibold mt-1 text-foreground">{e.title}</div>
                    {e.summary && <div className="text-xs text-muted-foreground mt-0.5">{e.summary}</div>}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="h-[480px]">
          <AgentChat surface="chief" />
        </div>
      </div>
    </div>
  );
}
