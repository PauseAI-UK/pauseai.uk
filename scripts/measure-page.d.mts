type Version = { name: string; ref?: string; url?: string };
type Options = {
  path: string;
  runs: number;
  images: string;
  networks: string[];
  viewports: string[];
  film: boolean;
  http2: boolean;
  versions: Version[];
};
type Request = { url: string; kind: string; bytes: number };
type Run = Record<string, number | null | undefined>;
type Frame = { file: string; at: number };
type Section = { title: string; names: string[]; results: Run[][]; films?: Frame[][] };

export const NETWORKS: Record<string, { name: string; conditions: Record<string, number> }>;
export const METRICS: [string, string, string][];
export function parseArgs(argv: string[]): Options;
export function weigh(requests: Request[], origin: string): Record<string, number>;
export function summary(runs: Run[], key: string, unit: string): string;
export function tableRows(names: string[], results: Run[][]): string[][];
export function textTable(title: string, rows: string[][]): string;
export function filmTimes(untilMs: number): number[];
export function frameAt(frames: Frame[], seconds: number): Frame | undefined;
export function reportHtml(title: string, sections: Section[]): string;
