import type { Frame, Storyboard } from "../tests/storyboard/report/frames.ts";

export type Part = string | { expr: string };
export type Placeholder = { file: string; line: number; endLine: number; parts: Part[]; source: string };
export type Group = { key: string; parts: Part[]; places: Placeholder[] };
export type Shot = { image: string; where: string[] };
export type Found = Map<string, { frame: Frame; boxes: number[][] }[]>;

export const MARK: string;
export const PAGE: string;
export function addedLines(diff: string): Map<string, Set<number>>;
export function kindOf(file: string): "jsx" | "js" | "text";
export function changedPlaceholders(
  base?: string,
  git?: (args: string[]) => string,
  read?: (file: string) => string,
): Placeholder[];
export function placeholdersIn(file: string, source: string): Placeholder[];
export function readCopy(source: string, at: number, kind: "jsx" | "js" | "text"): { parts: Part[]; end: number };
export function openQuote(source: string, at: number): string | undefined;
export function matchingBrace(source: string, open: number): number;
export function decodeEntities(text: string): string;
export function cutHtml(parts: Part[]): Part[];
export function copyText(parts: Part[], expr?: (expr: string) => string): string;
export function sameText(parts: Part[]): string;
export function copyPattern(parts: Part[]): RegExp;
export function groupPlaceholders(placeholders: Placeholder[]): Group[];
export function findInFrames(groups: Group[], storyboard: Pick<Storyboard, "frames">): Found;
export function cropAround(
  boxes: number[][],
  width: number,
  height: number,
):
  | {
      crop: { left: number; top: number; width: number; height: number };
      box: { x: number; y: number; width: number; height: number };
    }
  | undefined;
export function cropFrame(png: string | Buffer, boxes: number[][]): Promise<Buffer | undefined>;
export function renderCopyPage(data: {
  branch: string;
  base: string;
  run?: { name: string; at: string };
  warnings: string[];
  groups: (Group & { shots: Shot[] })[];
}): string;
export function frameName(frame: Frame, names?: Map<string, string>): string;
export function shotsOf(
  found: { frame: Frame; boxes: number[][] }[],
  runDir: string,
  name?: (frame: Frame) => string,
): Promise<Shot[]>;
export function staleness(runAt: string, lastCommitAt: string, modified: { file: string; mtime: number }[]): string[];
export function sectionsToRun(groups: Group[], found: Found): string[];
export function writeCopyPage(options?: {
  runDir?: string;
  out?: string;
  base?: string;
  git?: (args: string[]) => string;
}): Promise<{ out: string; groups: (Group & { shots: Shot[] })[]; warnings: string[]; found: Found }>;
