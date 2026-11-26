import { defineProblems, type SafeText } from "@/lib/problems";

export const pressCopy = {
  // The nightly press survey, on /staff/scheduled-jobs.
  job: {
    title: "Press survey",
    // Under the title: what it does, ending in a link to the Press page, where its finds wait.
    intro: {
      before:
        "Searches Google News for pieces that mention PauseAI, reads each one, and asks an LLM whether it's coverage of us. Results are on the ",
      link: "Press page",
      after: " for staff approval.",
    },
    importNow: "Search now",
    // A run's summary: what it searched, found and read, and how many are left to read.
    result: ({ found, read, waiting, left }: { found: number; read: number; waiting: number; left: number }) =>
      `${found} new found, ${read} read, ${waiting} waiting for staff${left > 0 ? `, ${left} left to read` : ""}.`,
  },
  // The email to the notification inbox once a night's reading is done, if it found pieces that may be ours.
  waitingEmail: {
    subject: (count: number) => `${count} press ${count === 1 ? "find" : "finds"} waiting`,
    // `finds`: each find's outlet, headline and address; `link`: the staff Press page.
    body: ({ finds, link }: { finds: { outlet: string; title: string; url: string }[]; link: string }) =>
      [
        "The press survey found these pieces, which may be coverage of PauseAI. Approve them to publish or remove them on the staff Press page.",
        "",
        ...finds.flatMap((find) => [`${find.outlet}: ${find.title}`, find.url, ""]),
        link,
      ].join("\n"),
  },
};

export const pressProblems = defineProblems("press", {
  // Google News didn't answer a search of the week after `after`, or answered with something that isn't its feed.
  // That week, and those after it, are searched again the next night.
  searchFailed: (p: { after: SafeText }) =>
    `Google News didn't answer a search for the week after ${p.after}, we'll try again tomorrow`,
  // A find's link couldn't be turned into its article's address, or its page couldn't be read. It's tried again the
  // next time, and after three tries left for staff to read themselves.
  findNotRead: (p: { find: number }) => `Couldn't read press find ${p.find}`,
  // Google blocked us partway through a run; the articles left are read next run.
  googleBlocked: "Google blocked us partway through, so some articles weren't read. They'll be read next run",
  // The LLM (Claude) couldn't be asked about the news sites a run met first, so their finds are sorted as tier 3 for
  // now; they're asked about again next run.
  sourcesNotJudged: (p: { sites: number }) =>
    `Couldn't ask the LLM about ${p.sites} new news sites, so their finds are sorted as other news for now`,
  // The LLM (Claude) didn't answer for the finds read in a run, so they wait for staff without its verdict.
  notJudged: (p: { finds: number }) =>
    `Couldn't reach the LLM. ${p.finds} articles are waiting for you to judge yourself`,
});
