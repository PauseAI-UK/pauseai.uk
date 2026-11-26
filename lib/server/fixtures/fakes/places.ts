import type { Fake } from "../fake";
import { photonResponse, shortLinkResponse } from "../places";

// Photon's search for places, and Google Maps' short links (../places.ts).

export const photonFake: Fake = ({ hostname, pathname, searchParams }) =>
  hostname === "photon.komoot.io" ? photonResponse(pathname, searchParams) : undefined;

export const googleMapsFake: Fake = ({ hostname, pathname }) =>
  hostname === "maps.app.goo.gl" ? shortLinkResponse(pathname) : undefined;
