import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ModuleSystem, nodeReport } from "./node-report.server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const nextVersion = (createRequire(import.meta.url)("next/package.json") as { version: string }).version;

/** A module system whose require() answers each specifier from `answers`, throwing what an answer is when it's thrown. */
function moduleSystem(
  answers: Record<string, { gives: unknown } | { throws: unknown }>,
  rest: Partial<ModuleSystem> = {},
) {
  return (): ModuleSystem => ({
    createRequire: () => (specifier) => {
      const answer = answers[specifier];
      if ("throws" in answer) throw answer.throws;
      return answer.gives;
    },
    ...rest,
  });
}

describe("nodeReport", () => {
  it("says how this Node runs, and that its own require() loads an ES module and jsdom", () => {
    vi.stubEnv("NODE_OPTIONS", "--max-old-space-size=4096 --require ./preload.js --no-experimental-require-module");
    vi.stubEnv("AWS_EXECUTION_ENV", "AWS_Lambda_nodejs24.x");
    vi.stubEnv("AWS_LAMBDA_RUNTIME_API", "127.0.0.1:9001");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const report = nodeReport();
    expect(report).toMatchObject({
      version: process.version,
      versions: process.versions,
      release: process.release,
      platform: process.platform,
      arch: process.arch,
      features: { require_module: true },
      execArgv: process.execArgv,
      nodeOptionFlags: ["--max-old-space-size", "--require", "--no-experimental-require-module"],
      environment: { lambdaRuntime: "AWS_Lambda_nodejs24.x", lambdaRuntimeApi: true, nextRuntime: "nodejs" },
      workingDirectory: process.cwd(),
      requireEsModule: { specifier: "@exodus/bytes/encoding-lite.js", ok: true },
      requireJsdom: { specifier: "jsdom", ok: true },
      next: nextVersion,
      netlifyHandler: null,
    });
    expect(report.environment.variableNames).toEqual(
      expect.arrayContaining(["AWS_LAMBDA_RUNTIME_API", "NODE_OPTIONS"]),
    );
    expect(report.environment.variableNames).not.toContain("AWS_EXECUTION_ENV");
    expect(report.loader).toMatchObject({
      load: { name: expect.any(String), head: expect.any(String), mentions: expect.any(Array) },
      require: { head: expect.any(String) },
      resolveFilename: { head: expect.any(String) },
      getBuiltinModule: { head: expect.any(String) },
      hookPackages: expect.any(Array),
    });
    // The report is the route's answer, so it all goes into JSON and back unchanged.
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it("gives none of Lambda's or Next's settings off Lambda", () => {
    vi.stubEnv("AWS_EXECUTION_ENV", "");
    vi.stubEnv("AWS_LAMBDA_RUNTIME_API", undefined);
    vi.stubEnv("NEXT_RUNTIME", undefined);
    expect(nodeReport().environment).toMatchObject({ lambdaRuntime: null, lambdaRuntimeApi: false, nextRuntime: null });
  });

  it("says how each require() failed, which loader functions are hooked, and by which packages", () => {
    const refused = Object.assign(new Error("require() of ES Module not supported"), { code: "ERR_REQUIRE_ESM" });
    const report = nodeReport(
      moduleSystem(
        {
          "@exodus/bytes/encoding-lite.js": { throws: refused },
          jsdom: { throws: "not an Error" },
          "next/package.json": { gives: { version: 16 } },
          "./___netlify-server-handler.json": { gives: { config: { generator: "@netlify/plugin-nextjs@5.16.9" } } },
        },
        {
          prototype: {
            require: function hooked(id: string) {
              return { _origRequire: id };
            },
          },
          _resolveFilename: () => "/var/task/node_modules/jsdom/lib/api.js",
          _cache: {
            "/var/task/node_modules/require-in-the-middle/index.js": {},
            "/var/task/node_modules/@opentelemetry/api/build/src/index.js": {},
            "/var/task/node_modules/@opentelemetry/api/build/src/trace.js": {},
            "/var/task/node_modules/jsdom/lib/api.js": {},
            "/var/task/.next/server/app/api/health/route.js": {},
          },
        },
      ),
    );
    expect(report).toMatchObject({
      requireEsModule: {
        specifier: "@exodus/bytes/encoding-lite.js",
        ok: false,
        code: "ERR_REQUIRE_ESM",
        name: "Error",
        message: "require() of ES Module not supported",
      },
      requireJsdom: { specifier: "jsdom", ok: false, thrown: "string" },
      next: null,
      netlifyHandler: "@netlify/plugin-nextjs@5.16.9",
    });
    expect(report.loader).toMatchObject({
      load: { type: "undefined" },
      require: { name: "hooked", mentions: ["_origRequire"] },
      resolveFilename: { name: "_resolveFilename", mentions: [] },
      hookPackages: ["@opentelemetry/api", "require-in-the-middle"],
    });
  });

  it("reads no version from a file that isn't an object", () => {
    const report = nodeReport(
      moduleSystem({
        "@exodus/bytes/encoding-lite.js": { gives: {} },
        jsdom: { gives: {} },
        "next/package.json": { gives: "16.4.6" },
        "./___netlify-server-handler.json": { gives: { config: "@netlify/plugin-nextjs@5.16.9" } },
      }),
    );
    expect(report).toMatchObject({ next: null, netlifyHandler: null, loader: { require: { type: "undefined" } } });
    expect(report.loader).toMatchObject({ hookPackages: [] });
  });

  it("fails every require() with how the module system couldn't be had, never throwing", () => {
    const report = nodeReport(() => {
      throw new TypeError("process.getBuiltinModule is not a function");
    });
    const missing = { ok: false, name: "TypeError", message: "process.getBuiltinModule is not a function" };
    expect(report).toMatchObject({
      loader: missing,
      requireEsModule: missing,
      requireJsdom: missing,
      next: null,
      netlifyHandler: null,
    });
  });

  it("fails every require() with how the working directory couldn't be had", () => {
    vi.spyOn(process, "cwd").mockImplementation(() => {
      throw Object.assign(new Error("no such directory"), { code: "ENOENT" });
    });
    const gone = { ok: false, code: "ENOENT", name: "Error", message: "no such directory" };
    expect(nodeReport()).toMatchObject({ workingDirectory: gone, requireEsModule: gone, requireJsdom: gone });
  });

  it("gives a failure without a code where the error has none", () => {
    const report = nodeReport(() => ({
      createRequire: () => {
        throw new Error("bad base");
      },
    }));
    expect(report.requireEsModule).toEqual({
      specifier: "@exodus/bytes/encoding-lite.js",
      ok: false,
      name: "Error",
      message: "bad base",
    });
  });
});
