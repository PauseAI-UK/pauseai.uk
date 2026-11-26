import "server-only";
import { config } from "@/lib/server/config.server";

// How this server's Node runs, for /api/health?node=1: its version and
// features, the flags it started with, whether anything hooks how it loads
// modules, and whether its own require() loads an ES module and jsdom. It's
// there to find why production's server handler can't require() an ES
// module (ERR_REQUIRE_ESM as it loads jsdom), and can go once that's settled.
// Anyone can ask, so flags and environment variables are given by name,
// never by value, but for Lambda's name for its runtime and Next's.
//
// The require() is Node's own, made as the request asks from the module
// system process.getBuiltinModule() hands over, and what it loads is named
// only in data, so the bundler sees no import or require of any of it: a
// module that fails to load fails its own attempt, never the route's file.

/** Node's module system, as far as the report reads it; its internals are what something hooking require() replaces. */
export type ModuleSystem = {
  createRequire(base: string): (specifier: string) => unknown;
  prototype?: { require?: unknown };
  _load?: unknown;
  _resolveFilename?: unknown;
  _cache?: Record<string, unknown>;
};

/** What went wrong in an attempt: a thrown Error's code, name and message, or what was thrown if it wasn't one. */
type Failure = { ok: false; code?: string; name?: string; message?: string; thrown?: string };
type Attempt<T> = { ok: true; value: T } | Failure;

/** An ES module jsdom's own chain requires (html-encoding-sniffer's), installed with jsdom. */
const ES_MODULE = "@exodus/bytes/encoding-lite.js";
/** The Netlify server handler's manifest, beside it in the function's folder, which names the plugin that wrote it. */
const HANDLER_MANIFEST = "./___netlify-server-handler.json";
/** Words in a loader function's source that say something other than Node wrote it. */
const HOOK_MARKERS = ["require-in-the-middle", "import-in-the-middle", "opentelemetry", "_origRequire", "_unhooked"];
/** The packages that hook require(), as named in the paths of the modules it has loaded. */
const HOOK_PACKAGES = /^(require-in-the-middle|import-in-the-middle|@opentelemetry\/.+|@netlify\/otel)$/;

/** The failure, as a report shows it. Its words are shown, never decided by. */
function failure(error: unknown): Failure {
  if (!(error instanceof Error)) return { ok: false, thrown: typeof error };
  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  return { ok: false, code, name: error.name, message: error.message };
}

/** Runs `work`, giving what it returns or how it failed, never throwing. */
function attempt<T>(work: () => T): Attempt<T> {
  try {
    return { ok: true, value: work() };
  } catch (error) {
    return failure(error);
  }
}

/** A loader function: its name, the start of its source, and which hook markers its source has. */
function described(fn: unknown) {
  if (typeof fn !== "function") return { type: typeof fn };
  const source = Function.prototype.toString.call(fn);
  return {
    name: fn.name,
    head: source.replace(/\s+/g, " ").slice(0, 160),
    mentions: HOOK_MARKERS.filter((marker) => source.includes(marker)),
  };
}

/** The hooking packages among the modules require() has loaded, by name. */
function hookPackages(paths: string[]): string[] {
  const names = paths.map((path) => /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(path)?.[1] ?? "");
  return [...new Set(names.filter((name) => HOOK_PACKAGES.test(name)))].sort();
}

/** What `value` holds at `key`, if it's an object. */
function at(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

/** The text at `path` in a loaded JSON file, such as a package's version; null if there's none. */
function text(loaded: Attempt<unknown>, path: string[]): string | null {
  if (!loaded.ok) return null;
  const found = path.reduce(at, loaded.value);
  return typeof found === "string" ? found : null;
}

/**
 * The report. `moduleSystem` is Node's unless a test hands it another; one
 * that's missing, or a require() that can't be made, fails every attempt
 * that needs it, with how.
 */
export function nodeReport(moduleSystem: () => ModuleSystem = () => process.getBuiltinModule("node:module")) {
  const modules = attempt(moduleSystem);
  const workingDirectory = attempt(() => process.cwd());
  const load = modules.ok ? attempt(() => modules.value.createRequire(`${process.cwd()}/`)) : modules;
  const loading = (specifier: string): Attempt<unknown> => (load.ok ? attempt(() => load.value(specifier)) : load);
  const tried = (loaded: Attempt<unknown>) => (loaded.ok ? { ok: true } : loaded);
  return {
    version: process.version,
    versions: process.versions,
    release: process.release,
    platform: process.platform,
    arch: process.arch,
    features: process.features,
    execArgv: process.execArgv,
    nodeOptionFlags: config.nodeOptionFlags,
    environment: {
      lambdaRuntime: config.lambdaRuntime ?? null,
      lambdaRuntimeApi: config.lambdaRuntimeApi,
      nextRuntime: config.nextRuntime ?? null,
      variableNames: config.runtimeVariableNames,
    },
    workingDirectory: workingDirectory.ok ? workingDirectory.value : workingDirectory,
    loader: modules.ok
      ? {
          load: described(modules.value._load),
          require: described(modules.value.prototype?.require),
          resolveFilename: described(modules.value._resolveFilename),
          getBuiltinModule: described(process.getBuiltinModule),
          hookPackages: hookPackages(Object.keys(modules.value._cache ?? {})),
        }
      : modules,
    requireEsModule: { specifier: ES_MODULE, ...tried(loading(ES_MODULE)) },
    requireJsdom: { specifier: "jsdom", ...tried(loading("jsdom")) },
    next: text(loading("next/package.json"), ["version"]),
    netlifyHandler: text(loading(HANDLER_MANIFEST), ["config", "generator"]),
  };
}
