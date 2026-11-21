import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAudienceDisplayNameConflict, isAudienceGuestTokenConflict } from "@/lib/audience/engine";
import {
  audienceDisplayNameKey,
  audienceDisplayNameMessage,
  decideAudienceNameClaim,
  type AudienceNameClaim,
} from "@/lib/audience/names";

const SESSION = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const MINE = "mine-token-mine-token-mine";
const THEIRS = "their-token-their-token-x";

function claim(partial: Partial<AudienceNameClaim> & { nameKey: string }): AudienceNameClaim {
  return {
    guestId: partial.guestId ?? "guest-1",
    guestToken: partial.guestToken ?? THEIRS,
    nameKey: partial.nameKey,
    sessionId: partial.sessionId ?? SESSION,
  };
}

describe("audience display names", () => {
  it("treats case and extra whitespace as the same name", () => {
    expect(audienceDisplayNameKey("  Sam  ")).toBe("sam");
    expect(audienceDisplayNameKey("SAM")).toBe("sam");
    expect(audienceDisplayNameKey("Sam   J")).toBe("sam j");
    expect(audienceDisplayNameKey("sam j")).toBe(audienceDisplayNameKey("  SAM   J  "));
  });

  it("lets a name from another session be used again", () => {
    const decision = decideAudienceNameClaim({
      displayName: "Sam",
      guestToken: MINE,
      sessionId: SESSION,
      sessionGuests: [claim({ nameKey: "sam", sessionId: OTHER, guestToken: THEIRS })],
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.displayName).toBe("Sam");
  });

  it("blocks a second person in the same session and suggests an open name", () => {
    const decision = decideAudienceNameClaim({
      displayName: "  SAM ",
      guestToken: MINE,
      sessionId: SESSION,
      sessionGuests: [claim({ nameKey: "sam", sessionId: SESSION, guestToken: THEIRS })],
    });
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.issue).toBe("taken");
    expect(decision.suggestion).toBe("SAM 2");
    expect(decision.message).toBe(audienceDisplayNameMessage("taken", "SAM 2"));
    expect(decision.message).toContain("already taken in this game");
    expect(decision.message).toContain("SAM 2 is available");
  });

  it("skips suggestions that are also taken", () => {
    const decision = decideAudienceNameClaim({
      displayName: "Sam",
      guestToken: MINE,
      sessionId: SESSION,
      sessionGuests: [
        claim({ nameKey: "sam", guestToken: THEIRS }),
        claim({ guestId: "guest-2", nameKey: "sam 2", guestToken: "third-token-third-token" }),
      ],
    });
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.suggestion).toBe("Sam 3");
  });

  it("gives the same device its own name back on rejoin", () => {
    const decision = decideAudienceNameClaim({
      displayName: "  sam  ",
      guestToken: MINE,
      sessionId: SESSION,
      sessionGuests: [claim({ nameKey: "sam", guestToken: MINE, sessionId: SESSION })],
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.displayName).toBe("sam");
  });

  it("uses one message for empty, too long, and inappropriate names", () => {
    const empty = decideAudienceNameClaim({
      displayName: "   ",
      guestToken: MINE,
      sessionId: SESSION,
      sessionGuests: [],
    });
    expect(empty).toMatchObject({ ok: false, issue: "empty", message: "Enter a display name." });

    const long = decideAudienceNameClaim({
      displayName: "This name is way too long for the wall",
      guestToken: MINE,
      sessionId: SESSION,
      sessionGuests: [],
    });
    expect(long.ok).toBe(false);
    if (long.ok) return;
    expect(long.issue).toBe("too_long");
    expect(long.message).toContain("24 characters or fewer");

    const blocked = decideAudienceNameClaim({
      displayName: "Nope",
      guestToken: MINE,
      sessionId: SESSION,
      sessionGuests: [],
      blocked: () => true,
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.issue).toBe("inappropriate");
    expect(blocked.message).toContain("isn't allowed on the wall");
  });

  it("does not treat a session name collision as a guest-token rejoin", () => {
    const nameHit = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "audience_guests_session_name_key_uidx"',
    };
    expect(isAudienceDisplayNameConflict(nameHit)).toBe(true);
    expect(isAudienceGuestTokenConflict(nameHit)).toBe(false);
    expect(
      isAudienceGuestTokenConflict({
        code: "23505",
        message: 'duplicate key value violates unique constraint "audience_guests_guest_token_key"',
      }),
    ).toBe(true);
  });

  it("keeps the database unique key on the session, not the venue", () => {
    const sql = readFileSync(
      "supabase/migrations/20261121000074_audience_guest_session_names.sql",
      "utf8",
    );
    expect(sql).toContain("audience_guests_session_name_key_uidx");
    expect(sql).toContain("(session_id, name_key)");
    expect(sql).not.toMatch(/unique\s*\(\s*venue_id/i);
    expect(sql.toLowerCase()).not.toContain("unique (venue_id, display_name)");
    expect(sql.toLowerCase()).not.toContain("unique (display_name)");
  });
});
