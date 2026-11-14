import { describe, expect, it } from "vitest";
import {
  added,
  compareMembers,
  holdsImport,
  importChangeCount,
  matchMembers,
  MAX_UNCHECKED_IMPORT_CHANGES,
  nextEmail,
  sharedAddresses,
  updated,
  type OfficialMember,
  type OurPolitician,
} from "./politician-import";

const member = (officialId: number, name: string, extra: Partial<OfficialMember> = {}): OfficialMember => ({
  officialId,
  house: "commons",
  name,
  constituency: "Ipswich",
  party: "Labour",
  country: "england",
  emails: [],
  websites: [],
  salutation: `Mx ${name.split(" ").pop()}`,
  ...extra,
});

const ours = (id: number, name: string, extra: Partial<OurPolitician> = {}): OurPolitician => ({
  id,
  officialId: null,
  house: "commons",
  name,
  salutation: `Mx ${name.split(" ").pop()}`,
  salutationToCheck: false,
  constituency: "Ipswich",
  party: "Labour",
  country: "england",
  email: null,
  status: "in_office",
  listed: [],
  ...extra,
});

describe("nextEmail", () => {
  it("keeps ours while the body lists it, or lists none, or never listed ours", () => {
    expect(nextEmail({ email: "a@parliament.uk", listed: [] }, ["a@parliament.uk"])).toBe("a@parliament.uk");
    expect(nextEmail({ email: "A@x.example", listed: [] }, [])).toBe("A@x.example");
    expect(nextEmail({ email: "lord@gmail.example", listed: [] }, ["other@parliament.uk"])).toBe("lord@gmail.example");
  });

  it("takes the body's first once it stops listing ours, or when we have none", () => {
    expect(nextEmail({ email: "old@parliament.uk", listed: ["old@parliament.uk"] }, ["new@parliament.uk"])).toBe(
      "new@parliament.uk",
    );
    expect(nextEmail({ email: null, listed: [] }, ["first@parliament.uk", "second@parliament.uk"])).toBe(
      "first@parliament.uk",
    );
  });

  it("never takes the Lords' shared inbox", () => {
    expect(nextEmail({ email: null, listed: [] }, ["contactholmember@parliament.uk"])).toBeNull();
    expect(
      nextEmail({ email: "old@parliament.uk", listed: ["old@parliament.uk"] }, ["contactholmember@parliament.uk"]),
    ).toBe("old@parliament.uk");
  });
});

describe("matchMembers", () => {
  it("matches by ID first, then by name without titles or accents, then an MP by their seat", () => {
    const byId = ours(1, "Old Name", { officialId: 10 });
    const byName = ours(2, "Órfhlaith Begley", { constituency: "West Tyrone" });
    const bySeat = ours(3, "Stephen Barclay", { constituency: "North East Cambridgeshire" });
    const members = [
      member(10, "New Name"),
      member(11, "Ms Orfhlaith Begley", { constituency: "West Tyrone" }),
      member(12, "Steve Barclay", { constituency: "North East Cambridgeshire" }),
    ];
    const pairs = matchMembers([byId, byName, bySeat], members);
    expect(members.map((m) => pairs.get(m)?.id)).toEqual([1, 2, 3]);
  });

  it("matches no one by a name two share, on either side, and only within a house", () => {
    const pairs = matchMembers(
      [
        ours(1, "Sam Smith", { constituency: "A" }),
        ours(2, "Sam Smith", { constituency: "B" }),
        ours(3, "Lord Ash", { house: "lords", constituency: null }),
      ],
      [member(10, "Sam Smith", { constituency: "C" }), member(11, "Lord Ash", { constituency: null })],
    );
    expect(pairs.size).toBe(0);
  });

  it("doesn't match by seat someone already matched, or out of office", () => {
    const left = ours(1, "Gone Person", { status: "left_office" });
    const pairs = matchMembers([left], [member(10, "New Person")]);
    expect(pairs.size).toBe(0);
  });
});

