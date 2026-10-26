import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WeekSocialGraphic } from "@/components/print/week-social-graphic";
import { DEMO_WEEK_SLIDE } from "@/lib/screens/demo";
import { WeekSocialOgGraphic } from "@/lib/screens/week-social-image";
import { weekSocialFormat } from "@/lib/screens/social";

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
