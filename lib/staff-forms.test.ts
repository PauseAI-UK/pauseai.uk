import { describe, expect, it } from "vitest";
import {
  askFrom,
  eraseFrom,
  eventFrom,
  dueAtFrom,
  noteEditFrom,
  noteFrom,
  ownEmail,
  ownId,
  ownText,
  permissionsFrom,
  savedFilterNeeds,
  savedListFrom,
  savedNameFrom,
  statusFrom,
  unblockFrom,
} from "./staff-forms";

function form(fields: Record<string, string | Blob>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("dueAtFrom", () => {
  it("reads a day, an hour and a minute the sending runs at in London, and refuses anything else", () => {
    expect(dueAtFrom(form({ day: "2026-07-03", hour: "14", minute: "33" }))).toEqual(
      new Date("2026-07-03T13:33:00.000Z"),
    );
    expect(dueAtFrom(form({ day: "3 July", hour: "14", minute: "3" }))).toBeUndefined();
    expect(dueAtFrom(form({ day: "2026-07-03", hour: "24", minute: "3" }))).toBeUndefined();
    expect(dueAtFrom(form({ day: "2026-07-03", hour: "14", minute: "30" }))).toBeUndefined();
    expect(dueAtFrom(form({ day: "2026-07-03", hour: "14" }))).toBeUndefined();
    expect(dueAtFrom(form({ hour: "14", minute: "3" }))).toBeUndefined();
  });
});

describe("ownId", () => {
  it("reads a row's ID, a positive whole number, and throws on anything else, as the form fills it in itself", () => {
    expect(ownId(form({ id: " 12 " }))).toBe(12);
    expect(ownId(form({ politicianId: "3" }), "politicianId")).toBe(3);
    for (const id of ["0", "-1", "1.5", "x", ""]) {
      expect(() => ownId(form({ id }))).toThrow(`A form's "id" isn't a row's ID`);
    }
    expect(() => ownId(form({ id: new Blob(["1"]) }))).toThrow(`A form's "id" isn't a row's ID`);
    expect(() => ownId(form({}), "politicianId")).toThrow(`A form's "politicianId" isn't a row's ID`);
  });
});

describe("ownText", () => {
  it("reads a field the form fills in itself, trimmed, and throws when it's blank or not there", () => {
    expect(ownText(form({ slug: " winter-reception " }), "slug")).toBe("winter-reception");
    expect(() => ownText(form({ slug: "  " }), "slug")).toThrow(`A form came without its "slug"`);
    expect(() => ownText(form({}), "address")).toThrow(`A form came without its "address"`);
  });
});

describe("statusFrom", () => {
  const base = { politicianId: "4", ask: "frontier-ai-letter", status: "signed", note: " At the march " };

  it("reads the form: the status and its note, or blank to clear it", () => {
    expect(statusFrom(form(base))).toEqual({
      ok: true,
      politicianId: 4,
      ask: "frontier-ai-letter",
      status: "signed",
      note: "At the march",
    });
    expect(statusFrom(form({ ...base, status: "" }))).toMatchObject({ status: null });
    // That they were asked, which either kind of ask allows.
    expect(statusFrom(form({ ...base, status: "invited" }))).toMatchObject({ status: "invited" });
  });

  it("refuses a note that's blank, which is typed", () => {
    expect(statusFrom(form({ ...base, note: " " }))).toEqual({ ok: false, reason: "blank" });
    expect(statusFrom(form({ politicianId: "4", ask: "frontier-ai-letter", status: "signed" }))).toEqual({
      ok: false,
      reason: "blank",
    });
  });

  it("throws on an unknown politician or status, no ask, or an ask an import fills, which the form fills in itself", () => {
    expect(() => statusFrom(form({ ...base, politicianId: "x" }))).toThrow(`"politicianId" isn't a row's ID`);
    expect(() => statusFrom(form({ ...base, status: "maybe" }))).toThrow("a status no ask allows");
    expect(() => statusFrom(form({ ...base, ask: "" }))).toThrow(`without its "ask"`);
    // ControlAI's letter is set from its PDF, never by hand.
    expect(() => statusFrom(form({ ...base, ask: "controlai-letter" }))).toThrow("an ask an import fills");
  });

  it("takes an ask staff added, whether it exists being the database's to say", () => {
    expect(statusFrom(form({ ...base, ask: "giant-pause-button-oct-2026" }))).toMatchObject({
      ask: "giant-pause-button-oct-2026",
    });
  });
});

describe("unblockFrom", () => {
  it("reads the address, lowercased, and the note", () => {
    expect(unblockFrom(form({ address: " Jo@Example.org ", note: " fixed " }))).toEqual({
      ok: true,
      address: "jo@example.org",
      note: "fixed",
    });
  });

  it("reads a number in international format", () => {
    expect(unblockFrom(form({ address: "+447700900001", note: "fixed" }))).toEqual({
      ok: true,
      address: "+447700900001",
      note: "fixed",
    });
  });

  it("refuses an unblock with no note, which is typed", () => {
    expect(unblockFrom(form({ address: "jo@example.org" }))).toEqual({ ok: false, reason: "blank" });
    expect(unblockFrom(form({ address: "jo@example.org", note: "  " }))).toEqual({ ok: false, reason: "blank" });
  });

  it("throws on anything that isn't an address or a number, which the form fills in itself", () => {
    const not = `"address" isn't an address or a number`;
    expect(() => unblockFrom(form({ address: "nobody", note: "fixed" }))).toThrow(not);
    expect(() => unblockFrom(form({ address: "07700 900001", note: "fixed" }))).toThrow(not);
    expect(() => unblockFrom(form({}))).toThrow(not);
  });
});

describe("permissionsFrom", () => {
  it("reads whose, lowercased, as typed, and which boxes are ticked", () => {
    expect(permissionsFrom(form({ email: " Jo@PauseAI.uk ", "permission:supporters": "on" }))).toEqual({
      email: "jo@pauseai.uk",
      permissions: ["supporters"],
    });
    expect(permissionsFrom(form({ email: "jo@pauseai.uk" }))).toEqual({ email: "jo@pauseai.uk", permissions: [] });
    expect(
      permissionsFrom(form({ email: "jo@pauseai.uk", "permission:admin": "on", "permission:root": "on" })),
    ).toEqual({
      email: "jo@pauseai.uk",
      permissions: ["admin"],
    });
    // Not an address, which is for saving it to refuse.
    expect(permissionsFrom(form({ email: " Nobody ", "permission:admin": "on" }))).toEqual({
      email: "nobody",
      permissions: ["admin"],
    });
  });
});

describe("ownEmail", () => {
  it("reads whose account a row's form is about, lowercased, and throws on anything that isn't an address", () => {
    expect(ownEmail(form({ email: " Jo@PauseAI.uk " }))).toBe("jo@pauseai.uk");
    expect(() => ownEmail(form({ email: "nobody" }))).toThrow(`A form's "email" isn't an address`);
    expect(() => ownEmail(form({}))).toThrow(`A form's "email" isn't an address`);
  });
});

describe("eraseFrom", () => {
  it("reads the supporter and the reference, trimmed, with the confirmation box ticked", () => {
    expect(eraseFrom(form({ id: "7", reference: " ICO-123 ", confirm: "on" }))).toEqual({
      ok: true,
      id: 7,
      reference: "ICO-123",
    });
  });

  it("refuses a reference that's blank, which is typed", () => {
    expect(eraseFrom(form({ id: "7", reference: "", confirm: "on" }))).toEqual({ ok: false, reason: "blank" });
    expect(eraseFrom(form({ id: "7", reference: "  ", confirm: "on" }))).toEqual({ ok: false, reason: "blank" });
  });

  it("throws without the supporter or the box ticked, which the form fills in itself", () => {
    expect(() => eraseFrom(form({ id: "7", reference: "x" }))).toThrow("without its box ticked");
    expect(() => eraseFrom(form({ id: "x", reference: "x", confirm: "on" }))).toThrow(`"id" isn't a row's ID`);
  });
});

describe("askFrom", () => {
  it("reads an ask's title, kind, date, link and who asks it, each asker once", () => {
    const data = form({
      title: " Winter reception ",
      kind: "event",
      date: "2026-12-09",
      url: "https://luma.com/winter",
    });
    for (const asker of ["pauseai", "supporters", "pauseai", "someone"]) data.append("askedBy", asker);
    expect(askFrom(data)).toEqual({
      title: "Winter reception",
      kind: "event",
      date: "2026-12-09",
      url: "https://luma.com/winter",
      askedBy: ["pauseai", "supporters"],
    });
    expect(askFrom(form({ title: "Letter", kind: "letter", date: "", url: "https://example.org" }))).toEqual({
      title: "Letter",
      kind: "letter",
      date: null,
      url: "https://example.org",
      askedBy: [],
    });
    expect(askFrom(form({ title: "Letter", kind: "letter" }))).toMatchObject({ date: null, url: null });
  });

  it("throws on one without a title, or with a link that isn't a whole https one, which the form's Save won't send", () => {
    expect(() => askFrom(form({ title: " ", kind: "event" }))).toThrow("without its title");
    expect(() => askFrom(form({ title: "A", kind: "event", url: "http://example.org" }))).toThrow("isn't a whole one");
    expect(() => askFrom(form({ title: "A", kind: "event", url: "/events" }))).toThrow("isn't a whole one");
  });

  it("throws on a kind it doesn't know or a date that isn't one, which the form fills in itself", () => {
    expect(() => askFrom(form({ title: "A", kind: "petition" }))).toThrow("without its kind");
    expect(() => askFrom(form({ title: "A", kind: "toString" }))).toThrow("without its kind");
    expect(() => askFrom(form({ title: "A" }))).toThrow("without its kind");
    expect(() => askFrom(form({ title: "A", kind: "event", date: "9 Dec" }))).toThrow("a date that isn't one");
    expect(() => askFrom(form({ title: "A", kind: "event", date: "2026-13-45" }))).toThrow("a date that isn't one");
  });
});

describe("noteFrom and noteEditFrom", () => {
  it("read whom a new note is on and what it says, trimmed, its lines kept", () => {
    expect(noteFrom(form({ supporterId: "3", body: " One\nTwo " }))).toEqual({
      ok: true,
      target: { supporterId: 3 },
      body: "One\nTwo",
    });
    expect(noteFrom(form({ politicianId: "4", body: "Hi" }))).toEqual({
      ok: true,
      target: { politicianId: 4 },
      body: "Hi",
    });
    expect(noteEditFrom(form({ id: "5", body: "Fixed" }))).toEqual({ ok: true, id: 5, body: "Fixed" });
  });

  it("refuse a note saying nothing, which is typed", () => {
    expect(noteFrom(form({ supporterId: "3", body: "  " }))).toEqual({ ok: false, reason: "blank" });
    expect(noteEditFrom(form({ id: "5", body: "" }))).toEqual({ ok: false, reason: "blank" });
  });

  it("throw on a note on no one or on two, or a note that isn't one, which the form fills in itself", () => {
    expect(() => noteFrom(form({ body: "Hi" }))).toThrow("without the one it's about");
    expect(() => noteFrom(form({ supporterId: "3", politicianId: "4", body: "Hi" }))).toThrow(
      "without the one it's about",
    );
    expect(() => noteEditFrom(form({ id: "x", body: "Fixed" }))).toThrow(`"id" isn't a row's ID`);
  });
});

describe("eventFrom", () => {
  it("reads which event, whose address, lowercased, and a link to Google Docs or Drive; blank for neither", () => {
    const doc = "https://docs.google.com/document/d/abc/edit";
    expect(eventFrom(form({ eventId: "evt-1", owner: " Jo@PauseAI.uk ", doc: ` ${doc} ` }))).toEqual({
      eventId: "evt-1",
      owner: "jo@pauseai.uk",
      doc,
    });
    expect(eventFrom(form({ eventId: "evt-1", doc: "https://drive.google.com/file/d/abc" }))).toEqual({
      eventId: "evt-1",
      owner: null,
      doc: "https://drive.google.com/file/d/abc",
    });
    expect(eventFrom(form({ eventId: "evt-1", owner: "", doc: "" }))).toEqual({
      eventId: "evt-1",
      owner: null,
      doc: null,
    });
  });

  it("throws on a form with no event, or a link anywhere else, which its doc box's pattern never sends", () => {
    expect(() => eventFrom(form({ owner: "jo@pauseai.uk" }))).toThrow(`without its "eventId"`);
    const elsewhere = "a link that isn't to Google Docs or Drive";
    expect(() => eventFrom(form({ eventId: "evt-1", doc: "https://example.com/docs.google.com/" }))).toThrow(elsewhere);
    expect(() => eventFrom(form({ eventId: "evt-1", doc: "http://docs.google.com/document/d/abc" }))).toThrow(
      elsewhere,
    );
  });
});

describe("a saved filter's form", () => {
  it("is for a list that has them", () => {
    expect(savedListFrom(form({ list: "events" }))).toBe("events");
    expect(() => savedListFrom(form({ list: "mailings" }))).toThrow("A saved filter's form came without its list");
    expect(() => savedListFrom(form({}))).toThrow("A saved filter's form came without its list");
  });

  it("needs the supporters permission only for that list", () => {
    expect(savedFilterNeeds(form({ list: "supporters" }))).toBe("supporters");
    expect(savedFilterNeeds(form({ list: "politicians" }))).toBe("account");
    expect(savedFilterNeeds(form({ list: "audit-log" }))).toBe("admin");
    expect(savedFilterNeeds(form({ list: "nonsense" }))).toBe("account");
  });

  it("gives a name on one line", () => {
    expect(savedNameFrom(form({ name: "  Labour\n  or   Green " }))).toBe("Labour or Green");
    expect(savedNameFrom(form({}))).toBe("");
  });
});
