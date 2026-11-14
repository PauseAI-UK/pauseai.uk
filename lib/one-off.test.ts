import { describe, expect, it } from "vitest";
import {
  addressForms,
  lordFor,
  lordNamed,
  formOwner,
  type FormPerson,
  nameParts,
  politiciansNamed,
  quotedNames,
  isPauseaiAddress,
  isRecognisedMail,
  isSomeoneElse,
  keepsPoliticianThreads,
  onParliamentDomain,
  participants,
  politicianAddresses,
  politicianAnswered,
  politiciansIn,
  politiciansOf,
  quotedAddresses,
  type PoliticianBook,
} from "./one-off";

/** Five politicians: three MPs, one of them out of office and two sharing a name, an MS and a peer. */
const people: FormPerson[] = [
  { id: 5, name: "Dame Meg Hillier", house: "commons", constituency: "Hackney South and Shoreditch", inOffice: true },
  {
    id: 6,
    name: "Sir Iain Duncan Smith MP",
    house: "commons",
    constituency: "Chingford and Woodford Green",
    inOffice: true,
  },
  { id: 7, name: "Dr Rosena Allin-Khan", house: "commons", constituency: "Tooting", inOffice: false },
  { id: 8, name: "Luke Fletcher", house: "senedd", constituency: "South Wales West", inOffice: true },
  { id: 9, name: "Baroness Chakrabarti", house: "lords", constituency: null, inOffice: true },
  { id: 10, name: "Mr John Smith", house: "commons", constituency: null, inOffice: true },
  { id: 11, name: "John Smith", house: "scottish-parliament", constituency: null, inOffice: true },
];

const book: PoliticianBook = {
  addresses: new Map([
    ["polly@gmail.com", [1]],
    ["shared@parliament.uk", [2, 3]],
  ]),
  domains: new Map([["tulip.example", 4]]),
  forms: addressForms(people),
};

describe("a politician's address forms", () => {
  it("takes a name's first name and surnames, without titles, honours or a peer's place", () => {
    expect(nameParts("Dame Meg Hillier")).toEqual({ first: "meg", surnames: ["hillier"] });
    expect(nameParts("The Rt Hon Sir Iain Duncan Smith MP KC")).toEqual({
      first: "iain",
      surnames: ["duncansmith", "smith"],
    });
    expect(nameParts("Dr Rosena Allin-Khan")).toEqual({ first: "rosena", surnames: ["allinkhan"] });
    expect(nameParts("Órfhlaith Begley")).toEqual({ first: "orfhlaith", surnames: ["begley"] });
    expect(nameParts("Baroness Chakrabarti")).toBeUndefined();
    expect(nameParts("Lord Jones of Penybont")).toBeUndefined();
  });

  it("makes each name's and MP's seat's key, leaving out one two share and a seat out of office", () => {
    const forms = addressForms(people);
    expect(forms.get("name:meghillier")).toBe(5);
    expect(forms.get("name:iainduncansmith")).toBe(6);
    expect(forms.get("name:iainsmith")).toBe(6);
    expect(forms.get("seat:hackneysouthandshoreditch")).toBe(5);
    expect(forms.get("name:rosenaallinkhan")).toBe(7);
    expect(forms.has("seat:tooting")).toBe(false);
    expect(forms.has("seat:southwaleswest")).toBe(false);
    expect(forms.has("name:johnsmith")).toBe(false);
  });

  it("finds whose a parliament address is by a name or seat with a mark", () => {
    const forms = book.forms;
    for (const address of [
      "meg.hillier.mp@parliament.uk",
      "meghilliermp@parliament.uk",
      "officeofmeghilliermp@parliament.uk",
      "officeofmeghillier@parliament.uk",
      "meg.hillier.casework@parliament.uk",
      "meg.hillier.hackneysouthandshoreditch@parliament.uk",
      "hackneysouthandshoreditch.mp@parliament.uk",
      "hackneysouthandshoreditchmp@parliament.uk",
    ]) {
      expect(formOwner(forms, address), address).toBe(5);
    }
    expect(formOwner(forms, "iain.duncan.smith.mp@parliament.uk")).toBe(6);
    expect(formOwner(forms, "luke.fletcher@senedd.wales")).toBe(8);
  });

  it("finds no one by a name without a mark, off a parliament's domain, or by a seat after someone else's name", () => {
    const forms = book.forms;
    expect(formOwner(forms, "meg.hillier@parliament.uk")).toBeUndefined();
    expect(formOwner(forms, "meghillier@parliament.uk")).toBeUndefined();
    expect(formOwner(forms, "meg.hillier.mp@example.com")).toBeUndefined();
    expect(formOwner(forms, "officeof@parliament.uk")).toBeUndefined();
    expect(formOwner(forms, "jane.smith.hackneysouthandshoreditch@parliament.uk")).toBeUndefined();
    expect(formOwner(forms, "jane.smith.mp@parliament.uk")).toBeUndefined();
    expect(formOwner(forms, "...@parliament.uk")).toBeUndefined();
  });

  it("counts a form as a politician's address", () => {
    expect(politiciansOf(book, "meghilliermp@parliament.uk")).toEqual([5]);
    expect(politiciansIn(book, ["staff.member@parliament.uk"])).toEqual({ counts: true, people: [] });
  });

  it("finds a politician named the way Outlook quotes a colleague", () => {
    expect(politiciansNamed(book, ["HILLIER, Meg", "HILLIER, Meg", "SMITH, Jane", "NOBODY"])).toEqual([5]);
  });

  it("reads the names given with no address in what a message quotes", () => {
    const text = [
      "From: Callum <cal@example.com>",
      "Sent: 20 October 2026 19:57",
      "To: HILLIER, Meg; Jane <jane@example.com>",
      'Cc: "DUNCAN SMITH, Iain"; policy@pauseai.uk',
      "",
      "From: HILLIER, Meg <meghilliermp@parliament.uk>",
      "Sent: 21 October 2026 09:00",
    ].join("\n");
    expect(quotedNames(text)).toEqual(["HILLIER, Meg", "DUNCAN SMITH, Iain"]);
  });
});

