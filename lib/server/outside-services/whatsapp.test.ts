import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import {
  businessNumber,
  createTemplate,
  deleteTemplate,
  listTemplates,
  managerLink,
  sendTemplate,
  sendText,
  signedByMeta,
  WhatsAppRequestError,
} from "./whatsapp";

const KEYS = { token: "token", accountId: "account" };
const GRAPH = "https://graph.facebook.com/v23.0";

describe("our number", () => {
  it("is the account's first, in international format, with its tier's daily limit", async () => {
    let auth: string | null = null;
    server.use(
      http.get(`${GRAPH}/account/phone_numbers`, ({ request }) => {
        auth = request.headers.get("authorization");
        return HttpResponse.json({
          data: [{ id: "p1", display_phone_number: "+44 7700 900000", messaging_limit_tier: "TIER_2K" }],
        });
      }),
    );
    expect(await businessNumber(KEYS)).toEqual({ id: "p1", number: "+447700900000", dailyLimit: 2000 });
    expect(auth).toBe("Bearer token");
  });

  it("has no limit at the top tier, and the lowest when Meta gives none we know", async () => {
    const tier = (messaging_limit_tier?: string) =>
      server.use(
        http.get(`${GRAPH}/account/phone_numbers`, () =>
          HttpResponse.json({ data: [{ id: "p1", display_phone_number: "447700900000", messaging_limit_tier }] }),
        ),
      );
    tier("TIER_UNLIMITED");
    expect((await businessNumber(KEYS)).dailyLimit).toBeNull();
    tier("TIER_NEW");
    expect((await businessNumber(KEYS)).dailyLimit).toBe(250);
    tier();
    expect((await businessNumber(KEYS)).dailyLimit).toBe(250);
  });

  it("refuses an account with no number, or a refusal, with Meta's code", async () => {
    server.use(http.get(`${GRAPH}/account/phone_numbers`, () => HttpResponse.json({})));
    await expect(businessNumber(KEYS)).rejects.toThrow("has no phone number");
    server.use(
      http.get(`${GRAPH}/account/phone_numbers`, () =>
        HttpResponse.json({ error: { message: "Bad token", code: 190 } }, { status: 401 }),
      ),
    );
    await expect(businessNumber(KEYS)).rejects.toMatchObject({
      name: "WhatsAppRequestError",
      code: 190,
      message: "WhatsApp request failed with status 401: Bad token",
    });
    // An answer that isn't JSON, or has no error in it.
    server.use(http.get(`${GRAPH}/account/phone_numbers`, () => new HttpResponse("down", { status: 502 })));
    await expect(businessNumber(KEYS)).rejects.toMatchObject({
      code: null,
      message: expect.stringContaining("no message"),
    });
  });
});

describe("sending", () => {
  it("sends a template from our number, its parameters named, and gives WhatsApp's ID", async () => {
    let sent: unknown;
    server.use(
      http.post(`${GRAPH}/p1/messages`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ messages: [{ id: "wamid.1" }] });
      }),
    );
    expect(
      await sendTemplate(KEYS, "p1", "+447700900001", {
        name: "march_day_1",
        params: [{ name: "first_name", text: "Jane" }],
      }),
    ).toEqual({ sent: true, id: "wamid.1" });
    expect(sent).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "447700900001",
      type: "template",
      template: {
        name: "march_day_1",
        language: { code: "en_GB" },
        components: [{ type: "body", parameters: [{ type: "text", parameter_name: "first_name", text: "Jane" }] }],
      },
    });
    await sendTemplate(KEYS, "p1", "+447700900001", { name: "plain_2", params: [] });
    expect(sent).toMatchObject({ template: { components: [] } });
  });

  it("sends words of our own", async () => {
    let sent: unknown;
    server.use(
      http.post(`${GRAPH}/p1/messages`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ messages: [{ id: "wamid.2" }] });
      }),
    );
    expect(await sendText(KEYS, "p1", "+447700900001", "Thanks!")).toEqual({ sent: true, id: "wamid.2" });
    expect(sent).toMatchObject({ type: "text", text: { body: "Thanks!", preview_url: false } });
  });

  it("gives a refusal's code, or none, rather than throwing; throws on anything else", async () => {
    server.use(
      http.post(`${GRAPH}/p1/messages`, () =>
        HttpResponse.json({ error: { message: "Not on WhatsApp", code: 131026 } }, { status: 400 }),
      ),
    );
    expect(await sendText(KEYS, "p1", "+447700900001", "Hi")).toEqual({
      sent: false,
      code: 131026,
      reason: "WhatsApp request failed with status 400: Not on WhatsApp",
    });
    server.use(http.post(`${GRAPH}/p1/messages`, () => HttpResponse.json({ messages: [] })));
    expect(await sendText(KEYS, "p1", "+447700900001", "Hi")).toEqual({
      sent: false,
      code: null,
      reason: "WhatsApp gave no message ID",
    });
    server.use(http.post(`${GRAPH}/p1/messages`, () => HttpResponse.json({})));
    expect(await sendText(KEYS, "p1", "+447700900001", "Hi")).toMatchObject({ sent: false });
    server.use(http.post(`${GRAPH}/p1/messages`, () => HttpResponse.error()));
    await expect(sendText(KEYS, "p1", "+447700900001", "Hi")).rejects.toThrow();
  });
});

