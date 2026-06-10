/**
 * Kammattam Meter — animated LED earnings board for the admin.
 *
 *   Black  = realised cash (paid onboarding, top-ups, fastlinks, charged overages)
 *   White  = trapped earnings (pending / failed)
 *
 * On every realised-rupee increment we ring a synthesised temple bell.
 * The "Pop out" button detaches the board into its own browser window so it
 * can sit on a second monitor 24/7.
 */
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Volume2, VolumeX, Sparkles, Zap, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Meter = { black_paise: number; white_paise: number };

function ringTempleBell(audioCtx: AudioContext) {
  // Stacked sine partials with exponential decay = soft bell
  const partials = [
    { f: 392.0, g: 0.45, d: 2.8 },   // fundamental (G4)
    { f: 587.3, g: 0.22, d: 2.4 },   // 3rd-ish
    { f: 880.0, g: 0.13, d: 1.8 },
    { f: 1244.5, g: 0.07, d: 1.2 },
  ];
  const now = audioCtx.currentTime;
  for (const p of partials) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = p.f;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(p.g, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + p.d);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + p.d + 0.05);
  }
}

function fmtINR(paise: number) {
  const r = Math.round((paise ?? 0) / 100);
  return "₹" + r.toLocaleString("en-IN");
}

export default function KammattamMeter({ popout = false }: { popout?: boolean }) {
  const [meter, setMeter] = useState<Meter | null>(null);
  const [autoCharge, setAutoCharge] = useState<boolean>(false);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [pulse, setPulse] = useState<"black" | "white" | null>(null);
  const prevBlack = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const ensureAudio = () => {
    if (!audioRef.current) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      if (Ctx) audioRef.current = new Ctx();
    }
    return audioRef.current;
  };

  const load = async () => {
    const [{ data: m }, { data: c }] = await Promise.all([
      supabase.from("v_kammattam_meter").select("black_paise, white_paise").maybeSingle(),
      supabase.from("billing_config").select("auto_charge_enabled").eq("id", 1).maybeSingle(),
    ]);
    if (m) {
      const next = { black_paise: Number(m.black_paise || 0), white_paise: Number(m.white_paise || 0) };
      if (prevBlack.current !== null && next.black_paise > prevBlack.current) {
        setPulse("black");
        if (soundOn) { const a = ensureAudio(); if (a) ringTempleBell(a); }
        setTimeout(() => setPulse(null), 1400);
      } else if (prevBlack.current !== null && next.white_paise > (meter?.white_paise ?? 0)) {
        setPulse("white");
        setTimeout(() => setPulse(null), 1400);
      }
      prevBlack.current = next.black_paise;
      setMeter(next);
    }
    if (c) setAutoCharge(!!c.auto_charge_enabled);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    // Realtime: re-pull on any revenue change
    const ch = supabase
      .channel("kammattam-meter")
      .on("postgres_changes", { event: "*", schema: "public", table: "usage_overages" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "fastlink_payments" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "storage_topups" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding_requests" }, load)
      .subscribe();
    return () => { clearInterval(id); supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundOn]);

  const toggleAutoCharge = async (v: boolean) => {
    setAutoCharge(v);
    const { error } = await supabase.from("billing_config").update({ auto_charge_enabled: v }).eq("id", 1);
    if (error) { toast.error(error.message); setAutoCharge(!v); }
    else toast.success(v ? "Auto-charge is LIVE — overages will be billed to saved cards." : "Auto-charge paused.");
  };

  const popOut = () => {
    const w = 460, h = 640;
    window.open(`/admin/kammattam?popout=1`, "kammattam", `width=${w},height=${h},menubar=no,toolbar=no`);
  };

  const total = (meter?.black_paise ?? 0) + (meter?.white_paise ?? 0);

  return (
    <div
      className={`relative rounded-3xl p-6 md:p-8 border-2 overflow-hidden transition-shadow ${
        pulse === "black" ? "shadow-[0_0_60px_rgba(34,197,94,0.6)] border-emerald-400/70"
        : pulse === "white" ? "shadow-[0_0_60px_rgba(244,244,245,0.5)] border-zinc-200/60"
        : "border-border/60 shadow-xl"
      }`}
      style={{ background: "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--secondary)/0.5) 100%)" }}
    >
      {/* LED chase border */}
      <div className="absolute inset-0 rounded-3xl pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,transparent,hsl(var(--primary)),transparent)] bg-[length:200%_100%] animate-[kam-led_3s_linear_infinite]" />
        <div className="absolute inset-y-0 right-0 w-[2px] bg-[linear-gradient(180deg,transparent,hsl(var(--accent)),transparent)] bg-[length:100%_200%] animate-[kam-led_3s_linear_infinite]" />
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-[linear-gradient(270deg,transparent,hsl(var(--primary)),transparent)] bg-[length:200%_100%] animate-[kam-led_3s_linear_infinite]" />
        <div className="absolute inset-y-0 left-0 w-[2px] bg-[linear-gradient(0deg,transparent,hsl(var(--accent)),transparent)] bg-[length:100%_200%] animate-[kam-led_3s_linear_infinite]" />
      </div>
      <style>{`@keyframes kam-led { 0% { background-position: 0% 0%; } 100% { background-position: 200% 200%; } }`}</style>

      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-pink-500 grid place-items-center glow-primary">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display text-lg font-bold tracking-tight">Digital Kammattam Meter</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Live earnings • realised vs trapped</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSoundOn(s => !s)} className="p-2 rounded-lg border border-border/60 hover:bg-secondary" title={soundOn ? "Mute bell" : "Unmute bell"}>
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 opacity-50" />}
            </button>
            {!popout && (
              <button onClick={popOut} className="p-2 rounded-lg border border-border/60 hover:bg-secondary" title="Pop out to a separate window">
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Total ticker */}
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Total pipeline</div>
          <div className="font-mono text-3xl md:text-5xl font-black tracking-tight">{meter ? fmtINR(total) : "—"}</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* BLACK — realised */}
          <div className={`rounded-2xl p-5 bg-black text-white border border-emerald-500/30 transition-transform ${pulse === "black" ? "scale-[1.02]" : ""}`}>
            <div className="flex items-center gap-2 text-emerald-400 text-[11px] uppercase tracking-[0.18em] mb-2">
              <Zap className="w-3.5 h-3.5" /> Realised · Black
            </div>
            <div className="font-mono text-2xl md:text-3xl font-extrabold">{meter ? fmtINR(meter.black_paise) : "—"}</div>
            <div className="text-[11px] text-zinc-400 mt-1">Cash in the account.</div>
          </div>

          {/* WHITE — trapped */}
          <div className={`rounded-2xl p-5 bg-white text-zinc-900 border border-zinc-300 transition-transform ${pulse === "white" ? "scale-[1.02]" : ""}`}>
            <div className="flex items-center gap-2 text-zinc-500 text-[11px] uppercase tracking-[0.18em] mb-2">
              <GraduationCap className="w-3.5 h-3.5" /> Trapped · White
            </div>
            <div className="font-mono text-2xl md:text-3xl font-extrabold">{meter ? fmtINR(meter.white_paise) : "—"}</div>
            <div className="text-[11px] text-zinc-500 mt-1">Pending / failed — waiting on auto-charge.</div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3 bg-secondary/40">
          <div className="text-xs">
            <div className="font-semibold">Auto-charge saved cards</div>
            <div className="text-muted-foreground">Drains the trapped column into realised — off_session Stripe.</div>
          </div>
          <Switch checked={autoCharge} onCheckedChange={toggleAutoCharge} />
        </div>
      </div>
    </div>
  );
}
