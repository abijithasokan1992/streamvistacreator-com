import { useState } from "react";
import { Loader2, Sparkles, Wrench } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { setWorkspaceMode, type WorkspaceMode } from "@/lib/managed/modeApi";
import { toast } from "@/hooks/use-toast";

/**
 * One-question prompt shown to Creators the first time they land on the
 * dashboard without a saved workspace mode. Managed is the default recommended
 * choice; Self-Service is available for advanced users.
 */
export default function WorkspaceModePrompt({ onChosen }: { onChosen: (mode: WorkspaceMode) => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<WorkspaceMode | null>(null);

  async function choose(mode: WorkspaceMode) {
    if (!user) return;
    try {
      setBusy(mode);
      await setWorkspaceMode(user.id, mode);
      onChosen(mode);
    } catch (err) {
      toast({
        title: "Could not save your choice",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
      setBusy(null);
    }
  }

  return (
    <main className="min-h-dvh grid place-items-center bg-background text-foreground px-4">
      <div className="max-w-3xl w-full">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">
          Welcome to StreamVista
        </p>
        <h1 className="font-display text-3xl md:text-4xl mt-2 mb-3">
          How would you like to work with StreamVista?
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl mb-8">
          You can change this later in Workspace Settings.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => choose("managed")}
            disabled={!!busy}
            className="text-left rounded-2xl border border-accent/30 bg-accent/[0.06] p-6 hover:bg-accent/[0.1] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-accent">Recommended</span>
            </div>
            <h2 className="font-display text-xl mb-1.5">Managed by StreamVista</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              StreamVista will manage your project, metadata, QC, packaging, distribution
              and delivery. You upload media, approve milestones and track progress.
            </p>
            <div className="mt-4 inline-flex items-center text-xs text-accent">
              {busy === "managed" ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Setting up…</> : "Start managed →"}
            </div>
          </button>

          <button
            type="button"
            onClick={() => choose("self_service")}
            disabled={!!busy}
            className="text-left rounded-2xl border border-border/50 bg-secondary/10 p-6 hover:bg-secondary/20 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
          >
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Advanced</span>
            </div>
            <h2 className="font-display text-xl mb-1.5">Self-Service</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              I want to manage my project myself using the complete Creator Workspace —
              metadata, packaging, distribution controls and delivery.
            </p>
            <div className="mt-4 inline-flex items-center text-xs">
              {busy === "self_service" ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Opening…</> : "Use self-service →"}
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}
