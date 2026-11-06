import localFont from "next/font/local";

/**
 * S&S Baldwins Serif, Regular.
 * Self-hosted from the supplied OTF (family "S&S Baldwins Serif", PostScript S&SBaldwinsSerif).
 * One weight, so the wall uses size rather than a synthesized bold.
 */
export const triviaDisplayFont = localFont({
  src: "../../fonts/S-and-S-Baldwins-Serif.otf",
  display: "swap",
  weight: "400",
  style: "normal",
  fallback: ["Georgia", "Times New Roman", "serif"],
  adjustFontFallback: false,
});

export const TRIVIA_DISPLAY_FONT_FAMILY = "S&S Baldwins Serif";
