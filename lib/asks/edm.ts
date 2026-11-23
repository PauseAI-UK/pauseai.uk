// EDM 1133, "Global pause on superintelligent AI", which MPs sign, and its
// list of signers from Parliament's API for motions
// (https://oralquestionsandmotions-api.parliament.uk/, no key needed). Its web
// page refuses scripts, so the import reads the API. The caller fetches:
// lib/server/outside-services/parliament.server.ts.

/** The motion's number in that API, which its page's address uses too. */
const EDM_ID = 66900;

/** The motion's page on Parliament's site, which staff follow. */
export const EDM_PAGE = `https://edm.parliament.uk/early-day-motion/${EDM_ID}`;

/** The motion, with its signers, from Parliament's API. */
export const EDM_API = `https://oralquestionsandmotions-api.parliament.uk/EarlyDayMotion/${EDM_ID}`;

/** An MP who signed: Parliament's ID for them, their name, and the day they signed. */
export type EdmSigner = { id: number; name: string; date: string };

type Sponsor = {
  MemberId?: number;
  Member?: { Name?: string } | null;
  CreatedWhen?: string;
  IsWithdrawn?: boolean;
};

/**
 * The motion's signers, sponsors included, from the API's answer, leaving
 * out those who withdrew. Throws if the answer has no list of them, as its
 * shape must have changed. The API gives each the time they signed in
 * London's time, so its day is London's.
 */
export function edmSigners(data: unknown): EdmSigner[] {
  const sponsors = (data as { Response?: { Sponsors?: Sponsor[] } } | null)?.Response?.Sponsors;
  if (!Array.isArray(sponsors)) throw new Error(`No signers in ${EDM_API}: has its answer changed shape?`);
  return sponsors
    .filter((s) => !s.IsWithdrawn)
    .map((s) => ({ id: Number(s.MemberId), name: s.Member?.Name ?? "", date: String(s.CreatedWhen).slice(0, 10) }));
}
