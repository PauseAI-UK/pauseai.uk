import { afterEach, expect, it, vi } from "vitest";
import { query } from "@/lib/server/db";
import { problem, registerProblemKeeper } from "@/lib/server/problems";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { onRequestError, register } from "./instrumentation";

const REQUEST = { path: "/api/signatories", method: "GET", headers: {} };
const CONTEXT = {
  routerKind: "App Router",
  routePath: "/api/signatories",
  routeType: "route",
  revalidateReason: undefined,
} as const;

const kept = () => query<{ kind: string; words: string }>("SELECT kind, words FROM errors_seen ORDER BY id");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  registerProblemKeeper(undefined);
});

describeWithDatabase("the server's hooks", () => {
  useTestDatabase();

  it("keep an error the server throws, and from its start a problem reported outside a run", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    await onRequestError(new Error("The list couldn't be read"), REQUEST, CONTEXT);
    await register();
    problem("postcodes.io couldn't be asked");
    await vi.waitFor(async () => expect(await kept()).toHaveLength(2));
    expect(await kept()).toEqual([
      { kind: "route", words: "The list couldn't be read" },
      { kind: "problem", words: "postcodes.io couldn't be asked" },
    ]);
  });

  it("do nothing in the edge runtime, where there's no database", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await onRequestError(new Error("At the edge"), REQUEST, CONTEXT);
    await register();
    problem("Nothing keeps this");
    expect(await kept()).toEqual([]);
  });
});
