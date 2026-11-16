// Hosts the bodies serve their members' photos from, which a politician's
// page loads straight from them (PoliticianDetails): Parliament's Members
// API, the Scottish Parliament's picture library, the Senedd's and the NI
// Assembly's own sites. next.config.ts allows them in the CSP's img-src,
// and the storyboard shows a stand-in for each (tests/storyboard/fixtures.ts).
export const POLITICIAN_PHOTO_HOSTS = [
  "members-api.parliament.uk",
  "scottishparliament.chorus-mk.thirdlight.com",
  "business.senedd.wales",
  "aims.niassembly.gov.uk",
];
