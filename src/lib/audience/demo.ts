import type { AudienceGuestState, AudienceWallState } from "@/lib/audience/types";

const PHOTO = "/flobama-logo.png";

function wallBase(tool: AudienceWallState["tool"]): AudienceWallState {
  return {
    sessionId: "demo-guess-session",
    title: "FloBama Live",
    joinCode: "LIVE01",
    joinPath: "/live/LIVE01",
    guestCount: 18,
    brandLogoUrl: null,
    cornerSponsor: null,
    tool,
    lobbyMessage: "Live on the wall — scan to join",
    recentJoins: [],
  };
}

export function demoGuessBubblesWall(): AudienceWallState {
  return wallBase({
    id: "demo-guess-tool",
    kind: "guess_player",
    title: "Guess the Player",
    payload: {
      prompt: "Who is this?",
      playerCount: 10,
      playerIndex: 3,
      photoUrl: PHOTO,
    },
    votingOpen: true,
    resultsRevealed: false,
    tallies: [],
    totalVotes: 0,
    guess: {
      roundKey: "player-3",
      prompt: "Who is this?",
      photoUrl: PHOTO,
      playerIndex: 3,
      playerCount: 10,
      status: "playing",
      winner: null,
      bubbles: [
        { id: "b1", displayName: "Ava", answer: "Bryce Young", correct: false, won: false, createdAt: "2026-11-21T15:00:00.000Z" },
        { id: "b2", displayName: "Noah", answer: "Milroe", correct: false, won: false, createdAt: "2026-11-21T15:00:01.000Z" },
        { id: "b3", displayName: "Mia", answer: "Jalen", correct: false, won: false, createdAt: "2026-11-21T15:00:02.000Z" },
        { id: "b4", displayName: "Leo", answer: "Jalen Milro", correct: false, won: false, createdAt: "2026-11-21T15:00:03.000Z" },
      ],
    },
  });
}

export function demoGuessWinnerWall(): AudienceWallState {
  const playing = demoGuessBubblesWall();
  return wallBase({
    ...playing.tool!,
    guess: {
      ...playing.tool!.guess!,
      status: "won",
      winner: { displayName: "Sam", answer: "Jalen Milroe" },
    },
  });
}

export function demoGuessGuest(joinCode = "LIVE01"): AudienceGuestState {
  const wall = demoGuessBubblesWall();
  return {
    sessionId: "demo-guess-session",
    joinCode,
    displayName: "Sam",
    votingOpen: true,
    resultsRevealed: false,
    tool: wall.tool,
    myVote: null,
    canSubmitQuestion: false,
  };
}
