/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FLO_BAMA_VENUE_ID, TRIVIA_OBS_SCENE_NAME, TRIVIA_WALL_HEIGHT, TRIVIA_WALL_WIDTH } from "@/lib/constants";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,abc") },
}));

vi.mock("next/font/local", () => ({
  default: () => ({ className: "font-trivia-display", variable: "--font-trivia-display", style: {} }),
}));
import { demoTriviaQuestionWall } from "@/lib/trivia/demo";
import { buildTriviaObsSceneCollection } from "@/lib/trivia/obs-collection";
import {
  issueTriviaWallShareToken,
  triviaWallPath,
  triviaWallPollPath,
  triviaWallShareUrl,
  verifyTriviaWallShareToken,
} from "@/lib/trivia/wall-share";

const SECRET = "test-trivia-wall-secret";

describe("trivia wall share token", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("issues a stable token that verifies back to the venue", () => {
    const first = issueTriviaWallShareToken(FLO_BAMA_VENUE_ID);
    const second = issueTriviaWallShareToken(FLO_BAMA_VENUE_ID);
    expect(first).toBeTruthy();
    expect(second).toBe(first);
    expect(first).not.toContain(FLO_BAMA_VENUE_ID);
    expect(verifyTriviaWallShareToken(first)).toEqual({ ok: true, venueId: FLO_BAMA_VENUE_ID });
  });

  it("rejects a tampered signature and a raw venue id", () => {
    const token = issueTriviaWallShareToken(FLO_BAMA_VENUE_ID)!;
    const [body] = token.split("~");
    expect(verifyTriviaWallShareToken(`${body}~aaaaaaaa`)).toEqual({ ok: false });
    expect(verifyTriviaWallShareToken(FLO_BAMA_VENUE_ID)).toEqual({ ok: false });
    expect(verifyTriviaWallShareToken("")).toEqual({ ok: false });
  });

  it("builds a public path and poll path from the token", () => {
    const token = issueTriviaWallShareToken(FLO_BAMA_VENUE_ID)!;
    expect(triviaWallPath(token)).toBe(`/wall/${token}`);
    expect(triviaWallPollPath(token)).toBe(`/api/public/v1/trivia/wall/${encodeURIComponent(token)}`);
    expect(triviaWallShareUrl("https://flobama-os.vercel.app", FLO_BAMA_VENUE_ID)).toBe(
      `https://flobama-os.vercel.app/wall/${token}`,
    );
  });

  it("does not issue a token without a signing secret", () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(issueTriviaWallShareToken(FLO_BAMA_VENUE_ID)).toBeNull();
    expect(verifyTriviaWallShareToken("anything")).toEqual({ ok: false });
  });
});

describe("trivia OBS scene collection", () => {
  it("imports as a version-1 collection with one 1920x1080 browser source", () => {
    const url = "https://flobama-os.vercel.app/wall/body~sig";
    const collection = buildTriviaObsSceneCollection({
      url,
      sceneUuid: "11111111-1111-4111-8111-111111111111",
      sourceUuid: "22222222-2222-4222-8222-222222222222",
    });

    expect(collection.version).toBeLessThan(2);
    expect("resolution" in collection).toBe(false);
    expect(collection.name).toBe("FloBama LED Wall");
    expect(collection.current_scene).toBe(TRIVIA_OBS_SCENE_NAME);
    expect(collection.current_program_scene).toBe(TRIVIA_OBS_SCENE_NAME);
    expect(collection.scene_order).toEqual([{ name: TRIVIA_OBS_SCENE_NAME }]);
    expect(collection.groups).toEqual([]);

    const scene = collection.sources.find((source) => source.id === "scene");
    const browser = collection.sources.find((source) => source.id === "browser_source");
    expect(scene?.name).toBe(TRIVIA_OBS_SCENE_NAME);
    expect(browser?.name).toBe("Trivia LED Browser");
    expect(browser?.versioned_id).toBe("browser_source");
    expect(browser?.settings).toMatchObject({
      is_local_file: false,
      url,
      width: TRIVIA_WALL_WIDTH,
      height: TRIVIA_WALL_HEIGHT,
      webpage_control_level: 0,
      shutdown: false,
    });
    expect(TRIVIA_WALL_WIDTH).toBe(1920);
    expect(TRIVIA_WALL_HEIGHT).toBe(1080);

    const items = ((scene?.settings as { items?: Array<{ name: string; source_uuid: string; bounds: { x: number; y: number } }> }).items ??
      []) as Array<{ name: string; source_uuid: string; bounds: { x: number; y: number } }>;
    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe(browser?.name);
    expect(items[0]?.source_uuid).toBe(browser?.uuid);
    expect(items[0]?.bounds).toEqual({ x: 1920, y: 1080 });

    const names = new Set(collection.sources.map((source) => source.name));
    for (const ordered of collection.scene_order) {
      expect(names.has(ordered.name)).toBe(true);
    }

    const roundTrip = JSON.parse(JSON.stringify(collection)) as typeof collection;
    expect(roundTrip.sources.find((source) => source.id === "browser_source")?.settings.url).toBe(url);
  });
});

describe("trivia wall stage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders the question wall and keeps polling the token path", async () => {
    const { TriviaWallStage } = await import("@/components/screens/trivia-wall-stage");
    const wall = demoTriviaQuestionWall();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ trivia: wall }),
      })),
    );
    await act(async () => {
      root.render(
        createElement(TriviaWallStage, {
          initial: wall,
          pollPath: "/api/public/v1/trivia/wall/signed-token",
        }),
      );
    });

    expect(document.body.textContent).toContain("Who founded FAME Studios in Muscle Shoals?");
    expect(document.body.textContent).not.toContain("Sign in");
    expect(fetch).toHaveBeenCalledWith("/api/public/v1/trivia/wall/signed-token", { cache: "no-store" });
  });

  it("shows the standby frame when no game is live", async () => {
    const { TriviaWallStage } = await import("@/components/screens/trivia-wall-stage");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ trivia: null }),
      })),
    );
    await act(async () => {
      root.render(
        createElement(TriviaWallStage, {
          initial: null,
          pollPath: "/api/public/v1/trivia/wall/signed-token",
        }),
      );
    });
    expect(document.body.textContent).toContain("Next game shows up here");
    expect(document.body.textContent).not.toContain("Sign in");
  });
});
