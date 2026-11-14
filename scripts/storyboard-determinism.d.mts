type Run = {
  section: string;
  flow: string;
  viewport: string;
  status: string;
  frames: { caption: string; png?: string }[];
};

export const SPACER: number;
export function compare(
  plain: { frames: Run[] },
  spaced: { frames: Run[] },
  same: (a: string, b: string) => Promise<boolean>,
): Promise<{
  differs: { key: string; caption: string; plain?: string; spaced?: string }[];
  problems: { key: string; problem: string }[];
}>;
export function samePixels(a: string, b: string): Promise<boolean>;
