import type { Changed, Context, flowsReached } from "./storyboard-reach.mjs";

export function flowsForCi(listed: Map<string, string>): Map<string, string>;
export function flowsForPart(listed: Map<string, string>, part: number, count: number): string[];
export interface CiChoice {
  run: Set<string>;
  reached: ReturnType<typeof flowsReached>;
  spot: string[];
}
export function reachedForCi(args: {
  keys: string[];
  map: { recording: number; flows: Record<string, string[]> } | undefined;
  changed: Changed;
  context: Context;
  seed: string;
}): CiChoice | undefined;
export function reachedLine(chosen: CiChoice, total: number): string;
