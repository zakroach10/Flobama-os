import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AudiencePlayClient } from "@/components/audience/audience-play-client";
import { AudienceWall } from "@/components/audience/audience-wall";
import { demoGuessBubblesWall, demoGuessGuest, demoGuessWinnerWall } from "@/lib/audience/demo";
import { defaultPayloadForKind } from "@/lib/audience/engine";
import {
  buildGuessView,
  decideGuess,
  guessAnswersMatch,
  redactGuessPayload,
  sanitizeGuessLyricPayload,
  sanitizeGuessPlayerPayload,
} from "@/lib/audience/guess";
import type { AudienceGuessBubble } from "@/lib/audience/types";

const VENUE = "11111111-1111-4111-8111-111111111111";

function roster(names: string[]) {
  return names.map((name, index) => ({
    id: `player-${index + 1}`,
    name,
    photoUrl: `https://cdn.example/${index + 1}.png`,
    storagePath: `${VENUE}/audience/players/${index + 1}.png`,
  }));
}

describe("guess matching", () => {
  it("trims the ends and otherwise requires an exact match", () => {
    expect(guessAnswersMatch("  Jalen Milroe  ", "Jalen Milroe")).toBe(true);
    expect(guessAnswersMatch("Jalen Milroe", "jalen milroe")).toBe(false);
    expect(guessAnswersMatch("Jalen Milroe", "Jalen  Milroe")).toBe(false);
    expect(guessAnswersMatch("Jalen Milroe", "Jalen Milroe ")).toBe(true);
    expect(guessAnswersMatch("sweet home alabama", "Sweet Home Alabama")).toBe(false);
    expect(guessAnswersMatch(" Sweet Home Alabama ", "Sweet Home Alabama")).toBe(true);
  });

  it("lets only the first exact guess win", () => {
    let hasWinner = false;
    const results = ["Milroe", "Jalen Milroe", "Jalen Milroe"].map((answer) => {
      const decision = decideGuess({ expected: "Jalen Milroe", submitted: answer, hasWinner });
      if (decision.status === "accepted" && decision.won) hasWinner = true;
      return decision;
    });
    expect(results[0]).toMatchObject({ status: "accepted", correct: false, won: false });
    expect(results[1]).toMatchObject({ status: "accepted", correct: true, won: true, answer: "Jalen Milroe" });
    expect(results[2]).toEqual({ status: "closed" });
  });

  it("uses the same rule for a lyric", () => {
    const decision = decideGuess({
      expected: "Sweet Home Alabama",
      submitted: " Sweet Home Alabama\n",
      hasWinner: false,
    });
    expect(decision).toMatchObject({ status: "accepted", correct: true, won: true });
    expect(
      decideGuess({ expected: "Sweet Home Alabama", submitted: "Sweet home Alabama", hasWinner: false }),
    ).toMatchObject({ correct: false, won: false });
  });
});