describe("compareMembers", () => {
  it("adds the new, changes the changed, and marks who left, with why when known", () => {
    const changes = compareMembers(
      [
        ours(1, "Same Person", { officialId: 10, party: "Labour" }),
        ours(2, "Left Person", { officialId: 20 }),
        ours(3, "Unknown Leaver", { constituency: "Ely" }),
        ours(4, "Retired Already", { status: "retired" }),
      ],
      [member(10, "Same Person", { party: "Independent" }), member(30, "New Person")],
      new Map([[20, { status: "died", date: "2026-10-01", reason: "Death" }]]),
    );
    expect(changes.added.map((m) => m.name)).toEqual(["New Person"]);
    expect(changes.changed).toEqual([{ id: 1, name: "Same Person", changed: { party: ["Labour", "Independent"] } }]);
    expect(changes.left).toEqual([
      {
        id: 2,
        name: "Left Person",
        house: "commons",
        constituency: "Ipswich",
        status: "died",
        date: "2026-10-01",
        reason: "Death",
      },
      {
        id: 3,
        name: "Unknown Leaver",
        house: "commons",
        constituency: "Ely",
        status: "left_office",
        date: null,
        reason: null,
      },
    ]);
    expect(changes.renamed).toEqual([]);
  });

  it("links someone matched by name, and shows a salutation unlike the rule's that once", () => {
    const first = compareMembers(
      [ours(1, "Ellie Chowns", { salutation: "Ms Chowns" })],
      [member(10, "Dr Ellie Chowns", { salutation: "Dr Chowns" })],
    );
    expect(first.changed[0].changed).toEqual({ officialId: [null, 10], name: ["Ellie Chowns", "Dr Ellie Chowns"] });
    expect(first.salutations).toEqual([{ id: 1, name: "Dr Ellie Chowns", ours: "Ms Chowns", rule: "Dr Chowns" }]);
    expect(first.renamed).toEqual([]);
    const later = compareMembers(
      [ours(1, "Dr Ellie Chowns", { officialId: 10, salutation: "Ms Chowns" })],
      [member(10, "Dr Ellie Chowns", { salutation: "Dr Chowns" })],
    );
    expect(later.salutations).toEqual([]);
    expect(later.changed).toEqual([]);
  });

  it("calls a different name a rename, and an MP's seat no postcode finds unofficial", () => {
    const changes = compareMembers(
      [ours(1, "Old Name", { officialId: 10, constituency: "Cities of London and Westminster" })],
      [member(10, "New Name", { constituency: "Cities of London & Westminster" })],
    );
    expect(changes.renamed).toEqual([{ id: 1, from: "Old Name", to: "New Name" }]);
    expect(changes.unofficial).toEqual([{ name: "New Name", constituency: "Cities of London & Westminster" }]);
  });

  it("brings back into office someone who'd left and is listed again", () => {
    const changes = compareMembers(
      [ours(1, "Back Again", { officialId: 10, status: "left_office" })],
      [member(10, "Back Again")],
    );
    expect(changes.changed[0].changed).toEqual({ status: ["left_office", "in_office"] });
  });
});

describe("updated and added", () => {
  it("makes a salutation from the name again once the rule can tell, unless staff changed it", () => {
    const waiting = ours(1, "Gwen Example", { salutation: "Gwen Example", salutationToCheck: true });
    expect(updated(waiting, member(10, "Gwen Example", { salutation: "Ms Example" }))).toMatchObject({
      salutation: "Ms Example",
      salutationToCheck: false,
    });
    expect(updated(waiting, member(10, "Gwen Example", { salutation: null }))).toMatchObject({
      salutation: "Gwen Example",
      salutationToCheck: true,
    });
    const edited = { ...waiting, salutation: "Gwen" };
    expect(updated(edited, member(10, "Gwen Example", { salutation: "Ms Example" }))).toMatchObject({
      salutation: "Gwen",
      salutationToCheck: true,
    });
  });

  it("adds a member with their salutation by rule, or their name to check", () => {
    expect(added(member(10, "Sam Example", { emails: ["sam@parliament.uk"] }))).toMatchObject({
      officialId: 10,
      email: "sam@parliament.uk",
      salutation: "Mx Example",
      salutationToCheck: false,
      status: "in_office",
    });
    expect(added(member(10, "Sam Example", { salutation: null }))).toMatchObject({
      salutation: "Sam Example",
      salutationToCheck: true,
      email: null,
    });
  });
});

describe("holding an import", () => {
  const none = { added: [], changed: [], left: [], renamed: [], unofficial: [], salutations: [] };

  it("holds more changes than a person needn't check, a rename, or an unofficial seat", () => {
    const many = Array.from({ length: MAX_UNCHECKED_IMPORT_CHANGES + 1 }, (_, i) => member(i, `Person ${i}`));
    expect(importChangeCount({ ...none, added: many })).toBe(MAX_UNCHECKED_IMPORT_CHANGES + 1);
    expect(holdsImport({ ...none, added: many })).toBe(true);
    expect(holdsImport({ ...none, added: many.slice(1) })).toBe(false);
    expect(holdsImport({ ...none, renamed: [{ id: 1, from: "A", to: "B" }] })).toBe(true);
    expect(holdsImport({ ...none, unofficial: [{ name: "A", constituency: "B" }] })).toBe(true);
  });
});

describe("sharedAddresses", () => {
  it("finds the addresses two members list, counting each member's once", () => {
    expect(
      sharedAddresses([
        { emails: ["office@parliament.uk", "a@parliament.uk", "a@parliament.uk"] },
        { emails: ["office@parliament.uk", "b@parliament.uk"] },
      ]),
    ).toEqual(new Set(["office@parliament.uk"]));
  });
});
