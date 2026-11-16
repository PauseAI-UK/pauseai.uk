// Hosts the bodies serve their members' photos from, which a politician's
// page loads straight from them (PoliticianDetails): Parliament's Members
// API, the Scottish Parliament's picture library, the Senedd's and the NI
// Assembly's own sites. next.config.ts allows them in the CSP's img-src. A
// fixture build shows a stand-in instead (STAND_IN_PHOTO).
export const POLITICIAN_PHOTO_HOSTS = [
  "members-api.parliament.uk",
  "scottishparliament.chorus-mk.thirdlight.com",
  "scottishparliament.thirdlight.com",
  "business.senedd.wales",
  "aims.niassembly.gov.uk",
];

/**
 * A politician's photo in a fixture build (getPolitician): a stand-in, as
 * the made-up politicians' photos, at their made-up IDs, aren't on their
 * bodies' sites.
 */
export const STAND_IN_PHOTO = "/images/stand-in-portrait.svg";
