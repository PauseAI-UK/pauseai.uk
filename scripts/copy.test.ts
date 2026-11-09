import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { Frame } from "../tests/storyboard/report/frames.ts";
import {
  addedLines,
  changedPlaceholders,
  copyPattern,
  copyText,
  cropAround,
  cropFrame,
  cutHtml,
  decodeEntities,
  findInFrames,
  frameName,
  groupPlaceholders,
  kindOf,
  MARK,
  openQuote,
  placeholdersIn,
  readCopy,
  renderCopyPage,
  sectionsToRun,
  shotsOf,
  staleness,
} from "./copy.mjs";

// The mark, never written out: tests/checks/placeholder-copy.test.ts fails on any file that has it.
const M = MARK;

const read = (source: string, kind: "jsx" | "js" | "text" = "js") => readCopy(source, source.indexOf(M), kind).parts;

describe("addedLines", () => {
  it("numbers each added line as the file is now, per file, and skips deleted files", () => {
    const diff = [
      "diff --git a/lib/a.ts b/lib/a.ts",
      "--- a/lib/a.ts",
      "+++ b/lib/a.ts",
      "@@ -3,0 +4,2 @@ context",
      "+one",
      "+++two",
      "@@ -10 +12 @@",
      "-old",
      "+new",
      "diff --git a/lib/gone.ts b/lib/gone.ts",
      "--- a/lib/gone.ts",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-gone",
      "diff --git a/lib/b.ts b/lib/b.ts",
      "+++ b/lib/b.ts",
      "@@ -1,2 +1,3 @@",
      " same",
      "+added",
    ].join("\n");
    expect(addedLines(diff)).toEqual(
      new Map([
        ["lib/a.ts", new Set([4, 5, 12])],
        ["lib/b.ts", new Set([2])],
      ]),
    );
  });
});

describe("kindOf", () => {
  it("reads JSX, other scripts, and the rest as text", () => {
    expect(["a.tsx", "a.jsx", "a.ts", "a.mjs", "a.cts", "a.md"].map(kindOf)).toEqual([
      "jsx",
      "jsx",
      "js",
      "js",
      "js",
      "text",
    ]);
  });
});

