import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  NAMED,
  reachContext,
  reachedFlows,
  resolveImport,
  routeFiles,
  STAFF_COPY,
  unresolvedImports,
} from "./storyboard-reach.mjs";

const COPY = [
  `const shared = "Staff";`,
  `export const staffCopy = {`,
  `  nav: {`,
  `    title: shared,`,
  `  },`,
  `  events: {`,
  `    title: "Events",`,
  `  },`,
  `  filters: {`,
  `    any: "Any",`,
  `  },`,
  `};`,
  `export const jobTitles = {`,
  `  events: staffCopy.events.title,`,
  `};`,
].join("\n");

// A checkout of a few files: public pages, staff pages behind a layout, the gallery with two groups, the
// specs that open them, and what the build and the server run whatever is opened.
const FILES: Record<string, string> = {
  "app/layout.tsx": `import "@/styles/globals.css";\nexport default function Root() {}`,
  "app/not-found.tsx": `export default function NotFound() {}`,
  "app/(site)/page.tsx": `import { Hero } from "@/components/Hero";\nexport default Hero;`,
  "app/(site)/blog/[slug]/page.tsx": `import "@/lib/posts";\nexport default function Post() {}`,
  "app/(site)/blog/feed.xml/route.ts": `import "@/lib/feed";\nexport function GET() {}`,
  "app/(site)/people/[[...name]]/page.tsx": `export default function People() {}`,
  "app/(site)/docs/[...path]/page.tsx": `export default function Docs() {}`,
  "app/(site)/_private/page.tsx": `export default function Hidden() {}`,
  "app/sitemap.ts": `export default function sitemap() {}`,
  "app/(staff)/staff/layout.tsx": `import { Nav } from "../_nav";\nexport default Nav;`,
  "app/(staff)/_nav.tsx": `import { staffCopy } from "@/lib/content/staff-interface";\nexport const Nav = () => staffCopy.nav.title;`,
  "app/(staff)/staff/letters/page.tsx": `import { Letters } from "@/components/Letters";\nexport default Letters;`,
  "app/(staff)/staff/events/page.tsx": `import { staffCopy } from "@/lib/content/staff-interface";\nconst { events, filters: f } = staffCopy;\nexport default () => events;`,
  "app/(staff)/staff/jobs/page.tsx": `import { jobTitles } from "@/lib/content/staff-interface";\nexport default () => jobTitles;`,
  "app/(tools)/gallery/page.tsx": `import { GROUPS } from "./_examples";\nexport default GROUPS;`,
  "app/(tools)/gallery/[group]/page.tsx": `import { GROUPS } from "../_examples";\nexport default GROUPS;`,
  "app/(tools)/gallery/_examples/index.ts": `import { ui } from "./ui";\nimport { staff } from "./staff";\nexport const GROUPS = [ui, staff];`,
  "app/(tools)/gallery/_examples/ui.tsx": `import { Hero } from "@/components/Hero";\nexport const ui = Hero;`,
  "app/(tools)/gallery/_examples/staff.tsx": `import { Letters } from "@/components/Letters";\nimport { more } from "./staff.client";\nexport const staff = [Letters, more];`,
  "app/(tools)/gallery/_examples/staff.client.tsx": `export const more = 1;`,
  "components/Hero.tsx": `import type { Letter } from "@/lib/letters";\nimport styles from "./Hero.module.css";\nexport const Hero = styles;`,
  "components/Hero.module.css": `.hero { composes: box from "./box.module.css"; }`,
  "components/box.module.css": `.box { margin: 0; }`,
  "components/Letters.tsx": `import { type Letter, sortLetters } from "@/lib/letters";\nexport const Letters = sortLetters;`,
  "lib/letters.ts": `export type Letter = string;\nexport const sortLetters = () => require("./sort");`,
  "lib/sort.ts": `export default 1;`,
  "lib/posts.ts": `export default 1;`,
  "lib/feed.ts": `export default 1;`,
  "lib/redirects.ts": `export default [];`,
  "lib/session.ts": `export default 1;`,
  "lib/broken.ts": `import "./nowhere";\nimport "react";`,
  "lib/content/staff-interface.ts": COPY,
  "lib/server/errors.ts": `export const keep = 1;`,
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
  "next.config.ts": `import redirects from "./lib/redirects";\nexport default { redirects };`,
  "proxy.ts": `import "@/lib/session";\nexport const config = {};`,
  "instrumentation.ts": `export async function register() {\n  await import("@/lib/server/errors");\n}`,
  "node_modules/pkg/index.ts": `export const ignored = 1;`,
  "tmp/scratch.ts": `export const ignored = 1;`,
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
const post = run("desktop|home|A post", ["/blog/a-post", "/images/gone.svg"]);
const letters = run("desktop|staff|The letters", ["/staff/letters"]);
const events = run("desktop|staff|The events", ["/staff/events"]);
const jobs = run("desktop|staff|The jobs", ["/staff/jobs"]);
const broken = run("desktop|staff|A letter that fails", ["/staff/letters", "instrumentation.ts"]);
const galleryUi = run("desktop|gallery|gallery: ui", ["/gallery/ui"]);
const galleryStaff = run("desktop|gallery|gallery: staff", ["/gallery/staff"]);
const galleryIndex = run("desktop|gallery|gallery: index", ["/gallery"]);
const upload = run("desktop|uploads|Uploading a list", ["/staff/letters"]);
const phoneHome = { ...home, key: "phone|home|The home page" };
const runs = [home, post, letters, events, jobs, broken, galleryUi, galleryStaff, galleryIndex, upload];
const keysOf = (...some: { key: string }[]) => new Set(some.map((r) => r.key));
const everyRun = keysOf(...runs);
const staffRuns = keysOf(letters, events, jobs, broken, upload);

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

  it("follows a stylesheet's @import and composes, and a JSON file imports nothing", () => {
    const css = `@import "./a.css";\n@import url('./b.css');\n.x { composes: y z from "./c.module.css"; }`;
    expect(importsOf("x.css", css)).toEqual(["./a.css", "./b.css", "./c.module.css"]);
    expect(importsOf("x.json", `{}`)).toEqual([]);
  });
});

