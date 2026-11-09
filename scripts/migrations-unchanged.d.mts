export function changedSince(ref: string, cwd?: string): string[];
export function refsFrom(args: string[], cwd?: string): { name: string; commit: string | undefined }[];
export function check(args: string[], cwd?: string): { lines: string[]; ok: boolean };