describe("readCopy", () => {
  it("reads a string to its closing quote, with its escapes", () => {
    expect(read(`label: "${M} Say \\"hi\\" \\u00e9\\x41\\u{1F600}\\n", other`)).toEqual([`${M} Say "hi" éA😀\n`]);
    expect(read(`x = '${M} it\\'s'; y`)).toEqual([`${M} it's`]);
  });

  it("reads a string the copy starts partway into", () => {
    expect(read(`greeting: "Hi {${M} first name}, the march",`)).toEqual([`${M} first name}, the march`]);
  });

  it("stops a string at the next mark, the end of the line or the file", () => {
    expect(read(`"${M} one ${M} two"`)).toEqual([`${M} one `]);
    expect(read(`"${M} open\nnext`)).toEqual([`${M} open`]);
    expect(read(`"${M} to the end`)).toEqual([`${M} to the end`]);
  });

  it("reads a template's expressions as expressions", () => {
    expect(read(`(n) => \`${M} \${n} letters to \${{ a: 1 }.a}\`;`)).toEqual([
      `${M} `,
      { expr: "n" },
      " letters to ",
      { expr: "{ a: 1 }.a" },
      "",
    ]);
    expect(read(`\`${M} a line\\\ncontinued \\\`x\\\`\``)).toEqual([`${M} a linecontinued \`x\``]);
  });

  it("reads JSX text through inline elements and literal expressions, to an element that isn't inline", () => {
    const jsx = `<p>
      <strong>${M} If you fill in a form</strong>, such as
      while we&apos;re <Link href={"/x"} className="a">flyering</Link>{" "}
      {/* a comment */}{count} times{'!'}{\`.\`}
      <ul><li>no</li></ul>
    </p>`;
    expect(read(jsx, "jsx")).toEqual([
      `${M} If you fill in a form, such as while we're flyering `,
      { expr: "count" },
      " times!.",
    ]);
  });

  it("ends JSX text at the next mark, a closing brace, or a stray <", () => {
    expect(read(`<p>${M} one <b>${M} two</b></p>`, "jsx")).toEqual([`${M} one `]);
    expect(read(`{cond && <p>${M} one</p>}`, "jsx")).toEqual([`${M} one`]);
    expect(read(`<p>${M} a < b</p>`, "jsx")).toEqual([`${M} a `]);
    expect(read(`<p>${M} {\`\${a}\`} {"x" + y}`, "jsx")).toEqual([
      `${M} `,
      { expr: "`${a}`" },
      " ",
      { expr: '"x" + y' },
      "",
    ]);
  });

  it("keeps JSX text on one line as written", () => {
    expect(read(`<p>${M} a  b</p>`, "jsx")).toEqual([`${M} a  b`]);
  });

  it("reads to the end of the line outside a string, or in a text file", () => {
    expect(read(`// ${M} a note\nnext`)).toEqual([`${M} a note`]);
    expect(read(`# ${M} Heading "quoted"\nbody`, "text")).toEqual([`${M} Heading "quoted"`]);
    expect(read(`${M} one ${M} two`, "text")).toEqual([`${M} one `]);
  });

  it("drops an HTML string's inline tags and cuts it at its first block", () => {
    expect(read(`html: \`${M} Read <a href="\${url}">the &amp; guide</a> today</p><p>next\``)).toEqual([
      `${M} Read the & guide today`,
    ]);
    expect(read(`"${M} <em>Hi</em> \${x}"`)).toEqual([`${M} Hi \${x}`]);
    expect(read(`\`${M} Hi \${name}, <b>\${n}</b>\``)).toEqual([`${M} Hi `, { expr: "name" }, ", ", { expr: "n" }, ""]);
  });
});

describe("openQuote", () => {
  it("finds the string a mark is in on its line, or none", () => {
    const at = (s: string) => openQuote(s, s.indexOf(M));
    expect(at(`"${M}"`)).toBe('"');
    expect(at(`<p className="a">${M}</p>`)).toBeUndefined();
    expect(at(`x = 'it\\'s ${M}'`)).toBe("'");
  });
});

describe("decodeEntities", () => {
  it("decodes named and numbered entities, and leaves unknown ones", () => {
    expect(
      decodeEntities(
        "&rsquo;&#39;&#x41;&nbsp;&bogus;&ldquo;&rdquo;&lsquo;&mdash;&ndash;&hellip;&pound;&middot;&quot;&lt;&gt;",
      ),
    ).toBe("’'A &bogus;“”‘—–…£·\"<>");
  });
});

describe("cutHtml", () => {
  it("leaves text without tags as it is", () => {
    expect(cutHtml([`${M} a`, { expr: "b" }, " c"])).toEqual([`${M} a`, { expr: "b" }, " c"]);
  });
});

describe("placeholdersIn", () => {
  it("finds each placeholder with the lines it spans and its source", () => {
    const source = `const a = 1;\nconst t = {\n  title: "${M} Title",\n  long: \`${M} One\ntwo\`,\n};\n`;
    expect(placeholdersIn("lib/t.ts", source)).toEqual([
      { file: "lib/t.ts", line: 3, endLine: 3, parts: [`${M} Title`], source: `  title: "${M} Title",` },
      { file: "lib/t.ts", line: 4, endLine: 5, parts: [`${M} One\ntwo`], source: `  long: \`${M} One\ntwo\`,` },
    ]);
  });
});

