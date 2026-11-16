import { expect, it } from "vitest";
import { addTestMp, addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query } from "@/lib/server/db.server";
import { editPoliticianDetails, isMark, setMark } from "./edits.server";

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

  it("saves a corrected salutation, which is then checked, and an email with the note of why", async () => {
    const lord = await addTestPolitician({ name: "Lord Seedling", house: "lords", email: null, constituency: null });
    await query("UPDATE notable_people SET salutation_to_check = true WHERE id = $1", [lord]);
    expect(
      await editPoliticianDetails(
        lord,
        { salutation: " Lord Seedling ", email: " Seedling@Example.org ", note: " From his office " },
        JO,
      ),
    ).toEqual({ saved: true });
    expect(await row(lord)).toMatchObject({
      salutation: "Lord Seedling",
      email: "seedling@example.org",
      toCheck: false,
    });
    expect(
      await editPoliticianDetails(lord, { salutation: "Lord Seedling", email: "", note: "He left it" }, JO),
    ).toEqual({ saved: true });
    expect((await row(lord)).email).toBeNull();
    expect(await editPoliticianDetails(lord, { salutation: "Lord Seedling" }, JO)).toEqual({ saved: true });
    // A salutation alone needs no note.
    expect(await editPoliticianDetails(lord, { salutation: "Lord S", email: "" }, JO)).toEqual({ saved: true });
    expect((await logged()).map((entry) => entry.details)).toEqual([
      {
        id: lord,
        name: "Lord Seedling",
        changed: { salutation: ["Ms Placeholder", "Lord Seedling"], email: [null, "seedling@example.org"] },
        note: "From his office",
      },
      { id: lord, name: "Lord Seedling", changed: { email: ["seedling@example.org", null] }, note: "He left it" },
      { id: lord, name: "Lord Seedling", changed: { salutation: ["Lord Seedling", "Lord S"] } },
    ]);
  });

  it("changes an MP's email too, but never without a note of why", async () => {
    const mp = await addTestPolitician();
    const edit = (note?: string) =>
      editPoliticianDetails(mp, { salutation: "Polly", email: "polly@example.org", note }, JO);
    expect(await edit()).toEqual({ saved: false, why: "note" });
    expect(await edit("  ")).toEqual({ saved: false, why: "note" });
    expect((await row(mp)).email).toBe("polly.placeholder.mp@parliament.uk");
    expect(await edit("Her office asked")).toEqual({ saved: true });
    expect(await row(mp)).toMatchObject({ salutation: "Polly", email: "polly@example.org" });
  });

  it("is refused by the audit log a staff member's change of email without a note, but not an import's", async () => {
    const entry = (actor: string, details: object) =>
      query("INSERT INTO audit_log (actor, action, details) VALUES ($1, 'edit politician', $2)", [actor, details]);
    const changed = { email: ["a@example.org", "b@example.org"] };
    await expect(entry(JO, { id: 1, name: "X", changed })).rejects.toThrow(/audit_log_email_edit_note/);
    await expect(entry(JO, { id: 1, name: "X", changed, note: " " })).rejects.toThrow(/audit_log_email_edit_note/);
    await entry(JO, { id: 1, name: "X", changed, note: "Why" });
    await entry("import-parliament", { id: 1, name: "X", changed });
    await entry(JO, { id: 1, name: "X", changed: { salutation: ["A", "B"] } });
    expect(await logged()).toHaveLength(3);
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
