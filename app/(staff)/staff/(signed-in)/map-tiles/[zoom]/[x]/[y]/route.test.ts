import { beforeEach, expect, it, vi } from "vitest";
import { createSession } from "@/lib/accounts/auth.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import { GET } from "./route";

vi.mock("next/headers", () => import("@/tests/next-headers"));

const open = (zoom: string, x: string, y: string) =>
  GET(new Request(`https://pauseai.uk/staff/map-tiles/${zoom}/${x}/${y}`), {
    params: Promise.resolve({ zoom, x, y }),
  });

describeWithDatabase("GET /staff/map-tiles/[zoom]/[x]/[y]", () => {
  useTestDatabase();
  beforeEach(() => requestCookies.clear());

  it("gives staff a square of the map, a PNG, kept a week in their browser", async () => {
    requestCookies.set("staff_session", await createSession("jo@pauseai.uk"));
    const res = await open("16", "32744", "21792");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("private, max-age=604800");
    expect((await open("1", "1", "1.png")).status).toBe(200);
  });

  it("gives nothing for a square the map hasn't", async () => {
    requestCookies.set("staff_session", await createSession("jo@pauseai.uk"));
    expect((await open("20", "0", "0")).status).toBe(404);
    expect((await open("x", "0", "0")).status).toBe(404);
    expect((await open("1", "2", "0")).status).toBe(404);
    expect((await open("1", "0", "-1")).status).toBe(404);
  });

  it("sends anyone else to log in", async () => {
    expect(await expectRedirect(() => open("1", "0", "0"))).toMatch(/^\/staff\/login/);
  });
});
