// Every word of politicians that only the staff pages show: the page of
// their blocked addresses, and choosing who a mailing is for on their list,
// with those the server uses too (lib/politicians/copy.ts).
import { count, plural } from "@/lib/content/plural";
import { politiciansCopy as wordsTheServerUses } from "@/lib/politicians/copy";

export const politiciansCopy = {
  ...wordsTheServerUses,
  // The page of politicians' blocked addresses (/staff/politicians/addresses-to-fix), titled as the navigation
  // names it; the rest of its words are every blocked address's (emailCopy.emails).
  addressesToFix: {
    title: "Addresses to fix",
    // Under the title, what the page is.
    intro: "Politicians' bad emails: unblock them here, or correct a Lord's on their page",
  },
  // Choosing who a mailing is for, on the politicians list, and starting one there; the mailings' pages
  // name a new mailing and one with no one ticked the same way.
  choosing: {
    // A new mailing's page's title, and the button that starts an empty one: on the mailings page, and on the politicians list with no filter.
    newTitle: "New mailing",
    // On the politicians list with a filter: the button that starts one to everyone it finds.
    mailThese: (n: number) => plural(n, "Mail this one…", `Mail these ${n}…`),
    // Choosing who a mailing is for on the politicians list: at the top, for a new mailing or for a draft named by its title,
    // and under that what to do.
    choosingNew: "Choose who the new mailing goes to",
    choosingDraft: (title: string) => `Change who the mailing “${title}” goes to`,
    // What to do, for a draft and for a new mailing. Not on a phone, where the title is enough.
    choosingHow: "Tick each person it's for. The mailing is immediately updated as you tick.",
    choosingHowNew: "Tick each person it's for. Then press the “Write to these” button.",
    // Beside it, for a new mailing: deleting it.
    cancelNew: "Cancel",
    backToDraft: "Back to the draft",
    // The tab after the houses, showing only those ticked.
    pickedTab: "Ticked",
    // The tab after it, once names are pasted: who each line found.
    pastedTab: "Paste names",
    // A row's tick box, and the one in the heading that ticks everyone the filters find, on every page.
    tick: (name: string) => `Tick ${name} for the mailing`,
    tickAll: (n: number) => `Tick all ${n} found, on every page`,
    // In the bar at the foot: the button that opens a box for names, one a line, and the box's button.
    pasteNames: "Paste names…",
    pasteLabel: "Paste names, constituencies or emails. You can just copy and paste text from a whole page.",
    pasteTick: "Find these",
    // Under it after a paste, the politicians list's table, a row for each person a line found, with their
    // tick box, and last the reason they're there: by their name, more than one match, or only near it.
    pastedTitle: "Names pasted",
    pastedTickAll: (n: number) => `Tick all ${n} found`,
    pastedFound: "Reason",
    pastedBy: {
      name: "Their name",
      constituency: "Their constituency",
      email: "Their email",
      words: "Part of their name or constituency",
    } as Record<string, string>,
    pastedSome: "More than one match: tick the right one",
    pastedNone: "No exact match: nearest name",
    // Under it: how many lines found no one; or, if none did, that.
    pastedSkipped: (n: number) => `Couldn't find a politician on ${count(n, "line", "lines")}.`,
    pastedNoOne: "None found.",
    // In the bar at the foot of the list: how many are ticked, and the button on to the draft.
    choosingCount: (n: number) => `${n} ticked for the mailing`,
    seeTicked: "See them",
    untickAll: "Clear all ticks",
    noneTicked: "Tick who it's for",
    writeToThese: (n: number) => plural(n, "Write to this one", `Write to these ${n}`),
    // The same, greyed, while no one's ticked.
    writeToNone: "Write to these",
    useThese: (n: number) => plural(n, "Use this one", `Use these ${n}`),
    // Who a mailing's for, before anyone's ticked.
    pickedNone: "No one ticked yet",
  },
};
