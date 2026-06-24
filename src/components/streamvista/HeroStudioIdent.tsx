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
      className="relative w-full aspect-[2.39/1] md:aspect-[2/1.1] rounded-xl overflow-hidden select-none bg-background"
    >
      {/* Single unified backdrop — responsive padding keeps the enlarged logo
          centered and uncropped on narrow mobile widths. */}
      <div className="absolute inset-0 flex items-center justify-center px-[4%] py-[6%] sm:px-[3%] sm:py-[4%]">
        <img
          src={active.src}
          alt={active.label}
          width={1600}
          height={900}
          loading="eager"
          decoding="async"
          className="block w-auto h-auto max-w-full max-h-full object-contain mx-auto will-change-[opacity]"
          style={{
            opacity: logoOpacity,
            transition: transitionMs
              ? `opacity ${transitionMs}ms cubic-bezier(0.4, 0, 0.2, 1)`
              : "none",
            // Brighter, more vivid logo — readable on both light and dark backgrounds.
            filter:
              "brightness(1.15) contrast(1.12) saturate(1.45) drop-shadow(0 8px 20px rgba(20,24,34,0.25))",
          }}
        />
      </div>

      {/* Carousel dots */}
      <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {LOGOS.map((_, k) => (
          <span
            key={k}
            data-testid={k === i ? "ident-dot-active" : "ident-dot"}
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: k === i ? 18 : 6,
              background:
                k === i ? "hsl(var(--primary) / 0.85)" : "hsl(var(--muted-foreground) / 0.35)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default HeroStudioIdent;
