import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronRight, Trash2, Layers, Sparkles, Loader2 } from "lucide-react";
import {
  listCollections, createCollection, deleteCollection,
  listCollectionItems, addTitleToCollection, removeTitleFromCollection,
  listFranchises, createFranchise, deleteFranchise,
  type Collection, type Franchise,
} from "@/lib/creator/mediaCmsApi";
import type { TitleRow } from "@/lib/creator/titleApi";

/**
 * Compact manager surfaced at the top of My Titles.
 * Reuses the same visual language as other creator cards — no new components.
 */
export function CollectionsFranchisesManager({
  userId, titles,
}: { userId: string; titles: TitleRow[] }) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newFranchiseName, setNewFranchiseName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [c, f] = await Promise.all([listCollections(userId), listFranchises(userId)]);
      setCollections(c); setFranchises(f);
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { if (open) void reload(); }, [open, reload]);

  const addCollection = async () => {
    if (!newCollectionName.trim()) return;
    try { await createCollection(userId, newCollectionName.trim()); setNewCollectionName(""); await reload(); toast.success("Collection created"); }
    catch (e: any) { toast.error(e.message ?? "Could not create"); }
  };
  const addFranchise = async () => {
    if (!newFranchiseName.trim()) return;
    try { await createFranchise(userId, newFranchiseName.trim()); setNewFranchiseName(""); await reload(); toast.success("Franchise created"); }
    catch (e: any) { toast.error(e.message ?? "Could not create"); }
  };

  return (
    <div className="mb-4 rounded-xl border border-border/40 bg-card/30 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs hover:bg-secondary/20 transition-colors">
        <span className="inline-flex items-center gap-2 font-medium">
          <Layers className="w-3.5 h-3.5 text-accent" /> Collections & Franchises
          <span className="text-muted-foreground font-normal">Group titles into curated sets or franchises.</span>
        </span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border/40 p-4 grid md:grid-cols-2 gap-4">
          {/* Collections */}
          <section>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Collections</div>
            <div className="flex items-center gap-2 mb-3">
              <input value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="New collection name"
                className="flex-1 rounded-md bg-background/60 border border-border/50 text-xs px-2 py-1.5" />
              <button onClick={addCollection} disabled={!newCollectionName.trim()}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-accent text-accent-foreground disabled:opacity-40">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /> :
              collections.length === 0 ? <p className="text-xs text-muted-foreground">No collections yet.</p> :
              <ul className="space-y-1">
                {collections.map((c) => (
                  <CollectionRow key={c.id} collection={c} titles={titles}
                    expanded={expandedId === c.id}
                    onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    onRemoved={reload} />
                ))}
              </ul>
            }
          </section>

          {/* Franchises */}
          <section>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Franchises</div>
            <div className="flex items-center gap-2 mb-3">
              <input value={newFranchiseName} onChange={(e) => setNewFranchiseName(e.target.value)}
                placeholder="New franchise name"
                className="flex-1 rounded-md bg-background/60 border border-border/50 text-xs px-2 py-1.5" />
              <button onClick={addFranchise} disabled={!newFranchiseName.trim()}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-accent text-accent-foreground disabled:opacity-40">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {franchises.length === 0 ? <p className="text-xs text-muted-foreground">No franchises yet. Link titles to a franchise from each title's Media CMS tab.</p> :
              <ul className="space-y-1">
                {franchises.map((f) => (
                  <li key={f.id} className="flex items-center justify-between text-xs px-2.5 py-2 rounded-md bg-background/40 border border-border/40">
                    <span className="inline-flex items-center gap-1.5 truncate"><Sparkles className="w-3 h-3 text-accent" /> {f.name}</span>
                    <button onClick={async () => { try { await deleteFranchise(f.id); await reload(); toast.success("Removed"); } catch (e: any) { toast.error(e.message); } }}
                      className="text-muted-foreground hover:text-rose-300" aria-label="Delete franchise">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            }
          </section>
        </div>
      )}
    </div>
  );
}

function CollectionRow({
  collection, titles, expanded, onToggle, onRemoved,
}: { collection: Collection; titles: TitleRow[]; expanded: boolean; onToggle: () => void; onRemoved: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try { setItems(await listCollectionItems(collection.id)); }
    finally { setLoading(false); }
  }, [collection.id]);

  useEffect(() => { if (expanded) void reload(); }, [expanded, reload]);

  const availableTitles = titles.filter((t) => !items.find((i) => i.title_id === t.id));

  const add = async () => {
    if (!selectedTitle) return;
    try { await addTitleToCollection(collection.id, selectedTitle, items.length); setSelectedTitle(""); await reload(); toast.success("Added"); }
    catch (e: any) { toast.error(e.message ?? "Could not add"); }
  };
  const remove = async (id: string) => {
    try { await removeTitleFromCollection(id); await reload(); toast.success("Removed"); }
    catch (e: any) { toast.error(e.message ?? "Could not remove"); }
  };
  const removeCollection = async () => {
    if (!confirm(`Delete collection "${collection.name}"?`)) return;
    try { await deleteCollection(collection.id); onRemoved(); toast.success("Collection deleted"); }
    catch (e: any) { toast.error(e.message ?? "Could not delete"); }
  };

  return (
    <li className="rounded-md bg-background/40 border border-border/40">
      <div className="flex items-center justify-between text-xs px-2.5 py-2">
        <button onClick={onToggle} className="inline-flex items-center gap-1.5 truncate flex-1 text-left">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span className="truncate">{collection.name}</span>
        </button>
        <button onClick={removeCollection} className="text-muted-foreground hover:text-rose-300 ml-2" aria-label="Delete collection">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-border/40 p-2.5 space-y-2">
          <div className="flex gap-2">
            <select value={selectedTitle} onChange={(e) => setSelectedTitle(e.target.value)}
              className="flex-1 rounded-md bg-background/60 border border-border/50 text-xs px-2 py-1.5">
              <option value="">Add title…</option>
              {availableTitles.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <button onClick={add} disabled={!selectedTitle}
              className="text-xs px-2.5 py-1.5 rounded-md bg-accent/20 hover:bg-accent/30 disabled:opacity-40">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /> :
            items.length === 0 ? <p className="text-[11px] text-muted-foreground">Empty.</p> :
            <ul className="space-y-1">
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-background/60">
                  <span className="truncate">{it.title?.title ?? it.title_id}</span>
                  <button onClick={() => remove(it.id)} className="text-muted-foreground hover:text-rose-300" aria-label="Remove">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          }
        </div>
      )}
    </li>
  );
}
