import type { PublicScreenAd } from "@/lib/screens/playlist";

function svgDataUri(background: string, title: string, subtitle: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
    <rect width="1080" height="1920" fill="${background}"/>
    <text x="540" y="880" fill="#f4ebe3" font-size="92" font-family="Georgia, serif" text-anchor="middle">${title}</text>
    <text x="540" y="980" fill="#c9b8aa" font-size="42" font-family="sans-serif" text-anchor="middle">${subtitle}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const DEMO_VERTICAL_ADS: PublicScreenAd[] = [
  {
    id: "demo-happy-hour",
    title: "Happy Hour",
    url: svgDataUri("#3a1f18", "Happy Hour", "Mon–Fri · 4 to 7"),
    mediaKind: "image",
    durationSeconds: 4,
    transition: "fade",
  },
  {
    id: "demo-live-music",
    title: "Live music tonight",
    url: svgDataUri("#1b1612", "Live tonight", "Doors at 8"),
    mediaKind: "image",
    durationSeconds: 4,
    transition: "slide",
  },
];
