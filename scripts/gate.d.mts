type Step = {
  id: string;
  label: string;
  command: string;
  args: string[];
  minutes: number;
  cwd?: string;
  required?: boolean;
  skip?: string;
};
type Result = { step: Step; code: number | null; ms: number; log?: string; note?: string };

export const LOG_DIR: string;
export function parseArgs(args: string[]): { fast: boolean; storyboard: boolean };
export function changedFiles(outputs: string[], exists?: (file: string) => boolean): string[];
export function fastPlan(files: string[]): Step[][][];
export function slowPlan(options: { storyboard: boolean }): Step[][][];
export function formatDuration(ms: number): string;
export function formatTable(results: Result[]): string;
export function tail(file: string, count: number): string;
export function runStep(step: Step, logDir?: string, report?: (line: string) => void): Promise<Result>;
export function runPlan(phases: Step[][][], logDir?: string, report?: (line: string) => void): Promise<Result[]>;
export function passed(results: Result[]): boolean;
