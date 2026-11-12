type Graph = Map<string, string[]>;
type Route = { pattern: RegExp; files: string[] };
type Context = {
  root: string;
  graph: Graph;
  routes: Route[];
  reaches?: Map<string, Set<string>>;
  texts?: Map<string, string>;
};
type Changed = { files: string[]; addedOrDeleted: string[] };
type Run = { key: string; section: string; flow: string; opened?: string[] };
type CarriedRun = Run & { status: string; tree?: string; seen?: string; setup?: string };

export const NAMED: string[];
export const STAFF_COPY: string;
export function readByNoFlow(path: string): boolean;
export function resolveImport(root: string, from: string, spec: string): string | undefined;
export function importsOf(path: string, text: string): string[];
export function importGraph(root: string): Graph;
export function unresolvedImports(root: string, dirs: string[]): string[];
export function handOvers(root: string, dirs: string[]): string[];
export function closure(graph: Graph, entries: Iterable<string>): Set<string>;
export function folderPattern(folder: string, prefix?: boolean): RegExp;
export function appRoutes(root: string): Route[];
export function routeFiles(routes: Route[], path: string): string[];
export function flowReach(run: Omit<Run, "key">, context: Context, whole?: boolean): Set<string>;
export function changedCopyKeys(diff: string, before: string, after: string): Set<string>;
export function copyKeysRead(text: string): Set<string>;
export function reachContext(root: string): Context;
export function reachedFlows(args: {
  files: string[];
  addedOrDeleted?: string[];
  runs: Run[];
  context: Context;
  copyKeys?: Set<string>;
}): {
  keys: Set<string>;
  everything: string[];
  unknown: string[];
};
export function flowsToRun(args: {
  suite: Set<string>;
  carried: CarriedRun[];
  phoneTagged: Set<string>;
  context: Context;
  setup?: string;
  changedSince: (tree: string) => Changed | undefined;
  copyKeysSince: (tree: string) => Set<string> | undefined;
}): {
  run: Set<string>;
  fresh: number;
  reached: number;
  swept: number;
  everything: string[];
  unknown: string[];
  changed: string[];
};
