import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sanitizeGuessPlayerPayload } from "@/lib/audience/guess";
import { applyVisibleReorder, reorderItems, withListPositions } from "@/lib/audience/order";

const VENUE = "11111111-1111-4111-8111-111111111111";

describe("audience list order", () => {
  it("moves an item and leaves the others in place", () => {
    expect(reorderItems(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(reorderItems(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(reorderItems(["a", "b"], 0, 0)).toEqual(["a", "b"]);
    expect(reorderItems(["a"], 0, 4)).toEqual(["a"]);
  });

  it("reorders a filtered preset list without moving hidden presets", () => {
    const all = ["poll", "picture", "lyric", "player"];
    const visible = ["poll", "lyric", "player"];
    expect(applyVisibleReorder(all, visible, ["player", "poll", "lyric"])).toEqual([
      "player",
      "picture",
      "poll",
      "lyric",
    ]);
  });

  it("stores guess-player positions in run order", () => {
    const players = ["Cee", "Aye", "Bee"].map((name, index) => ({
      id: `player-${index + 1}`,
      name,
      photoUrl: "",
      storagePath: "",
    }));
    const moved = reorderItems(players, 0, 2);
    const saved = sanitizeGuessPlayerPayload(
      { prompt: "Who is this?", players: withListPositions(moved), activePlayerId: "player-1" },
      VENUE,
      "draft",
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const rows = saved.payload.players as Array<{ name: string; position: number }>;
    const named = rows.filter((row) => row.name);
    expect(named.map((row) => row.name)).toEqual(["Aye", "Bee", "Cee"]);
    expect(named.map((row) => row.position)).toEqual([0, 1, 2]);
  });

  it("adds a sort_order column for presets", () => {
    const sql = readFileSync("supabase/migrations/20261121000073_audience_preset_sort_order.sql", "utf8");
    expect(sql).toContain("sort_order");
    expect(sql).toContain("audience_presets_venue_sort_idx");
  });
});
