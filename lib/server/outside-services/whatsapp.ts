import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { staffCopy } from "@/lib/content/staff-interface";
import { parseJsonIfAny } from "../json";
import { problem } from "../problems";
import { GRAPH_VERSION } from "./graph-api";
import { outsideFetch } from "./outside-fetch";

// The only file that talks to WhatsApp, through Meta's Cloud API, with our
// WhatsApp account's permanent token (WHATSAPP_TOKEN) and its ID
// (WHATSAPP_ACCOUNT_ID): our number, sending a template or words to a
// number, and the account's templates. Its webhook is signed with the Meta
// app's secret (WHATSAPP_APP_SECRET). Meta's docs:
// https://developers.facebook.com/documentation/business-messaging/whatsapp

const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** WhatsApp Manager, where staff see our number and account, opened at our account where its ID is set. */
export const managerLink = (accountId: string | undefined): string =>
  `https://business.facebook.com/wa/manage/home/${accountId ? `?waba_id=${accountId}` : ""}`;

/** What every call needs: the token, and the WhatsApp account's ID. */
export type WhatsAppKeys = { token: string; accountId: string };

/**
 * A call WhatsApp refused, with its error code, if it gave one, and its
 * reason: the words Meta writes for people, which say what to change
 * (`error_user_title`, `error_user_msg`), else its bare message.
 */
export class WhatsAppRequestError extends Error {
  constructor(
    message: string,
    readonly code: number | null = null,
    readonly reason: string | null = null,
  ) {
    super(message);
    this.name = "WhatsAppRequestError";
  }
}

/** Calls `path` under the Graph API, with `body` as JSON, and gives its answer; throws on a refusal. */
async function graph(
  keys: WhatsAppKeys,
  path: string,
  init: { method?: "GET" | "POST" | "DELETE"; body?: object } = {},
): Promise<Record<string, unknown>> {
  const res = await outsideFetch(`${GRAPH}/${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${keys.token}`,
      ...(init.body && { "Content-Type": "application/json" }),
    },
    ...(init.body && { body: JSON.stringify(init.body) }),
    cache: "no-store",
  });
  const data = (parseJsonIfAny(await res.text()) ?? {}) as Record<string, unknown>;
  if (!res.ok) {
    const error = (data.error ?? {}) as {
      message?: string;
      code?: number;
      error_user_title?: string;
      error_user_msg?: string;
    };
    // Meta's words for people, as "Invalid parameter" alone doesn't say which.
    const forPeople = [error.error_user_title, error.error_user_msg].filter(Boolean).join(": ");
    throw new WhatsAppRequestError(
      `WhatsApp request failed with status ${res.status}: ${error.message ?? "no message"}${forPeople ? ` (${forPeople})` : ""}`,
      typeof error.code === "number" ? error.code : null,
      forPeople || error.message || null,
    );
  }
  return data;
}

/**
 * How many people a business may text a day outside a conversation they
 * started, by its messaging limit; null for no limit.
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits
 */
const TIERS: Record<string, number | null> = {
  TIER_250: 250,
  TIER_1K: 1000,
  TIER_2K: 2000,
  TIER_10K: 10000,
  TIER_100K: 100000,
  TIER_UNLIMITED: null,
};

/** Our WhatsApp number: Meta's ID for it, which sends go to; the number, in international format; and its daily limit. */
export type BusinessNumber = { id: string; number: string; dailyLimit: number | null };

/**
 * The business's messaging limit, as asked of its number: the business
 * portfolio's, shared by every number in it. Empty if Meta doesn't say,
 * which is reported.
 */
async function messagingLimit(keys: WhatsAppKeys, numberId: string): Promise<string> {
  try {
    const data = await graph(keys, `${numberId}?fields=whatsapp_business_manager_messaging_limit`);
    return typeof data.whatsapp_business_manager_messaging_limit === "string"
      ? data.whatsapp_business_manager_messaging_limit
      : "";
  } catch (error) {
    problem(staffCopy.problems.anywhere.whatsAppLimitUnknown, error);
    return "";
  }
}

/**
 * The account's number, its first. Its daily limit is the lowest, 250, when
 * Meta gives none we know, so we never send more than it allows.
 */
export async function businessNumber(keys: WhatsAppKeys): Promise<BusinessNumber> {
  const data = await graph(keys, `${keys.accountId}/phone_numbers?fields=id,display_phone_number`);
  const [first] = (data.data ?? []) as { id: string; display_phone_number: string }[];
  if (!first) throw new WhatsAppRequestError("The WhatsApp account has no phone number");
  const tier = await messagingLimit(keys, first.id);
  return {
    id: first.id,
    number: `+${first.display_phone_number.replace(/\D/g, "")}`,
    dailyLimit: Object.hasOwn(TIERS, tier) ? TIERS[tier] : 250,
  };
}

