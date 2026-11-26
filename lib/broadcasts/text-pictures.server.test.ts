import { afterEach, expect, it, vi } from "vitest";
import { query } from "@/lib/server/db.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { keepPicture, pictureAddress, pictureOf } from "./text-pictures.server";
import { MOST_PICTURE_BYTES } from "./text-parts";

const JO = "jo@pauseai.uk";
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

afterEach(() => vi.unstubAllEnvs());

it("gives a picture's address on the site, for WhatsApp to fetch it from", () => {
  vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
  expect(pictureAddress("00000000-0000-4000-8000-000000000001")).toBe(
    "https://pauseai.uk/api/text-pictures/00000000-0000-4000-8000-000000000001",
  );
});

describeWithDatabase("a text's pictures", () => {
  useTestDatabase();

  it("keeps a JPEG or PNG, by who uploaded it, and gives it back by its ID", async () => {
    const png = await keepPicture({ type: "image/png", content: PNG }, JO);
    const jpeg = await keepPicture({ type: "image/jpeg", content: Buffer.from([255, 216, 255]) }, JO);
    if (!("id" in png) || !("id" in jpeg)) throw new Error("not kept");
    expect(png.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await pictureOf(png.id)).toEqual({ content: PNG, type: "image/png" });
    expect(await pictureOf(jpeg.id)).toMatchObject({ type: "image/jpeg" });
    expect(await query("SELECT created_by FROM text_pictures")).toEqual([{ created_by: JO }, { created_by: JO }]);
  });

  it("keeps one as big as WhatsApp takes, and refuses one bigger, or of another kind, keeping neither", async () => {
    expect(await keepPicture({ type: "image/png", content: Buffer.alloc(MOST_PICTURE_BYTES) }, JO)).toEqual({
      id: expect.any(String),
    });
    expect(await keepPicture({ type: "image/png", content: Buffer.alloc(MOST_PICTURE_BYTES + 1) }, JO)).toEqual({
      refused: "too-big",
    });
    expect(await keepPicture({ type: "image/gif", content: PNG }, JO)).toEqual({ refused: "not-picture" });
    expect(await keepPicture({ type: "", content: PNG }, JO)).toEqual({ refused: "not-picture" });
    expect(await query("SELECT id FROM text_pictures")).toHaveLength(1);
  });

  it("gives none for an ID no picture has, or that isn't an ID", async () => {
    expect(await pictureOf("00000000-0000-4000-8000-000000000009")).toBeUndefined();
    expect(await pictureOf("1 OR 1=1")).toBeUndefined();
    expect(await pictureOf("")).toBeUndefined();
  });
});
