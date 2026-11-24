export function databaseUrl(name: string): string;
export function migrationFiles(): string[];
export function dropDatabase(name: string): void;
export function copyDatabase(name: string, template: string): void;
export function runSql(name: string, sql: string): string[];
export function databaseNames(prefix: string): string[];
export function freshDatabase(name: string, options?: { singleTransaction?: boolean; upTo?: string }): string;
export function addTestMps(url: string, email: string): void;
export function addFixtureData(url: string): void;
export function connectLettersInbox(url: string, email: string, key: string): void;
export function resetDatabase(url: string, options?: { singleTransaction?: boolean; upTo?: string }): string;
export function isLocal(url: string, env?: Record<string, string | undefined>): boolean;
export function testServerUrl(env?: Record<string, string | undefined>, envFile?: string): string | undefined;
type LocalServer = { host: string; port?: string; user?: string; own?: boolean };
export function localServer(
  env?: Record<string, string | undefined>,
  own?: () => { env: Record<string, string> } | { problem: string },
  warn?: (message: string) => void,
): LocalServer;
export function serverEnv(env?: Record<string, string | undefined>, server?: () => LocalServer): Record<string, string>;
export function serverSource(
  env?: Record<string, string | undefined>,
  envFile?: string,
  server?: () => LocalServer,
): string;
export function noServer(url: string, source?: string): string;
