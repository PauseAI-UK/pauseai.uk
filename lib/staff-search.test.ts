import { describe, expect, it } from "vitest";
import {
  changesSearch,
  sentEmailsSearch,
  accountsSearch,
  allLettersSearch,
  askFormSearch,
  emailsSearch,
  eventsSearch,
  letterId,
  mailingId,
  lettersSearch,
  politicianId,
  supporterId,
  supportersSearch,
  erasedPath,
  eraseLeftovers,
  politiciansSearch,
} from "./staff-search";

describe("changesSearch", () => {
  it("reads the audit log's filters, any and none, and its sort, as typed and as applied", () => {
    expect(
      changesSearch({
        q: " polly ",
        actor: ["jo@pauseai.uk", "!sync"],
        action: "!add note",
        when: "30",
        sort: "actor",
        dir: "asc",
        page: "2",
        saved: "4",
      }),
    ).toEqual({
      q: " polly ",
      actor: ["jo@pauseai.uk", "!sync"],
      action: ["!add note"],
      when: "30",
      sort: "actor",
      dir: "asc",
      page: "2",
      saved: "4",
      filter: {
        search: "polly",
        actor: ["jo@pauseai.uk"],
        action: undefined,
        days: 30,
        not: { actor: ["sync"], action: ["add note"] },
        sort: { key: "actor", dir: "asc" },
        page: 2,
      },
    });
  });

  it("is newest first, of everything, with nothing asked for, or what it doesn't know", () => {
    const { filter } = changesSearch({ when: "5", sort: "details", q: "  " });
    expect(filter).toEqual({
      search: undefined,
      actor: undefined,
      action: undefined,
      days: undefined,
      not: undefined,
      sort: { key: "day", dir: "desc" },
      page: 1,
    });
  });
});

describe("sentEmailsSearch", () => {
  it("reads the sent emails' filters and search, those to leave out apart", () => {
    const { filter, ...typed } = sentEmailsSearch({
      q: " jane ",
      purpose: ["letter", "!relay"],
      outcome: "sent",
      backend: "!gmail",
      link: ["campaign", "!mailing", "nonsense"],
      sort: "subject",
      dir: "asc",
      page: "2",
    });
    expect(typed).toEqual({
      sort: "subject",
      dir: "asc",
      q: " jane ",
      purpose: ["letter", "!relay"],
      outcome: ["sent"],
      backend: ["!gmail"],
      link: ["campaign", "!mailing", "nonsense"],
      page: "2",
    });
    expect(filter).toEqual({
      search: "jane",
      sort: { key: "subject", dir: "asc" },
      purpose: ["letter"],
      outcome: ["sent"],
      backend: undefined,
      link: ["campaign"],
      not: { purpose: ["relay"], backend: ["gmail"], link: ["mailing"] },
      page: 2,
    });
    expect(sentEmailsSearch({}).filter).toEqual({
      search: undefined,
      sort: { key: "when", dir: "desc" },
      purpose: undefined,
      outcome: undefined,
      backend: undefined,
      link: undefined,
      not: undefined,
      page: 1,
    });
  });
});

describe("lettersSearch", () => {
  const none = {
    status: undefined,
    search: undefined,
    answered: undefined,
    tab: undefined,
    campaign: undefined,
    flags: undefined,
    backend: undefined,
    consent: undefined,
    not: undefined,
    sort: { key: "created", dir: "desc" },
    page: 1,
  };
  const blank = {
    tab: "",
    status: "",
    q: "",
    answered: "",
    campaign: [],
    flag: [],
    backend: [],
    sort: "",
    dir: "",
    page: "",
  };

  it("filters by a status, a search, whether answered, campaigns, the MP's markers, and where from, and sorts", () => {
    expect(
      lettersSearch({
        status: "sent",
        q: " jane ",
        answered: "yes",
        campaign: ["regulate-letter-pm", "!pauseai-info-deepmind"],
        flag: ["test", "!important"],
        backend: ["airtable", "!gmail"],
        sort: "from",
        dir: "asc",
        page: "2",
      }),
    ).toEqual({
      tab: "",
      status: "sent",
      q: " jane ",
      answered: "yes",
      campaign: ["regulate-letter-pm", "!pauseai-info-deepmind"],
      flag: ["test", "!important"],
      backend: ["airtable", "!gmail"],
      sort: "from",
      dir: "asc",
      page: "2",
      filter: {
        status: "sent",
        search: "jane",
        answered: "yes",
        campaign: ["regulate-letter-pm"],
        flags: ["test"],
        backend: ["airtable"],
        not: { campaign: ["pauseai-info-deepmind"], flags: ["important"], backend: ["gmail"] },
        sort: { key: "from", dir: "asc" },
        page: 2,
      },
    });
    expect(lettersSearch({ answered: "no", backend: "postmark", campaign: "support-sobel-bill" }).filter).toEqual({
      ...none,
      answered: "no",
      backend: ["postmark"],
      campaign: ["support-sobel-bill"],
    });
  });

  it("filters by nothing when each is blank or unknown, newest written first", () => {
    expect(lettersSearch({})).toEqual({ ...blank, filter: none });
    expect(
      lettersSearch({
        status: "nope",
        q: "  ",
        answered: "maybe",
        campaign: ["Not A Slug", "!"],
        flag: "nope",
        backend: "nope",
        sort: "nope",
      }).filter,
    ).toEqual(none);
    // A name every object inherits isn't a status; nor is a kind of event, which a letter's status never is.
    for (const status of ["toString", "replied", "auto_reply"]) expect(lettersSearch({ status }).filter).toEqual(none);
    expect(lettersSearch({ answered: "auto" }).filter).toEqual({ ...none, answered: "auto" });
  });
});

