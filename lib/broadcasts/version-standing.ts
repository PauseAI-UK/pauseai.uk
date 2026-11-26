import { sameTemplate } from "./broadcasts";
import type { TextTemplateParts } from "./text-parts";

// How a variant of a WhatsApp broadcast stands with WhatsApp, as its writer
// works it out from what's written: the default variant and the conditional
// one, by the same rule. The page keeps no note of which variant its words
// are; it's told by the words.

/** A variant as far as its standing goes: its words, header kind and buttons, and how it is with WhatsApp. */
type Variant = TextTemplateParts & { id: number; status: string };

/** How one variant of a broadcast stands with WhatsApp. */
export type VersionStanding<V extends Variant> = {
  /** The approved variant its words are, with its header kind and buttons: those words needn't go for approval. */
  approved: V | undefined;
  /** The same, while its words are fixed as that variant's: not once they're being edited as a new template. */
  chosen: V | undefined;
  /** The variant of its words that WhatsApp is reviewing. */
  waiting: V | undefined;
  /** The variant of its words that WhatsApp rejected, to say why till they're sent again or are an approved one's. */
  rejected: V | undefined;
  /** Whether its words, header kind and buttons can't change: they're an approved variant's, or WhatsApp is reviewing them. */
  fixed: boolean;
};

/**
 * How a variant stands. `parts` are its words, header kind and buttons as
 * written; `stored` is the variant the draft has for it, as the page last
 * heard; `approved`, the variants WhatsApp has approved; `editing`, whether
 * staff are editing an approved template's words as a new one, which frees
 * them to change.
 */
export function versionStanding<V extends Variant>(
  parts: TextTemplateParts,
  stored: V | null | undefined,
  approved: V[],
  editing: boolean,
): VersionStanding<V> {
  const waiting = stored?.status === "pending" ? stored : undefined;
  const same = (one: V) => one.status === "approved" && sameTemplate(parts, one);
  const match = waiting ? undefined : stored && same(stored) ? stored : approved.find(same);
  const chosen = editing ? undefined : match;
  const rejected = !match && stored?.status === "rejected" ? stored : undefined;
  return { approved: match, chosen, waiting, rejected, fixed: Boolean(chosen ?? waiting) };
}
