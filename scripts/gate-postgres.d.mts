type Run = (command: string, args: string[], options: { stdio: "pipe" }) => unknown;

export const INITDB_ARGS: string[];
export function serverOptions(dir: string): string;
export function postgresBase(shm?: string): string;
export function postgresDir(pid: number, base?: string): string;
export function postgresEnv(dir: string, user?: string): Record<string, string>;
export function startPostgres(
  dir: string,
  run?: Run,
  user?: string,
): { env: Record<string, string> } | { problem: string };
export function stopPostgres(dir: string, run?: Run): void;
export function isRunning(pid: number): boolean;
export function sweepPostgres(
  base?: string,
  running?: (pid: number) => boolean,
  stop?: (dir: string) => void,
): string[];
