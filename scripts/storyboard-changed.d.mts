import type { Flow, Frame, Storyboard } from "../tests/storyboard/report/frames.ts";

type Changed = {
  frames: { kind: "differs" | "new" | "gone"; frame: Frame }[];
  missing: { flow: Flow; frames: Frame[] }[];
  failed: Flow[];
  noise: number;
};

export function changedFrames(storyboard: Storyboard): Changed;
export function describeChanged(storyboard: Storyboard, runDir: string): string[];
export function runDirOf(name?: string, dir?: string): string | undefined;