describe("changedPlaceholders", () => {
  const files: Record<string, string> = {
    "lib/a.ts": `x\n"${M} kept"\n"${M} changed"\n`,
    "app/new.tsx": `<p>${M} new</p>`,
    "lib/plain.ts": "no copy\n",
    "lib/a.test.ts": `"${M} a test"`,
    "tests/storyboard/x.spec.ts": `"${M} a spec"`,
    "investments/x.md": `${M} a note`,
  };
  const git = (args: string[]) => {
    if (args[0] === "merge-base") return "abc123\n";
    if (args.includes("diff")) {
      return [
        "diff --git a/lib/a.ts b/lib/a.ts",
        "+++ b/lib/a.ts",
        "@@ -3 +3 @@",
        `+"${M} changed"`,
        "diff --git a/lib/plain.ts b/lib/plain.ts",
        "+++ b/lib/plain.ts",
        "@@ -1 +1 @@",
        "+no copy",
        "diff --git a/lib/a.test.ts b/lib/a.test.ts",
        "+++ b/lib/a.test.ts",
        "@@ -1 +1 @@",
        "+x",
        "diff --git a/lib/deleted-since.ts b/lib/deleted-since.ts",
        "+++ b/lib/deleted-since.ts",
        "@@ -1 +1 @@",
        "+x",
      ].join("\n");
    }
    return "app/new.tsx\ntests/storyboard/x.spec.ts\ninvestments/x.md\n";
  };
  const readFile = (file: string) => {
    if (!(file in files)) throw new Error("gone");
    return files[file];
  };

  it("lists the placeholders on added lines and in new files, not in tests or notes", () => {
    expect(changedPlaceholders("origin/main", git, readFile).map((p) => [p.file, p.line, copyText(p.parts)])).toEqual([
      ["app/new.tsx", 1, `${M} new`],
      ["lib/a.ts", 3, `${M} changed`],
    ]);
  });
});

describe("copyPattern", () => {
  const matches = (parts: (string | { expr: string })[], text: string) => copyPattern(parts).exec(text)?.[0];

  it("matches a string exactly, at the start of the text, ending at a word's end", () => {
    expect(matches([`${M} Import the calendar`], `${M} Import the calendar now`)).toBe(`${M} Import the calendar`);
    expect(matches([`${M} Import`], `${M} Imports`)).toBeUndefined();
    expect(matches([`${M} Import`], `x ${M} Import`)).toBeUndefined();
  });

  it("matches an expression as anything, and whitespace as a space or none", () => {
    expect(
      matches([`${M} `, { expr: "n" }, " letters to ", { expr: "name" }, ""], `${M} 3 letters to Jane Smith`),
    ).toBe(`${M} 3 letters to Jane`);
    expect(matches([`${M}  Hello\n  `, { expr: "name" }], `${M} HelloJane`)).toBe(`${M} HelloJane`);
    expect(matches([`${M} a (b) $1.`], `${M} a (b) $1.`)).toBe(`${M} a (b) $1.`);
  });
});

const frame = (extra: Partial<Frame>): Frame => ({
  section: "staff-login",
  flow: "Log in",
  viewport: "desktop",
  index: 1,
  caption: "The form",
  changed: false,
  status: "passed",
  branch: "branch/frames/1.png",
  ...extra,
});

const group = (parts: (string | { expr: string })[], file = "lib/a.ts", line = 1) =>
  groupPlaceholders([{ file, line, endLine: line, parts, source: "" }])[0];

describe("groupPlaceholders", () => {
  it("puts copy with the same text together, whatever its expressions are called", () => {
    const groups = groupPlaceholders([
      { file: "a.ts", line: 1, endLine: 1, parts: [`${M} `, { expr: "n" }, " left"], source: "" },
      { file: "b.ts", line: 9, endLine: 9, parts: [`${M} other`], source: "" },
      { file: "c.ts", line: 2, endLine: 2, parts: [`${M}  `, { expr: "count" }, " left"], source: "" },
    ]);
    expect(groups.map((g) => g.places.map((p) => p.file))).toEqual([["a.ts", "c.ts"], ["b.ts"]]);
  });
});