/** A template's named parameter, and its words for one person, or as an example. */
export type TemplateParam = { name: string; text: string };

/** What became of a send: WhatsApp's ID for the message, or its error code and why. */
export type WhatsAppSend = { sent: true; id: string } | { sent: false; code: number | null; reason: string };

/** Sends `message` from our number to `to`, in international format. */
async function send(keys: WhatsAppKeys, from: string, to: string, message: object): Promise<WhatsAppSend> {
  try {
    const data = await graph(keys, `${from}/messages`, {
      method: "POST",
      body: { messaging_product: "whatsapp", recipient_type: "individual", to: to.replace(/^\+/, ""), ...message },
    });
    const [sent] = (data.messages ?? []) as { id: string }[];
    if (!sent) return { sent: false, code: null, reason: "WhatsApp gave no message ID" };
    return { sent: true, id: sent.id };
  } catch (error) {
    if (!(error instanceof WhatsAppRequestError)) throw error;
    return { sent: false, code: error.code, reason: error.message };
  }
}

/** Sends template `name`, in British English, its parameters filled in, from our number `from` (its ID). */
export function sendTemplate(
  keys: WhatsAppKeys,
  from: string,
  to: string,
  template: { name: string; params: TemplateParam[] },
): Promise<WhatsAppSend> {
  return send(keys, from, to, {
    type: "template",
    template: {
      name: template.name,
      language: { code: "en_GB" },
      components: template.params.length
        ? [
            {
              type: "body",
              parameters: template.params.map((param) => ({
                type: "text",
                parameter_name: param.name,
                text: param.text,
              })),
            },
          ]
        : [],
    },
  });
}

/** Sends words of our own, which WhatsApp allows only within a day of the person's last message to us. */
export function sendText(keys: WhatsAppKeys, from: string, to: string, text: string): Promise<WhatsAppSend> {
  return send(keys, from, to, { type: "text", text: { body: text, preview_url: false } });
}

/** Words to send for approval as a marketing template, with a footer saying how to stop. */
export type NewTemplate = { name: string; body: string; examples: TemplateParam[]; footer: string };

/** Sends new words for approval; gives WhatsApp's ID for the template, and its status and category so far. */
export async function createTemplate(
  keys: WhatsAppKeys,
  template: NewTemplate,
): Promise<{ id: string; status: string; category: string }> {
  const data = await graph(keys, `${keys.accountId}/message_templates`, {
    method: "POST",
    body: {
      name: template.name,
      language: "en_GB",
      category: "MARKETING",
      parameter_format: "NAMED",
      components: [
        {
          type: "BODY",
          text: template.body,
          ...(template.examples.length && {
            example: {
              body_text_named_params: template.examples.map((param) => ({
                param_name: param.name,
                example: param.text,
              })),
            },
          }),
        },
        { type: "FOOTER", text: template.footer },
      ],
    },
  });
  return { id: String(data.id), status: String(data.status), category: String(data.category) };
}

/** Deletes template `name`, taking back words still waiting for approval. */
export async function deleteTemplate(keys: WhatsAppKeys, name: string): Promise<void> {
  await graph(keys, `${keys.accountId}/message_templates?name=${encodeURIComponent(name)}`, { method: "DELETE" });
}

/** A template as WhatsApp has it. */
export type MetaTemplate = {
  id: string;
  name: string;
  status: string;
  category: string;
  rejectedReason: string | null;
};

/** Every template of the account, a page of 100 at a time. */
export async function listTemplates(keys: WhatsAppKeys): Promise<MetaTemplate[]> {
  const templates: MetaTemplate[] = [];
  let after = "";
  for (;;) {
    const data = await graph(
      keys,
      `${keys.accountId}/message_templates?fields=id,name,status,category,rejected_reason&limit=100${after}`,
    );
    for (const row of (data.data ?? []) as Record<string, unknown>[]) {
      templates.push({
        id: String(row.id),
        name: String(row.name),
        status: String(row.status),
        category: String(row.category),
        rejectedReason: typeof row.rejected_reason === "string" ? row.rejected_reason : null,
      });
    }
    const paging = data.paging as { next?: string; cursors?: { after?: string } } | undefined;
    if (!paging?.next || !paging.cursors?.after) return templates;
    after = `&after=${encodeURIComponent(paging.cursors.after)}`;
  }
}

/** Whether a webhook's body is signed with the app's secret, as its X-Hub-Signature-256 says. */
export function signedByMeta(appSecret: string, body: string, signature: string | null): boolean {
  const expected = Buffer.from(`sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`);
  const given = Buffer.from(signature ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
