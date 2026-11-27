// The words of politicians that the server or pure code uses, as well as
// the staff pages: the politicians list, its filters and a politician's page,
// the imports of each body's members, and the problems finding an MP and
// searching for an address report. The staff pages' own are in
// app/(staff)/staff/_components/politicians/copy.ts.
import type { Body, Honour } from "./import-changes";
import { defineProblems, listed, type SafeText } from "@/lib/problems";
import { count, plural } from "@/lib/content/plural";
import { staffVocabulary } from "@/lib/staff-vocabulary";

/** Each body, as a sentence names it after its start. */
const bodyNames: Record<Body, string> = {
  parliament: "Parliament",
  "scottish-parliament": "the Scottish Parliament",
  senedd: "the Senedd",
  "ni-assembly": "the Northern Ireland Assembly",
};

export const politiciansCopy = {
  politicians: {
    title: "Politicians",
    // Under the title.
    intro: "MPs, Lords and other notable people we write to and meet",
    // The search box's label: what it searches.
    search: "Name, constituency, party or email",
    allHouses: "All houses",
    // The filters: in office or not, the marks, and an answer to an ask.
    status: "Status",
    // When they agreed to an ask, signing or going: the last so many days.
    agreedIn: "Agreed",
    anyStatus: "Any status",
    // The Email filter's choices: whether we can write to them.
    emailStates: {
      yes: "Has an address",
      none: "No address",
      blocked: "Address blocked",
    } as Record<string, string>,
    flag: "Marked",
    ask: "Ask",
    // How they stand on the ask chosen, in the second half of the ask's chip, its menu named after the ask. With
    // no ask, as a link from the dashboard can have it, its own chip.
    answer: "Answer",
    // In the ask's menu, under everyone asked: those who gave any answer, the answers set in under it.
    anyReply: "Any reply",
    // A filter: those a mailing about an ask has gone or is going to.
    mailed: "Mailed about",
    none: "None found.",
    // Over the list: how many there are.
    total: (total: number) => count(total, "politician", "politicians"),
    // Under the list, when a search of those in office finds others too, linked to them all.
    outOfOffice: (n: number) => `${count(n, "match", "matches")} found for politicians not in office`,
    // The same, when a search of one house finds no one there, linked to every house.
    otherHouses: (n: number) => `${count(n, "match", "matches")} found for politicians in other houses`,
    // The same, when a search finds no one, but would among the test politicians, linked to them.
    tests: (n: number) => `${count(n, "match", "matches")} found for test politicians`,
    // Over the nearest names, when a search finds no one.
    closest: "No one matches exactly. These are close matches:",
    // The counts in the list, as their page's band has them: the emails that went to them, and those that came from them.
    columns: {
      emailsToThem: "Emails to them",
      emailsFromThem: "Emails from them",
      status: "Status",
      // Their answer to each ask they've answered.
      asks: "Asks",
      // The first and last letter to them, reply, answer to an ask, or one-off email either way.
      first: "First activity",
      last: "Last activity",
    },
    // In that column, when they've answered none.
    noAsks: "None",
    noEmail: "No email",
    // On a politician whose address is blocked (/staff/politicians/addresses-to-fix).
    emailBlocked: "Email blocked",
    // The button on an ask staff record by hand.
  },
  politician: {
    statusesTitle: "Asks",
    // At the top right of their page, before where they came from.
    source: "Source:",
    sources: {
      airtable: "Airtable",
      staff: "Added by staff",
      test: "A test MP",
      // Their body's list, linking to their page on its site.
      parliament: "UK Parliament",
      "scottish-parliament": "the Scottish Parliament",
      senedd: "the Welsh Parliament",
      "ni-assembly": "the Northern Ireland Assembly",
    },
    // The card of the marks staff set, under their notes, each a switch.
    marks: "Marks",
    // What staff keep by hand, in the band's bubbles: their salutation and email.
    editDetails: {
      salutation: "Salutation",
      email: "Email",
      // Where a Lord's email would be, when they have none: why it's theirs to set.
      emailHint: "Most Lords have no public email, so set one you find here",
      // Each line's button, which opens its field, and the one that closes it unsaved.
      edit: "edit",
      // Over the email field in the band's bubble: the address letters go to, and what that means, ghosted.
      mainEmail: "Main address",
      mainIntro: "We send letters and emails to this address.",
      // Under it, ghosted, where it came from. Set by staff, it says why and who, as an ask's answer does (setBy);
      // one their body lists says so in the words of the other addresses' sources; and one that came from
      // Airtable's UK Parliamentarians, which the policy team kept, and no body lists.
      fromAirtable: "From Airtable",
      // In the band, for a Lord with no email: opens the bubble to set one.
      add: "add email",
      cancel: "Cancel",
      // A salutation that's empty.
      none: "None yet",
      // Before the salutation, as a letter to them starts: Letters start "Dear Dame Meg,".
      lettersStart: "Letters start",
      // In the bubble of a salutation made from their name, as their gender isn't known, before Ms and Mr with their surname.
      fromName: "We don't know their gender, so this is just their name. Pick one:",
      dear: (salutation: string) => `“Dear ${salutation},”`,
      // The field under the email, which must say why it's being changed: its name, and what it asks.
      note: "Why",
      notePlaceholder: "Why are you changing it?",
      save: "Save",
      saved: "Saved.",
      refused: {
        salutation: "A salutation can't be empty.",
        email: "That doesn't look like an email address.",
        shared: "That's the House of Lords' shared inbox.",
        note: "Say why you're changing their email.",
        gone: "This politician can't be edited.",
      },
    },
    // Who set something and when, as under an email address. An ask's answer says only who, as its date is beside
    // it; an import's is "from" it.
    setBy: (who: string, when: string) => `set by ${who}, ${when}`,
    answerSetBy: (who: string) => `set by ${who}`,
    fromImport: {
      airtable: "from Airtable",
      controlai: "from ControlAI's letter",
      parliament: "from Parliament",
    } as Record<string, string>,
    // The form on an ask staff record: its name, the note's field and what it asks, and Save for an event's answer.
    setStatus: "Set status",
    note: "Note",
    notePlaceholder: "What did they say?",
    // Why an answer wasn't saved, under its form.
    answerRefused: {
      // Its note is only spaces.
      blank: "Add a note.",
    },
    // Under the answer to an ask staff record: opens the form to change it.
    edit: "Edit",
    // Under a reply to a mailing's letter: opens the same form, to set their answer from what they said.
    setAnswer: "⁂ Set answer",
    save: "Save",
    // Under the asks, the small button whose menu lists the other asks staff record, to add one to the card.
    otherAsk: "Add another answer",
    // The fields of the box at the top.
    status: "Status",
    country: "Nation",
    // The marks staff set, by their name.
    importantTarget: "Important target",
    personalConnection: "Personal connection",
    // The band at the top of their page: where their record came from, and the counts at its right.
    band: {
      // The asks they signed or are going to.
      asksAgreed: (n: number) => plural(n, "ask agreed", "asks agreed"),
      emailsToThem: "emails to them",
      emailsFromThem: "emails from them",
    },
    // Their letters and threads, each with who wrote and when, a line of steps with arrows between.
    correspondence: {
      title: "Correspondence",
      none: "No emails yet.",
      wrote: (name: string, date: string) => `${name} wrote ${date}`,
      replied: (name: string, date: string) => `${name} replied ${date}`,
      sent: (date: string) => `PauseAI sent ${date}`,
      usReplied: (date: string) => `PauseAI replied ${date}`,
      auto: (date: string) => `Automatic reply ${date}`,
      // Who replied, when the message doesn't say.
      office: "Their office",
      // At the end of the steps, when nothing's come back from them.
      noReply: "no reply",
      // Opens the rest of the threads, in place: how many there are in all.
      all: (n: number) => `All ${n}`,
      // The switch at the card's top right: every thread, or those they've really replied on.
      allEmails: "All emails",
      repliesOnly: "Replies only",
    },
    // In the history, a one-off thread with someone else in it: who it's from, and its subject.
    emailFrom: (name: string) => `Email from ${name}`,
    // Under the history: edits to their record and their address blocked or unblocked, with who.
    recordTitle: "Changes to their record",
    historyTitle: "History",
    // A status set or cleared, in the history: around the ask's name.
    statusSet: (status: string) => ({ before: `${status} '`, after: "'" }),
    statusCleared: { before: "Answer cleared for '", after: "'" },
    noHistory: "Nothing yet.",
    // What each line of the history was: a letter, a reply, or an entry of the audit log about them.
    history: {
      letter: "Letter from",
      "letter-replied": "Replied to the letter from",
      // Without the supporters permission, a letter doesn't say who wrote it.
      unsignedLetter: "Letter written to them",
      "unsigned-letter-replied": "Replied to a letter",
      // A letter of one of PauseAI's mailings, by its mailing, and how it was written.
      "pauseai-letter": "Email from PauseAI:",
      "add politician": "Added",
      "edit politician": "Edited",
      "remove politician": "No longer in Airtable",
      "block address": "Address blocked",
      "unblock address": "Address unblocked",
      // Before the address, and staff's note of why it was added.
      "add politician address": "Linked address added",
      "remove politician address": "Linked address removed",
    } as Record<string, string>,
    // At the foot of their page, folded: every address and domain that says an
    // email is theirs, where each came from, and the form to add one by hand.
    aliases: {
      // After their email at the top of the page, opening the bubble of every
      // other address that links their emails, where they're changed.
      more: (n: number) => `+${n} more`,
      title: "Linked addresses",
      intro: "Policy emails using these will be linked to this politician.",
      columns: { address: "Address", from: "Source" },
      sources: {
        email: "Main address, we send email here",
        past: "Previous main address",
        // By the body whose list has it, from their house: Parliament's for MPs and Lords.
        parliament: (house?: string) =>
          house && house !== "parliament" && Object.hasOwn(bodyNames, house)
            ? `Listed on ${bodyNames[house as Body]}'s website`
            : "Listed on Parliament's website",
        office: "Inferred as being a member of their staff as in emails with them",
        domain: "Their own domain, taken from a list on Parliament website",
        form: "Variant format Parliament often uses",
      },
      // An address staff added: who and when, after their note of why, if any.
      addedBy: (by: string, when: string) => `Added by ${by} on ${when}`,
      remove: "Remove",
      // Under the list, the button that opens the form to add one; and the form's fields, its address and why.
      address: "New address",
      add: "Add",
      note: "Why",
      notePlaceholder: "Why is this address theirs?",
      refused: {
        invalid: "That doesn't look like an email address.",
        exists: "That address is already listed.",
        note: "Say why this address is theirs.",
        // The House of Lords' shared inbox, which forwards to the Lord a message names: no one's own.
        shared: "That's the House of Lords' shared inbox, which would be confusing to link to.",
        // At the top of the page, when the politician was removed after the page loaded.
        gone: "This politician has been removed, so the address couldn't be added.",
      },
    },
    // On an ask that isn't set by hand: where its statuses come from.
    importedAsk: "set each night by an import",
    personalised: "personalised",
    // Under their name: what they are, in their house, and where for.
    roles: {
      commons: "MP",
      lords: "Member of the House of Lords",
      "scottish-parliament": "MSP",
      senedd: "MS",
      "ni-assembly": "MLA",
      other: "Politician",
    } as Record<string, string>,
    role: (role: string, constituency: string | null, inOffice: boolean) =>
      `${inOffice ? "" : "Formerly "}${role}${constituency ? ` for ${constituency}` : ""}`,
    notFound: "Politician not found.",
    // Under their name, when their address is blocked: what's happened, what to check, and the form.
    blocked: {
      title: "Letters to this MP aren't being sent",
      // Around the address, which is in bold. Postmark's reason sometimes ends in a full stop and sometimes doesn't.
      why: {
        before: "Email to ",
        after: (reason: string, since: string) => ` bounced on ${since} with the error: ${reason.replace(/\.+$/, "")}.`,
      },
      // Under it, two things to do, side by side. If the address is wrong: correct it
      // from their email in the band, which opens its bubble. A new address isn't blocked.
      wrong: {
        title: "Address wrong?",
        before: "Correct it from ",
        link: "their email",
        after: ", above. The new address isn't blocked.",
      },
      // If the address is right: unblock it, with the note of why.
      right: {
        title: "Address right?",
        text: "If the bounce was a one-off, unblock it.",
      },
    },
  },
  // The nightly imports of each body's members from its own list (lib/politicians/imports.server.ts).
  politicianImports: {
    titles: {
      "import-parliament": "MPs and Lords from UK Parliament",
      "import-scottish-parliament": "MSPs from the Scottish Parliament",
      "import-senedd": "MSs from the Senedd",
      "import-ni-assembly": "MLAs from the Northern Ireland Assembly",
    },
    // Each with a link to the body's list in the middle.
    intros: {
      "import-parliament": {
        before: "Imports MPs and Lords from ",
        link: "Parliament's list",
        after: ".",
      },
      "import-scottish-parliament": {
        before: "Imports MSPs from ",
        link: "the Scottish Parliament's list",
        after: ".",
      },
      "import-senedd": {
        before: "Imports MSs from ",
        link: "the Senedd's list",
        after: ".",
      },
      "import-ni-assembly": {
        before: "Imports MLAs from ",
        link: "the Northern Ireland Assembly's list",
        after: ".",
      },
    },
    // After the description: when a run waits for staff to check it.
    held: "If there are more than 20 changes, or a rename, the changes are held until applied.",
    // Each import's button.
    importNow: {
      "import-parliament": "Import MPs and Lords now",
      "import-scottish-parliament": "Import MSPs now",
      "import-senedd": "Import MSs now",
      "import-ni-assembly": "Import MLAs now",
    },
    result: (r: { added: number; changed: number; left: number }) =>
      `${r.added} added, ${r.changed} changed, ${r.left} left.`,
    added: "Added",
    changed: "Changed",
    left: "Left",
    // Someone whose name changed, which may be a mistake in matching: from, to.
    renamed: "Renamed",
    // An MP whose constituency isn't spelt as the official list has it, so no postcode would find them.
    unofficial: "Constituency names no postcode would find",
    // Politicians linked to their body's list for the first time whose salutation by rule isn't ours: ours, then the rule's.
    salutations: "Salutations unlike the rule's",
    // Parliament's: constituencies with no MP in office, as before a by-election.
    vacant: (n: number) => `${count(n, "constituency", "constituencies")} with no MP.`,
    noMp: "Constituencies with no MP",
    // After an import, the one-off emails are linked again to the politicians
    // their addresses now match: what that did.
    relinked: (r: { read: number; unread: number; linked: number; unlinked: number; offices: number }) =>
      `One-off emails: ${count(r.linked, "new link", "new links")} to politicians, ${r.unlinked} removed, ${count(r.offices, "office address", "office addresses")} found.` +
      (r.read || r.unread
        ? ` ${count(r.unread, "older email", "older emails")} still to check for quoted addresses.`
        : ""),
    noEmail: "None",
    apply: "Apply",
    discard: "Discard",
  },
  // Whether a notable person is in office: the shared words, as asks' pages say it too.
  personStatuses: staffVocabulary.personStatuses,
  // The emails to the notification inbox (lib/email/notifications.server.ts) about a body's import.
  notifications: {
    // A body's import is held, as it would change too much: which import, how many politicians, and its page.
    importHeld: {
      subject: (job: string, changes: number) => `${job} would change ${changes} politicians`,
      body: (job: string, changes: number, link: string) =>
        `${job} would change ${changes} politicians, so it's held until someone checks it. Review it, then apply or discard it:\n\n${link}`,
    },
  },
};

