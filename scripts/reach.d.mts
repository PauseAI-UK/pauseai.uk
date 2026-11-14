import type { Context } from "./storyboard-reach.mjs";

type Run = { key: string; section: string; flow: string; viewport?: string; opened?: string[] };

export function isSiteCode(path: string): boolean;
export function newestRuns(store: string): Run[];
export function mostReaching(runs: Run[], context: Context, under?: string): { path: string; flows: number }[];
export function reachLines(found: { path: string; flows: number }[], total: number, limit: number): string[];
