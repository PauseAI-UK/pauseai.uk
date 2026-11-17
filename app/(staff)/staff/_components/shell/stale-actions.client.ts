import "client-only";

/** What Next.js marks the answer to a Server Action it doesn't have with. */
export const ACTION_NOT_FOUND = "x-nextjs-action-not-found";

/** How many draft writers on the page keep their changes across a reload. */
let keeping = 0;

/** Marks the page as keeping a draft's changes across a reload, till the returned function's called. */
export function keepDraftOnReload(): () => void {
  keeping++;
  return () => void keeping--;
}

/** Whether a draft on the page keeps its changes across a reload. */
export const keepsDraft = () => keeping > 0;

/** Who's told of a Server Action the site no longer has, and the fetch they're told of, the page's own. */
const told = new Set<() => void>();
let original: typeof fetch | undefined;

/**
 * Calls `onStale` each time the page calls a Server Action the site no
 * longer has: one of a deploy since the page was opened that renamed, moved
 * or removed it, as every button and form here calls one through fetch.
 * Watches the window's fetch, answering as it would, from the first watcher
 * to the last; returns what stops this one watching.
 */
export function watchStaleActions(onStale: () => void): () => void {
  if (told.size === 0) {
    const real = (original = window.fetch);
    window.fetch = async (...args) => {
      const answer = await real(...args);
      if (answer.headers.get(ACTION_NOT_FOUND) === "1") for (const tell of told) tell();
      return answer;
    };
  }
  told.add(onStale);
  return () => {
    told.delete(onStale);
    if (told.size === 0) window.fetch = original!;
  };
}
