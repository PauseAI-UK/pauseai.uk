import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  appRoutes,
  changedCopyKeys,
  closure,
  copyKeysRead,
  flowReach,
  flowsToRun,
  folderPattern,
  importGraph,
  importsOf,
  reachContext,
  reachedFlows,
  resolveImport,
  routeFiles,
} from "./storyboard-reach.mjs";

// A checkout of a few files: a public page, a staff page behind a layout, the gallery with two groups, and
// the specs that open them.
const FILES: Record<string, string> = {
  "app/layout.tsx": `import "@/styles/globals.css";\nexport default function Root() {}`,
  "app/not-found.tsx": `export default function NotFound() {}`,
  "app/(site)/page.tsx": `import { Hero } from "@/components/Hero";\nexport default Hero;`,
  "app/(site)/blog/[slug]/page.tsx": `export default function Post() {}`,
  "app/(site)/blog/feed.xml/route.ts": `export function GET() {}`,
  "app/(site)/people/[[...name]]/page.tsx": `export default function People() {}`,
  "app/(site)/docs/[...path]/page.tsx": `export default function Docs() {}`,
  "app/(site)/_private/page.tsx": `export default function Hidden() {}`,
  "app/sitemap.ts": `export default function sitemap() {}`,
  "app/(staff)/staff/layout.tsx": `import { Nav } from "../_nav";\nexport default Nav;`,
  "app/(staff)/_nav.tsx": `import { staffCopy } from "@/lib/copy";\nexport const Nav = () => staffCopy.nav.title;`,
  "app/(staff)/staff/letters/page.tsx": `import { Letters } from "@/components/Letters";\nexport default Letters;`,
  "app/(staff)/staff/events/page.tsx": `import { staffCopy } from "@/lib/copy";\nconst { events, filters: f } = staffCopy;\nexport default () => events;`,
  "app/(tools)/gallery/[group]/page.tsx": `import { GROUPS } from "../_examples";\nexport default GROUPS;`,
  "app/(tools)/gallery/_examples/index.ts": `import { ui } from "./ui";\nimport { staff } from "./staff";\nexport const GROUPS = [ui, staff];`,
  "app/(tools)/gallery/_examples/ui.tsx": `import { Hero } from "@/components/Hero";\nexport const ui = Hero;`,
  "app/(tools)/gallery/_examples/staff.tsx": `import { Letters } from "@/components/Letters";\nimport { more } from "./staff.client";\nexport const staff = [Letters, more];`,
  "app/(tools)/gallery/_examples/staff.client.tsx": `export const more = 1;`,
  "components/Hero.tsx": `import type { Letter } from "@/lib/letters";\nimport styles from "./Hero.module.css";\nexport const Hero = styles;`,
  "components/Hero.module.css": `.hero { color: red; }`,
  "components/Letters.tsx": `import { type Letter, sortLetters } from "@/lib/letters";\nexport const Letters = sortLetters;`,
  "lib/letters.ts": `export type Letter = string;\nexport const sortLetters = () => require("./sort");`,
  "lib/sort.ts": `export default 1;`,
  "lib/copy.ts": `export const staffCopy = {\n  nav: {\n    title: "Staff",\n  },\n  events: {\n    title: "Events",\n  },\n  filters: {\n    any: "Any",\n  },\n};`,
  "lib/server/inbox.ts": `export const folder = "lib/server/replies/";`,
  "lib/server/replies/jane.eml": `From: jane.smith@example.com`,
  "styles/globals.css": `@import "./tokens.css";`,
  "styles/tokens.css": `:root {}`,
  "public/images/logo.svg": `<svg/>`,
  "tests/storyboard/fixtures.ts": `export const test = 1;`,
  "tests/storyboard/home.spec.ts": `import { test } from "./fixtures";`,
  "tests/storyboard/staff.spec.ts": `import { test } from "./fixtures";\nimport { steps } from "./staff-steps";`,
  "tests/storyboard/staff-steps.ts": `export const steps = 1;`,
  "tests/storyboard/gallery.spec.ts": `import { test } from "./fixtures";`,
  "tests/storyboard/uploads.spec.ts": `import { test } from "./fixtures";\nconst file = "uploads/list.csv";`,
  "tests/fixtures/uploads/list.csv": `name\nJane Smith`,
  "proxy.ts": `export const config = {};`,
  "tests/node_modules/pkg/index.ts": `export const ignored = 1;`,
};

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "storyboard-reach-"));
  for (const [path, text] of Object.entries(FILES)) {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const run = (key: string, opened: string[] = []) => {
  const [, section, flow] = key.split("|");
  return { key, section, flow, opened };
};
const home = run("desktop|home|The home page", ["/", "/images/logo.svg"]);
const letters = run("desktop|staff|The letters", ["/staff/letters"]);
const events = run("desktop|staff|The events", ["/staff/events"]);
const galleryUi = run("desktop|gallery|gallery: ui", ["/gallery/ui"]);
const galleryStaff = run("desktop|gallery|gallery: staff", ["/gallery/staff"]);
const upload = run("desktop|uploads|Uploading a list", ["/staff/letters"]);
const phoneHome = { ...home, key: "phone|home|The home page" };
const runs = [home, letters, events, galleryUi, galleryStaff, upload];

describe("importsOf", () => {
  it("lists the imports that run, not those of types alone", () => {
    const text = [
      `import a from "./a";`,
      `import type { B } from "./b";`,
      `import { type C, type D } from "./c";`,
      `import { type E, f } from "./e";`,
      `import "./side-effect";`,
      `export { g } from "./g";`,
      `export type { H } from "./h";`,
      `export { type I } from "./i";`,
      `export * from "./j";`,
      `const k = await import("./k");`,
      `const l = require("./l");`,
      `const m = require(name);`,
      `import * as n from "./n";`,
    ].join("\n");
    expect(importsOf("x.tsx", text)).toEqual(["./a", "./e", "./side-effect", "./g", "./j", "./k", "./l", "./n"]);
  });

  it("follows a stylesheet's @import, and a JSON file imports nothing", () => {
    expect(importsOf("x.css", `@import "./a.css";\n@import url('./b.css');`)).toEqual(["./a.css", "./b.css"]);
    expect(importsOf("x.json", `{}`)).toEqual([]);
  });
});

describe("resolveImport", () => {
  it("finds the repo's file from @/ or beside the importer, trying each ending, and not a package's", () => {
    expect(resolveImport(root, "app/(site)/page.tsx", "@/components/Hero")).toBe("components/Hero.tsx");
    expect(resolveImport(root, "components/Hero.tsx", "./Hero.module.css")).toBe("components/Hero.module.css");
    expect(resolveImport(root, "app/(tools)/gallery/[group]/page.tsx", "../_examples")).toBe(
      "app/(tools)/gallery/_examples/index.ts",
    );
    expect(resolveImport(root, "x.ts", "react")).toBeUndefined();
    expect(resolveImport(root, "x.ts", "./missing")).toBeUndefined();
  });
});

describe("importGraph and closure", () => {
  it("joins what each file imports, so a page reaches what its components import, but not through types", () => {
    const graph = importGraph(root);
    expect(graph.get("components/Hero.tsx")).toEqual(["components/Hero.module.css"]);
    expect(graph.get("proxy.ts")).toEqual([]);
    expect(graph.has("tests/node_modules/pkg/index.ts")).toBe(false);
    const reach = closure(graph, ["app/(site)/page.tsx"]);
    expect(reach).toEqual(new Set(["app/(site)/page.tsx", "components/Hero.tsx", "components/Hero.module.css"]));
    expect(closure(graph, ["components/Letters.tsx"])).toContain("lib/sort.ts");
    expect(closure(graph, ["not/a/file.ts"])).toEqual(new Set(["not/a/file.ts"]));
  });
});

describe("folderPattern", () => {
  it("matches a folder's URLs, leaving out groups and slots, with dynamic segments, catch-alls and optional ones", () => {
    expect(folderPattern("app/(site)/blog/[slug]").test("/blog/a-post")).toBe(true);
    expect(folderPattern("app/(site)/blog/[slug]").test("/blog/a/b")).toBe(false);
    expect(folderPattern("app/(site)/docs/[...path]").test("/docs/a/b")).toBe(true);
    expect(folderPattern("app/(site)/docs/[...path]").test("/docs")).toBe(false);
    expect(folderPattern("app/(site)/people/[[...name]]").test("/people")).toBe(true);
    expect(folderPattern("app/(site)/people/[[...name]]").test("/people/jane")).toBe(true);
    expect(folderPattern("app/@modal/(site)").test("/")).toBe(true);
    expect(folderPattern("app/(site)/blog/feed.xml").test("/blog/feedxxml")).toBe(false);
    expect(folderPattern("app/(staff)/staff", true).test("/staff/letters")).toBe(true);
    expect(folderPattern("app/(staff)/staff", true).test("/staffing")).toBe(false);
  });
});

describe("appRoutes and routeFiles", () => {
  it("renders a URL with its page or route and every layout above it, a metadata route from its file, and an unknown one as not found", () => {
    const routes = appRoutes(root);
    expect(routeFiles(routes, "/staff/letters")).toEqual([
      "app/layout.tsx",
      "app/not-found.tsx",
      "app/(staff)/staff/layout.tsx",
      "app/(staff)/staff/letters/page.tsx",
    ]);
    expect(routeFiles(routes, "/blog/feed.xml")).toContain("app/(site)/blog/feed.xml/route.ts");
    expect(routeFiles(routes, "/blog/a-post")).toContain("app/(site)/blog/[slug]/page.tsx");
    expect(routeFiles(routes, "/sitemap.xml")).toContain("app/sitemap.ts");
    expect(routeFiles(routes, "/private")).toEqual(["app/layout.tsx", "app/not-found.tsx"]);
  });

  it("finds no routes in a checkout without an app", () => {
    expect(appRoutes(join(root, "lib"))).toEqual([]);
  });
});

describe("flowReach", () => {
  const context = () => reachContext(root);

  it("reaches the spec and its imports, each page's files and theirs, and the public files fetched", () => {
    const reach = flowReach(home, context());
    expect(reach).toContain("tests/storyboard/home.spec.ts");
    expect(reach).toContain("tests/storyboard/fixtures.ts");
    expect(reach).toContain("components/Hero.module.css");
    expect(reach).toContain("styles/tokens.css");
    expect(reach).toContain("public/images/logo.svg");
    expect(reach).not.toContain("components/Letters.tsx");
  });

  it("takes a flow that opened nothing to reach its spec alone", () => {
    const { opened, ...nothing } = home;
    void opened;
    expect(flowReach(nothing, context())).toEqual(
      new Set(["tests/storyboard/home.spec.ts", "tests/storyboard/fixtures.ts"]),
    );
  });

  it("takes a gallery group to reach its own examples, not the other groups'", () => {
    const ui = flowReach(galleryUi, context());
    expect(ui).toContain("app/(tools)/gallery/_examples/ui.tsx");
    expect(ui).not.toContain("app/(tools)/gallery/_examples/staff.tsx");
    const staff = flowReach(galleryStaff, context());
    expect(staff).toContain("app/(tools)/gallery/_examples/staff.client.tsx");
    expect(staff).not.toContain("components/Hero.tsx");
  });

  it("takes a gallery flow that names no group, or a checkout without the gallery, to reach every example", () => {
    const index = flowReach(run("desktop|gallery|The index", ["/gallery/ui"]), context());
    expect(index).toContain("app/(tools)/gallery/_examples/staff.tsx");
    const without = { ...context(), graph: new Map() };
    expect(flowReach(galleryUi, without)).toContain("tests/storyboard/gallery.spec.ts");
  });
});

describe("changedCopyKeys", () => {
  const before = FILES["lib/copy.ts"];
  const after = before.replace(`"Events"`, `"The events"`).replace(`"Any"`, `"Any at all"`);

  it("names the top-level keys whose lines a diff changed, before and after", () => {
    const diff = "@@ -6 +6 @@\n-x\n+y\n@@ -9,0 +10,2 @@\n+a\n+b\n";
    expect(changedCopyKeys(diff, before, after)).toEqual(new Set(["events", "filters"]));
  });

  it("says * for a line outside every key", () => {
    expect(changedCopyKeys("@@ -1 +1 @@\n", before, after)).toEqual(new Set(["*"]));
  });
});

describe("copyKeysRead", () => {
  it("reads staffCopy.key and destructured keys, and * where the object is used whole", () => {
    expect(copyKeysRead(FILES["app/(staff)/staff/events/page.tsx"])).toEqual(new Set(["events", "filters"]));
    expect(copyKeysRead(`import { staffCopy } from "x";\nshow(staffCopy);`)).toEqual(new Set(["*"]));
    expect(copyKeysRead(`const { } = staffCopy;`)).toEqual(new Set());
  });
});

describe("reachedFlows", () => {
  const reached = (files: string[], copyKeys?: Set<string>) =>
    reachedFlows({ files, runs, context: reachContext(root), copyKeys });

  it("reruns the flows whose reach has a changed file, and none for a file no flow reaches", () => {
    expect(reached(["components/Letters.tsx"]).keys).toEqual(new Set([letters.key, galleryStaff.key, upload.key]));
    expect(reached(["lib/server/inbox.ts"]).keys).toEqual(new Set());
    expect(reached(["public/images/logo.svg"]).keys).toEqual(new Set([home.key]));
  });

  it("says which files reach everything, and reruns nothing for docs, tests and the review's own code", () => {
    expect(reached(["netlify/database/migrations/0200_x.sql", "docs/testing.md"]).everything).toEqual([
      "netlify/database/migrations/0200_x.sql",
    ]);
    expect(reached(["docs/testing.md", "lib/x.test.ts", "tests/storyboard/report/page.ts"])).toEqual({
      keys: new Set(),
      everything: [],
    });
  });

  it("reruns a change to the staff copy only for the flows reading the keys it changed, or all its readers' for *", () => {
    const context = reachContext(root);
    const copy = (keys: string[]) =>
      reachedFlows({
        files: ["lib/content/staff-interface.ts"],
        runs,
        context: { ...context, graph: withCopy(context.graph) },
        copyKeys: new Set(keys),
      });
    expect(copy(["events"]).keys).toEqual(new Set([events.key]));
    expect(copy(["nav"]).keys).toEqual(new Set([letters.key, events.key, upload.key]));
    expect(copy(["*"]).keys).toEqual(new Set([letters.key, events.key, upload.key]));
  });

  it("reruns the flows that opened a route whose page or layout was added or deleted", () => {
    expect(reached(["app/(staff)/staff/new/page.tsx"]).keys).toEqual(new Set());
    expect(reached(["app/(staff)/staff/letters/page.tsx"]).keys).toEqual(new Set([letters.key, upload.key]));
    expect(reached(["app/(staff)/staff/events/layout.tsx"]).keys).toEqual(new Set([events.key]));
    expect(reached(["app/(staff)/staff/gone/layout.tsx"]).keys).toEqual(new Set());
    expect(reached(["app/(site)/blog/layout.tsx"]).keys).toEqual(new Set());
    const { opened, ...without } = letters;
    void opened;
    expect(
      reachedFlows({ files: ["app/(staff)/staff/letters/page.tsx"], runs: [without], context: reachContext(root) })
        .keys,
    ).toEqual(new Set());
  });

  it("reruns the flows reaching what reads a data file: a spec naming it, or code naming its folder", () => {
    expect(reached(["tests/fixtures/uploads/list.csv"]).keys).toEqual(new Set([upload.key]));
    expect(reached(["lib/server/replies/jane.eml"]).keys).toEqual(new Set());
    expect(reached(["somewhere/else.txt"]).keys).toEqual(new Set());
  });
});

/** The checkout's copy file at staffCopy's real path, as the repo has it, for the copy rule to apply. */
function withCopy(graph: Map<string, string[]>) {
  const copy = "lib/content/staff-interface.ts";
  mkdirSync(join(root, "lib/content"), { recursive: true });
  writeFileSync(join(root, copy), FILES["lib/copy.ts"]);
  const out = new Map<string, string[]>();
  for (const [file, imports] of graph)
    out.set(
      file,
      imports.map((i) => (i === "lib/copy.ts" ? copy : i)),
    );
  return out;
}

describe("flowsToRun", () => {
  const passed = (r: ReturnType<typeof run>, tree = "t1") => ({ ...r, status: "passed", tree });
  const suite = new Set([home.key, letters.key, events.key, phoneHome.key, "desktop|home|A new flow"]);
  const choose = (files: string[], carried = [passed(home), passed(letters), passed(events), passed(phoneHome)]) =>
    flowsToRun({
      suite,
      carried,
      phoneTagged: new Set(),
      context: reachContext(root),
      changedSince: () => files,
      copyKeysSince: () => undefined,
    });

  it("runs the flows new to the suite, and those a change since their tree reaches", () => {
    const chosen = choose(["components/Letters.tsx"]);
    expect(chosen.run).toEqual(new Set(["desktop|home|A new flow", letters.key]));
    expect(chosen).toMatchObject({ fresh: 1, reached: 1, everything: [], changed: ["components/Letters.tsx"] });
  });

  it("runs a flow that failed, or that has no tree or nothing opened, and carries the rest when nothing changed", () => {
    const chosen = choose([], [
      { ...passed(home), status: "failed" },
      { ...passed(letters), tree: undefined },
      { ...passed(events), opened: undefined },
      passed(phoneHome),
    ] as never);
    expect(chosen.run).toEqual(new Set([home.key, letters.key, events.key, "desktop|home|A new flow"]));
  });

  it("runs every desktop flow, and the phone's tagged ones, when a file that reaches everything changed", () => {
    const chosen = flowsToRun({
      suite: new Set([...suite, "phone|staff|Untagged"]),
      carried: [passed(home), passed(letters), passed(events), passed(phoneHome), passed(run("phone|staff|Untagged"))],
      phoneTagged: new Set([phoneHome.key]),
      context: reachContext(root),
      changedSince: (tree) => (tree === "t1" ? ["netlify/database/schema.sql"] : []),
      copyKeysSince: () => undefined,
    });
    expect(chosen.run).toEqual(new Set([...suite]));
    expect(chosen.everything).toEqual(["netlify/database/schema.sql"]);
  });

  it("works out each tree's changes once, for the flows that ran on it, and leaves out flows gone from the suite", () => {
    const asked: string[] = [];
    const chosen = flowsToRun({
      suite,
      carried: [
        passed(home, "t1"),
        passed(letters, "t2"),
        passed(events, "t2"),
        passed(phoneHome, "t1"),
        passed(run("desktop|gone|Gone"), "t3"),
      ],
      phoneTagged: new Set(),
      context: reachContext(root),
      changedSince: (tree) => {
        asked.push(tree);
        return tree === "t2" ? ["components/Hero.tsx"] : [];
      },
      copyKeysSince: () => undefined,
    });
    expect(asked).toEqual(["t1", "t2"]);
    expect(chosen.run).toEqual(new Set(["desktop|home|A new flow"]));
  });
});
