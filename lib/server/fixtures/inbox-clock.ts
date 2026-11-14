// The fake letters inbox's clock (letters-inbox.ts): its history IDs come
// from the time. A file of its own, as the storyboard starts each flow's
// reading of the inbox from it, and every flow would otherwise import the
// whole fake.

/** A history ID no message has yet, from the clock: where a fresh flow's reading of the letters inbox starts. */
export function historyIdNow(): number {
  return Date.now() * 1000;
}
