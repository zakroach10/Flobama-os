export type WallJoinNotice = {
  id: string;
  displayName: string;
  joinedAt: string;
};

export function mapJoinRows(
  rows: Array<{ id: string; display_name: string; joined_at: string }> | null | undefined,
): WallJoinNotice[] {
  return (rows ?? [])
    .filter((row) => row.id && row.display_name)
    .map((row) => ({
      id: row.id,
      displayName: row.display_name,
      joinedAt: row.joined_at,
    }));
}

/** Joins the wall has not announced yet, oldest first so names appear in arrival order. */
export function takeUnseenJoins(
  seen: ReadonlySet<string>,
  joins: readonly WallJoinNotice[],
): WallJoinNotice[] {
  return joins
    .filter((join) => join.id.length > 0 && join.displayName.trim().length > 0 && !seen.has(join.id))
    .slice()
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.id.localeCompare(b.id));
}
