type FlowStatus = "passed" | "failed" | "timedOut" | "interrupted";
type Flow = { section: string; flow: string; viewport: string; line: number; status: FlowStatus };
/** A flow as a run's frames.json has it: each picture a file, by its path in the run's folder. */
type Run = Flow & { frames: { caption: string; png?: string }[] };
/** A flow as the store keeps it: each picture by its hash. */
type KeptRun = Flow & { frames: { caption: string; picture?: string }[] };
type Kept = { flows?: Record<string, string>; frames: KeptRun[] };

export function storeDir(root: string): string;
export function flowFolder(run: { section: string; viewport: string; flow: string }): string;
export function readTree(store: string, tree: string, platform?: string): Kept;
export function keepRuns(
  store: string,
  tree: string,
  runDir: string,
  runs: Run[],
  flows?: Record<string, string>,
  platform?: string,
): Kept;
export function missingFlows(store: string, kept: Kept, needed: Iterable<string>): string[];
export function linkFlows(
  store: string,
  kept: Kept,
  wanted: { has(key: string): boolean },
  runDir: string,
  side?: string,
): { frames: Run[] };
export function touchTree(store: string, tree: string, now?: Date, platform?: string): void;
export function pruneStore(store: string, keep: number, now?: number): void;
