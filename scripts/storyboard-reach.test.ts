import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  handOvers,
  importGraph,
  importsOf,
  NAMED,
  reachContext,
  RECORDING,
  readByNoFlow,
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
  "app/layout.tsx": `import "@/styles/globals.css";\nimport "@/lib/font";\nexport default function Root() {}`,
  "app/not-found.tsx": `export default function NotFound() {}`,
  "app/(site)/page.tsx": `import { Hero } from "@/components/Hero";\nexport default Hero;`,
  "app/(site)/blog/[slug]/page.tsx": `import "@/lib/posts";\nexport default function Post() {}`,
  "app/(site)/blog/feed.xml/route.ts": `import "@/lib/feed";\nexport function GET() {}`,
  "app/(site)/people/[[...name]]/page.tsx": `export default function People() {}`,
  "app/(site)/docs/[...path]/page.tsx": `export default function Docs() {}`,
  "app/(site)/_private/page.tsx": `export default function Hidden() {}`,
  "app/sitemap.ts": `export default function sitemap() {\n  return readdirSync(join(process.cwd(), "app"));\n}`,
  "app/(staff)/staff/layout.tsx": `import { Nav } from "../_nav";\nexport default Nav;`,
  "app/(staff)/_nav.tsx": `import { staffCopy } from "@/lib/content/staff-interface";\nexport const Nav = () => staffCopy.nav.title;`,
  "app/(staff)/staff/letters/page.tsx": `import { Letters } from "@/components/Letters";\nimport "@/lib/attach";\nexport default Letters;`,
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
  "lib/posts.ts": `import "@/lib/server/problems";\nexport default 1;`,
  "lib/feed.ts": `export default 1;`,
  "lib/redirects.ts": `export default [];`,
  "lib/session.ts": `export default 1;`,
  "lib/broken.ts": `import "./nowhere";\nimport "react";\nconst late = await import(name);`,
  "lib/attach.ts": `export const briefing = (file: string) => join(process.cwd(), "public", "pdfs", file);`,
  "lib/font.ts": `export const font = localFont({ src: "./fonts/inter.woff2" });`,
  "lib/fonts/inter.woff2": `font`,
  "lib/content/notes.md": `Read by nothing.`,
  "lib/README.md": `About lib.`,
  "public/pdfs/briefing.pdf": `pdf`,
  "lib/content/staff-interface.ts": COPY,
  "lib/server/errors.ts": `export const keep = 1;`,
  "lib/server/problems.ts": `export const registerRunStore = (find: () => void) => find;\nconst held = globalThis;`,
  "lib/server/run-store.ts": `import * as storage from "node:async_hooks";\nimport register, { registerRunStore } from "./problems";\nconst find = () => storage;\nregisterRunStore(find);\nawait register.late(find);\nfind();\nnew Map();`,
  "lib/posts.test.ts": `import { check } from "./posts";\ncheck(globalThis);`,
  "lib/server/inbox.ts": `export const folder = "lib/server/replies/";`,
  "lib/server/replies/jane.eml": `From: jane.smith@example.com`,
  "styles/globals.css": `@import "./tokens.css";`,
  "styles/tokens.css": `:root {}`,
  "public/images/logo.svg": `<svg/>`,
  "tests/storyboard/fixtures.ts": `export const test = 1;\nconst standIn = "public/images/stand-in.jpeg";`,
  "public/images/stand-in.jpeg": `jpeg`,
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
const sitemap = run("desktop|home|The sitemap", ["/sitemap.xml"]);
const letters = run("desktop|staff|The letters", ["/staff/letters"]);
const events = run("desktop|staff|The events", ["/staff/events"]);
const jobs = run("desktop|staff|The jobs", ["/staff/jobs"]);
const broken = run("desktop|staff|A letter that fails", ["/staff/letters", "instrumentation.ts"]);
const galleryUi = run("desktop|gallery|gallery: ui", ["/gallery/ui"]);
const galleryStaff = run("desktop|gallery|gallery: staff", ["/gallery/staff"]);
const galleryIndex = run("desktop|gallery|gallery: index", ["/gallery"]);
const upload = run("desktop|uploads|Uploading a list", ["/staff/letters"]);
const phoneHome = { ...home, key: "phone|home|The home page" };
const runs = [home, post, sitemap, letters, events, jobs, broken, galleryUi, galleryStaff, galleryIndex, upload];
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
      `type O = import("./o").O;`,
    ].join("\n");
    expect(importsOf("x.tsx", text)).toEqual([
      "./a",
      "./e",
      "./side-effect",
      "./g",
      "./j",
      "./k",
      "./l",
      "(not a plain string)",
      "./n",
    ]);
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

  it("lists the imports the map can't follow, in the folders asked for: a repo file that isn't there, and one that isn't a plain string", () => {
    expect(unresolvedImports(root, ["lib", "components"])).toEqual([
      "lib/broken.ts: ./nowhere",
      "lib/broken.ts: (not a plain string)",
    ]);
    expect(unresolvedImports(root, ["components"])).toEqual([]);
  });
});

