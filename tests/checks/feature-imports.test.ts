import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import { featureLayers, importRules } from "../../eslint.config.mjs";

// The rule that holds each staff feature to the features it uses (FEATURES
// in eslint.config.mjs), on made-up files of two features: events, which
// may use supporters, and supporters, which may use none. The repo's other
// import rules still apply to a feature's files.
const eslint = new ESLint({
  overrideConfig: [
    ...importRules(featureLayers({ events: ["supporters"], supporters: [] })),
    // Made-up files have no types to check.
    {
      files: ["**/*.{ts,tsx}"],
      languageOptions: { parserOptions: { projectService: false } },
      rules: { "@typescript-eslint/no-floating-promises": "off" },
    },
  ],
});

/** Which of `imports` ESLint refuses in a file at `path`. */
async function refused(path: string, imports: string[]): Promise<string[]> {
  const code = imports.map((from) => `import { x } from "${from}";\nexport const y${imports.indexOf(from)} = x;`);
  const [result] = await eslint.lintText(code.join("\n"), { filePath: path });
  return result.messages
    .filter((message) => /no-restricted-imports$/.test(message.ruleId ?? ""))
    .map((message) => imports[Math.floor((message.line - 1) / 2)]);
}

const UI = "app/(staff)/staff/_components/events/EventRow.tsx";
const LIB = "lib/events/owners.ts";

describe("feature imports", () => {
  it("lets a feature's components use the kit, the frame, their own folder, the features listed and what all share", async () => {
    const allowed = [
      "../ui/Band",
      "../shell/StaffNav",
      "./EventTags",
      "../supporters/SupporterLink",
      "../SupporterBadges",
      "@/lib/events/owners",
      "@/lib/supporters/places",
      "@/lib/server/db",
      "@/lib/content/plural",
      "@/lib/email-parsing/addresses",
      "@/lib/staff-vocabulary",
      "@/lib/found",
      "@/components/ui/Button",
    ];
    expect(await refused(UI, allowed)).toEqual([]);
  });

  it("refuses a feature's components another feature's folders, and what the other rules refuse", async () => {
    const wrong = [
      "../politicians/PoliticianTable",
      "../../politicians/page",
      "@/lib/politicians/edits",
      "@/lib/collateral/draw",
      "@/app/(staff)/staff/_components/ui/Band",
      "next/link",
      "@/tests/fixtures/x",
    ];
    expect(await refused(UI, wrong)).toEqual(wrong);
    const fetching = `import { outsideFetch } from "@/lib/server/outside-services/outside-fetch";\nexport const f = outsideFetch;`;
    const [result] = await eslint.lintText(fetching, { filePath: UI });
    expect(result.messages.map((message) => message.ruleId)).toContain("no-restricted-imports");
  });

  it("lets a feature's logic use its own folder, the features listed and what all share", async () => {
    const allowed = ["./tags", "../supporters/places", "../server/db", "../found", "@/lib/supporters/places"];
    expect(await refused(LIB, allowed)).toEqual([]);
  });

  it("refuses a feature's logic another feature's folders, components and routes", async () => {
    const wrong = ["../politicians/edits", "@/lib/politicians/edits", "@/components/ui/Button", "@/app/api/x/route"];
    expect(await refused(LIB, wrong)).toEqual(wrong);
  });

  it("holds a feature that uses none to its own folders", async () => {
    expect(await refused("lib/supporters/places.ts", ["../events/owners", "@/lib/events/owners"])).toEqual([
      "../events/owners",
      "@/lib/events/owners",
    ]);
  });

  it("lets a feature's tests and gallery examples reach across", async () => {
    for (const path of [
      "app/(staff)/staff/_components/events/EventRow.browser.test.tsx",
      "app/(staff)/staff/_components/events/EventRow.gallery.tsx",
      "lib/events/owners.test.ts",
    ]) {
      expect(await refused(path, ["../politicians/edits", "@/lib/politicians/edits"])).toEqual([]);
    }
  });
});
