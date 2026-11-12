"use server";

// The email settings page's Server Actions. Each is a public endpoint: those
// that change anything take the token of the link the page was opened by,
// and act only for its address, only while it works, but for an email's
// unsubscribe button, which works forever.
import { after } from "next/server";
import type { SettingsView } from "@/lib/email-settings";
import {
  emailSettingsLink,
  liftNoBulk,
  openAddress,
  resendLink,
  saveSettings,
  settingsFor,
  stopEverything,
  unsubscribeCopy,
  type SettingsKind,
} from "@/lib/server/email-settings";
import { checkNotSpam } from "@/lib/server/outside-services/turnstile";

const text = (form: FormData, name: string): string => String(form.get(name) ?? "");
const kindOf = (form: FormData): SettingsKind => (text(form, "kind") === "copy" ? "copy" : "link");

/**
 * Asking for a link: past the spam check, emails the address one if we have
 * it. Says what to tell them. The email goes after the answer, so how long
 * the answer takes doesn't tell whether we have the address.
 */
export async function askForLinkNow(form: FormData): Promise<{ sent: string } | { message: string }> {
  const address = text(form, "email").trim();
  const spam = await checkNotSpam({ turnstileToken: text(form, "turnstileToken") });
  if (!spam.drop && spam.message) return { message: spam.message };
  after(() => emailSettingsLink(address));
  return { sent: address };
}

/** A page whose link has run out: emails its address a fresh one, after the answer, as askForLinkNow does. */
export async function resendLinkNow(form: FormData): Promise<void> {
  const [kind, token] = [kindOf(form), text(form, "token")];
  after(() => resendLink(kind, token));
}

/** Does `change` to the page's address while its link works, and gives the page afresh; null once it doesn't. */
async function changing(form: FormData, change: (address: string) => Promise<unknown>): Promise<SettingsView | null> {
  const address = await openAddress(kindOf(form), text(form, "token"));
  if (!address) return null;
  await change(address);
  return settingsFor(address);
}

/** Save: what's ticked becomes what the address and its numbers get. */
export async function saveSettingsNow(form: FormData): Promise<SettingsView | null> {
  const ticked = new Set(form.getAll("choice").map(String));
  return changing(form, (address) => saveSettings(address, ticked));
}

/** Lifting "No bulk emails". */
export async function liftNoBulkNow(form: FormData): Promise<SettingsView | null> {
  return changing(form, liftNoBulk);
}

/** Stop everything. */
export async function stopEverythingNow(form: FormData): Promise<SettingsView | null> {
  return changing(form, stopEverything);
}

/** An email's unsubscribe button, which works however old the email: the page afresh while it works. */
export async function unsubscribeNow(form: FormData): Promise<{ done: boolean; view: SettingsView | null }> {
  const token = text(form, "token");
  const done = await unsubscribeCopy(token, "link");
  const address = await openAddress("copy", token);
  return { done, view: address ? await settingsFor(address) : null };
}
