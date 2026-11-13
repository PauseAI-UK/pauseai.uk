// WhatsApp texts as a supporter gets them, for a flow to picture
// (textFrame, ./frame.ts). The fake writes each send to the outbox
// (lib/server/fixtures/whatsapp-outbox.ts): a template's name and its
// fields' words, as WhatsApp is sent them. WhatsApp keeps the template's
// words, so they're read from the flow's database, as the site has them.
import { TEXT_SENDER_NAME } from "@/lib/broadcasts";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { readTexts, type OutboxText } from "@/lib/server/fixtures/whatsapp-outbox";
import type { MailingDoc } from "@/lib/mailing-doc";
import { filledTemplate, templateText } from "@/lib/whatsapp-template";
import { runSql } from "@/scripts/fresh-database.mjs";
import { OUTBOX_DIR } from "../checkout.mjs";
import type { TextShown } from "../fixtures/text-view";

/** Our chat, as a supporter's WhatsApp names it: our name, and the fake's number. */
export const OUR_CHAT = { name: TEXT_SENDER_NAME, number: "+44 7700 900000" };

/** The newest text the build under test has sent to `to` (+447…) that `matches`. */
export function newestText(to: string, matches: (text: OutboxText) => boolean = () => true): OutboxText | undefined {
  return readTexts(OUTBOX_DIR)
    .filter((text) => text.to === to && matches(text))
    .at(-1);
}

/** A template's words in `database`, by the name WhatsApp has it by, its fields as {{first_name}}. */
function templateWords(database: string, name: string): string {
  const [body] = runSql(database, `SELECT body FROM whatsapp_templates WHERE coalesce(meta_name, name) = '${name}'`);
  return templateText(JSON.parse(body!) as MailingDoc);
}

/** A template's footer and Stop button, as every template sent from the site has them. */
const TEMPLATE_FOOT = { footer: emailSettingsCopy.textFooter, button: emailSettingsCopy.stopButton };

/** What a text shows: its template's words filled in, with the footer and Stop; or words of our own. */
export function shownText(database: string, text: OutboxText): TextShown {
  if ("words" in text) return { words: text.words };
  return { words: filledTemplate(templateWords(database, text.template.name), text.template.params), ...TEMPLATE_FOOT };
}

/** A template as it went to WhatsApp for approval: its words, each field as {{first_name}}, with the footer and Stop. */
export function templateSent(database: string, name: string): TextShown {
  return { words: templateWords(database, name), ...TEMPLATE_FOOT };
}
