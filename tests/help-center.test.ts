import { describe, expect, it } from "vitest";
import { HELP_FAQ, HELP_SECTIONS } from "@/lib/site/help";

describe("help center content", () => {
  it("includes introduction, faq, and run sections", () => {
    expect(HELP_SECTIONS.map((section) => section.href)).toEqual([
      "/help/introduction",
      "/help/faq",
      "/help/run",
    ]);
  });

  it("has faq answers about sign-in and local port", () => {
    const questions = HELP_FAQ.map((item) => item.question);
    expect(questions).toContain("How do I sign in?");
    expect(questions).toContain("What port does local development use?");

    const portAnswer = HELP_FAQ.find(
      (item) => item.question === "What port does local development use?",
    )?.answer;
    expect(portAnswer).toMatch(/43123/);
  });
});
