import type { Topic } from "@/lib/supporters/contact-permissions";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { toText } from "@/lib/letter-format";
import { fieldsIn, letterFor, type MailingDoc } from "@/lib/mailing-doc";

// A text's words as a WhatsApp template: its merge fields as named
// parameters, which WhatsApp fills in for each person from what a send
// gives it. Not server-only, so the storyboard can picture a text as it
// arrives (tests/storyboard/whatsapp-steps.ts).

/** A merge field's name as a template's parameter, which WhatsApp wants in lower case: firstName is first_name. */
export function paramName(field: string): string {
  return field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** A text's words as the template's body: each field as its parameter, {{first_name}}. */
export function templateText(body: MailingDoc): string {
  const values = Object.fromEntries(fieldsIn(body).map((field) => [field, `{{${paramName(field)}}}`]));
  return toText(letterFor(body, { values, meets: [] }));
}

/** Every template's footer, saying a reply of "stop" stops the texts: the same whatever topics a text goes under. */
export const TEMPLATE_FOOTER = emailSettingsCopy.textFooter;

/** Topics as a list in words: "newsletter", "newsletter and event", "newsletter, event and volunteering". */
function topicList(topics: Topic[]): string {
  const words = topics.map((topic) => emailSettingsCopy.textTopics[topic]);
  const last = words.pop()!;
  return words.length ? `${words.join(", ")} ${emailSettingsCopy.listAnd} ${last}` : last;
}

/** The answer to a reply of "stop": what it stopped, and a link to the contact preferences page for the number. */
export function stopAnswer(topics: Topic[], link: string): string {
  return emailSettingsCopy.stopAnswer(topicList(topics), link);
}

/** A template's words with its parameters filled in, as WhatsApp shows the text: `{{first_name}}` as `params.first_name`. */
export function filledTemplate(words: string, params: Record<string, string>): string {
  return words.replace(/\{\{(\w+)\}\}/g, (all, name: string) => params[name] ?? all);
}
