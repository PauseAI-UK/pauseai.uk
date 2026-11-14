import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { staffCopy } from "@/lib/content/staff-interface";
import { query } from "@/lib/server/db.server";
import { addFollower, addTemplate, startSending } from "@/tests/broadcast-fixtures";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { notifications } from "@/tests/notifications";
import { createBroadcastDraft } from "./broadcast-drafts.server";
import { applyTemplateStatus, checkTemplates } from "./whatsapp-templates.server";

const words = staffCopy.notifications.templateRejectedWhy;
const TEMPLATES = /graph\.facebook\.com\/.*\/message_templates/;

beforeEach(() => {
  vi.stubEnv("WHATSAPP_TOKEN", "token");
  vi.stubEnv("WHATSAPP_ACCOUNT_ID", "fixture-account");
});
afterEach(() => vi.unstubAllEnvs());

/** A template named `name` here and `meta` at WhatsApp, in `status`; its ID. */
async function template(name: string, status = "pending", meta: string | null = `${name}_1`): Promise<number> {
  const id = await addTemplate(name, { status });
  await query("UPDATE whatsapp_templates SET meta_name = $2 WHERE id = $1", [id, meta]);
  return id;
}

/** A template as kept: its status, category, and whether it's stopped. */
const stateOf = async (id: number) =>
  (
    await query<{ status: string; category: string | null; stopped: boolean }>(
      `SELECT status, category, stopped_at IS NOT NULL AS stopped FROM whatsapp_templates WHERE id = $1`,
      [id],
    )
  )[0];

