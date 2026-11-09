type Position = { line?: number; column?: number };
type Range = { start: Position; end: Position };

/** One file's coverage, as Istanbul's JSON has it. */
export type FileCoverage = {
  statementMap: Record<string, { start: { line: number; column: number }; end: Position }>;
  s: Record<string, number>;
  fnMap: Record<string, { name: string; line: number }>;
  f: Record<string, number>;
  branchMap: Record<string, { type: string; line: number; locations: Range[] }>;
  b: Record<string, number[]>;
};

export function changedFiles(base?: string, git?: (args: string[]) => string): string[];
export function sourcesToCover(
  files: string[],
  coverage: { include: string[]; exclude: string[] },
  exists?: (file: string) => boolean,
): string[];
export function lineRanges(lines: number[]): string;
export function uncovered(file: FileCoverage): {
  percents: { statements: number; branches: number; functions: number; lines: number };
  lines: number[];
  functions: string[];
  branches: string[];
};
export function report(sources: string[], coverage: Record<string, FileCoverage>, root: string): string;
export function vitestArgs(sources: string[], extra?: string[]): string[];
