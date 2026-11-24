// Every outside service's fake (./fakes/), asked in turn, for
// tests/fixtures/msw.ts, so Vitest tests get the same responses over a real
// fetch as a fixture build does. A fixture build asks only the service's
// own fake, which its binding hands outsideFetch (./fake.ts).
import type { Fake } from "./fake";
import { failingResponse } from "./failing-services";
import { blobsFake } from "./fakes/blobs";
import { civicrmFake } from "./fakes/civicrm";
import { controlaiFake } from "./fakes/controlai";
import { devolvedBodiesFake } from "./fakes/devolved-bodies";
import { googleFake } from "./fakes/google";
import { linkPagesFake } from "./fakes/link-pages";
import { lumaFake } from "./fakes/luma";
import { parliamentFake } from "./fakes/parliament";
import { postcodesFake } from "./fakes/postcodes";
import { postmarkFake } from "./fakes/postmark";
import { stripeFake } from "./fakes/stripe";
import { turnstileFake } from "./fakes/turnstile";
import { whatsAppFake } from "./fakes/whatsapp";
import { wikidataFake } from "./fakes/wikidata";

const FAKES: Fake[] = [
  lumaFake,
  civicrmFake,
  postcodesFake,
  parliamentFake,
  devolvedBodiesFake,
  wikidataFake,
  controlaiFake,
  stripeFake,
  postmarkFake,
  googleFake,
  blobsFake,
  whatsAppFake,
  linkPagesFake,
  turnstileFake,
];

/**
 * The canned response to a request to any service, if there is one: a
 * service the flow has made fail answers as it does when it's down
 * (failing-services.ts), and otherwise its fake does. `scope` is the
 * storyboard flow's database.
 */
export function fixtureResponse(url: string, init?: RequestInit, scope?: string): Response | undefined {
  const parsed = new URL(url);
  const failing = failingResponse(parsed.hostname, scope);
  if (failing) return failing;
  for (const fake of FAKES) {
    const answer = fake(parsed, init, scope);
    if (answer) return answer;
  }
  return undefined;
}
