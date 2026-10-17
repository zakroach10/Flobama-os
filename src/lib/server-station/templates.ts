export const SERVER_STATION_TEMPLATES = [
  {
    id: "classic",
    label: "Classic FloBama",
    background: "#1a1410",
    accent: "#d36b4a",
    headlineColor: "#f7efe6",
    subtitleColor: "#e8d5c4",
    badgeColor: "#d36b4a",
  },
  {
    id: "neon",
    label: "Neon Birthday",
    background: "#0b1020",
    accent: "#ff4fd8",
    headlineColor: "#f5f7ff",
    subtitleColor: "#9ad7ff",
    badgeColor: "#39f3c4",
  },
  {
    id: "lights",
    label: "Celebration Lights",
    background: "#201208",
    accent: "#f0b429",
    headlineColor: "#fff8e8",
    subtitleColor: "#ffd28a",
    badgeColor: "#ff7a45",
  },
  {
    id: "spotlight",
    label: "Music Hall Spotlight",
    background: "#120e0c",
    accent: "#f2ece4",
    headlineColor: "#ffffff",
    subtitleColor: "#d8cfc4",
    badgeColor: "#d36b4a",
  },
] as const;

export type ServerStationTemplateId = (typeof SERVER_STATION_TEMPLATES)[number]["id"];

export function getServerStationTemplate(id: string | null | undefined) {
  return SERVER_STATION_TEMPLATES.find((item) => item.id === id) ?? SERVER_STATION_TEMPLATES[0];
}

export type ServerStationGraphicKind =
  | "food_special"
  | "drink_special"
  | "birthday"
  | "anniversary"
  | "congratulations"
  | "celebration"
  | "message";

export function celebrationBadge(kind: ServerStationGraphicKind) {
  switch (kind) {
    case "food_special":
      return "FOOD SPECIAL";
    case "drink_special":
      return "DRINK SPECIAL";
    case "birthday":
      return "HAPPY BIRTHDAY";
    case "anniversary":
      return "HAPPY ANNIVERSARY";
    case "congratulations":
      return "CONGRATULATIONS";
    case "celebration":
      return "CELEBRATION";
    case "message":
      return "FLOBAMA";
  }
}

export function buildServerStationGraphicModel(input: {
  kind: ServerStationGraphicKind;
  templateId?: string | null;
  headline: string;
  subtitle?: string | null;
  price?: string | null;
  footer?: string | null;
}) {
  const template = getServerStationTemplate(input.templateId);
  return {
    template,
    badge: celebrationBadge(input.kind),
    headline: input.headline,
    subtitle: input.subtitle ?? null,
    price: input.price ?? null,
    footer: input.footer ?? "FROM YOUR FRIENDS AT FLOBAMA",
  };
}
