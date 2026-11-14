// Oversight's words: the emails the site has sent, the errors it has seen, and the audit log, which its pages and
// its server code (lib/oversight/) share.
import { count, plural } from "@/lib/content/plural";

export const oversightCopy = {
  sentEmails: {
    // Under the title.
    intro: "Every email the site has sent",
    // Over the list, for an admin without the supporters permission.
    withheld: "Emails to and from supporters are not shown, as you don't have the supporters permission.",
    search: "Address or subject",
    total: (n: number) => count(n, "email", "emails"),
    none: "No emails match.",
    columns: {
      when: "When",
      what: "What",
      to: "To",
      from: "From",
      backend: "Backend",
      subject: "Subject",
      outcome: "Outcome",
      links: "Links",
    },
    purposes: {
      letter: "Letter",
      "letter-copy": "Supporter's copy",
      relay: "Message relayed",
      "supporter-notice": "Notice to supporter",
      "office-notice": "Notice to MP's office",
      "forwarded-reply": "Forwarded reply",
      "staff-login": "Staff sign-in",
      "staff-alert": "Staff alert",
      "staff-report": "Staff report",
      mailing: "Mailing",
      "mailing-test": "Mailing test",
    } as Record<string, string>,
    backends: { postmark: "Postmark", gmail: "Gmail" } as Record<string, string>,
    outcomes: {
      sent: "Sent",
      refused: "Refused",
      failed: "Failed",
      bounced: "Bounced",
      complaint: "Spam complaint",
    } as Record<string, string>,
    imported: "Imported",
    letterLink: "Letter →",
    campaignLink: "Campaign →",
    mailingLink: "Mailing →",
    filters: {
      purpose: "What",
      outcome: "Outcome",
      backend: "Backend",
      links: { letter: "Has a letter", campaign: "Has a campaign", mailing: "Has a mailing" },
    },
  },
  // What went wrong on the site outside a job's run (lib/oversight/errors-seen.server.ts): the admins' list at
  // /staff/errors, one error's page, and the emails to the notification inbox.
  errorsSeen: {
    // Under the list's heading.
    intro: "Server and browser errors",
    total: (n: number) => count(n, "error", "errors"),
    none: "No errors.",
    // The list's two tabs: those still to do, and those an admin has marked done, which go back to the first
    // when they happen again. Then what the Done tab says when it's empty.
    tabs: { label: "Which errors", toDo: "To do", done: "Done" },
    noneDone: "No errors are marked done.",
    columns: {
      what: "Error message",
      kind: "Kind",
      // The route's pattern for the server's, the page's path for a browser's; nothing for a problem.
      page: "Page or route",
      first: "First seen",
      last: "Last seen",
      count: "Times",
      // On the Done tab alone: who marked it done, and when.
      doneBy: "Marked done by",
      doneAt: "Marked done",
    },
    // What was running: Next's four on the server, a problem our code reported, and the browser's two. Of
    // the browser's, the first lost the visitor the page, which went to the error page; the second threw
    // from a click or the like and left the page as it was.
    kinds: {
      render: "Page",
      route: "Route handler",
      action: "Server Action",
      proxy: "Proxy",
      problem: "Problem",
      "browser-page": "Browser: page crashed",
      "browser-other": "Browser: page carried on",
    },
    // One error's page: its title, and its step of the trail above it, then each thing known about it.
    one: {
      title: "Error",
      kind: "Kind",
      page: "Page or route",
      className: "Class",
      code: "Code",
      browser: "Browser of the latest",
      first: "First seen",
      last: "Last seen",
      count: "Times",
      // Over everything under the header, which is the latest time's alone.
      latest: "Details on most recent time",
      // Over its message as it was thrown, numbers, addresses and all; then over its stack trace.
      message: "Error message",
      stack: "Stack trace",
      noStack: "No stack trace.",
      // The button that takes it off the list to do until it happens again; then, once it's done, who marked
      // it and when, and the button that puts it back.
      markDone: "Mark as done",
      doneBy: (by: string, at: string) => `Marked done by ${by}, ${at}.`,
      undo: "Mark not done",
    },
    // The emails. `where` is the kind and the route; `words` the error's, with what varies taken out.
    email: {
      // An error on the server, or a problem.
      server: {
        subject: (words: string) => `Error on pauseai.uk server: ${words}`,
        first: (where: string, words: string, link: string) =>
          `Something new went wrong on pauseai.uk.\n\n${where}\n${words}\n\nYou'll be emailed about it again at most once a day. More info: ${link}`,
        again: (where: string, words: string, since: number, total: number, link: string) =>
          `This is still going wrong on pauseai.uk. ${count(since, "more time", "more times")} since the last email about it, ${total} in all.\n\n${where}\n${words}\n\nMore info: ${link}`,
      },
      // An error in a visitor's browser that lost them the page. Its words aren't quoted, as anyone can post them.
      browser: {
        subject: (page: string) => `Browser error on pauseai.uk: ${page}`,
        first: (where: string, link: string) =>
          `A page fell over in someone's browser, in a way that hasn't been seen in the last month.\n\n${where}\n\nYou'll be emailed about it again at most once a day. More info: ${link}`,
        again: (where: string, since: number, total: number, link: string) =>
          `A page is still falling over in people's browsers. ${count(since, "more time", "more times")} since the last email about it, ${total} in all.\n\n${where}\n\nMore info: ${link}`,
      },
      // In place of an hour's sixth email about the server's errors, or fourth about the browser's; then no more that hour.
      many: {
        subject: "Many new server errors on pauseai.uk",
        body: (link: string) =>
          `Several different things have gone wrong on the site in the last hour, so no more emails about new errors will be sent for now.\n\nMore info: ${link}`,
      },
      manyBrowser: {
        subject: "Many new browser errors on pauseai.uk",
        body: (link: string) =>
          `Pages have fallen over in people's browsers in several different ways in the last hour, so no more emails about new ones will be sent for now.\n\nMore info: ${link}`,
      },
    },
  },
  changes: {
    // Over the list, for an admin without the supporters permission.
    withheld: "Entries about supporters are not shown, as you don't have the supporters permission.",
    title: "Audit log",
    // Under the title.
    intro: "Every action taken by staff or by syncing",
    // Over the list: how many entries there are.
    total: (n: number) => count(n, "entry", "entries"),
    none: "No entries match.",
    // The search box: what it searches. The details include whom an entry is about.
    search: "Who, what or details",
    // The column of the day, before the time.
    day: "Date",
    at: "When",
    actor: "Who",
    action: "What",
    details: "Details",
    // In the details: someone no longer here (erased, or never named), by their ID.
    gone: (id: string) => `#${id}`,
    noPermissions: "No permissions",
    // A saved filter saved, changed or deleted: which list it's on, and its ID, never its name.
    savedFilter: (list: string, id: string) => `${list}, saved filter ${id}`,
    // A held MP import decided, linked to the import's page.
    run: (id: string) => `Import run ${id}`,
    // After each number an import, a sync, an erasure or the end of sessions logged: what it counted, for one and for more.
    counts: {
      added: () => "added",
      removed: () => "removed",
      changed: () => "changed",
      matched: () => "matched",
      imported: () => "imported",
      heldBack: () => "held back",
      alreadySet: () => "already signed",
      problems: (n: number) => plural(n, "problem", "problems"),
      lumaUsers: (n: number) => plural(n, "Luma person", "Luma people"),
      formEntries: (n: number) => plural(n, "form entry", "form entries"),
      letters: (n: number) => plural(n, "letter", "letters"),
      members: (n: number) => plural(n, "member record", "member records"),
      proxies: (n: number) => plural(n, "proxy", "proxies"),
      messages: (n: number) => plural(n, "message in the letters inbox", "messages in the letters inbox"),
      sessions: (n: number) => plural(n, "session", "sessions"),
    } as Record<string, (n: number) => string>,
  },
};
