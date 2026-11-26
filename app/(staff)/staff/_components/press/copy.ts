import { pressCopy } from "@/lib/press/copy";
import type { NotRead } from "@/lib/press/finds";

// The staff Press page's words (/staff/press).
export const pressPageCopy = {
  ...pressCopy,
  title: "Press",
  // Under the title, "/press" a link to it.
  intro: { before: "News articles about Pause AI that show on ", after: "." },
  waiting: {
    title: "Waiting for you",
    add: "Add to /press",
    // The LLM's (Claude's) verdict, beside its reason.
    verdicts: { ours: "LLM: ours", unclear: "LLM: can't tell", "not ours": "LLM: not ours" },
    noVerdict: "Not judged by the LLM",
    notReadTag: "Couldn't read the page",
    // Why a find couldn't be read after three tries (whyNotRead in lib/press/finds.ts).
    notRead: {
      noAddress: "Google News wouldn't give the article's address.",
      refused: "Couldn't read site with automatic script",
      busy: "The site turned us away for querying it too often.",
      missing: "The page wasn't there.",
      noAnswer: "The site didn't answer.",
    } satisfies Record<NotRead, string>,
  },
  shown: {
    title: "On /press",
    edit: "Edit",
    remove: "Remove",
    save: "Save",
    // Opens the form for a piece staff found themselves.
    addPiece: "Add a piece",
    fields: { url: "Link", title: "Headline", outlet: "Outlet", medium: "Kind", date: "Date", note: "Note" },
  },
  // A find's or piece's source, as a tag, by its tier (press_sources): what kind of news it is.
  tiers: {
    1: "UK national",
    2: "Major news",
    3: "Other news",
    4: "Not news",
    // A source the LLM didn't know.
    none: "Unknown source",
  },
  // The folded list of finds and pieces staff removed.
  removed: { title: "Removed" },
  refused: {
    gone: "Someone has decided that one since the page loaded.",
    blank: "A headline is needed.",
    noOutlet: "An outlet is needed.",
    notUrl: "That link isn't a web page's.",
    known: "That piece is on /press already, or was removed from it.",
  },
};
