import assert from "node:assert/strict";
import { coverLabel, isHappeningNow } from "./event-status";
import type { PublicEventJson } from "../types";

const base: PublicEventJson = {
  id: "1",
  name: "Test",
  day: "Monday",
  date: "Oct 19, 2026",
  time: "8:00 PM",
  display: "Mon, Oct 19 • 8:00 PM",
  ticketed: false,
  ticketUrl: null,
  coverCharge: "$5.00",
  startsAt: "2026-10-20T01:00:00.000Z",
  endsAt: "2026-10-20T04:00:00.000Z",
  eventType: "live_music",
  locationLabel: "FloBama Music Hall",
  featured: false,
  artists: ["Test"],
};

assert.equal(coverLabel(base), "$5.00");
assert.equal(coverLabel({ ...base, coverCharge: "  " }), null);

const during = new Date("2026-10-20T02:00:00.000Z");
const before = new Date("2026-10-20T00:30:00.000Z");
const after = new Date("2026-10-20T05:00:00.000Z");
assert.equal(isHappeningNow(base, during), true);
assert.equal(isHappeningNow(base, before), false);
assert.equal(isHappeningNow(base, after), false);

console.log("event-status.test.ts: ok");