describeWithDatabase("what WhatsApp decides of our templates", () => {
  useTestDatabase();

  it("approves one waiting, with the category WhatsApp gave it, emailing who sent it", async () => {
    const sent = notifications();
    const id = await template("march");
    expect(await applyTemplateStatus("march_1", "APPROVED", null, "MARKETING")).toBe(true);
    expect(await stateOf(id)).toEqual({ status: "approved", category: "MARKETING", stopped: false });
    expect(sent.map((email) => email.Subject)).toEqual([staffCopy.notifications.templateApproved.subject("march")]);
    // Told again, nothing changes.
    expect(await applyTemplateStatus("march_1", "APPROVED", null)).toBe(false);
  });

  it("keeps a category it gives only if it's one we know", async () => {
    notifications();
    const id = await template("march");
    expect(await applyTemplateStatus("march_1", "", null, "SOMETHING")).toBe(false);
    expect((await stateOf(id)).category).toBeNull();
    expect(await applyTemplateStatus("march_1", "", null, "UTILITY")).toBe(false);
    expect((await stateOf(id)).category).toBe("UTILITY");
  });

  it("finds one made in WhatsApp Manager by its own name", async () => {
    notifications();
    const id = await template("write_to_your_mp", "pending", null);
    expect(await applyTemplateStatus("write_to_your_mp", "APPROVED", null)).toBe(true);
    expect((await stateOf(id)).status).toBe("approved");
  });

  it("changes nothing for a template it doesn't know, or a status it says nothing by", async () => {
    notifications();
    expect(await applyTemplateStatus("nobody_1", "APPROVED", null)).toBe(false);
    const id = await template("march");
    expect(await applyTemplateStatus("march_1", "FLAGGED", null)).toBe(false);
    expect((await stateOf(id)).status).toBe("pending");
  });

  it("rejects one waiting, keeping WhatsApp's code for why and emailing it in plain words, but not one it has decided already", async () => {
    const sent = notifications();
    const id = await template("march");
    expect(await applyTemplateStatus("march_1", "REJECTED", "PROMOTIONAL")).toBe(true);
    expect(await query("SELECT status, rejected_reason AS reason FROM whatsapp_templates WHERE id = $1", [id])).toEqual(
      [{ status: "rejected", reason: "PROMOTIONAL" }],
    );
    expect(sent.map((email) => email.Subject)).toEqual([staffCopy.notifications.templateRejected.subject("march")]);
    expect(sent[0]!.TextBody).toContain(words.reasons.PROMOTIONAL);
    const approved = await template("social", "approved");
    expect(await applyTemplateStatus("social_1", "REJECTED", null)).toBe(false);
    expect((await stateOf(approved)).status).toBe("approved");
  });

  it("pauses or disables one approved, stopping the texts on it and telling staff, and approves it again", async () => {
    const sent = notifications();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith", { phone: "+447700900123" });
    const id = await template("march", "approved");
    const text = (await createBroadcastDraft("jo@pauseai.uk", { contact: "text:events:yes" }))!;
    await query(
      "UPDATE mailings SET title = 'March day', template_id = $2, due_at = now(), state = 'scheduled' WHERE id = $1",
      [text, id],
    );
    await startSending(text);
    expect(await applyTemplateStatus("march_1", "PAUSED", null)).toBe(true);
    expect(await stateOf(id)).toMatchObject({ status: "paused", stopped: true });
    expect(await query("SELECT state, wait_reason AS reason FROM mailings WHERE id = $1", [text])).toEqual([
      { state: "cancelled", reason: "template" },
    ]);
    expect(sent.map((email) => email.Subject)).toEqual([
      staffCopy.notifications.broadcastGaveUp.subject("March day", "template"),
      staffCopy.notifications.templatePaused.subject("march"),
    ]);
    // Paused, it can't be paused again; approved again, it can be sent on.
    expect(await applyTemplateStatus("march_1", "PAUSED", null)).toBe(false);
    expect(await applyTemplateStatus("march_1", "APPROVED", null)).toBe(true);
    expect(await stateOf(id)).toMatchObject({ status: "approved", stopped: false });
    expect(await applyTemplateStatus("march_1", "DISABLED", null)).toBe(true);
    expect((await stateOf(id)).status).toBe("disabled");
    expect(await applyTemplateStatus("march_1", "REINSTATED", null)).toBe(true);
    expect((await stateOf(id)).status).toBe("approved");
  });

  it("asks WhatsApp only while a template waits or a text is to go, and applies what it says", async () => {
    notifications();
    let asked = 0;
    server.use(
      http.get(TEMPLATES, () => {
        asked++;
        return HttpResponse.json({
          data: [
            { id: "1", name: "march_1", status: "APPROVED", category: "MARKETING" },
            { id: "2", name: "rain_1", status: "REJECTED", category: "MARKETING", rejected_reason: "SCAM" },
          ],
        });
      }),
    );
    await checkTemplates();
    expect(asked).toBe(0);
    const march = await template("march");
    const rain = await template("rain");
    // Where WhatsApp doesn't send, there's nothing to ask.
    vi.stubEnv("WHATSAPP_TOKEN", "");
    await checkTemplates();
    expect(asked).toBe(0);
    vi.stubEnv("WHATSAPP_TOKEN", "token");
    await checkTemplates();
    expect(asked).toBe(1);
    expect(await stateOf(march)).toMatchObject({ status: "approved", category: "MARKETING" });
    expect((await stateOf(rain)).status).toBe("rejected");
    // None waits now, but a text is to go.
    const text = (await createBroadcastDraft("jo@pauseai.uk", { contact: "text:events:yes" }))!;
    await query(
      "UPDATE mailings SET title = 'March day', template_id = $2, due_at = now(), state = 'sending' WHERE id = $1",
      [text, march],
    );
    await checkTemplates();
    expect(asked).toBe(2);
  });

  it("reports it, and changes nothing, while WhatsApp doesn't answer", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.get(TEMPLATES, () => HttpResponse.json({ error: { message: "Down" } }, { status: 500 })));
    const id = await template("march");
    await checkTemplates();
    expect((await stateOf(id)).status).toBe("pending");
    expect(console.error).toHaveBeenCalledWith(staffCopy.problems.anywhere.whatsAppUnanswered, expect.anything());
  });
});
