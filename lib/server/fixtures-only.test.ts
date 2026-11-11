import { afterEach, expect, it, vi } from "vitest";
import { fixturesOnly } from "./fixtures-only";

afterEach(() => vi.unstubAllEnvs());

it("passes in a fixture build, and is a 404 otherwise", () => {
  vi.stubEnv("DATA_FIXTURES", "1");
  expect(() => fixturesOnly()).not.toThrow();
  vi.stubEnv("DATA_FIXTURES", "0");
  expect(() => fixturesOnly()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
});
