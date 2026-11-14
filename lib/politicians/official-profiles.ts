// Each politician's page on their body's own site, from the ID their body
// gives them, where staff follow their details to the source.

import { mlaProfile } from "./ni-assembly";
import { parliamentProfile } from "./parliament";
import { BODY_HOUSES, type Body } from "./import-changes";
import { MSP_PAGES } from "./scottish-parliament";
import { nameSlug } from "@/lib/controlai-statement";
import type { House } from "./filters";

/** The body whose list a house's members come from, if any. */
export function bodyOf(house: House): Body | undefined {
  return (Object.keys(BODY_HOUSES) as Body[]).find((body) => BODY_HOUSES[body].includes(house));
}

/**
 * Their page on their body's site: by their ID, or for an MSP by their
 * name, as the Scottish Parliament's addresses are; the Senedd's is its
 * ModernGov page for them.
 */
export function officialProfile(politician: {
  house: House;
  officialId: number | null;
  name: string;
}): string | undefined {
  const { house, officialId, name } = politician;
  if (officialId === null) return undefined;
  switch (bodyOf(house)) {
    case "parliament":
      return parliamentProfile(officialId);
    case "scottish-parliament":
      return `${MSP_PAGES}${nameSlug(name)}`;
    case "senedd":
      return `https://business.senedd.wales/mgUserInfo.aspx?UID=${officialId}`;
    case "ni-assembly":
      return mlaProfile(officialId);
  }
  return undefined;
}
