type Graph = Map<string, string[]>;
type Route = { pattern: RegExp; files: string[] };
export type Context = {
  root: string;
  graph: Graph;
  routes: Route[];
  reaches?: Map<string, Set<string>>;
  texts?: Map<string, string>;
  roots?: Map<string, Set<string>>;
};
export type Changed = { files: string[]; addedOrDeleted: string[] };
/** A frame as a run records it: in the gallery, with the file of the component it pictures. */
type Frame = { caption: string; file?: string };
type Run = { key: string; section: string; flow: string; opened?: string[]; frames?: Frame[] };
type CarriedRun = Run & { status: string; tree?: string; seen?: string; setup?: string; recording?: number };

export const NAMED: string[];
export const RECORDING: number;
export function readByNoFlow(path: string): boolean;
export function sqlWithoutComments(sql: string): string;
export function resolveImport(root: string, from: string, spec: string): string | undefined;
export function importsOf(path: string, text: string): string[];
export function importGraph(root: string, options?: { handedOver?: boolean }): Graph;
export function unresolvedImports(root: string, dirs: string[]): string[];
export function handOvers(root: string, dirs: string[]): string[];
export function closure(graph: Graph, entries: Iterable<string>): Set<string>;
export function folderPattern(folder: string, prefix?: boolean): RegExp;
export function appRoutes(root: string): Route[];
export function routeFiles(routes: Route[], path: string): string[];
export function flowReach(run: Omit<Run, "key">, context: Context, whole?: boolean, cut?: Set<string>): Set<string>;
export function reachContext(root: string): Context;
export function reachedFlows<R extends Run>(args: {
  files: string[];
  addedOrDeleted?: string[];
  runs: R[];
  context: Context;
}): {
  keys: Set<string>;
  carried: Map<string, NonNullable<R["frames"]>>;
  everything: string[];
  unknown: string[];
};
export function flowsReached<R extends CarriedRun>(args: {
  suite: Set<string>;
  records: R[];
  phoneTagged: { has(key: string): boolean };
  context: Context;
  changed: Changed;
}): ReturnType<typeof flowsToRun<R>>;
export function flowsToRun<R extends CarriedRun>(args: {
  suite: Set<string>;
  carried: R[];
  phoneTagged: { has(key: string): boolean };
  context: Context;
  setup?: string;
  changedSince: (tree: string) => Changed | undefined;
}): {
  run: Set<string>;
  carried: Map<string, NonNullable<R["frames"]>>;
  fresh: number;
  reached: number;
  swept: number;
  everything: string[];
  unknown: string[];
  changed: string[];
};
export const SPOT_CHECKS: number;
export function spotCheckKeys(keys: Iterable<string>, seed: string): string[];
