// How copies of something sent to many went, in their states
// (lib/copy-states.ts): each copy's one tag, and the counts of each state,
// in the colours of their tags (docs/style-guide.md, "Status colours").
import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import { DIDNT_GO, STATE_TONES, type StateTone } from "@/lib/copy-states";
import type { Count } from "./ui/Counts";
import type { CountGroup } from "./CopyCounts";

const words = staffCopy.copyStates;

/** A count of each of `keys`, its states, from how many are in each, in the colour of their tags. */
export function stateCounts<K extends string>(states: Record<K, number>, keys: K[]): Count[] {
  return keys.map((key) => ({ key, n: states[key], label: words.counts[key]!, tone: STATE_TONES[key] ?? "grey" }));
}

/** Counts in two groups, each under its total: those that went, then those that didn't (DIDNT_GO). */
export function wentAndGone(counts: Count[]): CountGroup[] {
  return [
    { key: "went", label: words.groups.went, counts: counts.filter((count) => !DIDNT_GO.has(count.key)) },
    { key: "gone", label: words.groups.gone, counts: counts.filter((count) => DIDNT_GO.has(count.key)) },
  ];
}

/** A copy's one tag: its state's words, with why where it has one, in its state's colour. */
export function copyStatus({ state, why }: { state: string; why: string | null }): {
  words: string;
  tone?: StateTone;
} {
  return { words: words.tags[`${state}:${why}`] ?? words.tags[state]!, tone: STATE_TONES[state] };
}

/** Where a copy stands, as one tag (copyStatus). */
export function CopyStatus({ copyOf }: { copyOf: { state: string; why: string | null } }) {
  const { words, tone } = copyStatus(copyOf);
  return <Tag tone={tone}>{words}</Tag>;
}