describe("what counts as a thread with a politician", () => {
  it("knows parliaments' domains and their subdomains", () => {
    expect(onParliamentDomain("a@parliament.uk")).toBe(true);
    expect(onParliamentDomain("a@mla.niassembly.gov.uk")).toBe(true);
    expect(onParliamentDomain("a@notparliament.uk")).toBe(false);
  });

  it("finds a politician by an address they have or had, or their own domain", () => {
    expect(politiciansOf(book, "polly@gmail.com")).toEqual([1]);
    expect(politiciansOf(book, "office@tulip.example")).toEqual([4]);
    expect(politiciansOf(book, "x@example.com")).toEqual([]);
  });

  it("counts by a politician, or a parliament's address with no one we know", () => {
    expect(politiciansIn(book, ["polly@gmail.com", "shared@parliament.uk"])).toEqual({
      counts: true,
      people: [1, 2, 3],
    });
    expect(politiciansIn(book, ["staff@parliament.uk"])).toEqual({ counts: true, people: [] });
    expect(politiciansIn(book, ["x@example.com"])).toEqual({ counts: false, people: [] });
  });

  it("reads the addresses in what a message quotes", () => {
    expect(
      quotedAddresses("From: Polly <polly@gmail.com>\nSent: 1 Jan\nTo: Me <me@x.uk>, polly@gmail.com\nCc: c@x.uk"),
    ).toEqual(["polly@gmail.com", "me@x.uk", "c@x.uk"]);
  });
});

describe("who's in a thread", () => {
  it("is PauseAI's by a connected Gmail or an alias", () => {
    expect(isPauseaiAddress("jo@pauseai.uk", ["jo@pauseai.uk"])).toBe(true);
    expect(isPauseaiAddress("joseph@pauseai.info", [])).toBe(true);
    expect(isPauseaiAddress("x@example.com", [])).toBe(false);
  });

  it("is someone else by anyone else", () => {
    expect(isSomeoneElse(book, "x@example.com", [])).toBe(true);
    expect(isSomeoneElse(book, "polly@gmail.com", [])).toBe(false);
    expect(isSomeoneElse(book, "joseph@pauseai.info", [])).toBe(false);
  });
});

