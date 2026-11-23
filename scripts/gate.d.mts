type Step = {
  id: string;
  label: string;
  command: string;
  args: string[];
  minutes: number;
  cwd?: string;
  required?: boolean;
  skip?: string;
  postgres?: boolean;
  env?: Record<string, string>;
};
type Result = { step: Step; code: number | null; ms: number; log?: string; note?: string };
type State = "waiting" | "running" | "passed" | "failed" | "skipped";
type Changed = (step: Step, state: State) => void;

export const LOG_DIR: string;
export const GROUPS: string[];
export function parseArgs(args: string[]): { fast: boolean; storyboard: boolean; only?: string[] };
export function changedFiles(outputs: string[], exists?: (file: string) => boolean): string[];
export function fastPlan(files: string[]): Step[][][];
export const PICTURING: string[];
export function slowPlan(options: { storyboard: boolean }, files?: string[]): Step[][][];
export function withEnv(phases: Step[][][], env: Record<string, string>): Step[][][];
export function formatDuration(ms: number): string;
export function formatTable(results: Result[]): string;
export function tail(file: string, count: number): string;
export function groupState(states: State[]): "waiting" | "running" | "passed" | "failed";
export function onlyGroups(phases: Step[][][], groups: string[]): Step[][][];
export function keptStates(commit: string, file?: string): Record<string, State>;
export function statusWriter(
  steps: Step[],
  commit: string,
  file?: string,
  kept?: Record<string, State>,
): { set: Changed; end: () => void };
export function runStep(
  step: Step,
  logDir?: string,
  report?: (line: string) => void,
  changed?: Changed,
): Promise<Result>;
export function runPlan(
  phases: Step[][][],
  logDir?: string,
  report?: (line: string) => void,
  changed?: Changed,
): Promise<Result[]>;
export function passed(results: Result[]): boolean;
