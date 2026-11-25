import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
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
  uploadExample,
  WhatsAppRequestError,
} from "./whatsapp.server";
import { serverProblems } from "@/lib/server/copy";

const KEYS = { token: "token", accountId: "account" };
const GRAPH = "https://graph.facebook.com/v23.0";

describe("our number", () => {
  const limit = (whatsapp_business_manager_messaging_limit?: string) =>
    http.get(`${GRAPH}/p1`, ({ request }) =>
      new URL(request.url).searchParams.get("fields") === "whatsapp_business_manager_messaging_limit"
        ? HttpResponse.json({ id: "p1", whatsapp_business_manager_messaging_limit })
        : undefined,
    );

  it("is the account's first, in international format, with its messaging limit a day", async () => {
    let auth: string | null = null;
    server.use(
      http.get(`${GRAPH}/account/phone_numbers`, ({ request }) => {
        auth = request.headers.get("authorization");
        return HttpResponse.json({ data: [{ id: "p1", display_phone_number: "+44 7700 900000" }] });
      }),
      limit("TIER_2K"),
    );
    expect(await businessNumber(KEYS)).toEqual({ id: "p1", number: "+447700900000", dailyLimit: 2000 });
    expect(auth).toBe("Bearer token");
  });

  it("has no limit at the top tier, and the lowest when Meta gives none we know, or doesn't answer", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(
      http.get(`${GRAPH}/account/phone_numbers`, () =>
        HttpResponse.json({ data: [{ id: "p1", display_phone_number: "447700900000" }] }),
      ),
    );
    server.use(limit("TIER_UNLIMITED"));
    expect((await businessNumber(KEYS)).dailyLimit).toBeNull();
    server.use(limit("TIER_NEW"));
    expect((await businessNumber(KEYS)).dailyLimit).toBe(250);
    server.use(limit());
    expect((await businessNumber(KEYS)).dailyLimit).toBe(250);
    expect(error).not.toHaveBeenCalled();
    // Refused, as by an API version without the field: the lowest, reported.
    server.use(http.get(`${GRAPH}/p1`, () => HttpResponse.json({ error: { code: 100 } }, { status: 400 })));
    expect((await businessNumber(KEYS)).dailyLimit).toBe(250);
    expect(error.mock.calls[0][0]).toBe(serverProblems.whatsAppLimitUnknown().what);
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
      reason: "Bad token",
    });
    // Meta's words for people, which say what's wrong: its title and message, or either alone.
    const refusal = (error: object) =>
      server.use(
        http.get(`${GRAPH}/account/phone_numbers`, () =>
          HttpResponse.json({ error: { message: "Invalid parameter", code: 100, ...error } }, { status: 400 }),
        ),
      );
    refusal({ error_user_title: "Duplicate parameter", error_user_msg: "Use each parameter once." });
    await expect(businessNumber(KEYS)).rejects.toMatchObject({
      message:
        "WhatsApp request failed with status 400: Invalid parameter (Duplicate parameter: Use each parameter once.)",
      reason: "Duplicate parameter: Use each parameter once.",
    });
    refusal({ error_user_msg: "Use each parameter once." });
    await expect(businessNumber(KEYS)).rejects.toMatchObject({ reason: "Use each parameter once." });
    // An answer that isn't JSON, or has no error in it.
    server.use(http.get(`${GRAPH}/account/phone_numbers`, () => new HttpResponse("down", { status: 502 })));
    await expect(businessNumber(KEYS)).rejects.toMatchObject({
      code: null,
      message: expect.stringContaining("no message"),
      reason: null,
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

  it("sends a template with a place, its map's point, name and address first", async () => {
    let sent: { template: { components: object[] } } | undefined;
    server.use(
      http.post(`${GRAPH}/p1/messages`, async ({ request }) => {
        sent = (await request.json()) as typeof sent;
        return HttpResponse.json({ messages: [{ id: "wamid.3" }] });
      }),
    );
    const place = { name: "Parliament Square", address: "London SW1P 3BD", latitude: 51.5005, longitude: -0.1268 };
    await sendTemplate(KEYS, "p1", "+447700900001", { name: "march_3", params: [], place });
    expect(sent!.template.components).toEqual([
      {
        type: "header",
        parameters: [
          {
            type: "location",
            location: {
              latitude: "51.5005",
              longitude: "-0.1268",
              name: "Parliament Square",
              address: "London SW1P 3BD",
            },
          },
        ],
      },
    ]);
  });

  it("sends a template with a picture at its top, by the address WhatsApp fetches it from", async () => {
    let sent: { template: { components: object[] } } | undefined;
    server.use(
      http.post(`${GRAPH}/p1/messages`, async ({ request }) => {
        sent = (await request.json()) as typeof sent;
        return HttpResponse.json({ messages: [{ id: "wamid.4" }] });
      }),
    );
    const picture = "https://pauseai.uk/api/text-pictures/00000000-0000-4000-8000-000000000001";
    await sendTemplate(KEYS, "p1", "+447700900001", {
      name: "march_4",
      params: [{ name: "first_name", text: "Jane" }],
      picture,
    });
    expect(sent!.template.components).toEqual([
      { type: "header", parameters: [{ type: "image", image: { link: picture } }] },
      { type: "body", parameters: [{ type: "text", parameter_name: "first_name", text: "Jane" }] },
    ]);
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
  const NEW = { name: "march_day_1", body: "Hi {{first_name}}", footer: "Reply STOP to stop event texts" };

  it("sends words for approval as a marketing template, with examples and a footer saying how to stop", async () => {
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
        { type: "FOOTER", text: "Reply STOP to stop event texts" },
      ],
    });
    // Words with no field need no example.
    await createTemplate(KEYS, { ...NEW, body: "Hello", examples: [] });
    expect((made as { components: object[] }).components[0]).toEqual({ type: "BODY", text: "Hello" });
  });

  it("sends a place at the top, and reply buttons in order, after the footer", async () => {
    let made: { components: object[] } | undefined;
    server.use(
      http.post(`${GRAPH}/account/message_templates`, async ({ request }) => {
        made = (await request.json()) as typeof made;
        return HttpResponse.json({ id: "t2", status: "PENDING", category: "MARKETING" });
      }),
    );
    await createTemplate(KEYS, {
      ...NEW,
      examples: [],
      header: { kind: "location" },
      buttons: [{ text: "I'm coming" }, { text: "Can't make it" }],
    });
    expect(made!.components).toEqual([
      { type: "HEADER", format: "LOCATION" },
      { type: "BODY", text: "Hi {{first_name}}" },
      { type: "FOOTER", text: "Reply STOP to stop event texts" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "I'm coming" },
          { type: "QUICK_REPLY", text: "Can't make it" },
        ],
      },
    ]);
    // No buttons is none.
    await createTemplate(KEYS, { ...NEW, examples: [], buttons: [] });
    expect(made!.components).toHaveLength(2);
  });

  it("sends a picture at the top, by its uploaded example's handle, and link buttons with their addresses", async () => {
    let made: { components: object[] } | undefined;
    server.use(
      http.post(`${GRAPH}/account/message_templates`, async ({ request }) => {
        made = (await request.json()) as typeof made;
        return HttpResponse.json({ id: "t3", status: "PENDING", category: "MARKETING" });
      }),
    );
    await createTemplate(KEYS, {
      ...NEW,
      examples: [],
      header: { kind: "image", example: "4::handle" },
      buttons: [{ text: "I'm coming" }, { text: "Read more", url: "https://pauseai.uk/march" }],
    });
    expect(made!.components).toEqual([
      { type: "HEADER", format: "IMAGE", example: { header_handle: ["4::handle"] } },
      { type: "BODY", text: "Hi {{first_name}}" },
      { type: "FOOTER", text: "Reply STOP to stop event texts" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "I'm coming" },
          { type: "URL", text: "Read more", url: "https://pauseai.uk/march" },
        ],
      },
    ]);
  });

  it("uploads a picture for a template's approval through the Meta app: a session for it, then the file, giving its handle", async () => {
    let session: URLSearchParams | undefined;
    let sessionAuth: string | null = null;
    let file: { bytes: number[]; auth: string | null; offset: string | null } | undefined;
    server.use(
      http.post(`${GRAPH}/app-1/uploads`, ({ request }) => {
        session = new URL(request.url).searchParams;
        sessionAuth = request.headers.get("authorization");
        return HttpResponse.json({ id: "upload:session-1" });
      }),
      http.post(`${GRAPH}/upload:session-1`, async ({ request }) => {
        file = {
          bytes: [...new Uint8Array(await request.arrayBuffer())],
          auth: request.headers.get("authorization"),
          offset: request.headers.get("file_offset"),
        };
        return HttpResponse.json({ h: "4::handle" });
      }),
    );
    const content = new Uint8Array([137, 80, 78, 71]);
    expect(await uploadExample(KEYS, "app-1", { name: "march_1.png", type: "image/png", content })).toBe("4::handle");
    expect(Object.fromEntries(session!)).toEqual({
      file_name: "march_1.png",
      file_length: "4",
      file_type: "image/png",
    });
    expect(sessionAuth).toBe("Bearer token");
    // The file goes by OAuth, as the Resumable Upload API asks, from its start.
    expect(file).toEqual({ bytes: [137, 80, 78, 71], auth: "OAuth token", offset: "0" });
  });

  it("refuses an upload Meta refuses", async () => {
    server.use(
      http.post(`${GRAPH}/app-1/uploads`, () =>
        HttpResponse.json({ error: { message: "Bad app", code: 100 } }, { status: 400 }),
      ),
    );
    const content = new Uint8Array([1]);
    await expect(uploadExample(KEYS, "app-1", { name: "a.jpg", type: "image/jpeg", content })).rejects.toMatchObject({
      name: "WhatsAppRequestError",
      reason: "Bad app",
    });
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
