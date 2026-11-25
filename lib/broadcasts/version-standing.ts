// How a version of a text stands with WhatsApp, as its writer works it out:
// the text's own version and its second, by the same rule.

/** A template as far as a version's standing goes. */
type Template = { id: number; status: string };

/** How one version of a text stands with WhatsApp. */
export type VersionStanding<T extends Template> = {
  /** The approved template chosen for it: its words, top and buttons are the template's. */
  chosen: T | undefined;
  /** The template of its words that WhatsApp is reviewing. */
  waiting: T | undefined;
  /** The template of its words that WhatsApp rejected, to say why till they're sent again or a template is chosen. */
  rejected: T | undefined;
  /** Whether its words, top and buttons can't change: they're a chosen template's, or WhatsApp is reviewing them. */
  fixed: boolean;
};

/**
 * How a version stands. `chosenId` is the approved template the page has
 * chosen for it, or none; `stored` is the template the draft has it on, as
 * the page last heard; `approved`, the approved templates, where the one
 * chosen is found, or else is the stored one itself.
 */
export function versionStanding<T extends Template>(
  chosenId: number | null,
  stored: T | null | undefined,
  approved: T[],
): VersionStanding<T> {
  const held = stored?.status === "approved" && stored.id === chosenId ? stored : undefined;
  const chosen = chosenId === null ? undefined : (approved.find((one) => one.id === chosenId) ?? held);
  const waiting = stored?.status === "pending" ? stored : undefined;
  const rejected = !chosen && stored?.status === "rejected" ? stored : undefined;
  return { chosen, waiting, rejected, fixed: Boolean(chosen ?? waiting) };
}
