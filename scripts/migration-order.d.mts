export type OpenPr = { number: number; headRefName: string; files: { path: string }[] };

export const MIGRATIONS: string;
export function numberOf(name: string): number | undefined;
export function prefix(number: number, width?: number): string;
export function highest(names: string[]): number;
export function orderProblems(main: string[], own: string[]): string[];
export function openPrClashes(added: string[], prs: OpenPr[], branch: string): string[];
export function nextFree(main: string[], own: string[], prs?: OpenPr[]): string;
export function migrationsAt(ref: string, cwd?: string): string[];
export function migrationsOnDisk(cwd?: string): string[];
export const LISTED_FILES: number;
export function openPrs(cwd?: string, run?: (args: string[], cwd: string) => string): OpenPr[] | undefined;
export function check(options?: { cwd?: string; prs?: OpenPr[] | null }): { lines: string[]; ok: boolean };
