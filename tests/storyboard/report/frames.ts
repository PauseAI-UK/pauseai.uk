// The storyboard's data: the frames one run of the suite recorded, and how
// they pair up with another run's (main's), for the page (page.ts) and for an
// agent (storyboard.json).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

export type FlowStatus = "passed" | "failed" | "timedOut" | "interrupted";

/** The three parts of the page, each under its own heading. */
export const PARTS = ["Public site", "Staff pages", "Tools and checks"] as const;

/**
 * A section as its spec file declares it, on a line of its own after the
 * imports:
 *
 *   export const section: Section = { name: "Write to your MP", part: "Public site", order: 20 };
 *
 * `name` is its heading on the page, `part` the heading it goes under, and
 * `order` its place in that part, smallest first: the public site, what a
 * visitor sees then what they do; the staff pages; then the tools and the
 * mechanics, the component gallery last. Orders go up in tens, so a new
 * section fits between two. The report can't import a spec file, which
 * calls Playwright's `test()` as it loads, so it reads the declaration from
 * the file's text (parseSection).
 */
export type Section = { name: string; part: (typeof PARTS)[number]; order: number };

const DECLARATION = /^export const section: Section = (\{[^]*?\});$/m;

/**
 * The section a spec file's text declares, or undefined if it declares none,
 * or one with a part not in PARTS.
 */
export function parseSection(source: string): Section | undefined {
  const object = DECLARATION.exec(source)?.[1];
  if (!object) return undefined;
  const text = (field: string) => {
    const quoted = new RegExp(`\\b${field}: ("(?:[^"\\\\]|\\\\.)*")`).exec(object)?.[1];
    return quoted === undefined ? undefined : (JSON.parse(quoted) as string);
  };
  const name = text("name");
  const part = PARTS.find((p) => p === text("part"));
  const order = /\border: (\d+)/.exec(object)?.[1];
  return name !== undefined && part && order ? { name, part, order: Number(order) } : undefined;
}

/**
 * Every section that a spec file in `dir` declares, in the order the page
 * shows them: by part, then order, then file name. A spec file that declares
 * none is left out, and its flows go after these, alphabetically, so a new
 * one still appears; frames.test.ts checks every spec file declares one.
 */
export function readSections(dir: string): ({ id: string } & Section)[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".spec.ts"))
    .flatMap((file) => {
      const section = parseSection(readFileSync(join(dir, file), "utf8"));
      return section ? [{ id: file.slice(0, -".spec.ts".length), ...section }] : [];
    })
    .sort((a, b) => PARTS.indexOf(a.part) - PARTS.indexOf(b.part) || a.order - b.order || a.id.localeCompare(b.id));
}

let read: ({ id: string } & Section)[] | undefined;

/**
 * The storyboard's sections, from its spec files, read the first time
 * they're asked for. From the working directory, which is the repo's root
 * for every command that makes a report: Playwright loads this file as
 * CommonJS, for the reporter, where `import.meta` isn't allowed.
 */
export function sections() {
  read ??= readSections(join("tests", "storyboard"));
  return read;
}

/**
 * A placeholder's text where a frame pictures it (frame.ts, `placeholdersOnPage`), for
 * scripts/copy.mjs to match with the copy a branch changes. `text` runs from
 * the placeholder mark (U+2042) to the end of the block it's in, or to the next mark, its
 * whitespace collapsed. Each of `boxes` is a piece of it, `[at, x, y, width, height]`:
 * where in `text` the piece starts, and its box in the frame's picture, in
 * CSS pixels (as every frame is pictured), so a match of the text's first n
 * characters is boxed by the pieces that start before n.
 */
export type PlaceholderText = { text: string; boxes: [number, number, number, number, number][] };

