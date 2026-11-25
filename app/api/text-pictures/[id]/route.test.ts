import { expect, it } from "vitest";
import { keepPicture } from "@/lib/broadcasts/text-pictures.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { GET } from "./route";

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** The route's answer for the picture `id`. */
const get = (id: string) =>
  GET(new Request(`https://pauseai.uk/api/text-pictures/${id}`), { params: Promise.resolve({ id }) });

describeWithDatabase("GET /api/text-pictures/[id]", () => {
  useTestDatabase();

  it("gives a picture's bytes as its kind, kept for a year, as its address never changes", async () => {
    const kept = await keepPicture({ type: "image/png", content: PNG }, "jo@pauseai.uk");
    if (!("id" in kept)) throw new Error("not kept");
    const res = await get(kept.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PNG);
  });

  it("is not found for an ID no picture has, or that isn't one", async () => {
    expect((await get("00000000-0000-4000-8000-000000000009")).status).toBe(404);
    expect((await get("picture")).status).toBe(404);
  });
});
