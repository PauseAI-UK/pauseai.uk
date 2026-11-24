import { afterEach, expect, it, vi } from "vitest";
import { getJson, postJson } from "./ask-server";

afterEach(() => {
  vi.restoreAllMocks();
});

it("gets a path's JSON", async () => {
  const fetched = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ count: 3 }));
  expect(await getJson<{ count: number }>("/api/march/signups")).toEqual({ count: 3 });
  expect(fetched).toHaveBeenCalledWith("/api/march/signups");
});

it("posts a body as JSON, and gives the answer, a refusal as any other", async () => {
  const fetched = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ok: false, reason: "not-found" }));
  expect(await postJson("/api/events/place", { postcode: "ZZ1 1ZZ" })).toEqual({ ok: false, reason: "not-found" });
  expect(fetched).toHaveBeenCalledWith("/api/events/place", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"postcode":"ZZ1 1ZZ"}',
  });
});

it("throws when the server answers anything but ok, or can't be reached", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Bad gateway", { status: 502 }));
  await expect(getJson("/api/signatories")).rejects.toThrow("/api/signatories answered 502");
  await expect(postJson("/api/events/place", {})).rejects.toThrow("/api/events/place answered 502");
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
  await expect(postJson("/api/events/place", {})).rejects.toThrow("Failed to fetch");
});
