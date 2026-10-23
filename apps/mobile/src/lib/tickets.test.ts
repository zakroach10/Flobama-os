import assert from "node:assert/strict";
import { isVerifiedProductionTicketUrl } from "./tickets";

assert.equal(isVerifiedProductionTicketUrl(null), false);
assert.equal(isVerifiedProductionTicketUrl(""), false);
assert.equal(isVerifiedProductionTicketUrl("/tickets/abc"), false);
assert.equal(isVerifiedProductionTicketUrl("https://flobama-os.vercel.app/tickets/abc"), false);
assert.equal(isVerifiedProductionTicketUrl("http://example.com/checkout"), false);
assert.equal(isVerifiedProductionTicketUrl("https://mk360.me/flobama-kirbi"), true);
assert.equal(isVerifiedProductionTicketUrl("https://tickets.example.com/event/1"), true);

console.log("tickets.test.ts: ok");