describe("resolveImport and unresolvedImports", () => {
  it("finds the repo's file from @/ or beside the importer, trying each ending, and not a package's", () => {
    expect(resolveImport(root, "app/(site)/page.tsx", "@/components/Hero")).toBe("components/Hero.tsx");
    expect(resolveImport(root, "components/Hero.tsx", "./Hero.module.css")).toBe("components/Hero.module.css");
    expect(resolveImport(root, "app/(tools)/gallery/[group]/page.tsx", "../_examples")).toBe(
      "app/(tools)/gallery/_examples/index.ts",
    );
    expect(resolveImport(root, "x.ts", "react")).toBeUndefined();
    expect(resolveImport(root, "x.ts", "./missing")).toBeUndefined();
  });

  it("lists the imports of a repo file that isn't there, and not a package's", () => {
    expect(unresolvedImports(root)).toEqual(["lib/broken.ts: ./nowhere"]);
  });
});

describe("importGraph and closure", () => {
  it("joins what each file imports, so a page reaches what its components import, but not through types", () => {
    const graph = importGraph(root);
    expect(graph.get("components/Hero.tsx")).toEqual(["components/Hero.module.css"]);
    expect(graph.get("lib/broken.ts")).toEqual([]);
    expect(graph.get("instrumentation.ts")).toEqual(["lib/server/errors.ts"]);
    expect(graph.has("node_modules/pkg/index.ts")).toBe(false);
    expect(graph.has("tmp/scratch.ts")).toBe(false);
    expect(closure(graph, ["app/(site)/page.tsx"])).toEqual(
      new Set([
        "app/(site)/page.tsx",
        "components/Hero.tsx",
        "components/Hero.module.css",
        "components/box.module.css",
      ]),
    );
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
    expect(folderPattern("app", true).test("/anything/at/all")).toBe(true);
  });
});