describe("mail the site recognises", () => {
  it("is spam, its own, bounces and Google's", () => {
    expect(isRecognisedMail("x@example.com", ["SPAM"])).toBe(true);
    expect(isRecognisedMail("x@example.com", ["TRASH"])).toBe(true);
    expect(isRecognisedMail("mailer-daemon@x.uk", [])).toBe(true);
    expect(isRecognisedMail("a@notify.pauseai.uk", [])).toBe(true);
    expect(isRecognisedMail("noreply@x.uk", [])).toBe(true);
    expect(isRecognisedMail("x@example.com", ["INBOX"])).toBe(false);
  });
});

describe("a header's line", () => {
  it("says which politician an address is, unless several share it", () => {
    expect(
      politicianAddresses(book, [
        "polly@gmail.com",
        "shared@parliament.uk",
        "someone@tulip.example",
        "jane@example.com",
      ]),
    ).toEqual({ "polly@gmail.com": 1, "someone@tulip.example": 4 });
  });
});

describe("whether a politician answered", () => {
  it("counts a politician or a parliament's address after the first message, and no one else", () => {
    expect(politicianAnswered(book, ["joseph@pauseai.uk", "polly@gmail.com"])).toBe(true);
    expect(politicianAnswered(book, ["joseph@pauseai.uk", "office@parliament.uk"])).toBe(true);
    expect(politicianAnswered(book, ["polly@gmail.com", "joseph@pauseai.uk"])).toBe(false);
    expect(politicianAnswered(book, ["polly@gmail.com"])).toBe(false);
  });
});

describe("a thread's participants", () => {
  it("lists each sender once, in the order they first wrote, by name or else address", () => {
    expect(
      participants([
        { name: "Joseph", address: "joseph@pauseai.uk" },
        { name: "", address: "polly@parliament.uk" },
        { name: "Joseph", address: "joseph@pauseai.uk" },
      ]),
    ).toEqual(["Joseph", "polly@parliament.uk"]);
  });
});

describe("which mailboxes are kept", () => {
  it("keeps policy@'s and Joseph's threads with politicians, and no one else's", () => {
    expect(keepsPoliticianThreads("policy@pauseai.uk")).toBe(true);
    expect(keepsPoliticianThreads("Joseph@pauseai.uk")).toBe(true);
    expect(keepsPoliticianThreads("jo@pauseai.uk")).toBe(false);
  });
});

describe("threads through the House of Lords' shared inbox", () => {
  it("finds the Lord a subject is for, after any Re: or Fwd:, or none", () => {
    expect(lordFor("For Baroness Verma: Request to co-sign")).toBe("Baroness Verma");
    expect(lordFor("Re: Fwd: For Lord Seedling of Example: Thanks")).toBe("Lord Seedling of Example");
    expect(lordFor("FW: for the Lord Bishop of Example : a letter")).toBe("the Lord Bishop of Example");
    expect(lordFor("For your information: a briefing")).toBeNull();
    expect(lordFor("Request to co-sign, for Baroness Verma")).toBeNull();
  });

  it("matches a name to one sitting Lord, with or without their territorial part, or to none", () => {
    const lords = [
      { id: 1, name: "Baroness Verma" },
      { id: 2, name: "Lord Seedling of Example" },
      { id: 3, name: "Lord Smith of Here" },
      { id: 4, name: "Lord Smith of There" },
      { id: 5, name: "Baroness Ní Éxample" },
    ];
    expect(lordNamed(lords, "Baroness  verma")).toBe(1);
    expect(lordNamed(lords, "Lord Seedling")).toBe(2);
    expect(lordNamed(lords, "The Lord Seedling of Example")).toBe(2);
    expect(lordNamed(lords, "Baroness Ni Example")).toBe(5);
    // Two Lords Smith: no telling which.
    expect(lordNamed(lords, "Lord Smith")).toBeNull();
    expect(lordNamed(lords, "Lord Nobody")).toBeNull();
  });
});
