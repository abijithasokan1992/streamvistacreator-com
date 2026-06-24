import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { AgentChat, type AgentSurface } from "./AgentChat";
import { cn } from "@/lib/utils";

export function AgentDock({ surface }: { surface: AgentSurface }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Launcher */}
      <button
        aria-label="Open AI assistant"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full shadow-2xl",
          "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground",
          "flex items-center justify-center transition-transform hover:scale-105",
          "ring-2 ring-primary/20",
        )}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[min(92vw,400px)] h-[min(70vh,560px)] animate-in fade-in slide-in-from-bottom-4">
          <AgentChat surface={surface} className="h-full shadow-2xl" />
        </div>
      )}
    </>
  );
}