describe("appRoutes and routeFiles", () => {
  it("renders a URL with its page or route and every layout above it, and a metadata route from its file", () => {
    const routes = appRoutes(root);
    expect(routeFiles(routes, "/staff/letters")).toEqual([
      "app/layout.tsx",
      "app/not-found.tsx",
      "app/(staff)/staff/layout.tsx",
      "app/(staff)/staff/letters/page.tsx",
    ]);
    expect(routeFiles(routes, "/blog/a-post")).toContain("app/(site)/blog/[slug]/page.tsx");
    expect(routeFiles(routes, "/blog/a-post")).not.toContain("app/(site)/blog/feed.xml/route.ts");
    expect(routeFiles(routes, "/sitemap.xml")).toContain("app/sitemap.ts");
  });

  it("gives the files of every route that could serve a URL, and the not-found page's for one none serves", () => {
    const routes = appRoutes(root);
    const feed = routeFiles(routes, "/blog/feed.xml");
    expect(feed).toContain("app/(site)/blog/feed.xml/route.ts");
    expect(feed).toContain("app/(site)/blog/[slug]/page.tsx");
    expect(feed.filter((file) => file === "app/layout.tsx")).toHaveLength(1);
    expect(routeFiles(routes, "/private")).toEqual(["app/layout.tsx", "app/not-found.tsx"]);
  });

  it("finds no routes in a checkout without an app", () => {
    expect(appRoutes(join(root, "lib"))).toEqual([]);
  });
});

describe("flowReach", () => {
  it("reaches the spec and its imports, each page's files and theirs, the public files fetched, and what every flow runs", () => {
    const reach = flowReach(home, reachContext(root));
    for (const file of [
      "tests/storyboard/home.spec.ts",
      "tests/storyboard/fixtures.ts",
      "components/box.module.css",
      "styles/tokens.css",
      "public/images/logo.svg",
      "next.config.ts",
      "lib/redirects.ts",
      "proxy.ts",
      "lib/session.ts",
    ])
      expect(reach).toContain(file);
    expect(reach).not.toContain("components/Letters.tsx");
    expect(reach).not.toContain("lib/server/errors.ts");
  });

  it("takes a flow that opened nothing to reach its spec and what every flow runs", () => {
    const { opened, ...nothing } = home;
    void opened;
    expect(flowReach(nothing, reachContext(root))).toEqual(
      new Set([
        "tests/storyboard/home.spec.ts",
        "tests/storyboard/fixtures.ts",
        "next.config.ts",
        "lib/redirects.ts",
        "proxy.ts",
        "lib/session.ts",
      ]),
    );
  });

  it("takes an entry that isn't a path as a file whose code ran: where the server hands over an error it keeps", () => {
    expect(flowReach(broken, reachContext(root))).toContain("lib/server/errors.ts");
    expect(flowReach(letters, reachContext(root))).not.toContain("lib/server/errors.ts");
  });

  it("takes a gallery group to reach its own examples, not the other groups'", () => {
    const ui = flowReach(galleryUi, reachContext(root));
    expect(ui).toContain("app/(tools)/gallery/_examples/ui.tsx");
    expect(ui).not.toContain("app/(tools)/gallery/_examples/staff.tsx");
    const staff = flowReach(galleryStaff, reachContext(root));
    expect(staff).toContain("app/(tools)/gallery/_examples/staff.client.tsx");
    expect(staff).not.toContain("components/Hero.tsx");
  });

  it("takes a gallery flow with no examples file of its name, or a checkout without the gallery, to reach every example", () => {
    const index = flowReach(galleryIndex, reachContext(root));
    expect(index).toContain("app/(tools)/gallery/_examples/staff.tsx");
    expect(index).toContain("app/(tools)/gallery/_examples/ui.tsx");
    const without = { ...reachContext(root), graph: new Map<string, string[]>() };
    expect(flowReach(galleryUi, without)).toContain("tests/storyboard/gallery.spec.ts");
  });

  it("works a flow's reach out once for a context, and afresh without the context's memory", () => {
    const context = reachContext(root);
    expect(flowReach(home, context)).toBe(flowReach({ ...home }, context));
    const { reaches, ...forgetful } = context;
    void reaches;
    expect(flowReach(home, forgetful)).not.toBe(flowReach(home, forgetful));
  });
});

