type Run = (command: string, args: string[], options: { stdio: "pipe" }) => unknown;
type Started = { env: Record<string, string> } | { problem: string };

export const INITDB_ARGS: string[];
export function serverOptions(dir: string): string;
export function postgresBase(shm?: string): string;
export function defaultHost(port?: string, places?: string[]): string;
export function postgresDir(pid: number, base?: string): string;
export function checkoutPostgresDir(checkout: string, base?: string): string;
export function postgresEnv(dir: string, user?: string): Record<string, string>;
export function startPostgres(dir: string, run?: Run, user?: string): Started;
export function stopPostgres(dir: string, run?: Run): void;
export function isRunning(pid: number): boolean;
export function sweepPostgres(
  base?: string,
  running?: (pid: number) => boolean,
  stop?: (dir: string) => void,
): string[];
export function isReady(dir: string, running?: (pid: number) => boolean): boolean;
export function sweepCheckoutPostgres(
  base?: string,
  exists?: (path: string) => boolean,
  stop?: (dir: string) => void,
): string[];
export function checkoutPostgres(
  checkout?: string,
  options?: { base?: string; run?: Run; user?: string; wait?: (ms: number) => void; now?: () => number },
): Started;
