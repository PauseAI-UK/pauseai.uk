import { BaseSequencer } from "vitest/node";
import type { Changed, Context, flowsReached } from "./storyboard-reach.mjs";

export interface Item {
  key: string;
  group: string;
  ms: number | undefined;
}

export interface VitestResults {
  version: number;
  projects: Record<string, { files?: Record<string, { duration: number; failed?: boolean; lastRun?: number }> }>;
}

export function deal(items: Item[], count: number): string[][];
export class TimedSequencer extends BaseSequencer {}
export function mergeVitestResults(caches: VitestResults[]): VitestResults;
export function flowsForPart(
  listed: Map<string, string>,
  times: Record<string, number>,
  part: number,
  count: number,
): string[];

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
