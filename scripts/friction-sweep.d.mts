type Session = { first: string | undefined; measures: Set<string>; conflicts: Map<string, number> };

export function commandMeasures(command: string): Set<string>;
export function weekOf(timestamp: string): string;
export function projectFolder(checkout: string): string;
export function logFiles(dir: string): string[];
export function sweep(files: string[], isRepoFile: (path: string) => boolean): Promise<Map<string, Session>>;
export function report(sessions: Map<string, Session>, source: string): string;