describe("politicianId", () => {
  it("reads a whole number, and nothing else", () => {
    expect(politicianId("12")).toBe(12);
    for (const id of ["x", "1.5", "-1", ""]) expect(politicianId(id)).toBeUndefined();
  });
});

describe("emailsSearch", () => {
  /** The filter with nothing chosen: newest blocked first. */
  const NEWEST = { sort: { key: "since", dir: "desc" } };

  it("keeps the URL as typed, and filters by what blocked it, and by nothing else", () => {
    expect(emailsSearch({ kind: "complaint" })).toEqual({
      search: { q: "", kind: "complaint", backend: "", found: "", sort: "", dir: "", page: "" },
      page: 1,
      filter: { kind: "complaint", ...NEWEST },
    });
    expect(emailsSearch({ kind: "not-on-whatsapp" }).filter).toEqual({ kind: "not-on-whatsapp", ...NEWEST });
    expect(emailsSearch({ kind: "soft" }).filter).toEqual(NEWEST);
  });

  it("filters by who told us, and what found it out, and by nothing else", () => {
    expect(emailsSearch({ backend: "gmail" }).filter).toEqual({ backend: "gmail", ...NEWEST });
    expect(emailsSearch({ backend: "pigeon" }).filter).toEqual(NEWEST);
    expect(emailsSearch({ found: "mailbox" }).filter).toEqual({ found: "mailbox", ...NEWEST });
    expect(emailsSearch({ found: "postcard" }).filter).toEqual(NEWEST);
  });

  it("sorts by a column it has, most blocked first by default for Times blocked", () => {
    expect(emailsSearch({ sort: "refused" }).filter.sort).toEqual({ key: "refused", dir: "desc" });
    expect(emailsSearch({ sort: "address", dir: "desc" }).filter.sort).toEqual({ key: "address", dir: "desc" });
    expect(emailsSearch({ sort: "whose" }).filter.sort).toEqual(NEWEST.sort);
  });

  it("searches the addresses for what was typed, trimmed", () => {
    expect(emailsSearch({ q: " bob@ " }).filter.search).toBe("bob@");
    expect(emailsSearch({ q: "  " }).filter.search).toBeUndefined();
  });

  it("reads the page, the first for anything else", () => {
    expect(emailsSearch({ page: "3" }).page).toBe(3);
    expect(emailsSearch({ page: "x" }).page).toBe(1);
  });
});