describe("changedCopyKeys", () => {
  const hunk = (line: number, added = 1) => `@@ -${line} +${line},${added} @@\n`;

  it("names the top-level keys of staffCopy whose lines a diff changed, before and after", () => {
    expect(changedCopyKeys(hunk(7) + hunk(10, 2), COPY, COPY)).toEqual(new Set(["events", "filters"]));
    expect(changedCopyKeys("@@ -4,0 +4 @@\n", COPY, COPY)).toEqual(new Set(["nav"]));
  });

  it("says * for a line outside the object: before it, its last line, or after it, another export's", () => {
    expect(changedCopyKeys(hunk(1), COPY, COPY)).toEqual(new Set(["*"]));
    expect(changedCopyKeys(hunk(2), COPY, COPY)).toEqual(new Set(["*"]));
    expect(changedCopyKeys(hunk(12), COPY, COPY)).toEqual(new Set(["*"]));
    expect(changedCopyKeys(hunk(14), COPY, COPY)).toEqual(new Set(["*"]));
  });

  it("says * for a file with no staffCopy, or one that never closes it", () => {
    expect(changedCopyKeys(hunk(1), "", "export const other = {\n  nav: 1,\n};")).toEqual(new Set(["*"]));
    expect(changedCopyKeys(hunk(2), "", "export const staffCopy = {\n  nav: 1,")).toEqual(new Set(["*"]));
  });
});

describe("copyKeysRead", () => {
  it("reads staffCopy.key and destructured keys, and * where the object is used whole", () => {
    expect(copyKeysRead(FILES["app/(staff)/staff/events/page.tsx"])).toEqual(new Set(["events", "filters"]));
    expect(copyKeysRead(`import { staffCopy } from "x";\nshow(staffCopy);`)).toEqual(new Set(["*"]));
    expect(copyKeysRead(`const { } = staffCopy;`)).toEqual(new Set());
    expect(copyKeysRead(FILES["app/(staff)/staff/jobs/page.tsx"])).toEqual(new Set());
  });
});

