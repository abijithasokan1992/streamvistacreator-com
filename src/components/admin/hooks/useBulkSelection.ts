import { useCallback, useMemo, useState } from "react";

/**
 * Reusable multi-select primitive for admin list consoles.
 *
 *   const bulk = useBulkSelection(rows.map(r => r.id));
 *   ...
 *   <input type="checkbox" checked={bulk.isSelected(id)} onChange={() => bulk.toggle(id)} />
 *   <BulkActionBar count={bulk.count} onClear={bulk.clear} actions={[...]} />
 */
export function useBulkSelection(allIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);
  const selectAll = useCallback(() => setSelected(new Set(allIds)), [allIds]);
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));

  return useMemo(() => ({
    selected, ids: Array.from(selected), count: selected.size,
    toggle, clear, selectAll, isSelected, allSelected,
    toggleAll: () => (allSelected ? clear() : selectAll()),
  }), [selected, toggle, clear, selectAll, isSelected, allSelected]);
}
