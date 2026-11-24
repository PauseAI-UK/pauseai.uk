import { json, type Fake } from "../fake";
import { THEYWORKFORYOU_PEOPLE_DATA, wikidataAnswer } from "../politician-lists";

// Wikidata's query service, and TheyWorkForYou's people data on GitHub.

export const wikidataFake: Fake = ({ hostname, pathname }, init) => {
  if (hostname === "raw.githubusercontent.com" && pathname.endsWith("/members/people.json")) {
    return json(THEYWORKFORYOU_PEOPLE_DATA);
  }
  if (hostname === "query.wikidata.org" && pathname === "/sparql") {
    return json(wikidataAnswer(new URLSearchParams(String(init?.body ?? "")).get("query") ?? ""));
  }
  return undefined;
};
