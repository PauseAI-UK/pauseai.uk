// Loaded into the fixture build's server before it starts
// (scripts/serve-fixture.mjs, with Node's --import): keeps, for each flow of
// the storyboard, the address of every request the server gets from it, a
// line each in a file named after the flow's database (REQUESTS_DIR,
// tests/checkout.mjs). tests/storyboard/fixtures.ts reads it as what the flow
// opened, for working out which flows a change can reach
// (scripts/storyboard-reach.mjs).
//
// The server sees what no browser's events do: each step of a redirect that
// a flow's own request follows, and a request from a browser the flow started
// for itself. Next's prefetches of the pages a link points to aren't kept:
// nothing of one is seen until the link is followed, which asks again or, if
// the page came whole, moves the address, which the flow's browser records.
import { appendFileSync, mkdirSync } from "node:fs";
import http from "node:http";
import { join } from "node:path";
import { FLOW_DATABASE_COOKIE, FLOW_DATABASE_PREFIX } from "../lib/server/fixtures/fixture-env.mjs";

const dir = process.env.STORYBOARD_REQUESTS_DIR;
if (dir) {
  mkdirSync(dir, { recursive: true });
  const flowOf = new RegExp(`(?:^|;\\s*)${FLOW_DATABASE_COOKIE}=(${FLOW_DATABASE_PREFIX}\\w+)`);
  const emit = http.Server.prototype.emit;
  http.Server.prototype.emit = function (event, request, ...rest) {
    if (event === "request") {
      const flow = flowOf.exec(request.headers.cookie ?? "")?.[1];
      if (flow && !request.headers["next-router-prefetch"])
        appendFileSync(join(dir, `${flow}.txt`), `${request.url}\n`);
    }
    return emit.call(this, event, request, ...rest);
  };
}
