import { useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import crayonsPictures from "@/assets/crayons-pictures-3d.png";
import crayonsBridge from "@/assets/crayons-bridge-3d.png";
import crayonsLoop from "@/assets/crayons-loop-3d.png";

/**
 * HeroSilverScreen
 *
 * A static 3D studio-ident showcase rendered inside an IMAX-style silver screen
 * panel. The logo itself does NOT animate or rotate — it cycles by fading OUT
 * to a silver-screen white, then the next logo fades IN from that same silver
 * white. The frame around it carries the anamorphic / ARRI Master Anamorphic
 * cinema tone: 2.39 letterboxed frame, soft horizontal lens flare hints,
 * vignette, subtle gate weave, and projector side-light bleeds.
 *
 * Used only on the public home page hero.
 */

const LOGOS = [
  { src: crayonsPictures, label: "Crayons Pictures" },
  { src: crayonsBridge,   label: "Crayons Bridge"   },
  { src: crayonsLoop,     label: "Crayons Loop"     },
];

// Responsive IMAX / ARRI Master Anamorphic pacing constants
// Desktop = slower, majestic; Mobile = snappier but still cinematic
function useCinemaTiming() {
  const isMobile = useIsMobile();
  return useMemo(() => {
    if (isMobile) {
      return {
        hold: 2600,        // shorter hold for mobile attention
        fadeOut: 750,      // faster fade to silver
        silverHold: 350,   // quick silver flash
        fadeIn: 750,       // faster reveal
        grainOpacity: 0.05,
      };
    }
    return {
      hold: 4800,          // long, majestic hold on desktop
      fadeOut: 1400,       // slow, elegant fade to silver
      silverHold: 700,     // generous silver interlude
      fadeIn: 1400,        // slow, dramatic reveal
      grainOpacity: 0.10,
    };
  }, [isMobile]);
}

type Phase = "hold" | "fading-out" | "silver" | "fading-in";

export function HeroSilverScreen() {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("hold");

  useEffect(() => {
    let cancelled = false;
    const next = (p: Phase, delay: number, after: () => void) => {
      const t = setTimeout(() => { if (!cancelled) { setPhase(p); after(); } }, delay);
      return () => clearTimeout(t);
    };
    let cleanup: (() => void) | void;
    const run = () => {
      // hold → fade out → silver → swap → fade in → hold
      cleanup = next("fading-out", HOLD, () => {
        cleanup = next("silver", FADE_OUT, () => {
          if (cancelled) return;
          setI((x) => (x + 1) % LOGOS.length);
          cleanup = next("fading-in", SILVER_HOLD, () => {
            cleanup = next("hold", FADE_IN, run);
          });
        });
      });
    };
    run();
    return () => { cancelled = true; if (cleanup) cleanup(); };
  }, []);

  const logoOpacity =
    phase === "hold" ? 1 :
    phase === "fading-out" ? 0 :
    phase === "silver" ? 0 :
    /* fading-in */ 1;

  const transitionMs =
    phase === "fading-out" ? FADE_OUT :
    phase === "fading-in"  ? FADE_IN  :
    0;

  const active = LOGOS[i];

  return (
    <div
      role="img"
      aria-label={`Studio ident — ${active.label}`}
      className="relative w-full aspect-[2.39/1] md:aspect-[2/1.1] rounded-xl overflow-hidden select-none"
      style={{
        // IMAX projection-room outer frame
        background:
          "radial-gradient(120% 80% at 50% 40%, hsl(0 0% 96%) 0%, hsl(0 0% 92%) 38%, hsl(220 12% 80%) 72%, hsl(220 14% 62%) 100%)",
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,0.6), inset 0 60px 120px rgba(255,255,255,0.35), 0 30px 80px -20px rgba(15,18,30,0.35)",
      }}
    >
      {/* Silver-screen surface — the actual projection field */}
      <div
        className="absolute inset-[6%] rounded-md overflow-hidden"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 45%, #ffffff 0%, #fafbfc 45%, #eef0f3 75%, #d9dde3 100%)",
          boxShadow:
            "inset 0 0 80px rgba(255,255,255,0.9), inset 0 0 200px rgba(180,190,205,0.45)",
        }}
      >
        {/* Anamorphic horizontal projector beam — left */}
        <div
          aria-hidden
          className="absolute -left-[20%] top-[15%] h-[70%] w-[55%] pointer-events-none mix-blend-screen opacity-70"
          style={{
            background:
              "radial-gradient(ellipse at left center, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.25) 35%, transparent 70%)",
            filter: "blur(14px)",
          }}
        />
        {/* Anamorphic horizontal projector beam — right */}
        <div
          aria-hidden
          className="absolute -right-[20%] top-[15%] h-[70%] w-[55%] pointer-events-none mix-blend-screen opacity-70"
          style={{
            background:
              "radial-gradient(ellipse at right center, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.25) 35%, transparent 70%)",
            filter: "blur(14px)",
          }}
        />

        {/* 3D logo — static, only opacity transitions */}
        <div className="absolute inset-0 flex items-center justify-center p-[8%]">
          <img
            src={active.src}
            alt={active.label}
            width={1600}
            height={900}
            loading="eager"
            decoding="async"
            className="max-w-[78%] max-h-[78%] w-auto h-auto object-contain will-change-[opacity]"
            style={{
              opacity: logoOpacity,
              transition: transitionMs
                ? `opacity ${transitionMs}ms cubic-bezier(0.4, 0, 0.2, 1)`
                : "none",
              // ARRI Master Anamorphic tone: gentle warm contrast + subtle bloom
              filter:
                "contrast(1.04) saturate(1.05) drop-shadow(0 6px 14px rgba(20,24,34,0.18))",
            }}
          />
        </div>

        {/* Vignette */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 55%, rgba(40,46,60,0.18) 100%)",
          }}
        />

        {/* Subtle horizontal scan / gate weave */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-[0.12]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 3px)",
          }}
        />

        {/* Film grain */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.07] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
          }}
        />

        {/* Anamorphic horizontal lens flare streak */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] pointer-events-none opacity-30"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(120,170,255,0.0) 15%, rgba(150,200,255,0.55) 50%, rgba(120,170,255,0.0) 85%, transparent 100%)",
            filter: "blur(2px)",
          }}
        />
      </div>

      {/* Bottom IMAX micro-label */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[9px] uppercase tracking-[0.35em] text-slate-600/80 font-mono">
        <span>IMAX</span>
        <span className="opacity-40">·</span>
        <span>ARRI Master Anamorphic</span>
        <span className="opacity-40">·</span>
        <span>2.39 : 1</span>
      </div>

      {/* Carousel dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {LOGOS.map((_, k) => (
          <span
            key={k}
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: k === i ? 18 : 6,
              background:
                k === i ? "rgba(60,80,180,0.85)" : "rgba(80,90,110,0.35)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default HeroSilverScreen;
