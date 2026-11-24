import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { createSession } from "@/lib/accounts/auth.server";
import { query } from "@/lib/server/db.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import { saveEventNow } from "./actions";

vi.mock("next/headers", () => import("@/tests/next-headers"));
// revalidatePath needs a Next request; here it only needs to have been asked.
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describeWithDatabase("the events page's Server Actions", () => {
  useTestDatabase();

  beforeEach(async () => {
    requestCookies.clear();
    revalidatePath.mockClear();
    requestCookies.set("staff_session", await createSession("jo@pauseai.uk"));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("change nothing without a session", async () => {
    requestCookies.clear();
    expect(await expectRedirect(() => saveEventNow(form({ eventId: "evt-1", owner: "jo@pauseai.uk", doc: "" })))).toBe(
      "/staff/login",
    );
    expect(await query("SELECT count(*)::int AS n FROM event_owners")).toEqual([{ n: 0 }]);
  });

  it("saveEventNow sets an event's owner and Google Doc as any staff member, refreshing the page only when either changed", async () => {
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "server-token");
    server.use(
      http.post("https://api.postmarkapp.com/email", () => HttpResponse.json({ ErrorCode: 0, MessageID: "m-1" })),
    );
    await query(
      "INSERT INTO luma_events (id, name, url, start_at, access) VALUES ('evt-1', 'Event', 'evt-1', now() + interval '1 day', 'manage')",
    );
    const doc = "https://docs.google.com/document/d/abc/edit";
    const saved = () => query("SELECT o.owner, d.url FROM event_owners o FULL JOIN event_docs d USING (event_id)");
    // Jo chose themselves, and is emailed too.
    expect(await saveEventNow(form({ eventId: "evt-1", owner: "Jo@pauseai.uk", doc }))).toEqual({
      ok: true,
      emailed: ["jo@pauseai.uk"],
      owner: "jo@pauseai.uk",
    });
    expect(await saved()).toEqual([{ owner: "jo@pauseai.uk", url: doc }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/events");

    // The same again changes nothing, and is done all the same.
    revalidatePath.mockClear();
    expect(await saveEventNow(form({ eventId: "evt-1", owner: "jo@pauseai.uk", doc }))).toEqual({
      ok: true,
      emailed: [],
      owner: "jo@pauseai.uk",
    });
    expect(revalidatePath).not.toHaveBeenCalled();

    // Only the doc, cleared, with no owner chosen.
    expect(await saveEventNow(form({ eventId: "evt-1", owner: "", doc: "" }))).toEqual({
      ok: true,
      emailed: [],
      owner: null,
    });
    expect(await saved()).toEqual([{ owner: "jo@pauseai.uk", url: null }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/events");
  });

  it("saveEventNow throws on a form without its event, or with a link its doc box's pattern never sends", async () => {
    await query(
      "INSERT INTO luma_events (id, name, url, start_at, access) VALUES ('evt-1', 'Event', 'evt-1', now() + interval '1 day', 'manage')",
    );
    await expect(saveEventNow(form({ owner: "jo@pauseai.uk", doc: "" }))).rejects.toThrow(`without its "eventId"`);
    await expect(
      saveEventNow(form({ eventId: "evt-1", owner: "jo@pauseai.uk", doc: "https://example.com/" })),
    ).rejects.toThrow("a link that isn't to Google Docs or Drive");
    expect(await query("SELECT count(*)::int AS n FROM event_owners")).toEqual([{ n: 0 }]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
