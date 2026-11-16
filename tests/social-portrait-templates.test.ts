import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WeekSocialGraphic } from "@/components/print/week-social-graphic";
import { DEMO_WEEK_SLIDE } from "@/lib/screens/demo";
import { WeekSocialOgGraphic } from "@/lib/screens/week-social-image";
import { socialLineupBlockHeight, socialLineupLayout, socialLineupLimit } from "@/lib/screens/social-poster";
import { weekSocialFormat, type WeekSocialTemplateId } from "@/lib/screens/social";

const format = weekSocialFormat("ig-portrait");

function preview(templateId: string) {
  return renderToStaticMarkup(
    createElement(WeekSocialGraphic, {
      format,
      days: DEMO_WEEK_SLIDE.days,
      rangeLabel: DEMO_WEEK_SLIDE.rangeLabel,
      templateId,
    }),
  );
}

describe("instagram portrait templates", () => {
  it("keeps the torn-paper poster as the default", () => {
    const html = preview("paper");
    expect(html).toContain('data-social-template="paper"');
    expect(html).toContain("/social/paper-orange.jpg");
    expect(html).toContain("LIVE  MUSIC  THIS  WEEK");
    expect(html).toContain("SLAW DOGS");
  });

  it("renders night, marquee, and ticket treatments with the same shows", () => {
    const night = preview("night");
    expect(night).toContain('data-social-template="night"');
    expect(night).toContain("/flobama-logo.png");
    expect(night).toContain('alt="FloBama"');
    expect(night).toContain("Sep 6–12, 2026");
    expect(night).not.toContain("paper-orange");
    expect(night).not.toContain("FLO BAMA");

    const marquee = preview("marquee");
    expect(marquee).toContain('data-social-template="marquee"');
    expect(marquee).toContain("/flobama-logo.png");
    expect(marquee).toContain("#0257e8");

    const ticket = preview("ticket");
    expect(ticket).toContain('data-social-template="ticket"');
    expect(ticket).toContain("/flobama-logo.png");
    expect(ticket).toContain("FRIDAY");
    expect(ticket).toContain("KARAOKE");
  });

  it("uses the same template in the PNG markup", () => {
    const html = renderToStaticMarkup(
      createElement(WeekSocialOgGraphic, {
        format,
        days: DEMO_WEEK_SLIDE.days,
        rangeLabel: DEMO_WEEK_SLIDE.rangeLabel,
        pageLabel: null,
        paperSrc: null,
        tearSrc: null,
        stickerSrc: null,
        logoSrc: "data:image/png;base64,logo",
        templateId: "ticket",
      }),
    );
    expect(html).toContain("data:image/png;base64,logo");
    expect(html).toContain('alt="FloBama"');
    expect(html).toContain("LATE SET");
    expect(html).not.toContain("paper-orange");
    expect(html).not.toContain("FLO BAMA");
  });
});

const FULL_WEEK = [
  "SLAW DOGS",
  "ALL THE THINGS - PODCAST WITH NATASHA NIX AND KENSIE COPPIN",
  "BOO BALL BY SALVATION ARMY",
  "JIMINEM",
  "DJ & KARAOKE",
  "DEJA VU",
  "AUSTIN BOHANNON",
];

describe("portrait lineup fit", () => {
  it("keeps a short week at the design size", () => {
    const night = socialLineupLayout({ templateId: "night", names: ["SLAW DOGS", "KARAOKE", "LATE SET"] });
    expect(night.nameSize).toBe(60);
    expect(night.dateSize).toBe(34);
    const paper = socialLineupLayout({ templateId: "paper", names: ["SLAW DOGS", "KARAOKE", "LATE SET"] });
    expect(paper.nameSize).toBe(48);
  });

  it("shrinks a full week so the lineup stays under the header", () => {
    const templates: WeekSocialTemplateId[] = ["paper", "night", "marquee", "ticket"];
    for (const templateId of templates) {
      const layout = socialLineupLayout({ templateId, names: FULL_WEEK, width: 1080, height: 1350 });
      expect(socialLineupBlockHeight(layout, FULL_WEEK)).toBeLessThanOrEqual(socialLineupLimit(layout));
    }
    const night = socialLineupLayout({ templateId: "night", names: FULL_WEEK });
    expect(night.nameSize).toBeLessThan(60);
    expect(night.nameSize).toBeGreaterThanOrEqual(48);
    const ticket = socialLineupLayout({ templateId: "ticket", names: FULL_WEEK });
    expect(ticket.nameSize).toBeLessThan(58);
  });

  it("fits eight one-line shows under the header", () => {
    const names = Array.from({ length: 8 }, (_, index) => `SHOW ${index + 1}`);
    for (const templateId of ["paper", "night", "marquee", "ticket"] as const) {
      const layout = socialLineupLayout({ templateId, names, width: 1080, height: 1350 });
      expect(socialLineupBlockHeight(layout, names)).toBeLessThanOrEqual(socialLineupLimit(layout));
    }
  });
});
