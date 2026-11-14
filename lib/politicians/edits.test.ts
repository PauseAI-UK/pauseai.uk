import { expect, it } from "vitest";
import { addTestMp, addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query } from "@/lib/server/db";
import { editPoliticianDetails, isMark, setMark } from "./edits";

const JO = "jo@pauseai.uk";

const row = (id: number) =>
  query<{ salutation: string; email: string | null; important: boolean; toCheck: boolean }>(
    `SELECT salutation, email, important_target AS important, salutation_to_check AS "toCheck"
     FROM notable_people WHERE id = $1`,
    [id],
  ).then((rows) => rows[0]);

const logged = () =>
  query<{ actor: string; details: object }>(
    "SELECT actor, details FROM audit_log WHERE action = 'edit politician' ORDER BY id",
  );

describeWithDatabase("staff edits", () => {
  useTestDatabase();

  it("turns a marker on and off, logging each change and nothing when it's already so", async () => {
    const id = await addTestPolitician();
    await setMark(id, "importantTarget", true, JO);
    await setMark(id, "importantTarget", true, JO);
    expect((await row(id)).important).toBe(true);
    await setMark(id, "importantTarget", false, JO);
    await setMark(9999, "importantTarget", true, JO);
    expect(await logged()).toEqual([
      { actor: JO, details: { id, name: "Polly Placeholder", changed: { importantTarget: [false, true] } } },
      { actor: JO, details: { id, name: "Polly Placeholder", changed: { importantTarget: [true, false] } } },
    ]);
    expect(isMark("personalConnection")).toBe(true);
    expect(isMark("is_test")).toBe(false);
  });

  it("saves a corrected salutation, which is then checked, and a Lord's email", async () => {
    const lord = await addTestPolitician({ name: "Lord Seedling", house: "lords", email: null, constituency: null });
    await query("UPDATE notable_people SET salutation_to_check = true WHERE id = $1", [lord]);
    expect(
      await editPoliticianDetails(lord, { salutation: " Lord Seedling ", email: " Seedling@Example.org " }, JO),
    ).toEqual({ saved: true });
    expect(await row(lord)).toMatchObject({
      salutation: "Lord Seedling",
      email: "seedling@example.org",
      toCheck: false,
    });
    expect(await editPoliticianDetails(lord, { salutation: "Lord Seedling", email: "" }, JO)).toEqual({ saved: true });
    expect((await row(lord)).email).toBeNull();
    expect(await editPoliticianDetails(lord, { salutation: "Lord Seedling" }, JO)).toEqual({ saved: true });
    expect(await logged()).toHaveLength(2);
  });

  it("leaves an MP's email to their body's list", async () => {
    const mp = await addTestPolitician();
    await editPoliticianDetails(mp, { salutation: "Polly", email: "polly@example.org" }, JO);
    expect(await row(mp)).toMatchObject({ salutation: "Polly", email: "polly.placeholder.mp@parliament.uk" });
  });

  it("refuses an empty salutation, an address that isn't one, the Lords' shared inbox, and a test MP or no one", async () => {
    const lord = await addTestPolitician({ house: "lords" });
    const edit = (salutation: string, email?: string) => editPoliticianDetails(lord, { salutation, email }, JO);
    expect(await edit(" ")).toEqual({ saved: false, why: "salutation" });
    expect(await edit("Lord X", "not an address")).toEqual({ saved: false, why: "email" });
    expect(await edit("Lord X", "ContactHOLMember@parliament.uk")).toEqual({ saved: false, why: "shared" });
    const testMp = await addTestMp();
    expect(await editPoliticianDetails(testMp, { salutation: "X" }, JO)).toEqual({ saved: false, why: "gone" });
    expect(await editPoliticianDetails(9999, { salutation: "X" }, JO)).toEqual({ saved: false, why: "gone" });
  });
});
