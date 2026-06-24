import { useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import crayonsPictures from "@/assets/crayons-pictures-3d.png";
import crayonsBridge from "@/assets/crayons-bridge-3d.png";
import crayonsLoop from "@/assets/crayons-loop-3d.png";

/**
 * HeroStudioIdent
 *
 * Studio-ident showcase. Logos cycle by fading OUT then fading IN on a single
 * unified background. No screen framing, no projection chrome, no labels —
 * just the logos, large, centered, and vivid in both light and dark themes.
 */

const LOGOS = [
  { src: crayonsPictures, label: "Crayons Pictures" },
  { src: crayonsBridge,   label: "Crayons Bridge"   },
  { src: crayonsLoop,     label: "Crayons Loop"     },
];

function useIdentTiming() {
  const isMobile = useIsMobile();
  return useMemo(() => {
    if (isMobile) {
      return { hold: 2600, fadeOut: 750, midHold: 200, fadeIn: 750 };
    }
    return { hold: 4800, fadeOut: 1200, midHold: 350, fadeIn: 1200 };
  }, [isMobile]);
}

type Phase = "hold" | "fading-out" | "mid" | "fading-in";

export function HeroStudioIdent() {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("hold");
  const timing = useIdentTiming();

  useEffect(() => {
    let cancelled = false;
    const next = (p: Phase, delay: number, after: () => void) => {
      const t = setTimeout(() => { if (!cancelled) { setPhase(p); after(); } }, delay);
      return () => clearTimeout(t);
    };
    let cleanup: (() => void) | void;
    const run = () => {
      cleanup = next("fading-out", timing.hold, () => {
        cleanup = next("mid", timing.fadeOut, () => {
          if (cancelled) return;
          setI((x) => (x + 1) % LOGOS.length);
          cleanup = next("fading-in", timing.midHold, () => {
            cleanup = next("hold", timing.fadeIn, run);
          });
        });
      });
    };
    run();
    return () => { cancelled = true; if (cleanup) cleanup(); };
  }, [timing]);

  const logoOpacity =
    phase === "hold" ? 1 :
    phase === "fading-out" ? 0 :
    phase === "mid" ? 0 :
    1;

  const transitionMs =
    phase === "fading-out" ? timing.fadeOut :
    phase === "fading-in"  ? timing.fadeIn  :
    0;

  const active = LOGOS[i];

  return (
    <div
      data-testid="hero-studio-ident"
      role="img"
      aria-label={`Studio ident — ${active.label}`}
      className="relative w-full aspect-[16/9] rounded-xl overflow-hidden select-none bg-background"
    >
      {/* Locked 16:9 stage — matches source-logo intrinsic ratio so the logo
          always fills the same pixels at every breakpoint, and the aura stays
          perfectly aligned to it. No padding that could shift placement. */}
      <div
        data-testid="ident-stage"
        className="absolute inset-0 grid place-items-center"
      >
        {/* Aura — sized to the stage so it tracks the logo exactly */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(58% 52% at 50% 50%, hsl(var(--primary-glow) / 0.28) 0%, hsl(var(--primary) / 0.12) 38%, transparent 72%)",
          }}
        />

        <img
          src={active.src}
          alt={active.label}
          width={1600}
          height={900}
          loading="eager"
          decoding="async"
          className="relative block w-full h-full object-contain"
          style={{
            opacity: logoOpacity,
            transition: transitionMs
              ? `opacity ${transitionMs}ms cubic-bezier(0.4, 0, 0.2, 1)`
              : "none",
            // Bright, vivid logo with chromatic aura.
            filter:
              "brightness(1.22) contrast(1.18) saturate(1.6) drop-shadow(0 0 22px hsl(var(--primary-glow) / 0.45)) drop-shadow(0 10px 24px rgba(20,24,34,0.22))",
          }}
        />
      </div>
    </div>
  );
}

export default HeroStudioIdent;