describe("eventsSearch", () => {
  const blank = {
    when: "",
    q: "",
    owner: [],
    tag: [],
    place: [],
    removed: "",
    held: "",
    group: "",
    sort: "",
    dir: "",
    page: "",
    saved: "",
  };
  const none = {
    search: undefined,
    owner: undefined,
    tag: undefined,
    place: undefined,
    removed: false,
    not: undefined,
    page: 1,
  };

  it("reads who an email is to, leaving out what's no ID", () => {
    expect(allLettersSearch({ to: ["5", "!6", "x"] }).filter).toMatchObject({ to: [5], notTo: [6] });
  });

  it("reads the date filter, only a window of the dashboard's", () => {
    expect(eventsSearch({ when: "past", held: "30" }).filter.heldDays).toBe(30);
    expect(eventsSearch({ held: "31" }).filter.heldDays).toBeUndefined();
    expect(supportersSearch({ first: "7", registered: "30", unsubscribed: "90" }).filter).toMatchObject({
      firstDays: 7,
      registeredDays: 30,
      unsubscribedDays: 90,
    });
  });

  it("is the Future tab, soonest first, with those taken off Luma left out, nothing chosen; and Past, latest first", () => {
    expect(eventsSearch({})).toEqual({
      ...blank,
      filter: { ...none, tab: "future", sort: { key: "start", dir: "asc" } },
    });
    expect(eventsSearch({ when: "past" }).filter).toEqual({
      ...none,
      tab: "past",
      sort: { key: "start", dir: "desc" },
    });
    expect(eventsSearch({ when: "someday" }).filter.tab).toBe("future");
    // Only "yes" finds those taken off Luma.
    expect(eventsSearch({ removed: "no" }).filter.removed).toBe(false);
  });

  it("groups by owner or by tag, on either tab, from group or else view, and not by anything else", () => {
    expect(eventsSearch({ group: "owner" })).toMatchObject({ group: "owner", filter: { group: "owner" } });
    expect(eventsSearch({ when: "past", group: "tag" }).filter).toMatchObject({ tab: "past", group: "tag" });
    expect(eventsSearch({ view: "tag" })).toMatchObject({ group: "tag", filter: { group: "tag" } });
    expect(eventsSearch({ group: "owner", view: "tag" }).filter.group).toBe("owner");
    expect(eventsSearch({ group: "city" })).toMatchObject({ group: "", filter: { group: undefined } });
  });

  it("reads each filter as typed and as applied, a repeated one as a list, its values marked ! left out", () => {
    const all = eventsSearch({
      when: "past",
      q: " social ",
      owner: ["none", "!jo@pauseai.uk"],
      tag: "London",
      place: ["!online"],
      removed: "yes",
      sort: "going",
      dir: "asc",
      page: "2",
    });
    expect(all.owner).toEqual(["none", "!jo@pauseai.uk"]);
    expect(all.filter).toEqual({
      tab: "past",
      search: "social",
      owner: ["none"],
      tag: ["London"],
      place: undefined,
      removed: true,
      not: { owner: ["jo@pauseai.uk"], place: ["online"] },
      sort: { key: "going", dir: "asc" },
      page: 2,
    });
  });
});

describe("supportersSearch", () => {
  const blank = {
    q: "",
    activity: [],
    contact: [],
    event: [],
    campaign: "",
    wrote: "",
    nation: [],
    mp: [],
    near: "",
    within: "",
    first: "",
    registered: "",
    unsubscribed: "",
    sort: "",
    dir: "",
    page: "",
    erased: "",
    broadcast: "",
    why: "",
    saved: "",
  };

  it("reads each filter as typed and as applied, a repeated one as a list, its values marked ! left out", () => {
    expect(supportersSearch({})).toEqual({ ...blank, filter: { sort: "active", dir: "desc", page: 1 } });
    const all = supportersSearch({
      q: " jane ",
      activity: ["registered", "member", "!letter"],
      contact: ["email:events:unsubscribed", "!email:newsletter:yes"],
      event: ["evt-1", "evt-2", "!evt-3"],
      campaign: "support-sobel-bill",
      wrote: "no",
      nation: ["wales", "!scotland"],
      mp: ["7", "!8"],
      near: " Leeds ",
      within: "25",
      sort: "name",
      dir: "desc",
      page: "3",
    });
    expect(all.filter).toEqual({
      search: "jane",
      activity: ["registered", "member"],
      contact: [{ way: "email", topic: "events", reason: "unsubscribed" }],
      event: ["evt-1", "evt-2"],
      campaign: "support-sobel-bill",
      wrote: false,
      country: ["wales"],
      mp: [7],
      near: { text: "Leeds", miles: 25 },
      not: {
        activity: ["letter"],
        contact: [{ way: "email", topic: "newsletter", send: "yes" }],
        event: ["evt-3"],
        country: ["scotland"],
        mp: [8],
      },
      sort: "name",
      dir: "desc",
      page: 3,
    });
    // Any MP is a value of the MP filter of its own, which can be left out too.
    expect(supportersSearch({ mp: ["any", "7"] }).filter).toMatchObject({ mp: [7], hasMp: true });
    expect(supportersSearch({ mp: "!any" }).filter).toMatchObject({ not: { hasMp: true } });
    expect(all.q).toBe(" jane ");
    expect(all.activity).toEqual(["registered", "member", "!letter"]);
    expect(all.contact).toEqual(["email:events:unsubscribed", "!email:newsletter:yes"]);
    // A campaign alone is those who wrote in it; Near alone is within 10 miles.
    expect(supportersSearch({ campaign: "support-sobel-bill", near: "M1" }).filter).toMatchObject({
      wrote: true,
      near: { text: "M1", miles: 10 },
    });
  });

  it("drops what it doesn't know", () => {
    const bad = supportersSearch({
      activity: ["x", "!x"],
      contact: "x",
      event: "!",
      campaign: "no-such-campaign",
      wrote: "no",
      nation: "atlantis",
      mp: "x",
      near: "  ",
      within: "7",
      sort: "x",
      page: "0",
    });
    expect(bad.filter).toEqual({ sort: "active", dir: "desc", page: 1 });
    expect(supportersSearch({ sort: "first" }).filter).toMatchObject({ sort: "first" });
  });
});

