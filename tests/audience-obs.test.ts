import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudienceObsSourcePanel } from "@/components/audience/obs-source-panel";
import { AudiencePlayClient } from "@/components/audience/audience-play-client";
import { AudienceWall } from "@/components/audience/audience-wall";
import { demoGuessBubblesWall } from "@/lib/audience/demo";
import { audienceDisplayNameMessage } from "@/lib/audience/names";
import { standbyAudienceWall } from "@/lib/audience/runtime";
import {
  audienceWallPath,
  audienceWallPollPath,
  audienceWallShareUrl,
  issueAudienceWallShareToken,
  verifyAudienceWallShareToken,
} from "@/lib/audience/wall-share";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { TRIVIA_PUBLIC_ORIGIN } from "@/lib/public/urls";

const SECRET = "test-audience-wall-secret";

describe("audience OBS browser source", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("issues a stable per-venue token and puts it in the browser source URL", () => {
    const first = issueAudienceWallShareToken(FLO_BAMA_VENUE_ID);
    const second = issueAudienceWallShareToken(FLO_BAMA_VENUE_ID);
    expect(first).toBeTruthy();
    expect(second).toBe(first);
    expect(first).not.toContain(FLO_BAMA_VENUE_ID);
    expect(verifyAudienceWallShareToken(first)).toEqual({ ok: true, venueId: FLO_BAMA_VENUE_ID });
    expect(verifyAudienceWallShareToken(FLO_BAMA_VENUE_ID)).toEqual({ ok: false });

    const solid = audienceWallShareUrl(TRIVIA_PUBLIC_ORIGIN, FLO_BAMA_VENUE_ID, "solid");
    const clear = audienceWallShareUrl(TRIVIA_PUBLIC_ORIGIN, FLO_BAMA_VENUE_ID, "transparent");
    expect(solid).toBe(`https://admin.flobamadowntown.com/display/audience/${first}?bg=solid`);
    expect(clear).toBe(`https://admin.flobamadowntown.com/display/audience/${first}?bg=transparent`);
    expect(audienceWallPollPath(first!)).toBe(`/api/public/v1/audience/wall/${encodeURIComponent(first!)}`);
    expect(audienceWallPath(first!, "solid")).toContain("bg=solid");
  });

  it("renders the copy panel with the production URL and OBS settings", () => {
    const solid = audienceWallShareUrl(TRIVIA_PUBLIC_ORIGIN, FLO_BAMA_VENUE_ID, "solid")!;
    const html = renderToStaticMarkup(
      createElement(AudienceObsSourcePanel, {
        solidUrl: solid,
        transparentUrl: solid.replace("bg=solid", "bg=transparent"),
      }),
    );
    expect(html).toContain("OBS browser source");
    expect(html).toContain(solid);
    expect(html).toContain("Copy link");
    expect(html).toContain("1920");
    expect(html).toContain("1080");
    expect(html).toContain("Refresh browser when scene becomes active");
    expect(html).toContain("Shutdown source when not visible");
  });

  it("keeps branding on a transparent wall and hides the join card when the show is between sessions", () => {
    const live = demoGuessBubblesWall();
    const html = renderToStaticMarkup(
      createElement(AudienceWall, {
        initial: {
          ...live,
          brandLogoUrl: "https://cdn.example/podcast.png",
          cornerSponsor: {
            name: "Acme Motors",
            imageUrl: "https://cdn.example/acme.png",
            corner: "bottom-left",
            phone: "(256) 555-0199",
            message: "Presented tonight",
          },
        },
        lockDemo: true,
        background: "transparent",
        pollPath: "/api/public/v1/audience/wall/token",
      }),
    );
    expect(html).toContain("bg-transparent");
    expect(html).toContain("https://cdn.example/podcast.png");
    expect(html).toContain("Acme Motors");
    expect(html).toContain("Presented tonight");
    expect(html).not.toContain("bg-[#07090d]");

    const standby = renderToStaticMarkup(
      createElement(AudienceWall, {
        initial: standbyAudienceWall({
          brandLogoUrl: "https://cdn.example/podcast.png",
          cornerSponsor: null,
        }),
        lockDemo: true,
      }),
    );
    expect(standby).toContain("https://cdn.example/podcast.png");
    expect(standby).toContain("stand by");
    expect(standby).not.toContain("tracking-[0.2em]");
  });
});

describe("taken display name on the phone", () => {
  it("shows the taken-name message and an available alternative", () => {
    const html = renderToStaticMarkup(
      createElement(AudiencePlayClient, {
        joinCode: "LIVE01",
        initialName: "Sam",
        initialNotice: {
          message: audienceDisplayNameMessage("taken", "Sam 2"),
          suggestion: "Sam 2",
        },
      }),
    );
    expect(html).toContain("That name&#x27;s already taken in this game");
    expect(html).toContain("Sam 2 is available");
    expect(html).toContain("Use Sam 2");
    expect(html).toContain("display-name-error");
  });
});
