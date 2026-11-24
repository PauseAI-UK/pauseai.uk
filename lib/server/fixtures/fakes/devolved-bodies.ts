import { json, type Fake } from "../fake";
import { NI_ASSEMBLY, SCOTTISH_PARLIAMENT, SENEDD_MEMBERS } from "../politician-lists";

// The Scottish Parliament's, the Senedd's and the Northern Ireland Assembly's lists of members.

export const devolvedBodiesFake: Fake = ({ hostname, pathname }) => {
  if (hostname === "data.parliament.scot" && pathname.startsWith("/api/")) {
    const list = SCOTTISH_PARLIAMENT[pathname.slice("/api/".length)];
    if (list) return json(list);
  }
  if (hostname === "business.senedd.wales" && pathname === "/mgwebservice.asmx/GetCouncillorsByWard") {
    return new Response(SENEDD_MEMBERS, { headers: { "Content-Type": "text/xml" } });
  }
  if (hostname === "data.niassembly.gov.uk" && pathname === "/members.asmx/GetAllCurrentMembers_JSON") {
    return json(NI_ASSEMBLY.members);
  }
  if (hostname === "data.niassembly.gov.uk" && pathname === "/members.asmx/GetAllMemberContactDetails_JSON") {
    return json(NI_ASSEMBLY.contacts);
  }
  return undefined;
};