describe("guess payloads", () => {
  it("requires ten named photos before a player game goes on the wall", () => {
    const draft = sanitizeGuessPlayerPayload(defaultPayloadForKind("guess_player"), VENUE, "draft");
    expect(draft.ok).toBe(true);
    const incomplete = sanitizeGuessPlayerPayload(
      { prompt: "Who is this?", players: roster(["Only One"]), activePlayerId: "player-1" },
      VENUE,
      "live",
    );
    expect(incomplete.ok).toBe(false);

    const ready = sanitizeGuessPlayerPayload(
      {
        prompt: " Who is this? ",
        players: roster(["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"]),
        activePlayerId: "player-4",
      },
      VENUE,
      "live",
    );
    expect(ready.ok).toBe(true);
    if (!ready.ok) return;
    expect(ready.payload.activePlayerId).toBe("player-4");
    expect(ready.payload.prompt).toBe("Who is this?");
  });

  it("rejects a player photo that was not uploaded for this venue", () => {
    const players = roster(["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"]);
    players[0] = { ...players[0]!, storagePath: "other-venue/audience/players/1.png" };
    const result = sanitizeGuessPlayerPayload({ players, activePlayerId: "player-1" }, VENUE, "draft");
    expect(result.ok).toBe(false);
  });

  it("keeps the lyric answer off the public wall until someone wins", () => {
    const payload = {
      prompt: "Finish the line",
      songTitle: "Sweet Home Alabama",
      answer: "Sweet Home Alabama",
      roundId: "44444444-4444-4444-8444-444444444444",
    };
    const redacted = redactGuessPayload("guess_lyric", payload);
    expect(redacted).toEqual({ prompt: "Finish the line" });
    expect(JSON.stringify(redacted)).not.toContain("Sweet Home");

    const bubbles: AudienceGuessBubble[] = [
      {
        id: "wrong",
        displayName: "Ava",
        answer: "sweet home",
        correct: false,
        won: false,
        createdAt: "2026-11-21T15:00:00.000Z",
      },
    ];
    const playing = buildGuessView({ kind: "guess_lyric", payload, submissions: bubbles });
    expect(playing.status).toBe("playing");
    expect(playing.winner).toBeNull();
    expect(JSON.stringify(playing)).not.toContain("Sweet Home Alabama");

    const won = buildGuessView({
      kind: "guess_lyric",
      payload,
      submissions: [
        ...bubbles,
        {
          id: "win",
          displayName: "Sam",
          answer: "Sweet Home Alabama",
          correct: true,
          won: true,
          createdAt: "2026-11-21T15:00:04.000Z",
        },
      ],
    });
    expect(won.status).toBe("won");
    expect(won.winner).toEqual({ displayName: "Sam", answer: "Sweet Home Alabama" });
    expect(won.bubbles.map((bubble) => bubble.id)).toEqual(["wrong"]);
  });

  it("does not publish player names while the photo is up", () => {
    const payload = {
      prompt: "Who is this?",
      activePlayerId: "player-2",
      players: roster(["Hidden One", "Hidden Two"]),
    };
    const view = buildGuessView({ kind: "guess_player", payload, submissions: [] });
    expect(view.photoUrl).toContain("cdn.example/2.png");
    expect(view.playerIndex).toBe(2);
    expect(JSON.stringify(view)).not.toContain("Hidden");
    expect(JSON.stringify(redactGuessPayload("guess_player", payload))).not.toContain("Hidden");
  });

  it("requires a lyric before the round can start", () => {
    expect(sanitizeGuessLyricPayload({ prompt: "Name it", answer: "  " }, "live").ok).toBe(false);
    const ready = sanitizeGuessLyricPayload(
      { prompt: " Name it ", answer: " Sweet Home Alabama ", songTitle: " Lynyrd Skynyrd " },
      "live",
    );
    expect(ready.ok).toBe(true);
    if (!ready.ok) return;
    expect(ready.payload.answer).toBe("Sweet Home Alabama");
    expect(ready.payload.songTitle).toBe("Lynyrd Skynyrd");
  });
});

describe("guess wall and phone", () => {
  it("renders wrong-answer bubbles and the winner moment", () => {
    const bubbles = renderToStaticMarkup(
      createElement(AudienceWall, { initial: demoGuessBubblesWall(), lockDemo: true }),
    );
    expect(bubbles).toContain("Who is this?");
    expect(bubbles).toContain("Player 3 of 10");
    expect(bubbles).toContain("Ava");
    expect(bubbles).toContain("Bryce Young");
    expect(bubbles).toContain("Wrong");
    expect(bubbles).toContain("audience-bubble");
    expect(bubbles).toContain("/flobama-logo.png");
    expect(bubbles).not.toContain("Jalen Milroe");

    const winner = renderToStaticMarkup(
      createElement(AudienceWall, { initial: demoGuessWinnerWall(), lockDemo: true }),
    );
    expect(winner).toContain("Sam");
    expect(winner).toContain("Jalen Milroe");
    expect(winner).toContain("Correct");
    expect(winner).toContain("audience-winner");
    expect(winner).toContain("/flobama-logo.png");
  });

  it("renders the audience guess form", () => {
    const html = renderToStaticMarkup(
      createElement(AudiencePlayClient, {
        joinCode: "LIVE01",
        initialState: demoGuessGuest(),
        lockDemo: true,
      }),
    );
    expect(html).toContain("Who is this?");
    expect(html).toContain("Player 3 of 10");
    expect(html).toContain("Submit guess");
    expect(html).toContain("Exact name");
    expect(html).toContain("/flobama-logo.png");
    expect(html).not.toContain("Jalen Milroe");
  });
});
