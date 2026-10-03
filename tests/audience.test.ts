import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AudienceWall } from "@/components/audience/audience-wall";
import type { AudienceWallState } from "@/lib/audience/types";
import {
  applyVoteCounts,
  choiceLabelsForTool,
  createAudienceJoinCode,
  cornerSponsorForWall,
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

  it("shows a corner sponsor only when it is enabled and has a name or logo", () => {
    expect(cornerSponsorForWall(null)).toBeNull();
    expect(
      cornerSponsorForWall({ enabled: false, name: "Acme", imageUrl: null, corner: "bottom-left" }),
    ).toBeNull();
    expect(
      cornerSponsorForWall({ enabled: true, name: "  ", imageUrl: "  ", corner: "bottom-left" }),
    ).toBeNull();
    expect(
      cornerSponsorForWall({ enabled: true, name: " Acme ", imageUrl: "", corner: "sideways" }),
    ).toEqual({
      name: "Acme",
      imageUrl: null,
      corner: "bottom-left",
    });
    expect(
      cornerSponsorForWall({
        enabled: true,
        name: "",
        imageUrl: "https://cdn.example/logo.png",
        corner: "bottom-right",
      }),
    ).toEqual({
      name: "",
      imageUrl: "https://cdn.example/logo.png",
      corner: "bottom-right",
    });
  });

  it("renders the corner sponsor on the audience wall without replacing the live card", () => {
    const wall: AudienceWallState = {
      sessionId: "session",
      title: "Live show",
      joinCode: "ABC234",
      joinPath: "/live/ABC234",
      guestCount: 3,
      brandLogoUrl: null,
      cornerSponsor: {
        name: "Acme Motors",
        imageUrl: "https://cdn.example/acme.png",
        corner: "bottom-right",
      },
      tool: {
        id: "tool",
        kind: "message",
        title: "Message",
        payload: { text: "Going live" },
        votingOpen: false,
        resultsRevealed: false,
        tallies: [],
        totalVotes: 0,
      },
      lobbyMessage: "Live on the wall — scan to join",
    };
    const html = renderToStaticMarkup(createElement(AudienceWall, { initial: wall }));
    expect(html).toContain("Going live");
    expect(html).toContain("Acme Motors");
    expect(html).toContain("Presented by");
    expect(html).toContain("bottom-10 right-10");
    expect(html).toContain("https://cdn.example/acme.png");
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
