import { json, type Fake } from "../fake";
import { EDM_ANSWER, PARLIAMENT_ENDING, PARLIAMENT_MEMBERS } from "../politician-lists";

// Parliament's Members Data Platform, Members API and motions API.

export const parliamentFake: Fake = ({ hostname, pathname }) => {
  // The bodies' lists of members (politician-lists.ts). Parliament's starts with a byte-order mark, as its own does.
  const house = hostname === "data.parliament.uk" && pathname.match(/\/house=(Commons|Lords)(?:%7C|\|)/i);
  if (house) return new Response(`\uFEFF${JSON.stringify(PARLIAMENT_MEMBERS[house[1] as "Commons" | "Lords"])}`);
  if (hostname === "members-api.parliament.uk" && /^\/api\/Members\/\d+$/.test(pathname)) {
    return json(PARLIAMENT_ENDING);
  }
  if (hostname === "oralquestionsandmotions-api.parliament.uk" && pathname === "/EarlyDayMotion/66900") {
    return json(EDM_ANSWER);
  }
  return undefined;
};