describe("accountsSearch", () => {
  it("keeps only the notice it knows", () => {
    expect(accountsSearch({ notice: "last-admin" }).notice).toBe("last-admin");
    expect(accountsSearch({ notice: "not-pauseai" }).notice).toBe("not-pauseai");
    expect(accountsSearch({ notice: "removed" }).notice).toBe("removed");
    expect(accountsSearch({ notice: "x" }).notice).toBe("");
    expect(accountsSearch({}).notice).toBe("");
  });

  it("reads the sort, by address if none's known, each in its natural direction", () => {
    expect(accountsSearch({}).sort).toEqual({ key: "email", dir: "asc" });
    expect(accountsSearch({ sort: "nonsense" }).sort).toEqual({ key: "email", dir: "asc" });
    expect(accountsSearch({ sort: "lastSeen" }).sort).toEqual({ key: "lastSeen", dir: "desc" });
    expect(accountsSearch({ sort: "added", dir: "asc" }).sort).toEqual({ key: "added", dir: "asc" });
  });
});

describe("letterId", () => {
  it("is a whole number from the URL", () => {
    expect(letterId("17")).toBe(17);
    expect(letterId("x")).toBeUndefined();
  });
});

describe("mailingId", () => {
  it("is a whole number from the URL", () => {
    expect(mailingId("3")).toBe(3);
    expect(mailingId("x")).toBeUndefined();
  });
});

describe("supporterId", () => {
  it("is a whole number from the URL", () => {
    expect(supporterId("12")).toBe(12);
    expect(supporterId("x")).toBeUndefined();
  });
});

describe("askFormSearch", () => {
  it("goes back to a staff page given, else the asks page, and says how the last save went", () => {
    expect(askFormSearch({ back: "/staff/mailings/4", notice: "added" })).toEqual({
      back: "/staff/mailings/4",
      notice: "added",
    });
    expect(askFormSearch({ back: "https://evil.example" })).toEqual({ back: "/staff/asks", notice: "" });
  });
});

it("sends an erasure to the list saying so, with what couldn't be cleared, if anything", () => {
  expect(erasedPath([])).toBe("/staff/supporters?erased=1");
  expect(erasedPath(["mail", "oneOffs"])).toBe("/staff/supporters?erased=partly&why=mail,oneOffs");
});

it("reads only the codes it knows from an erasure's address", () => {
  expect(eraseLeftovers("oneOffs,someone's words")).toEqual(["oneOffs"]);
  expect(eraseLeftovers("")).toEqual([]);
});

/** An ask, by its slug. */
const BILL = "controlai-letter";