describe("findInFrames", () => {
  it("finds each copy's frames, with the boxes of what matched, the longest match winning", () => {
    const short = group([`${M} Import`]);
    const long = group([`${M} Import the calendar`]);
    const never = group([`${M} Never shown`]);
    const shown = frame({
      placeholders: [
        {
          text: `${M} Import the calendar now`,
          boxes: [
            [0, 10, 20, 100, 16],
            [20, 10, 40, 100, 16],
            [25, 10, 60, 100, 16],
          ],
        },
        { text: `${M} Import`, boxes: [[0, 1, 2, 3, 4]] },
        { text: `${M} Import`, boxes: [[0, 9, 9, 9, 9]] },
      ],
    });
    const found = findInFrames([short, long, never], {
      frames: [shown, frame({ branch: undefined, placeholders: shown.placeholders }), frame({ index: 2 })],
    });
    expect(found.get(long.key)).toEqual([
      {
        frame: shown,
        boxes: [
          [10, 20, 100, 16],
          [10, 40, 100, 16],
        ],
      },
    ]);
    expect(found.get(short.key)).toEqual([{ frame: shown, boxes: [[1, 2, 3, 4]] }]);
    expect(found.get(never.key)).toEqual([]);
  });
});

describe("cropAround", () => {
  it("centres a crop of at least the smallest size on the copy, inside the picture", () => {
    expect(cropAround([[600, 500, 80, 20]], 1280, 2000)).toEqual({
      crop: { left: 320, top: 410, width: 640, height: 200 },
      box: { x: 276, y: 86, width: 88, height: 28 },
    });
    expect(cropAround([[0, 0, 50, 10]], 390, 100)).toEqual({
      crop: { left: 0, top: 0, width: 390, height: 100 },
      box: { x: 0, y: 0, width: 58, height: 18 },
    });
  });

  it("shows the top of copy taller than the largest crop, and nothing for copy outside the picture", () => {
    expect(cropAround([[10, 100, 300, 2000]], 1280, 5000)?.crop).toEqual({ left: 0, top: 28, width: 640, height: 720 });
    expect(cropAround([[10, 900, 300, 20]], 1280, 800)).toBeUndefined();
  });
});

describe("cropFrame and shotsOf", () => {
  const dir = mkdtempSync(join(tmpdir(), "copy-test-"));
  const png = join(dir, "frame.png");

  it("crops a picture around the copy with a box drawn on it, as WebP", async () => {
    writeFileSync(
      png,
      await sharp({ create: { width: 800, height: 600, channels: 3, background: "#fff" } })
        .png()
        .toBuffer(),
    );
    const image = (await cropFrame(png, [[100, 100, 50, 10]]))!;
    expect(await sharp(image).metadata()).toMatchObject({ format: "webp", width: 640, height: 200 });
    const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
    // The box's top edge, at its padding above the copy, is drawn; inside it is the page.
    const at = (x: number, y: number) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
    expect(at(120, 92)[1]).toBeLessThan(100);
    expect(at(120, 98)).toEqual([255, 255, 255]);
    expect(await cropFrame(png, [[100, 700, 50, 10]])).toBeUndefined();
  });

  it("puts frames whose crops are the same picture under one, and skips frames without the copy in view", async () => {
    const shots = await shotsOf(
      [
        { frame: frame({ branch: "frame.png", flow: "A" }), boxes: [[100, 100, 50, 10]] },
        { frame: frame({ branch: "frame.png", flow: "B" }), boxes: [[100, 100, 50, 10]] },
        { frame: frame({ branch: "frame.png", flow: "C" }), boxes: [[300, 300, 50, 10]] },
        { frame: frame({ branch: "frame.png", flow: "D" }), boxes: [[300, 900, 50, 10]] },
      ],
      dir,
      (f) => f.flow,
    );
    expect(shots.map((s) => s.where)).toEqual([["A", "B"], ["C"]]);
    expect(shots[0].image).toMatch(/^data:image\/webp;base64,/);
  });
});