/** A test as one run of the suite saw it, with its frames in order. */
export type FlowRun = {
  section: string;
  flow: string;
  viewport: string;
  /** The line the test starts on, so flows keep their spec file's order whatever order they ran in. */
  line: number;
  status: FlowStatus;
  /** The failure's first line, if it failed. */
  error?: string;
  /** Each with the lines of the flow's story that come before it (frame.ts's `story`), and the placeholders it pictures. */
  frames: { caption: string; png?: string; story?: string[]; placeholders?: PlaceholderText[] }[];
  /** The story's lines after the last frame. */
  end?: string[];
  /** When the run that shot it started: a partial run carries the flows it didn't run from the last one. */
  shotAt?: string;
  /** The tree of the code it ran on (scripts/storyboard.mjs), which a carried flow keeps. */
  tree?: string;
  /** The tree a review last carried it at, having found that nothing changed since it ran could reach it (scripts/storyboard.mjs). */
  seen?: string;
  /** The dependencies installed when it ran, which the tree doesn't hold (scripts/storyboard.mjs, setupOf). */
  setup?: string;
  /** What it opened, by path (fixtures.ts), for working out which flows a change reaches (scripts/storyboard-reach.mjs). */
  opened?: string[];
};

/** What one run of the suite wrote: `frames.json` in its output directory. */
export type RunManifest = { frames: FlowRun[] };

/** One frame of the storyboard, with this branch's picture and main's, paired by section, flow and caption. */
export type Frame = {
  section: string;
  flow: string;
  viewport: string;
  /** Its place in the flow, from 1. */
  index: number;
  caption: string;
  /** The lines of the flow's story before it. */
  story?: string[];
  /** The placeholders this branch's picture shows (PlaceholderText). */
  placeholders?: PlaceholderText[];
  /** PNG paths, relative to the storyboard directory. */
  branch?: string;
  main?: string;
  diff?: string;
  /** The fraction of pixels that differ, 0 for identical; absent when one side has no picture. */
  mismatch?: number;
  /** Differs from main's, but only by noise (CHANNEL_NOISE and the limits below it): not changed. */
  noise?: boolean;
  /** Whether a person should look: differs, new on this branch, or gone from it. */
  changed: boolean;
  status: FlowStatus;
};

export type Flow = {
  section: string;
  flow: string;
  viewport: string;
  status: FlowStatus;
  error?: string;
  /** Main's status, when main ran the flow. */
  mainStatus?: FlowStatus;
  frames: number;
  changed: number;
  /** The story's lines after the last frame (FlowRun's). */
  end?: string[];
  /** When the run that shot it started (FlowRun's). */
  shotAt?: string;
};

export type Storyboard = {
  generatedAt: string;
  /** Whether there was a run of main to compare with. */
  withMain: boolean;
  summary: { flows: number; failed: number; frames: number; changed: number; mainFailed: number };
  flows: Flow[];
  frames: Frame[];
};

const key = (run: Pick<FlowRun, "section" | "flow" | "viewport">) =>
  `${run.section}\u0000${run.flow}\u0000${run.viewport}`;

const sectionRank = (section: string) => {
  const at = sections().findIndex((s) => s.id === section);
  return at === -1 ? sections().length : at;
};

/** Section order, then the spec file's order, then the viewport: the workers finish flows in any order. */
export function sortRuns<T extends Pick<FlowRun, "section" | "line" | "flow" | "viewport">>(runs: T[]): T[] {
  return [...runs].sort(
    (a, b) =>
      sectionRank(a.section) - sectionRank(b.section) ||
      a.section.localeCompare(b.section) ||
      a.line - b.line ||
      a.flow.localeCompare(b.flow) ||
      a.viewport.localeCompare(b.viewport),
  );
}

/**
 * A partial run's flows on top of the last run's: each flow it ran replaces
 * that flow, and the rest are carried as they were, so the review stays whole.
 */
export function carryRuns(previous: RunManifest, fresh: RunManifest): RunManifest {
  const ran = new Set(fresh.frames.map(key));
  return { frames: [...previous.frames.filter((run) => !ran.has(key(run))), ...fresh.frames] };
}

/**
 * Pairs each frame of this branch's run with main's, by section, flow and
 * caption (the n-th frame with that caption, if a flow repeats one), and
 * compares the pictures with `compare`, all at once. Frames only main has are
 * kept, as gone from this branch.
 */