describe("reachedFlows", () => {
  const reached = (files: string[], copyKeys?: Set<string>) =>
    reachedFlows({ files, runs, context: reachContext(root), copyKeys });

  it("reruns the flows whose reach has a changed file, and none for code no flow reaches", () => {
    expect(reached(["components/Letters.tsx"]).keys).toEqual(
      keysOf(letters, broken, galleryStaff, galleryIndex, upload),
    );
    expect(reached(["lib/server/inbox.ts"])).toEqual({ keys: new Set(), everything: [], unknown: [] });
    expect(reached(["components/box.module.css"]).keys).toEqual(keysOf(home, galleryUi, galleryIndex));
  });

  it("reruns every flow for what the build's settings and the proxy import, and only the flows that kept an error for what handles one", () => {
    expect(reached(["lib/redirects.ts"]).keys).toEqual(everyRun);
    expect(reached(["lib/session.ts"]).keys).toEqual(everyRun);
    expect(reached(["lib/server/errors.ts"]).keys).toEqual(keysOf(broken));
  });

  it("reruns the flows that fetched a public file, there or not", () => {
    expect(reached(["public/images/logo.svg"]).keys).toEqual(keysOf(home));
    expect(reached(["public/images/gone.svg"]).keys).toEqual(keysOf(post));
    expect(reached(["public/images/unused.svg"]).keys).toEqual(new Set());
  });

  it("says which files reach every flow, and reruns nothing for docs, tests, types and the review's own code", () => {
    expect(reached(["netlify/database/migrations/0200_x.sql", ".nvmrc", "next.config.ts", "docs/testing.md"])).toEqual({
      keys: new Set(),
      everything: ["netlify/database/migrations/0200_x.sql", ".nvmrc", "next.config.ts"],
      unknown: [],
    });
    expect(
      reached(["docs/testing.md", "lib/x.test.ts", "tests/storyboard/report/page.ts", "next-env.d.ts", "netlify.toml"]),
    ).toEqual({ keys: new Set(), everything: [], unknown: [] });
  });

  it("can't place a file at the top that nothing imports, or one that isn't code and that no file names", () => {
    expect(reached(["postcss.config.mjs", "Makefile", "somewhere/else.txt"]).unknown).toEqual([
      "postcss.config.mjs",
      "Makefile",
      "somewhere/else.txt",
    ]);
    const context = reachContext(root);
    const imported = { ...context, graph: new Map([...context.graph, ["lib/x.ts", ["settings.ts"]]]) };
    expect(reachedFlows({ files: ["settings.ts"], runs, context: imported }).unknown).toEqual([]);
  });

  it("reruns a change to the staff copy for the flows reaching a reader of the keys changed, or one that names no key", () => {
    expect(reached([STAFF_COPY], new Set(["events"])).keys).toEqual(keysOf(events, jobs));
    expect(reached([STAFF_COPY], new Set(["filters", "none-reads-this"])).keys).toEqual(keysOf(events, jobs));
    expect(reached([STAFF_COPY], new Set(["nav"])).keys).toEqual(staffRuns);
  });

  it("reruns every flow that reaches the staff copy when a line outside a key changed, or the keys aren't known", () => {
    expect(reached([STAFF_COPY], new Set(["*", "events"])).keys).toEqual(staffRuns);
    expect(reached([STAFF_COPY]).keys).toEqual(staffRuns);
  });

  it("reruns the flows that opened a route whose page or layout was added or deleted", () => {
    expect(reached(["app/(staff)/staff/new/page.tsx"]).keys).toEqual(new Set());
    expect(reached(["app/(staff)/staff/letters/page.tsx"]).keys).toEqual(keysOf(letters, broken, upload));
    expect(reached(["app/(staff)/staff/events/layout.tsx"]).keys).toEqual(keysOf(events));
    expect(reached(["app/(site)/blog/layout.tsx"]).keys).toEqual(keysOf(post));
    expect(reached(["app/error.tsx"]).keys).toEqual(everyRun);
    const { opened, ...without } = letters;
    void opened;
    expect(
      reachedFlows({ files: ["app/(staff)/staff/letters/page.tsx"], runs: [without], context: reachContext(root) })
        .keys,
    ).toEqual(new Set());
  });

  it("reruns the flows reaching what reads a data file: a spec naming it, or code naming its folder", () => {
    expect(reached(["tests/fixtures/uploads/list.csv"])).toEqual({
      keys: keysOf(upload),
      everything: [],
      unknown: [],
    });
    expect(reached(["lib/server/replies/jane.eml"])).toEqual({ keys: new Set(), everything: [], unknown: [] });
  });
});

