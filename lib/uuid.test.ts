import { describe, expect, it, vi } from "vitest";
import { uuid } from "./uuid";

describe("uuid", () => {
  it("is a version 4 UUID, a new one each time", () => {
    const ids = new Set(Array.from({ length: 100 }, () => uuid()));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("sets the version and variant whatever the random bytes, as Postgres's uuid takes it", () => {
    const random = vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint8Array).fill(0xff);
      return array;
    });
    expect(uuid()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    random.mockImplementation((array) => array);
    expect(uuid()).toBe("00000000-0000-4000-8000-000000000000");
    random.mockRestore();
  });

  it("needs no crypto.randomUUID, which a page on plain HTTP hasn't", () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    expect(uuid()).toMatch(/^[0-9a-f-]{36}$/);
    vi.unstubAllGlobals();
  });
});
