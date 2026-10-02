import { describe, expect, it } from "vitest";
import {
  applyVoteCounts,
  choiceLabelsForTool,
  createAudienceJoinCode,
  defaultPayloadForKind,
  isAudienceToolKind,
  normalizeAudienceDisplayName,
} from "@/lib/audience/engine";
import { AUDIENCE_TOOL_KINDS } from "@/lib/audience/types";
import {
  authorizeAudienceRun,
  authorizeTriviaRun,
  canRunAudienceInteractor,
  isInteractorOnly,
  ROLE_PERMISSIONS,
} from "@/lib/auth/permissions";
import { STAFF_ROLES } from "@/lib/constants";

describe("audience interactor role", () => {
  it("includes interactor in staff roles", () => {
    expect(STAFF_ROLES).toContain("interactor");
  });

  it("lets interactors run audience tools but not trivia", () => {
    expect(canRunAudienceInteractor("interactor")).toBe(true);
    expect(authorizeAudienceRun("interactor").allowed).toBe(true);
    expect(authorizeTriviaRun("interactor").allowed).toBe(false);
    expect(isInteractorOnly("interactor")).toBe(true);
    expect(authorizeAudienceRun("viewer").allowed).toBe(false);
  });

  it("documents audience-only access for entertainers", () => {
    expect(ROLE_PERMISSIONS.interactor.some((item) => /no sidebar/i.test(item))).toBe(true);
    expect(ROLE_PERMISSIONS.interactor.some((item) => /preset/i.test(item))).toBe(true);
  });
});

describe("audience engine", () => {
  it("builds poll and hot-take choices", () => {
    expect(isAudienceToolKind("poll")).toBe(true);
    expect(choiceLabelsForTool("poll", { options: ["A", "B"] }).map((row) => row.key)).toEqual([
      "opt-0",
      "opt-1",
    ]);
    expect(choiceLabelsForTool("hot_take", {}).map((row) => row.label)).toEqual([
      "Agree",
      "Terrible Take",
    ]);
  });

  it("tallies votes", () => {
    const base = choiceLabelsForTool("poll", { options: ["Yes", "No"] });
    const { tallies, totalVotes } = applyVoteCounts(base, [
      { choice_key: "opt-0" },
      { choice_key: "opt-0" },
      { choice_key: "opt-1" },
    ]);
    expect(totalVotes).toBe(3);
    expect(tallies[0]?.count).toBe(2);
  });

  it("has defaults for every tool kind", () => {
    for (const kind of AUDIENCE_TOOL_KINDS) {
      expect(Object.keys(defaultPayloadForKind(kind)).length).toBeGreaterThan(0);
    }
  });

  it("does not expose pickem or leaderboard tools", () => {
    expect(AUDIENCE_TOOL_KINDS).not.toContain("pickem_promo");
    expect(AUDIENCE_TOOL_KINDS).not.toContain("leaderboard");
    expect(isAudienceToolKind("pickem_promo")).toBe(false);
    expect(isAudienceToolKind("leaderboard")).toBe(false);
  });

  it("supports picture presets for the LED wall", () => {
    expect(AUDIENCE_TOOL_KINDS).toContain("picture");
    expect(isAudienceToolKind("picture")).toBe(true);
    expect(defaultPayloadForKind("picture")).toEqual({
      imageUrl: "",
      storagePath: "",
      caption: "",
    });
  });

  it("normalizes names and join codes", () => {
    expect(normalizeAudienceDisplayName("  Zak  ")).toBe("Zak");
    expect(createAudienceJoinCode()).toHaveLength(6);
  });
});