describe("flowsToRun", () => {
  const passed = (r: ReturnType<typeof run>, tree = "t1") => ({ ...r, status: "passed", tree });
  const fresh = "desktop|home|A new flow";
  const suite = new Set([home.key, letters.key, events.key, phoneHome.key, fresh]);
  const carried = [passed(home), passed(letters), passed(events), passed(phoneHome)];
  const choose = (
    changedSince: (tree: string) => string[] | undefined,
    from: (ReturnType<typeof passed> | Record<string, unknown>)[] = carried,
    phoneTagged = new Set<string>(),
  ) =>
    flowsToRun({
      suite,
      carried: from as never,
      phoneTagged,
      context: reachContext(root),
      changedSince,
      copyKeysSince: () => undefined,
    });

  it("runs the flows new to the suite, and those a change since their tree reaches", () => {
    const chosen = choose(() => ["components/Letters.tsx"]);
    expect(chosen.run).toEqual(new Set([fresh, letters.key]));
    expect(chosen).toMatchObject({
      fresh: 1,
      reached: 1,
      swept: 0,
      everything: [],
      unknown: [],
      changed: ["components/Letters.tsx"],
    });
  });

  it("runs a flow that failed, or that recorded no tree or nothing opened, and carries the rest when nothing changed", () => {
    const chosen = choose(
      () => [],
      [
        { ...passed(home), status: "failed" },
        { ...passed(letters), tree: undefined },
        { ...passed(events), opened: undefined },
        passed(phoneHome),
      ],
    );
    expect(chosen.run).toEqual(new Set([home.key, letters.key, events.key, fresh]));
    expect(chosen).toMatchObject({ fresh: 4, reached: 0, swept: 0 });
  });

  it("runs a flow whose tree git no longer has", () => {
    const chosen = choose(
      (tree) => (tree === "gone" ? undefined : []),
      [passed(home, "gone"), passed(letters), passed(events), passed(phoneHome)],
    );
    expect(chosen.run).toEqual(new Set([home.key, fresh]));
    expect(chosen.fresh).toBe(2);
  });

  it("runs every desktop flow, and the phone's tagged ones, when a file that reaches everything changed", () => {
    const untagged = run("phone|staff|Untagged", ["/staff/letters"]);
    const chosen = flowsToRun({
      suite: new Set([...suite, untagged.key]),
      carried: [...carried, passed(untagged)],
      phoneTagged: new Set([phoneHome.key]),
      context: reachContext(root),
      changedSince: () => ["netlify/database/schema.sql"],
      copyKeysSince: () => undefined,
    });
    expect(chosen.run).toEqual(suite);
    expect(chosen).toMatchObject({ swept: 4, reached: 0, everything: ["netlify/database/schema.sql"] });
  });

  it("runs every flow, on both viewports, when the map can't place a changed file", () => {
    const untagged = run("phone|staff|Untagged", ["/staff/letters"]);
    const chosen = flowsToRun({
      suite: new Set([...suite, untagged.key]),
      carried: [...carried, passed(untagged)],
      phoneTagged: new Set(),
      context: reachContext(root),
      changedSince: () => ["postcss.config.mjs"],
      copyKeysSince: () => undefined,
    });
    expect(chosen.run).toEqual(new Set([...suite, untagged.key]));
    expect(chosen.unknown).toEqual(["postcss.config.mjs"]);
  });

  it("works out each tree's changes once, for the flows that ran on it, and leaves out flows gone from the suite", () => {
    const asked: string[] = [];
    const chosen = choose(
      (tree) => {
        asked.push(tree);
        return tree === "t2" ? ["components/Hero.tsx"] : [];
      },
      [
        passed(home, "t1"),
        passed(letters, "t2"),
        passed(events, "t2"),
        passed(phoneHome, "t1"),
        passed(run("desktop|gone|Gone"), "t3"),
      ],
    );
    expect(asked).toEqual(["t1", "t2"]);
    expect(chosen.run).toEqual(new Set([fresh]));
  });

  it("asks for the staff copy's changed keys by tree", () => {
    const chosen = flowsToRun({
      suite,
      carried,
      phoneTagged: new Set(),
      context: reachContext(root),
      changedSince: () => [STAFF_COPY],
      copyKeysSince: (tree) => (tree === "t1" ? new Set(["events"]) : undefined),
    });
    expect(chosen.run).toEqual(new Set([fresh, events.key]));
  });
});

describe("this repo", () => {
  const repo = join(import.meta.dirname, "..");

  it("has every file the map names by its path", () => {
    expect(NAMED.filter((path) => !existsSync(join(repo, path)))).toEqual([]);
  });

  it("has no import of a repo file that the map can't follow", () => {
    expect(unresolvedImports(repo)).toEqual([]);
  });
});
