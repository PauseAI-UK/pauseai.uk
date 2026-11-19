export function isBeacon(method: string, url: string): boolean;
export function keptName(url: string): string;
export function sameFile(url: string): string;
export function startReplay(folder?: string): Promise<{
  port: number;
  certificate: { key: Buffer; cert: Buffer };
  counts: { kept: number; fetched: number; empty: number; missed: number };
  freeze: () => void;
  thaw: () => void;
  stop: () => Promise<void>;
}>;
