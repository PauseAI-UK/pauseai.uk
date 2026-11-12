type Graph = Map<string, string[]>;
type Route = { pattern: RegExp; files: string[] };
type Context = { root: string; graph: Graph; routes: Route[]; specs: string[] };
type Run = { key: string; section: string; flow: string; opened?: string[] };
type CarriedRun = Run & { status: string; tree?: string };

export const EVERYTHING: RegExp[];
export const NOTHING: RegExp[];
export const STAFF_COPY: string;
export function resolveImport(root: string, from: string, spec: string): string | undefined;
export function importsOf(path: string, text: string): string[];
export function importGraph(root: string): Graph;
export function closure(graph: Graph, entries: Iterable<string>): Set<string>;
export function folderPattern(folder: string, prefix?: boolean): RegExp;
export function appRoutes(root: string): Route[];
export function routeFiles(routes: Route[], path: string): string[];
export function flowReach(run: Omit<Run, "key">, context: Pick<Context, "graph" | "routes" | "root">): Set<string>;
export function changedCopyKeys(diff: string, before: string, after: string): Set<string>;
export function copyKeysRead(text: string): Set<string>;
export function reachContext(root: string): Context;
export function reachedFlows(args: { files: string[]; runs: Run[]; context: Context; copyKeys?: Set<string> }): {
  keys: Set<string>;
  everything: string[];
};
export function flowsToRun(args: {
  suite: Set<string>;
  carried: CarriedRun[];
  phoneTagged: Set<string>;
  context: Context;
  changedSince: (tree: string) => string[];
  copyKeysSince: (tree: string) => Set<string> | undefined;
}): { run: Set<string>; fresh: number; reached: number; everything: string[]; changed: string[] };