describe("readByNoFlow", () => {
  it("says which files no flow runs or reads: docs and unit tests, not the site's code", () => {
    expect(["docs/testing.md", "lib/x.test.ts", "AGENTS.md"].map(readByNoFlow)).toEqual([true, true, true]);
    expect(["lib/x.ts", "scripts/storyboard.mjs", "package.json"].map(readByNoFlow)).toEqual([false, false, false]);
  });
});

describe("handOvers", () => {
  it("finds where code could be handed over without an import: a call of an imported function as a module loads, and globalThis", () => {
    expect(handOvers(root, ["lib", "components"])).toEqual([
      "lib/server/problems.ts: uses globalThis",
      "lib/server/run-store.ts: calls registerRunStore() as it loads",
      "lib/server/run-store.ts: calls register() as it loads",
    ]);
  });

  it("joins what's handed over to the module it's handed to, so a flow that reaches the one reaches the other", () => {
    const graph = importGraph(root);
    expect(graph.get("lib/server/problems.ts")).toEqual(["lib/server/run-store.ts", "instrumentation.ts"]);
    expect(closure(graph, ["app/(site)/blog/[slug]/page.tsx"])).toContain("lib/server/errors.ts");
    expect(importGraph(join(root, "components")).has("lib/server/problems.ts")).toBe(false);
  });

  it("leaves them out when asked for the imports alone", () => {
    const graph = importGraph(root, { handedOver: false });
    expect(graph.get("lib/server/problems.ts")).toEqual([]);
    expect(graph.get("instrumentation.ts")).toEqual(["lib/server/errors.ts"]);
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

  it("reaches every group's files when asked for the imports as they are, as a plain stylesheet is", () => {
    const context = reachContext(root);
    expect(flowReach(galleryUi, context, true)).toContain("app/(tools)/gallery/_examples/staff.tsx");
    expect(flowReach(galleryUi, context)).not.toContain("app/(tools)/gallery/_examples/staff.tsx");
    const styled = {
      ...context,
      reaches: new Map(),
      graph: new Map([
        ...context.graph,
        ["app/(tools)/gallery/_examples/staff.tsx", ["components/print.css", "components/Staff.module.css"]],
      ]),
    };
    const reached = (file: string) => reachedFlows({ files: [file], runs, context: styled }).keys;
    expect(reached("components/print.css")).toEqual(keysOf(galleryUi, galleryStaff, galleryIndex));
    expect(reached("components/Staff.module.css")).toEqual(keysOf(galleryStaff, galleryIndex));
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

  it("names each top-level key of the staff copy itself, which the shared words have left", () => {
    const text = readFileSync(join(__dirname, "..", STAFF_COPY), "utf8");
    const lines = text.split("\n");
    const start = lines.findIndex((line) => line.startsWith("export const staffCopy"));
    const end = lines.findIndex((line, at) => at > start && line.startsWith("};"));
    const keys = lines.slice(start, end).flatMap((line, at) => {
      const key = /^ {2}(\w+): /.exec(line)?.[1];
      return key ? [{ key, line: start + at + 1 }] : [];
    });
    expect(keys.map(({ key }) => key)).toContain("login");
    expect(keys.map(({ key }) => key)).not.toContain("filters");
    for (const { key, line } of keys) expect(changedCopyKeys(hunk(line), text, text)).toEqual(new Set([key]));
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
    // Whatever kind of file: a test file that a spec imports is reached like any other.
    const context = reachContext(root);
    const imported = {
      ...context,
      graph: new Map([...context.graph, ["tests/storyboard/home.spec.ts", ["lib/x.test.ts"]]]),
    };
    expect(reachedFlows({ files: ["lib/x.test.ts"], runs, context: imported }).keys).toEqual(
      keysOf(home, post, sitemap),
    );
  });

  it("reruns every flow for what the build's settings and the proxy import", () => {
    expect(reached(["lib/redirects.ts"]).keys).toEqual(everyRun);
    expect(reached(["lib/session.ts"]).keys).toEqual(everyRun);
  });

  it("reruns, for what handles an error, the flows that kept one and those that reach where problems are reported", () => {
    expect(reached(["lib/server/errors.ts"]).keys).toEqual(keysOf(post, broken));
    expect(reached(["lib/server/run-store.ts"]).keys).toEqual(keysOf(post));
  });

  it("reruns the flows that fetched a public file, there or not, and none for one nothing fetches or names", () => {
    expect(reached(["public/images/logo.svg"]).keys).toEqual(keysOf(home));
    expect(reached(["public/images/gone.svg"]).keys).toEqual(keysOf(post));
    expect(reached(["public/images/unused.svg"])).toEqual({ keys: new Set(), everything: [], unknown: [] });
  });

  it("reruns the flows reaching a file that names a public file, or reads from its folder", () => {
    expect(reached(["public/images/stand-in.jpeg"]).keys).toEqual(everyRun);
    expect(reached(["public/pdfs/briefing.pdf"]).keys).toEqual(keysOf(letters, broken, upload));
  });

  it("reruns the flows reaching a file that names a font, a picture or other data beside the code", () => {
    expect(reached(["lib/fonts/inter.woff2"]).keys).toEqual(everyRun);
  });

  it("says which files reach every flow, and reruns nothing for docs, tests, types and the review's own code", () => {
    expect(reached(["netlify/database/migrations/0200_x.sql", ".nvmrc", "docs/testing.md"])).toEqual({
      keys: new Set(),
      everything: ["netlify/database/migrations/0200_x.sql", ".nvmrc"],
      unknown: [],
    });
    expect(reached(["next.config.ts"])).toEqual({ keys: everyRun, everything: ["next.config.ts"], unknown: [] });
    expect(
      reached([
        "docs/testing.md",
        "AGENTS.md",
        "lib/README.md",
        "lib/x.test.ts",
        "tests/storyboard/report/page.ts",
        "next-env.d.ts",
        "netlify.toml",
      ]),
    ).toEqual({ keys: new Set(), everything: [], unknown: [] });
  });

  it("can't place a file at the top that nothing imports, data that no file names, or a file Next serves at an address of its own", () => {
    expect(
      reached([
        "postcss.config.mjs",
        "Makefile",
        "somewhere/else.txt",
        "lib/content/notes.md",
        "app/(site)/opengraph-image.tsx",
        "app/icon.png",
      ]).unknown,
    ).toEqual([
      "postcss.config.mjs",
      "Makefile",
      "somewhere/else.txt",
      "lib/content/notes.md",
      "app/(site)/opengraph-image.tsx",
      "app/icon.png",
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
    expect(reached(["app/global-error.tsx"]).keys).toEqual(everyRun);
    const { opened, ...without } = letters;
    void opened;
    expect(
      reachedFlows({ files: ["app/(staff)/staff/letters/page.tsx"], runs: [without], context: reachContext(root) })
        .keys,
    ).toEqual(new Set());
  });

  it("reruns the flows reaching what lists a folder, when a file in or under it is added or deleted", () => {
    const added = (files: string[], addedOrDeleted: string[]) =>
      reachedFlows({ files, addedOrDeleted, runs, context: reachContext(root) }).keys;
    expect(added(["app/(site)/new/page.tsx"], ["app/(site)/new/page.tsx"])).toEqual(keysOf(sitemap));
    expect(added(["app/(site)/new/page.tsx"], [])).toEqual(new Set());
    expect(added(["lib/new.ts"], ["lib/new.ts"])).toEqual(new Set());
    // A file that reaches every flow by rule isn't followed to what lists its folder.
    writeFileSync(join(root, "app/sitemap.ts"), `readdirSync(join(process.cwd(), "netlify", "database"));`);
    try {
      const listing = (file: string) =>
        reachedFlows({ files: [file], addedOrDeleted: [file], runs, context: reachContext(root) }).keys;
      expect(listing("netlify/database/migrations/0200_new.sql")).toEqual(new Set());
      expect(listing("netlify/database-notes/new.ts")).toEqual(keysOf(sitemap));
    } finally {
      writeFileSync(join(root, "app/sitemap.ts"), FILES["app/sitemap.ts"]);
    }
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
  const passed = (r: ReturnType<typeof run>, tree = "t1") => ({ ...r, status: "passed", tree, recording: RECORDING });
  const fresh = "desktop|home|A new flow";
  const suite = new Set([home.key, letters.key, events.key, phoneHome.key, fresh]);
  const carried = [passed(home), passed(letters), passed(events), passed(phoneHome)];
  const since = (files: string[]) => ({ files, addedOrDeleted: [] });
  const choose = (
    changedSince: (tree: string) => { files: string[]; addedOrDeleted: string[] } | undefined,
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
    const chosen = choose(() => since(["components/Letters.tsx"]));
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

  it("runs a flow that failed, or that recorded no tree or nothing opened, or recorded it another way", () => {
    const chosen = choose(
      () => since([]),
      [
        { ...passed(home), status: "failed" },
        { ...passed(letters), tree: undefined },
        { ...passed(events), opened: undefined },
        { ...passed(phoneHome), recording: RECORDING - 1 },
      ],
    );
    expect(chosen.run).toEqual(new Set([home.key, letters.key, events.key, phoneHome.key, fresh]));
    expect(chosen).toMatchObject({ fresh: 5, reached: 0, swept: 0 });
  });

  it("runs a flow whose tree git no longer has", () => {
    const chosen = choose(
      (tree) => (tree === "gone" ? undefined : since([])),
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
      changedSince: () => since(["netlify/database/schema.sql"]),
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
      changedSince: () => since(["postcss.config.mjs"]),
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
        return since(tree === "t2" ? ["components/Hero.tsx"] : []);
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

  it("runs a flow that ran on other installed dependencies, and passes on which files were added or deleted", () => {
    const chosen = flowsToRun({
      suite: new Set([home.key, sitemap.key, letters.key]),
      carried: [
        { ...passed(home), setup: "old" },
        { ...passed(sitemap), setup: "now" },
        { ...passed(letters), setup: "now" },
      ],
      phoneTagged: new Set(),
      context: reachContext(root),
      setup: "now",
      changedSince: () => ({ files: ["app/(site)/new/page.tsx"], addedOrDeleted: ["app/(site)/new/page.tsx"] }),
      copyKeysSince: () => undefined,
    });
    expect(chosen.run).toEqual(new Set([home.key, sitemap.key]));
    expect(chosen).toMatchObject({ fresh: 1, reached: 1 });
  });

  it("asks what changed since a review last carried a flow, not since it ran", () => {
    const asked: string[] = [];
    choose(
      (tree) => {
        asked.push(tree);
        return since([]);
      },
      [{ ...passed(home, "t1"), seen: "t5" }, passed(letters, "t1"), passed(events, "t5"), passed(phoneHome, "t5")],
    );
    expect(asked).toEqual(["t5", "t1"]);
  });

  it("asks for the staff copy's changed keys by tree", () => {
    const chosen = flowsToRun({
      suite,
      carried,
      phoneTagged: new Set(),
      context: reachContext(root),
      changedSince: () => since([STAFF_COPY]),
      copyKeysSince: (tree) => (tree === "t1" ? new Set(["events"]) : undefined),
    });
    expect(chosen.run).toEqual(new Set([fresh, events.key]));
  });
});

// Each reads the whole of the site's code, which takes a slow machine many seconds.
describe("this repo", { timeout: 120_000 }, () => {
  const repo = join(import.meta.dirname, "..");

  it("has every file the map names by its path", () => {
    expect(NAMED.filter((path) => !existsSync(join(repo, path)))).toEqual([]);
  });

  it("has no code handed over without an import that the map doesn't know of", () => {
    expect(handOvers(repo, ["app", "components", "lib"])).toEqual([
      // Checks of the posts' authors as the lists load: no code is handed over.
      "lib/content/blog/index.ts: calls checkPostAuthors() as it loads",
      "lib/content/briefings/index.ts: calls checkPostAuthors() as it loads",
      // The fakes' mail and answers, kept for each flow's database across the build's copies of a module: no code.
      "lib/server/fixtures/letters-inbox.ts: uses globalThis",
      "lib/server/fixtures/outside-services.ts: uses globalThis",
      // Handed the keeper of errors by instrumentation.ts, and the run in progress by run-store.ts (HANDED_OVER).
      "lib/server/problems.ts: uses globalThis",
      "lib/server/run-store.ts: calls registerRunStore() as it loads",
    ]);
  });

  it("has no import that the map can't follow, in what the site and its flows run", () => {
    expect(
      unresolvedImports(repo, ["app", "components", "lib", "styles", "tests/storyboard", "tests/fixtures"]),
    ).toEqual([]);
  });
});
