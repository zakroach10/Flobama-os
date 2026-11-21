export const AUDIENCE_DISPLAY_NAME_MAX = 24;

export type AudienceNameIssue = "empty" | "too_long" | "taken" | "inappropriate";

export type AudienceNameClaim = {
  guestId: string;
  guestToken: string;
  /** Already normalized with audienceDisplayNameKey. */
  nameKey: string;
  sessionId: string;
};

export type AudienceNameDecision =
  | { ok: true; displayName: string; nameKey: string }
  | { ok: false; issue: AudienceNameIssue; message: string; suggestion: string | null };

/**
 * Collapse ends and internal whitespace, then lowercase.
 * " Sam  J " and "sam j" are the same claim inside one session.
 */
export function audienceDisplayNameKey(raw: string) {
  return raw.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function audienceDisplayNameMessage(issue: AudienceNameIssue, suggestion?: string | null) {
  switch (issue) {
    case "empty":
      return "Enter a display name.";
    case "too_long":
      return `That name is too long. Use ${AUDIENCE_DISPLAY_NAME_MAX} characters or fewer.`;
    case "inappropriate":
      return "That name isn't allowed on the wall. Try a nickname instead.";
    case "taken":
      return suggestion
        ? `That name's already taken in this game — try adding an initial or a nickname. ${suggestion} is available.`
        : "That name's already taken in this game — try adding an initial or a nickname.";
  }
}

export function suggestAvailableAudienceName(displayName: string, takenKeys: Set<string>) {
  const base = displayName.trim().replace(/\s+/g, " ");
  if (!base) return null;
  for (let n = 2; n <= 50; n += 1) {
    const candidate = `${base} ${n}`;
    if (candidate.length > AUDIENCE_DISPLAY_NAME_MAX) return null;
    if (!takenKeys.has(audienceDisplayNameKey(candidate))) return candidate;
  }
  return null;
}

/**
 * There is no profanity list in the product. Pass `blocked` only when a filter exists.
 * The message catalog still has a line for that case so every name error reads the same way.
 */
export function validateAudienceDisplayName(
  raw: string,
  options?: { blocked?: (displayName: string) => boolean },
): AudienceNameDecision {
  const displayName = raw.trim().replace(/\s+/g, " ");
  if (!displayName) {
    return { ok: false, issue: "empty", message: audienceDisplayNameMessage("empty"), suggestion: null };
  }
  if (displayName.length > AUDIENCE_DISPLAY_NAME_MAX) {
    return { ok: false, issue: "too_long", message: audienceDisplayNameMessage("too_long"), suggestion: null };
  }
  if (options?.blocked?.(displayName)) {
    return {
      ok: false,
      issue: "inappropriate",
      message: audienceDisplayNameMessage("inappropriate"),
      suggestion: null,
    };
  }
  return { ok: true, displayName, nameKey: audienceDisplayNameKey(displayName) };
}

/**
 * Names collide only with other people in this session.
 * The caller's own guest token is their claim, including a refresh or a rejoin.
 * Rows from any other sessionId are ignored.
 */
export function decideAudienceNameClaim(input: {
  displayName: string;
  guestToken: string;
  sessionId: string;
  sessionGuests: AudienceNameClaim[];
  blocked?: (displayName: string) => boolean;
}): AudienceNameDecision {
  const validated = validateAudienceDisplayName(input.displayName, { blocked: input.blocked });
  if (!validated.ok) return validated;

  const here = input.sessionGuests.filter((guest) => guest.sessionId === input.sessionId);
  const takenByOther = here.some(
    (guest) => guest.nameKey === validated.nameKey && guest.guestToken !== input.guestToken,
  );
  if (!takenByOther) return validated;

  const takenKeys = new Set(here.map((guest) => guest.nameKey));
  const suggestion = suggestAvailableAudienceName(validated.displayName, takenKeys);
  return {
    ok: false,
    issue: "taken",
    message: audienceDisplayNameMessage("taken", suggestion),
    suggestion,
  };
}
