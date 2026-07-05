import pictures from "@/assets/crayons-pictures.png.asset.json";
import bridge from "@/assets/crayons-bridge.png.asset.json";
import loop from "@/assets/crayons-loop.png.asset.json";

const BRANDS = [
  { name: "Crayons Pictures", url: pictures.url, one: "Production & IP" },
  { name: "Crayons Bridge", url: bridge.url, one: "Licensing & delivery" },
  { name: "Crayons Loop", url: loop.url, one: "Streaming & exhibition" },
];

interface Props {
  variant?: "row" | "grid";
  eyebrow?: string;
  className?: string;
  showCaptions?: boolean;
}

/** Own-ecosystem lockup — NOT a partner strip. */
export const CrayonsNetwork = ({
  variant = "row",
  eyebrow = "The Crayons Network — our own studios",
  className = "",
  showCaptions = false,
}: Props) => {
  if (variant === "grid") {
    return (
      <div className={className}>
        <div className="text-[10px] font-mono-tech uppercase tracking-[0.22em] text-muted-foreground/70 mb-4 text-center">
          {eyebrow}
        </div>
        <div className="grid grid-cols-3 gap-3 md:gap-6 items-center">
          {BRANDS.map((b) => (
            <div key={b.name} className="rounded-xl border border-border/50 bg-background/40 p-4 grid place-items-center">
              <img src={b.url} alt={b.name} className="h-10 md:h-12 w-auto object-contain" loading="lazy" />
              {showCaptions && (
                <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground text-center">{b.one}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="text-[10px] font-mono-tech uppercase tracking-[0.22em] text-muted-foreground/70">
        {eyebrow}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        {BRANDS.map((b) => (
          <img
            key={b.name}
            src={b.url}
            alt={b.name}
            title={b.name}
            className="h-7 md:h-8 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
            loading="lazy"
          />
        ))}
      </div>
    </div>
  );
};

export default CrayonsNetwork;