describe("politiciansSearch", () => {
  it("keeps what was typed, and filters by it, a repeated filter by any of its values and none of those marked !", () => {
    const typed = {
      q: "Jo",
      house: "lords",
      status: "retired",
      party: ["Crossbench", "Labour", "!Reform UK"],
      flag: ["important", "removed", "!connection"],
      nation: ["wales", "!scotland"],
      email: ["none", "blocked", "!yes"],
      ask: [BILL],
      answer: [`${BILL}.signed`],
      mailed: ["deepmind-letter", "!frontier-ai-letter"],
      sort: "party",
      dir: "desc",
      page: "3",
      mailing: "12",
    };
    expect(politiciansSearch(typed)).toEqual({
      ...typed,
      tab: "",
      agreed: "",
      saved: "",
      filter: {
        search: "Jo",
        house: "lords",
        status: "retired",
        party: ["Crossbench", "Labour"],
        // "removed" was a marker once: an old link keeps working without it.
        flags: ["important"],
        country: ["wales"],
        email: ["none", "blocked"],
        mailed: ["deepmind-letter"],
        asks: [{ ask: BILL, answer: ["signed"] }],
        not: {
          party: ["Reform UK"],
          flags: ["connection", "test"],
          country: ["scotland"],
          email: ["yes"],
          mailed: ["frontier-ai-letter"],
        },
        sort: { key: "party", dir: "desc" },
        page: 3,
      },
    });
    // Each ask has its own answers, found or left out; one not paired with an ask is the first's, as an old link has
    // it; an ask chosen twice is one.
    const asks = politiciansSearch({
      ask: [BILL, "frontier-ai-letter", BILL],
      answer: ["invited", "!frontier-ai-letter.signed", `!${BILL}.declined`],
    });
    expect(asks.answer).toEqual([`${BILL}.invited`, "!frontier-ai-letter.signed", `!${BILL}.declined`]);
    expect(asks.filter.asks).toEqual([
      { ask: BILL, answer: ["invited"], not: ["declined"] },
      { ask: "frontier-ai-letter", not: ["signed"] },
    ]);
    // One of a filter that repeats, as the URL gives it, is a list of one; one that doesn't, given twice, its first.
    const once = politiciansSearch({ party: "Green", q: ["a", "b"] });
    expect(once.party).toEqual(["Green"]);
    expect(once.filter).toMatchObject({ party: ["Green"], search: "a" });
  });

  it("filters by nothing that's blank, missing or unknown", () => {
    const none = {
      search: undefined,
      house: undefined,
      status: "in_office",
      party: undefined,
      flags: undefined,
      country: undefined,
      email: undefined,
      mailed: undefined,
      asks: undefined,
      not: { flags: ["test"] },
      sort: { key: "name", dir: "asc" },
      page: 1,
    };
    const blank = {
      q: "",
      house: "",
      status: "",
      party: [],
      flag: [],
      nation: [],
      email: [],
      ask: [],
      answer: [],
      mailed: [],
      agreed: "",
      sort: "",
      dir: "",
      page: "",
      mailing: "",
      tab: "",
      saved: "",
    };
    expect(politiciansSearch({})).toEqual({ ...blank, filter: none });
    // An answer is to an ask chosen, so without one it's left out, as typed too.
    expect(politiciansSearch({ answer: "invited" })).toEqual({ ...blank, filter: none });
    expect(politiciansSearch({ ask: BILL, answer: ["other-ask.signed", `${BILL}.`] })).toMatchObject({
      answer: [],
      filter: { asks: [{ ask: BILL }] },
    });
    // A draft's ID is a number; the tab is ticked or pasted.
    expect(politiciansSearch({ mailing: "12x", tab: "yes" })).toMatchObject({ mailing: "", tab: "" });
    expect(politiciansSearch({ mailing: "12", tab: "ticked" })).toMatchObject({ mailing: "12", tab: "ticked" });
    const unknown = {
      house: "hogwarts",
      status: "sitting",
      party: ["!"],
      flag: ["other", "!other"],
      nation: ["atlantis"],
      email: ["maybe"],
      sort: "age",
    };
    expect(politiciansSearch(unknown)).toEqual({ ...blank, ...unknown, filter: none });
    // A sort the list doesn't have, with a direction, gives the list by name, A to Z.
    for (const sort of ["letters", "replies"]) {
      expect(politiciansSearch({ sort, dir: "desc" }).filter.sort).toEqual({ key: "name", dir: "asc" });
    }
    expect(politiciansSearch({ sort: "emailsFromThem", dir: "asc" }).filter.sort).toEqual({
      key: "emailsFromThem",
      dir: "asc",
    });
    expect(politiciansSearch({ q: "  " }).filter.search).toBeUndefined();
  });

  it("leaves out the test politicians, unless the Marked filter finds them", () => {
    expect(politiciansSearch({ flag: "test" }).filter).toMatchObject({ flags: ["test"], not: undefined });
    expect(politiciansSearch({ flag: ["important", "test"] }).filter.not).toBeUndefined();
    expect(politiciansSearch({ flag: "!test" }).filter).toMatchObject({ flags: undefined, not: { flags: ["test"] } });
  });

  it("is everyone, in office or not, with any status", () => {
    expect(politiciansSearch({ status: "any" }).filter.status).toBeUndefined();
  });
});
