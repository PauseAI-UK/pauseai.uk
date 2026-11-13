import { expect, it } from "vitest";
import { query } from "@/lib/server/db";
import { staffCopy } from "@/lib/content/staff-interface";
import { registeredFor, wroteIn } from "@/lib/broadcasts";
import { addTestLetter, addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { addFollower } from "@/tests/broadcast-fixtures";
import { supporterAudience } from "./broadcast-recipients";
import { refreshSupportersList } from "./supporter-facts";
import { linkSupporters } from "./supporters";

const copy = staffCopy.broadcastPages;
const FILTER = { list: "supporters" as const, params: {} };
const EMAIL = { channel: "email" as const, topics: ["events" as const] };

describeWithDatabase("who a broadcast to supporters goes to", () => {
  useTestDatabase();

  it("fills in their fields, with a fallback for those without, and says how many lack each", async () => {
    await query(
      `INSERT INTO postcode_places (postcode, latitude, longitude, place, country, constituency, constituency_checked)
       VALUES ('M11AE', 53.4794, -2.2353, 'Manchester', 'england', 'Manchester Central', true)`,
    );
    const jane = await addFollower("usr-1", "jane@example.com", "Jane Smith", { postcode: "M1 1AE" });
    const sam = await addFollower("usr-2", "sam@example.com", "");
    const { recipients, fields, conditions } = await supporterAudience(FILTER, EMAIL);
    expect(recipients.find((one) => one.id === jane)).toMatchObject({
      name: "Jane Smith",
      address: "jane@example.com",
      values: {
        firstName: "Jane",
        name: "Jane Smith",
      },
      meets: ["has:firstName", "has:name", "event:evt-1"],
    });
    expect(recipients.find((one) => one.id === sam)).toMatchObject({
      // No name, which the email's To is without; where its words name them, a fallback.
      name: null,
      values: { firstName: copy.fallbacks.firstName, name: copy.fallbacks.name },
    });
    expect(fields.map(({ id, lacking, fallback }) => ({ id, lacking, fallback }))).toEqual([
      { id: "firstName", lacking: 1, fallback: true },
      { id: "name", lacking: 1, fallback: true },
    ]);
    expect(conditions.find((one) => one.id === "event:evt-1")?.covers).toBe(2);
  });

  it("puts those who wrote to their MP in a campaign, and who registered for an event, in its part", async () => {
    const jane = await addFollower("usr-1", "jane@example.com", "Jane");
    const sam = await addFollower("usr-2", "sam@example.com", "Sam");
    await addTestLetter({
      politicianId: await addTestPolitician(),
      senderName: "Jane",
      senderEmail: "jane@example.com",
    });
    // Sam declined the event, so isn't counted as registered for it.
    await query("UPDATE luma_guests SET approval_status = 'declined' WHERE user_id = 'usr-2'");
    await linkSupporters();
    await refreshSupportersList();
    const { recipients, conditions } = await supporterAudience(FILTER, EMAIL);
    expect(recipients.find((one) => one.id === jane)!.meets).toEqual([
      "has:firstName",
      "has:name",
      wroteIn("regulate-letter-pm"),
      registeredFor("evt-1"),
    ]);
    expect(recipients.find((one) => one.id === sam)!.meets).toEqual(["has:firstName", "has:name"]);
    expect(conditions.find((one) => one.id === wroteIn("regulate-letter-pm"))).toEqual({
      id: "wrote:regulate-letter-pm",
      label: copy.conditions.wrote("Regulate AI developers now"),
      group: copy.conditions.wroteGroup,
      option: "Regulate AI developers now",
      covers: 1,
    });
    expect(conditions.find((one) => one.id === registeredFor("evt-1"))).toEqual({
      id: "event:evt-1",
      label: copy.conditions.registered("evt-1"),
      group: copy.conditions.registeredGroup,
      option: staffCopy.supporters.filters.eventChoice("evt-1", "1 Oct 2026"),
      searchable: true,
      covers: 1,
    });
    // Every campaign has its part, written in or not, by title.
    expect(conditions.filter((one) => one.group === copy.conditions.wroteGroup).map((one) => one.covers)).toEqual([
      0, 0, 1, 0, 0,
    ]);
  });

  it("uses a number that said yes, for a text", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const { recipients } = await supporterAudience(FILTER, { channel: "text", topics: ["events"] });
    expect(recipients.map((one) => one.address)).toEqual(["+447700900001"]);
  });

  it("goes to none with no yes, a stop or a blocked address", async () => {
    await addFollower("usr-1", "pat@example.com", "Pat");
    await query("UPDATE luma_people SET contact_since = NULL WHERE user_id = 'usr-1'");
    await addFollower("usr-2", "sam@example.com", "Sam");
    await query(
      `INSERT INTO opt_outs (address, list, source, source_ref, unsubscribed_at)
       VALUES ('sam@example.com', 'events', 'luma-webhook', 'msg-1', '2026-10-01T00:00:00Z')`,
    );
    await addFollower("usr-3", "bob@example.com", "Bob");
    await query(
      `WITH p AS (INSERT INTO email_problems (address, kind, at, can_reset) VALUES ('bob@example.com', 'hard', '2026-10-13T00:00:00Z', false) RETURNING id)
       INSERT INTO email_blocks (address, problem_id) SELECT 'bob@example.com', id FROM p`,
    );
    const nobody = await addFollower("usr-4", "nobody@example.com", "");
    const { recipients } = await supporterAudience(FILTER, { channel: "text", topics: ["newsletter"] });
    expect(recipients).toEqual([]);
    // Pat never said yes, Sam asked us to stop and Bob's address is blocked: only the one with no name goes.
    const email = await supporterAudience(FILTER, EMAIL);
    expect(email.recipients.map((one) => [one.id, one.name])).toEqual([[nobody, null]]);
  });
});
