import { BaseSequencer } from "vitest/node";

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