export async function pairRuns(
  branch: RunManifest,
  main: RunManifest | undefined,
  compare: (
    branchPng: string,
    mainPng: string,
    name: string,
  ) => Promise<{ mismatch: number; noise: boolean; diff?: string }>,
): Promise<Storyboard> {
  const mainRuns = new Map(sortRuns(main?.frames ?? []).map((run) => [key(run), run]));
  const flows: { flow: Flow; frames: Frame[] }[] = [];
  const comparisons: Promise<void>[] = [];

  for (const run of sortRuns(branch.frames)) {
    const mainRun = mainRuns.get(key(run));
    mainRuns.delete(key(run));
    const mainFrames = [...(mainRun?.frames ?? [])];
    const flowFrames: Frame[] = run.frames.map((f, i) => {
      const at = mainFrames.findIndex((m) => m.caption === f.caption);
      const [paired] = at === -1 ? [] : mainFrames.splice(at, 1);
      const frame: Frame = {
        section: run.section,
        flow: run.flow,
        viewport: run.viewport,
        index: i + 1,
        caption: f.caption,
        ...(f.story ? { story: f.story } : {}),
        ...(f.placeholders ? { placeholders: f.placeholders } : {}),
        branch: f.png,
        main: paired?.png,
        changed: false,
        status: run.status,
      };
      if (f.png && paired?.png) {
        comparisons.push(
          compare(f.png, paired.png, `${run.section}-${run.viewport}-${run.flow}-${i + 1}`).then(
            ({ mismatch, noise, diff }) => {
              frame.mismatch = mismatch;
              frame.diff = diff;
              if (noise) frame.noise = true;
              frame.changed = mismatch > 0 && !noise;
            },
          ),
        );
      } else if (main && (f.png || paired?.png)) {
        // New on this branch, or main's run of the flow didn't get this far.
        frame.changed = true;
      }
      return frame;
    });
    // Frames main took that this branch no longer does.
    for (const gone of mainFrames) {
      flowFrames.push({
        section: run.section,
        flow: run.flow,
        viewport: run.viewport,
        index: flowFrames.length + 1,
        caption: gone.caption,
        main: gone.png,
        changed: true,
        status: run.status,
      });
    }
    flows.push({
      flow: {
        section: run.section,
        flow: run.flow,
        viewport: run.viewport,
        status: run.status,
        error: run.error,
        mainStatus: mainRun?.status,
        frames: flowFrames.length,
        changed: 0,
        ...(run.end ? { end: run.end } : {}),
        shotAt: run.shotAt,
      },
      frames: flowFrames,
    });
  }

  // Flows main ran that this branch doesn't have at all.
  for (const gone of mainRuns.values()) {
    const flowFrames = gone.frames.map((f, i): Frame => ({
      section: gone.section,
      flow: gone.flow,
      viewport: gone.viewport,
      index: i + 1,
      caption: f.caption,
      main: f.png,
      changed: true,
      status: gone.status,
    }));
    flows.push({
      flow: {
        section: gone.section,
        flow: gone.flow,
        viewport: gone.viewport,
        status: gone.status,
        mainStatus: gone.status,
        frames: flowFrames.length,
        changed: 0,
      },
      frames: flowFrames,
    });
  }

  await Promise.all(comparisons);
  // A flow that failed on main has nothing fair to compare with, so none of its frames count as changed. It's
  // told apart by its mainStatus, in Main failed on the page.
  const failedOnMain = (flow: Flow) => flow.mainStatus !== undefined && flow.mainStatus !== "passed";
  for (const { flow, frames } of flows) flow.changed = failedOnMain(flow) ? 0 : frames.filter((f) => f.changed).length;
  const frames = flows.flatMap((f) => f.frames);
  return {
    generatedAt: new Date().toISOString(),
    withMain: main !== undefined,
    summary: {
      flows: flows.length,
      failed: flows.filter((f) => f.flow.status !== "passed").length,
      frames: frames.length,
      changed: flows.reduce((n, f) => n + f.flow.changed, 0),
      mainFailed: flows.filter((f) => failedOnMain(f.flow)).length,
    },
    flows: flows.map((f) => f.flow),
    frames,
  };
}

