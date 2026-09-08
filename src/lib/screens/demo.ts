import { WEEK_EVENTS_PUBLIC_URL } from "@/lib/constants";
import type { PublicScreenAd } from "@/lib/screens/playlist";
import type { WeekSlidePayload } from "@/lib/screens/week";

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
  {
    id: "demo-this-week",
    title: "This week's events",
    url: WEEK_EVENTS_PUBLIC_URL,
    mediaKind: "week_events",
    durationSeconds: 8,
    transition: "fade",
  },
];

export const DEMO_WEEK_SLIDE: WeekSlidePayload = {
  heading: "This week",
  rangeLabel: "Sep 6–12, 2026",
  timezone: "America/Chicago",
  eventCount: 3,
  days: [
    {
      dateKey: "2026-09-08",
      weekday: "Tuesday",
      dateLabel: "Sep 8",
      events: [
        {
          id: "demo-slaw",
          name: "Slaw Dogs",
          time: "7:00 PM",
          artists: ["Slaw Dogs"],
          ticketed: false,
          coverCharge: "$0.00",
          featured: true,
        },
      ],
    },
    {
      dateKey: "2026-09-11",
      weekday: "Friday",
      dateLabel: "Sep 11",
      events: [
        {
          id: "demo-karaoke",
          name: "Karaoke",
          time: "8:00 PM",
          artists: [],
          ticketed: false,
          coverCharge: null,
          featured: false,
        },
        {
          id: "demo-late",
          name: "Late set",
          time: "10:30 PM",
          artists: ["House band"],
          ticketed: false,
          coverCharge: "$5",
          featured: false,
        },
      ],
    },
  ],
};