describe("frameName", () => {
  it("names a frame by viewport, section, flow and caption, the section by its heading where it has one", () => {
    const names = new Map([["staff-login", "Staff login"]]);
    expect(frameName(frame({}), names)).toBe("desktop › Staff login › Log in › 1. The form");
    expect(frameName(frame({ section: "other" }), names)).toBe("desktop › other › Log in › 1. The form");
    expect(frameName(frame({ section: "public-pages", flow: "/", index: 2, caption: "c" }))).toMatch(
      /^desktop › .+ › \/ › 2\. c$/,
    );
  });
});

describe("staleness", () => {
  it("warns of a run older than the last commit, or than a file with changed copy", () => {
    const at = "2026-11-09T10:00:00.000Z";
    expect(staleness(at, "2026-11-09T09:00:00Z", [{ file: "a.ts", mtime: Date.parse(at) - 1 }])).toEqual([]);
    const warnings = staleness(at, "2026-11-09T11:00:00Z", [
      { file: "a.ts", mtime: Date.parse(at) + 1 },
      { file: "b.ts", mtime: 0 },
    ]);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("older than the branch's last commit");
    expect(warnings[1]).toBe("Changed since the storyboard run: a.ts. Its frames may not show that copy as it is.");
  });
});

describe("sectionsToRun", () => {
  it("is the sections that showed the copy, or every section if any copy was in no frame", () => {
    const a = group([`${M} a`]);
    const b = group([`${M} b`]);
    const found = new Map([
      [a.key, [{ frame: frame({ section: "z" }), boxes: [] }]],
      [
        b.key,
        [
          { frame: frame({ section: "m" }), boxes: [] },
          { frame: frame({ section: "z" }), boxes: [] },
        ],
      ],
    ]);
    expect(sectionsToRun([a, b], found)).toEqual(["m", "z"]);
    expect(sectionsToRun([a, b], new Map([[a.key, found.get(a.key)!]]))).toEqual([]);
  });
});

describe("renderCopyPage", () => {
  it("shows each file's copy with its frames, and the copy in no frame at the end", () => {
    const seen = {
      ...group([`${M} Hi `, { expr: "name" }, " <you>"], "app/x.tsx", 4),
      shots: [] as { image: string; where: string[] }[],
    };
    seen.shots = [
      { image: "data:image/webp;base64,AAA", where: ["desktop › A › B › 1. C", "phone › A › B › 1. C"] },
      { image: "data:image/webp;base64,BBB", where: ["desktop › A › D › 1. E"] },
    ];
    const unseen = { ...group([`${M} Nowhere`], "lib/y.ts", 9), shots: [] };
    const html = renderCopyPage({
      branch: "my-branch",
      base: "abc1234",
      run: { name: "2026-11-09T10-00-00", at: "2026-11-09T10:00:00Z" },
      warnings: ["Old & stale"],
      groups: [seen, unseen],
    });
    expect(html).toContain(
      `<p class="text">${M} Hi <span class="slot" title="Filled in as the page is made">name</span> &lt;you&gt;</p>`,
    );
    expect(html).toContain('<a href="#file-app-x-tsx">app/x.tsx</a> (1)');
    expect(html).toContain('<a href="#unseen">In no frame</a> (1)');
    expect(html).toContain("<code>app/x.tsx:4</code>");
    expect(html).toContain("and 1 more frame the same");
    expect(html).toContain("phone › A › B › 1. C");
    expect(html).toContain('<p class="warning">Old &amp; stale</p>');
    expect(html).toContain("2 placeholders that <code>my-branch</code>");
    expect(html).toContain("1 in frames, 1 in none. Frames from storyboard run 2026-11-09T10-00-00");
    expect(html.indexOf("Nowhere")).toBeGreaterThan(html.indexOf('id="unseen"'));
  });

  it("says so when there's no run, and leaves out the list of copy in no frame when there's none", () => {
    const html = renderCopyPage({ branch: "b", base: "c", warnings: [], groups: [] });
    expect(html).toContain("0 placeholders");
    expect(html).not.toContain("Frames from storyboard run");
    expect(html).not.toContain('id="unseen"');
  });
});
