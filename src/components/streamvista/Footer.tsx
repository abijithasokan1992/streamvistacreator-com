import { useBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";

export const Footer = () => {
  const b = useBranding();
  const logo = b?.footer_logo_url;
  const pos = b?.footer_logo_position ?? "footer-left";
  return (
    <footer className="border-t border-border/40 py-10">
      <div className={cn("container flex items-center gap-4", pos === "footer-right" ? "justify-end" : "justify-start")}>
        {logo ? (
          <img src={logo} alt="Brand" className="h-10 w-auto max-w-[180px] object-contain opacity-80" />
        ) : (
          <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} StreamVista Cloud X</span>
        )}
      </div>
    </footer>
  );
};