// What went wrong without stopping the work (lib/problems.ts). All but mpLookupFailed are on a job's run, so on its
// page and in the email. A politician's name, salutation and constituency are public.
export const politicianProblems = defineProblems("politicians", {
  // On the Gmail read's run: searching the mailboxes for an address staff added to a politician failed, so its
  // earlier mail may not be kept. The politician is named by their ID here, as the address may be a person's own.
  addressNotSearched: (p: { politician: number }) =>
    `Couldn't search policy@ and Joseph's inbox for an address added to politician ${p.politician}`,
  // No job reaches this: it's kept as an error (lib/oversight/errors-seen.server.ts), on the errors page and emailed
  // to staff. A visitor looking up their MP is told it failed.
  mpLookupFailed: "The MP lookup failed",
  // An import: Wikidata couldn't be asked, so new MSPs' or MSs' salutations are their names until the next run.
  genderLookupFailed: "Couldn't ask Wikidata for new members' genders, so their salutations are their names for now",
  // Parliament's import: constituencies with two MPs in office, so a postcode there finds the wrong one.
  twoMps: (p: { constituencies: readonly SafeText[] }) =>
    `Constituencies with two MPs in office: ${listed(p.constituencies)}`,
  // An import: a salutation staff set by hand, which the import keeps, unlike the one the title their body records
  // makes.
  keptSalutation: (p: { name: SafeText; ours: SafeText; body: Body; theirs: SafeText }) =>
    `${p.name}: staff set ${p.ours}; ${bodyNames[p.body]} records ${p.theirs}`,
  // An import: a salutation that doesn't spell its politician's name as the name is written, case and all, such as
  // a slip in typing.
  misspeltSalutation: (p: { name: SafeText; salutation: SafeText }) =>
    `${p.name}: the salutation ${p.salutation} doesn't spell the name as it's written`,
  // An import: Wikidata says a politician is Sir or Dame, and their salutation doesn't.
  missingHonour: (p: { name: SafeText; salutation: SafeText; honour: Honour }) =>
    `${p.name}: Wikidata says ${p.honour}, but the salutation is ${p.salutation}`,
  // An import: Wikidata couldn't be asked who's Sir or Dame, so no salutation was checked for it.
  honourLookupFailed: "Couldn't ask Wikidata who's Sir or Dame, so no salutation was checked for it",
});
