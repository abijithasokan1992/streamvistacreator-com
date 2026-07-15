import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getWorkspaceMode, setWorkspaceMode, type WorkspaceMode } from "@/lib/managed/modeApi";
import { toast } from "@/hooks/use-toast";

/**
 * Renders on the account/workspace settings page. Lets a creator switch
 * between Managed and Self-Service at any time.
 */
export default function WorkspaceModeCard() {
  const { user } = useAuth();
  const [mode, setMode] = useState<WorkspaceMode | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const m = await getWorkspaceMode(user.id);
        setMode(m ?? "managed");
      } catch { setMode("managed"); }
    })();
  }, [user?.id]);

  async function switchTo(next: WorkspaceMode) {
    if (!user || next === mode) return;
    try {
      setBusy(true);
      await setWorkspaceMode(user.id, next);
      setMode(next);
      toast({ title: `Switched to ${next === "managed" ? "Managed by StreamVista" : "Self-Service"}` });
    } catch (err) {
      toast({
        title: "Could not switch mode",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/10 p-5">
      <h2 className="text-sm font-semibold mb-1">Workspace mode</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Managed by StreamVista is recommended for most creators. Self-Service exposes
        the complete Creator Workspace with metadata, packaging and distribution controls.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => switchTo("managed")}
          className={`text-left rounded-xl border p-4 text-sm transition-colors ${
            mode === "managed"
              ? "border-accent/40 bg-accent/[0.06] text-foreground"
              : "border-border/50 bg-background hover:bg-secondary/20"
          }`}
        >
          <div className="font-semibold mb-1">Managed by StreamVista</div>
          <div className="text-xs text-muted-foreground">Upload, approve, track. We handle the rest.</div>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => switchTo("self_service")}
          className={`text-left rounded-xl border p-4 text-sm transition-colors ${
            mode === "self_service"
              ? "border-accent/40 bg-accent/[0.06] text-foreground"
              : "border-border/50 bg-background hover:bg-secondary/20"
          }`}
        >
          <div className="font-semibold mb-1">Self-Service</div>
          <div className="text-xs text-muted-foreground">Full Creator Workspace, every control available.</div>
        </button>
      </div>
      {busy && (
        <div className="mt-3 inline-flex items-center text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Saving…
        </div>
      )}
    </div>
  );
}
