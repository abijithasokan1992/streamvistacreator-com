import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Pencil, Eye, Send, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { createTitle, listTitles, type TitleRow } from "@/lib/creator/titleApi";
import { StatusBadge } from "@/components/creator/title/StatusBadge";
import { TitleEditor } from "@/components/creator/title/TitleEditor";

export default function MyTitlesSection() {
  const { user } = useAuth();
  const { active } = useWorkspaces();
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"edit" | "view">("edit");

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try { setTitles(await listTitles(user.id)); } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const handleCreate = async () => {
    if (!user) return;
    if (!newName.trim()) { toast.error("Title name is required."); return; }
    try {
      const t = await createTitle(user.id, active?.id ?? null, newName);
      setNewName("");
      setCreating(false);
      await reload();
      setEditorId(t.id);
      setEditorMode("edit");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create title.");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          {loading ? "Loading…" : `${titles.length} title${titles.length === 1 ? "" : "s"}`}
        </p>
        <button
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground text-xs px-3 py-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Create New Title
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border border-border/50 bg-secondary/10 p-4 mb-4 flex items-center gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Title name"
            className="flex-1 bg-background border border-border/40 rounded-md px-3 py-1.5 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          />
          <button onClick={handleCreate} className="rounded-md bg-accent text-accent-foreground text-xs px-3 py-1.5">
            Create
          </button>
          <button onClick={() => { setCreating(false); setNewName(""); }}
            className="text-xs text-muted-foreground hover:text-foreground px-2">
            Cancel
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
        </div>
      ) : titles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-secondary/5 p-10 text-center">
          <p className="font-semibold">No titles yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first title to begin.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {titles.map((t) => (
            <article key={t.id} className="rounded-xl border border-border/40 bg-secondary/5 p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium truncate">{t.title}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Updated {new Date(t.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {t.locked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
              <StatusBadge status={t.status} />
              <div className="flex items-center gap-1.5 mt-auto pt-2">
                <button
                  onClick={() => { setEditorId(t.id); setEditorMode("view"); }}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-border/50 text-xs px-2 py-1.5 hover:bg-secondary/30"
                >
                  <Eye className="w-3 h-3" /> View
                </button>
                <button
                  disabled={t.locked}
                  onClick={() => { setEditorId(t.id); setEditorMode("edit"); }}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-border/50 text-xs px-2 py-1.5 hover:bg-secondary/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editorId && (
        <TitleEditor
          titleId={editorId}
          mode={editorMode}
          onClose={() => { setEditorId(null); reload(); }}
          onSubmitted={() => { setEditorId(null); reload(); toast.success("Submitted to Admin."); }}
        />
      )}
    </div>
  );
}
