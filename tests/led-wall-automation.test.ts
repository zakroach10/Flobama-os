import { describe, expect, it } from "vitest";
import { canAutoArtistCut } from "@/lib/screens/led-wall-automation";

describe("LED wall automation guards", () => {
  it("allows artist auto onto ad-roll and legacy house media", () => {
    expect(
      canAutoArtistCut({
        activeKind: null,
        activationSource: null,
        activePlaylistId: null,
        defaultPlaylistId: "default",
        activeSceneId: null,
      }),
    ).toBe(true);

    expect(
      canAutoArtistCut({
        activeKind: null,
        activationSource: "ad_roll",
        activePlaylistId: "default",
        defaultPlaylistId: "default",
        activeSceneId: null,
      }),
    ).toBe(true);

    expect(
      canAutoArtistCut({
        activeKind: "media",
        activationSource: null,
        activePlaylistId: null,
        defaultPlaylistId: "default",
        activeSceneId: "scene-1",
      }),
    ).toBe(true);
  });

  it("blocks artist auto over trivia/audience and explicit manual sources", () => {
    expect(
      canAutoArtistCut({
        activeKind: "trivia",
        activationSource: "manual",
        activePlaylistId: null,
        defaultPlaylistId: "default",
        activeSceneId: "trivia-1",
      }),
    ).toBe(false);

    expect(
      canAutoArtistCut({
        activeKind: "media",
        activationSource: "manual",
        activePlaylistId: null,
        defaultPlaylistId: "default",
        activeSceneId: "scene-1",
      }),
    ).toBe(false);
  });
});
