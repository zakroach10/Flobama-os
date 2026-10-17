const BLOCKED_PATTERNS = [
  /\b(fuck|shit|bitch|asshole|cunt|nigg|faggot|retard)\b/i,
  /\b(kill\s+yourself|kys)\b/i,
  /https?:\/\//i,
  /www\./i,
];

export function sanitizeServerStationText(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function validateServerStationMessage(input: {
  headline: string;
  subtitle?: string | null;
}): { ok: true; headline: string; subtitle: string | null } | { ok: false; message: string } {
  const headline = sanitizeServerStationText(input.headline, 48);
  const subtitle = input.subtitle ? sanitizeServerStationText(input.subtitle, 72) : null;

  if (!headline) return { ok: false, message: "Enter a short headline." };
  if (headline.length < 2) return { ok: false, message: "Headline is too short." };

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(headline) || (subtitle && pattern.test(subtitle))) {
      return { ok: false, message: "That message cannot be shown on the wall. Try different wording." };
    }
  }

  return { ok: true, headline, subtitle };
}

export function validateGuestDisplayName(name: string) {
  const cleaned = sanitizeServerStationText(name, 24);
  if (!cleaned) return { ok: false as const, message: "Enter the guest’s first name." };
  if (cleaned.length < 2) return { ok: false as const, message: "Name is too short." };
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(cleaned)) {
      return { ok: false as const, message: "That name cannot be shown on the wall." };
    }
  }
  return { ok: true as const, name: cleaned.toUpperCase() };
}

export function validateSpecialCopy(input: {
  itemName: string;
  price?: string | null;
  description?: string | null;
}) {
  const itemName = sanitizeServerStationText(input.itemName, 40);
  const price = input.price ? sanitizeServerStationText(input.price, 24) : null;
  const description = input.description ? sanitizeServerStationText(input.description, 80) : null;
  if (!itemName) return { ok: false as const, message: "Enter the special name." };
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(itemName) || (price && pattern.test(price)) || (description && pattern.test(description))) {
      return { ok: false as const, message: "That special cannot be shown on the wall. Try different wording." };
    }
  }
  return { ok: true as const, itemName, price, description };
}
