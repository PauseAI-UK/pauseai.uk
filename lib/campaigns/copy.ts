// The words of asks that the server or pure code uses, as well as the staff
// pages: the asks list, an ask's page and its form, and how an ask leads
// into a politician's answer to it.
import { count, plural } from "@/lib/content/plural";

/**
 * What can't be done to an ask, said on its form and, the same words, when a
 * save or a delete is refused for it (campaignsCopy.asks).
 */
const askLimits = {
  kindFixed: "Kind can't be changed now, as politicians have answered it.",
  named: "The site's own code uses this ask, so it can't be deleted.",
  notDeletable: "Asks can't be deleted while answers, campaigns or mailings refer to them.",
};

export const campaignsCopy = {
  // The asks page: each ask, its kind and date, and how many gave each answer.
  asks: {
    title: "Asks",
    intro: "What we ask notable people to do, either by writing to them or by meeting them",
    edit: "Edit",
    // The form, adding an ask or editing one; the new one's title is the asks page's button to it, too.
    newTitle: "New ask",
    editTitle: (title: string) => `Edit the ask “${title}”`,
    fields: {
      kind: "We ask them to",
      askedBy: "Who has or will ask them",
    },
    // The rest of the form's fields, by the kind of ask: the title reads on from "sign" or "attend".
    byKind: {
      letter: {
        title: "Which letter",
        titleExample: "Giant pause button funding request to the Chancellor",
        date: "When the letter was started",
        url: "Where to read the letter",
      },
      event: {
        title: "Which event",
        titleExample: "Tea, biscuits and existential risk conference",
        date: "When the event is",
        url: "Where to learn more about the event",
      },
    } as Record<string, { title: string; titleExample: string; date: string; url: string }>,
    // Under the link, in red, while what's in it isn't a whole one.
    badLink: "Give a full link beginning https://",
    // Over an ask's slug, which doesn't change.
    slugLabel: "Identifier: ",
    kindFixed: askLimits.kindFixed,
    named: askLimits.named,
    // Beside the form: the ask as it will show on a politician's page.
    previewTitle: "What the ask will look like on a politician's page",
    save: "Save ask",
    delete: "Delete ask",
    notDeletable: askLimits.notDeletable,
    // After saving or deleting, or failing to.
    notices: {
      added: "Ask added.",
      saved: "Ask saved.",
      deleted: "Ask deleted.",
      // The same as the form says, when a save or a delete is refused for it.
      named: askLimits.named,
      "kind-in-use": askLimits.kindFixed,
      "in-use": askLimits.notDeletable,
      gone: "That ask has been deleted.",
    } as Record<string, string>,
    none: "No asks yet.",
    // Over the list's upcoming events; the rest go under their months and years.
    comingUp: "Coming up",
    kinds: { letter: "Sign a letter", event: "Attend an event" } as Record<string, string>,
    // Over a mailing's or campaign's ask, and before it on their lists.
    askTo: { letter: "Ask to sign", event: "Ask to attend" } as Record<string, string>,
    noAsk: "No ask",
    // An ask's own page.
    page: {
      asked: "Asked",
      when: "When",
      on: "On",
      readIt: { letter: "Read it", event: "Find out more" } as Record<string, string>,
      theLink: { letter: "The letter", event: "The event" } as Record<string, string>,
      writtenTo: "written to",
      lettersWord: (n: number) => plural(n, "letter", "letters"),
      replied: "replies",
      howWeAsked: "How we asked",
      answersTitle: "Answers",
      // Pressing the answer chosen goes back to all its columns.
      showAll: "Show all the answers",
      // The column of the "other" answers, each tagged with its note.
      otherAnswers: "Other answers",
      // At the foot of a column with more people than it shows.
      allOf: (n: number) => `All ${n.toLocaleString("en-GB")} →`,
      none: "No answers yet.",
      noWay: "No mailing or campaign has put this.",
      politician: "Politician",
      answer: "Answer",
      lastWrittenTo: "Last written to",
      // Under the answers: leads to the politicians list, filtered to those who answered this ask.
      everyone: "All answers in Politicians →",
      letters: (n: number) => count(n, "letter", "letters"),
    },
    askedBy: { supporters: "Supporters", pauseai: "PauseAI", controlai: "ControlAI" },
    // Over an ask's title on a politician's page, leading into it: who asked them, by askedBy, if we know, and to do what.
    askedThem: (who: string, kind: string) =>
      `${who ? `${who} asked` : "Asked"} them to ${kind === "letter" ? "sign" : "attend"}`,
    // Over the campaigns and mailings that asked it, on the list of asks.
    waysOf: { campaign: "Supporter campaigns", mailing: "PauseAI mailings" },
    noAnswers: "No answers yet",
  },
};
