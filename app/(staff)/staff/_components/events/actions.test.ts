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
      emailed: ["jo@pauseai.uk"],
      owner: "jo@pauseai.uk",
    });
    expect(await saved()).toEqual([{ owner: "jo@pauseai.uk", url: doc }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/events");

    // The same again, or a link anywhere else, changes nothing.
    revalidatePath.mockClear();
    await saveEventNow(form({ eventId: "evt-1", owner: "jo@pauseai.uk", doc }));
    expect(await saveEventNow(form({ eventId: "evt-1", owner: "jo@pauseai.uk", doc: "https://example.com/" }))).toEqual(
      {
        emailed: [],
        owner: null,
      },
    );
    expect(revalidatePath).not.toHaveBeenCalled();

    // Only the doc, cleared, with no owner chosen.
    await saveEventNow(form({ eventId: "evt-1", owner: "", doc: "" }));
    expect(await saved()).toEqual([{ owner: "jo@pauseai.uk", url: null }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/events");
  });
});
