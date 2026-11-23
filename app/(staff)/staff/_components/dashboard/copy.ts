// The dashboard's words: the staff home page.
import { count, plural } from "@/lib/content/plural";

export const dashboardCopy = {
  // The home page: the dashboard.
  home: {
    title: "Dashboard",
    // The dashboard: what needs a person, then the window's numbers in
    // three groups, each against the window before.
    dashboard: {
      // What's waiting for someone, shown only when something is: each kind of item, its detail, and its button.
      // The list's name, read out by a screen reader; not shown.
      actionsTitle: "Needs a person",
      actions: {
        // A body's import held, as it would change too much: which, and how many politicians.
        heldImport: (job: string, changes: number) => `${job} would change ${changes} politicians`,
        // Why it's held, and what to do.
        heldImportDetail:
          "That's a lot of politicians, or someone's name has changed, so please check it, and apply or discard it.",
        decide: "Review import",
        blockedMp: (name: string) => `${name}'s email is bouncing`,
        blockedMpDetail: "Find a working email for this MP if it has changed, or unblock if working now.",
        openMp: "Fix MP email",
        failedImport: (job: string) => `Import '${job}' failed`,
        failedImportDetail: (error: string, at: string) => `Error: "${error}" · ${at}`,
        seeRun: "See failed run",
        // The newest read of Gmail found mail in the letters inbox it couldn't handle: when, and where it waits.
        lettersInboxDetail: (at: string) =>
          `Open each in Gmail and deal with it by hand: forward it, answer it, or leave it. Found ${at}.`,
        // Its button, to the run's page, which lists each with why it wasn't relayed and a link to it in Gmail.
        lettersInboxButton: "See emails",
        // Replies to one broadcast, by email or text, waiting for someone to answer or record them: a line each broadcast.
        broadcastReplies: (n: number, title: string) => `${count(n, "reply", "replies")} to "${title}" to check`,
        broadcastRepliesDetail: "Answer them promptly, and record anyone asking to stop as an opt-out.",
        broadcastRepliesButton: "See replies",
        // Politicians' replies to one mailing waiting for someone to answer them, set their answer to its ask, or say
        // there's nothing to do: a line each mailing, its title and button as a broadcast's.
        mailingRepliesDetail: "⁂ Answer them, or record what they said about the ask.",
      },
      // The windows: each a tab, its length in days; "Show" is the tabs' name, read out by a screen reader.
      window: (days: number) => `${days} days`,
      windows: "Show",
      // After each number: what it counts, for one and for more.
      metrics: {
        lettersSent: (n: number) => plural(n, "supporter email to politicians", "supporter emails to politicians"),
        lettersReplied: (n: number) => plural(n, "reply from politicians", "replies from politicians"),
        politiciansAgreed: (n: number) => plural(n, "politician agreed to an ask", "politicians agreed to an ask"),
        eventRegistrations: (n: number) =>
          plural(n, "person registered for an event", "people registered for an event"),
        eventsHeld: (n: number) => plural(n, "event held", "events held"),
        supportersAdded: (n: number) => plural(n, "new supporter", "new supporters"),
        // Supporters who stopped any consent: an unsubscribe, from Luma, CiviCRM or anywhere else.
        unsubscribes: (n: number) => plural(n, "new opt-out", "new opt-outs"),
      } as Record<string, (n: number) => string>,
      // A count of nothing, instead of a 0.
      none: "No",
      // Under the number: against the window before.
      change: {
        up: (n: number, days: number) => `▲ ${n} on the ${days} days before`,
        down: (n: number, days: number) => `▼ ${n} on the ${days} days before`,
        same: (days: number) => `Same as the ${days} days before`,
      },
      // A sparkline's name, which only screen readers read: the tile's label
      // ("event registrations"), and the span the line covers.
      series: (what: string, days: number, points: number) =>
        days === 7
          ? `Sparkline of ${what}, week by week over the last ${points} weeks`
          : `Sparkline of ${what}, ${days} days at a time over the last ${days * points} days`,
      // The chart of new supporters' name, which only screen readers read.
      bySourceName: (what: string, days: number, points: number) =>
        days === 7
          ? `Bars of ${what} by source, week by week over the last ${points} weeks`
          : `Bars of ${what} by source, ${days} days at a time over the last ${days * points} days`,
      // A point's label: the window it counts, by the day it begins.
      seriesPoint: (days: number, from: string, n: number) =>
        days === 7 ? `Week beginning ${from}: ${n}` : `${days} days beginning ${from}: ${n}`,
    },
  },
};