describe("templates", () => {
  const NEW = { name: "march_day_1", body: "Hi {{first_name}}", footer: "Press Stop", stopButton: "Stop" };

  it("sends words for approval as a marketing template, with examples, a footer and a Stop button", async () => {
    let made: unknown;
    server.use(
      http.post(`${GRAPH}/account/message_templates`, async ({ request }) => {
        made = await request.json();
        return HttpResponse.json({ id: "t1", status: "PENDING", category: "MARKETING" });
      }),
    );
    expect(await createTemplate(KEYS, { ...NEW, examples: [{ name: "first_name", text: "Jane" }] })).toEqual({
      id: "t1",
      status: "PENDING",
      category: "MARKETING",
    });
    expect(made).toEqual({
      name: "march_day_1",
      language: "en_GB",
      category: "MARKETING",
      parameter_format: "NAMED",
      components: [
        {
          type: "BODY",
          text: "Hi {{first_name}}",
          example: { body_text_named_params: [{ param_name: "first_name", example: "Jane" }] },
        },
        { type: "FOOTER", text: "Press Stop" },
        { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Stop" }] },
      ],
    });
    // Words with no field need no example.
    await createTemplate(KEYS, { ...NEW, body: "Hello", examples: [] });
    expect((made as { components: object[] }).components[0]).toEqual({ type: "BODY", text: "Hello" });
  });

  it("deletes a template by its name", async () => {
    let asked = "";
    server.use(
      http.delete(`${GRAPH}/account/message_templates`, ({ request }) => {
        asked = new URL(request.url).searchParams.get("name")!;
        return HttpResponse.json({ success: true });
      }),
    );
    await deleteTemplate(KEYS, "march day");
    expect(asked).toBe("march day");
  });

  it("lists every template, a page at a time", async () => {
    const pages: (string | null)[] = [];
    server.use(
      http.get(`${GRAPH}/account/message_templates`, ({ request }) => {
        const after = new URL(request.url).searchParams.get("after");
        pages.push(after);
        return after
          ? HttpResponse.json({
              data: [{ id: "t2", name: "two", status: "REJECTED", category: "MARKETING", rejected_reason: "SCAM" }],
              paging: { cursors: { after: "end" } },
            })
          : HttpResponse.json({
              data: [{ id: "t1", name: "one", status: "APPROVED", category: "UTILITY" }],
              paging: { next: "https://graph.facebook.com/next", cursors: { after: "page-2" } },
            });
      }),
    );
    expect(await listTemplates(KEYS)).toEqual([
      { id: "t1", name: "one", status: "APPROVED", category: "UTILITY", rejectedReason: null },
      { id: "t2", name: "two", status: "REJECTED", category: "MARKETING", rejectedReason: "SCAM" },
    ]);
    expect(pages).toEqual([null, "page-2"]);
    server.use(http.get(`${GRAPH}/account/message_templates`, () => HttpResponse.json({})));
    expect(await listTemplates(KEYS)).toEqual([]);
  });
});

describe("the webhook's signature", () => {
  const sign = (body: string, secret = "secret") => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  it("is the body's HMAC with the app's secret", () => {
    expect(signedByMeta("secret", "{}", sign("{}"))).toBe(true);
    expect(signedByMeta("secret", "{}", sign("{}", "other"))).toBe(false);
    expect(signedByMeta("secret", "{}", "sha256=short")).toBe(false);
    expect(signedByMeta("secret", "{}", null)).toBe(false);
  });
});

it("names its error", () => {
  expect(new WhatsAppRequestError("Down").code).toBeNull();
});

it("links to our account in WhatsApp Manager, or WhatsApp Manager itself without its ID", () => {
  expect(managerLink("1234")).toBe("https://business.facebook.com/wa/manage/home/?waba_id=1234");
  expect(managerLink(undefined)).toBe("https://business.facebook.com/wa/manage/home/");
});
