import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { requestCookies } from "@/tests/next-headers";
import { downloadAs } from "@/tests/staff-download";
import { query } from "@/lib/server/db";
import { devBroadcastTitle, hashOf } from "@/lib/supporters/email-settings";
import { addFormEntry } from "@/lib/supporters/form-entries";
import { GET } from "./route";

vi.mock("next/headers", () => import("@/tests/next-headers"));

const URL = "https://pauseai.uk/staff/api/dev-contact-preferences";
const JANE = "jane.smith@example.com";

describeWithDatabase("GET /staff/api/dev-contact-preferences", () => {
  useTestDatabase();
  beforeEach(() => {
    requestCookies.clear();
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("in a fixture build, makes a fresh link to the address's contact preferences and goes to it", async () => {
    vi.stubEnv("DATA_FIXTURES", "1");
    const res = await downloadAs(GET, `${URL}?address=jane.smith%40example.com`, ["supporters"]);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toMatch(/^https:\/\/pauseai\.uk\/contact-preferences\/[\w-]+$/);
    expect(await query("SELECT address FROM preference_links")).toEqual([{ address: "jane.smith@example.com" }]);
  });

  it("in a fixture build, goes to the unsubscribe page of the address's latest email under a topic, made if none", async () => {
    vi.stubEnv("DATA_FIXTURES", "1");
    await addFormEntry("march-2026-11", {
      name: "Jane Smith",
      email: JANE,
      phone: null,
      city: null,
      postcode: null,
      consent: true,
      utmSource: null,
    });
    const open = async (topic: string, old = "") => {
      const res = await downloadAs(GET, `${URL}?address=${encodeURIComponent(JANE)}&topic=${topic}${old}`, [
        "supporters",
      ]);
      expect(res.status).toBe(303);
      return /^https:\/\/pauseai\.uk\/contact-preferences\/m\/([\w-]+)$/.exec(res.headers.get("location")!)![1];
    };
    const copies = () =>
      query(
        `SELECT m.title, c.topics, c.link_token_hash AS hash FROM broadcast_messages c
         JOIN mailings m ON m.id = c.mailing_id ORDER BY c.id`,
      );
    // None yet: one made, under a broadcast for the purpose.
    const first = await open("newsletter");
    expect(await copies()).toEqual([
      { title: devBroadcastTitle("newsletter"), topics: ["newsletter"], hash: hashOf(first) },
    ]);
    // Then the same copy, with a fresh link; and a second topic's under a broadcast of its own.
    const again = await open("newsletter");
    await open("events");
    expect((await copies()).map((c) => [c.title, c.hash === hashOf(again)])).toEqual([
      [devBroadcastTitle("newsletter"), true],
      [devBroadcastTitle("events"), false],
    ]);
    // An old email's: none of hers is, so one made, past the days its page works for, then the same again.
    const old = await open("newsletter", "&old=1");
    const olds = () =>
      query(`SELECT link_token_hash AS hash FROM broadcast_messages WHERE sent_at < now() - interval '30 days'`);
    expect(await olds()).toEqual([{ hash: hashOf(old) }]);
    const oldAgain = await open("newsletter", "&old=1");
    expect(await olds()).toEqual([{ hash: hashOf(oldAgain) }]);
    // An address no supporter has, or a topic there's no such thing as.
    expect((await downloadAs(GET, `${URL}?address=nobody%40example.com&topic=newsletter`, ["supporters"])).status).toBe(
      404,
    );
    expect(
      (await downloadAs(GET, `${URL}?address=${encodeURIComponent(JANE)}&topic=other`, ["supporters"])).status,
    ).toBe(404);
  });

  it("doesn't exist outside a fixture build, or without an address", async () => {
    vi.stubEnv("DATA_FIXTURES", "1");
    expect((await downloadAs(GET, URL, ["supporters"])).status).toBe(404);
    vi.stubEnv("DATA_FIXTURES", "");
    expect((await downloadAs(GET, `${URL}?address=jane.smith%40example.com`, ["supporters"])).status).toBe(404);
    expect(await query("SELECT address FROM preference_links")).toEqual([]);
  });
});
