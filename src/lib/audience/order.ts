export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }
  const next = items.slice();
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return items;
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Reorder a visible slice (a filtered preset list, or one game's roster)
 * without disturbing rows that are hidden from the current view.
 */
export function applyVisibleReorder(allIds: string[], visibleIds: string[], nextVisibleIds: string[]) {
  const visible = new Set(visibleIds);
  const queue = nextVisibleIds.filter((id) => visible.has(id));
  if (queue.length !== visibleIds.length) return allIds;
  return allIds.map((id) => (visible.has(id) ? queue.shift()! : id));
}

export function withListPositions<T extends object>(items: T[]) {
  return items.map((item, position) => ({ ...item, position }));
}