/**
 * How two pictures may differ and still count as the same, as toucan's
 * snapshot gallery does (https://git.sr.ht/~frabcus/toucan,
 * platform/snapshots/png.ts and engine.ts). A pixel differs when a channel
 * moves by more than CHANNEL_NOISE levels. A frame has changed when its
 * differing pixels' largest channel moves add up to more than NOISE_TOTAL,
 * or more than NOISE_PIXELS pixels differ, counted in CSS pixels, as
 * every frame is pictured (tests/storyboard/frame.ts). Antialiasing on a
 * few glyphs adds up to a few thousand; a line that moves, millions. Below
 * the limits the frame is "noise": shown, with its diff, but not counted as
 * changed.
 */
const CHANNEL_NOISE = 4;
const NOISE_TOTAL = 2_000;
const NOISE_PIXELS = 1_000;

export type Comparison = {
  /** The fraction of pixels that differ, 0 for identical. */
  mismatch: number;
  /** How many pixels differ. */
  pixels: number;
  /** Differs, but within the noise limits. */
  noise: boolean;
  /** The diff picture, if they differ: the branch's picture faded, the differing pixels red. */
  diff?: string;
};

/**
 * Compares two PNG files pixel by pixel, writing the differences to
 * `diffPath` if there are any. Identical files are the same without being
 * decoded, which is most frames of most runs. Pictures of different sizes
 * are padded with white, so the extra height shows as a difference rather
 * than vanishing.
 */
export async function comparePngs(branchPath: string, mainPath: string, diffPath: string): Promise<Comparison> {
  const same: Comparison = { mismatch: 0, pixels: 0, noise: false };
  if (readFileSync(branchPath).equals(readFileSync(mainPath))) return same;
  const [a, b] = padToMatch(await rgba(branchPath), await rgba(mainPath));
  let pixels = 0;
  let total = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const move = channelMove(a.data, b.data, i);
    if (move > CHANNEL_NOISE) {
      pixels++;
      total += move;
    }
  }
  if (pixels === 0) return same;
  const diff = Buffer.alloc(a.data.length);
  for (let i = 0; i < a.data.length; i += 4) {
    // Red where they differ; elsewhere the branch's picture, faded towards white so the red stands out.
    const grey = 255 - Math.round((255 - (a.data[i] + a.data[i + 1] + a.data[i + 2]) / 3) * 0.2);
    const red = channelMove(a.data, b.data, i) > CHANNEL_NOISE;
    diff[i] = red ? 255 : grey;
    diff[i + 1] = red ? 0 : grey;
    diff[i + 2] = red ? 0 : grey;
    diff[i + 3] = 255;
  }
  await sharp(diff, { raw: { width: a.width, height: a.height, channels: 4 } })
    .png()
    .toFile(diffPath);
  return {
    mismatch: pixels / (a.width * a.height),
    pixels,
    noise: total <= NOISE_TOTAL && pixels <= NOISE_PIXELS,
    diff: diffPath,
  };
}

/** A decoded picture: four bytes a pixel, red, green, blue and alpha. */
type Rgba = { width: number; height: number; data: Buffer };

async function rgba(path: string): Promise<Rgba> {
  const { data, info } = await sharp(path, { limitInputPixels: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

/** The pixel at byte `i`'s largest channel move between the two pictures. */
function channelMove(a: Buffer, b: Buffer, i: number): number {
  return Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
}

function padToMatch(a: Rgba, b: Rgba): [Rgba, Rgba] {
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const pad = (img: Rgba): Rgba => {
    if (img.width === width && img.height === height) return img;
    const data = Buffer.alloc(width * height * 4, 255);
    for (let y = 0; y < img.height; y++) {
      img.data.copy(data, y * width * 4, y * img.width * 4, (y + 1) * img.width * 4);
    }
    return { width, height, data };
  };
  return [pad(a), pad(b)];
}
