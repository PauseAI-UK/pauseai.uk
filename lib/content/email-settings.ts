// Every word of the contact preferences page (/contact-preferences) and the emails
// that link to it: how PauseAI UK contacts someone, by email, text or call,
// why, and how to change it. Plain and short: what each choice does, the truth of it, nothing more.

import type { Reason, Topic, Way } from "../contact-permissions";

/** A date as the page says it: 2 November 2026. */
export function settingsDate(date: Date | null): string {
  return date
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })
    : "";
}

// As the staff pages name them (staffCopy.supporters.detail.permissions.topics).
const topicNames: Record<Topic, string> = {
  newsletter: "Newsletter",
  events: "Events only",
  volunteering: "Volunteering",
};

const wayNames: Record<Way, string> = { email: "Email", text: "Text", call: "Call" };

/** Where a yes or an opt-out came from, as the page tells the person: the form, or how they did it. */
const sources: Record<string, string> = {
  "march-2026-11": "when you signed up for the March Against AI Extinction",
  "email-your-mp": "when you wrote to your MP",
  "web-form": "when you wrote to your MP",
  "paper-signup": "on a paper sign-up form",
  airtable: "when you joined PauseAI",
  civicrm: "with PauseAI Global",
  luma: "on Luma",
  "luma-webhook": "in a Luma email",
  "luma-contacts": "on Luma",
  link: "from one of our emails",
  "list-unsubscribe": "from your mail app",
  "postmark-complaint": "by marking our email as spam",
  reply: "by replying to our email",
  staff: "by telling us",
  preferences: "on this page",
  "civicrm-check": "with PauseAI Global",
};

const from = (source: string | null): string => sources[source ?? ""] ?? "";

export const emailSettingsCopy = {
  fromName: "PauseAI UK",
  // The email with a link to the page, which someone asked for.
  linkEmail: {
    subject: "Set PauseAI UK contact preferences",
    body: (link: string, days: number) =>
      `Follow this link to see and change how PauseAI UK contacts you:\n\n${link}\n\nIt works for ${days} days. If you didn't ask for it, you can ignore this email.`,
  },
  // To someone with "No bulk emails" who just ticked a box to hear from us: what happened and how to settle it, once,
  // and nothing more. `where` is where they signed up.
  bulkNotice: {
    subject: "⁂ You asked to hear from PauseAI UK",
    body: (where: string, link: string, days: number) =>
      `⁂ You ticked the box to hear from PauseAI UK on ${where}. But you've asked PauseAI not to send you bulk email, so we won't send you anything yet.\n\nIf you'd like our emails, you can change that here:\n\n${link}\n\nThe link works for ${days} days. If you'd rather not hear from us, do nothing: we won't email you about this again.`,
    where: {
      "march-2026-11": "⁂ the March Against AI Extinction sign-up",
      "email-your-mp": "⁂ our Email your MP form",
    } as Record<string, string>,
    paper: (where: string, date: string) => `⁂ a paper form at ${where} on ${date}`,
  },
  // At the foot of every copy of a broadcast, with its own link to the page, which opens with an Unsubscribe button.
  footer: {
    text: (link: string) =>
      `You get this because you said PauseAI UK could email you. Unsubscribe or change what we send you: ${link}`,
    html: (link: string) =>
      `You get this because you said PauseAI UK could email you. <a href="${link}">Unsubscribe or change what we send you</a>.`,
  },
  // Asking for a link: the first page.
  start: {
    title: "Contact preferences",
    lead: "View and change how PauseAI UK contacts you, by email, text or phone.",
    label: "Your email address",
    button: "Email me a link",
    also: "Or use the link at the bottom of any email we've sent you.",
    description: "See and change how PauseAI UK contacts you, by emails, texts or phone.",
  },
  sent: {
    title: "Check your email",
    body: (address: string, days: number) =>
      `If we have ${address} in our records, we've sent you a link to your contact preferences. It works for ${days} days.`,
    again: "Nothing come? Check your spam folder, ask again in a few minutes, or try another email address.",
  },
  // A link that's run out.
  expired: {
    title: "That link has run out",
    body: "For your privacy, links to your contact preferences only work for a while. We can email you a new one.",
    button: "Email me a new link",
    sent: "We've emailed you a new link.",
  },
  settings: {
    title: "Contact preferences",
    lead: (address: string) =>
      `View and change how PauseAI UK contacts you via your email ${address} and associated phone numbers.`,
    // Beside a topic's boxes, as a change of them is saved; as the staff pages' drafts say it.
    saving: "Saving…",
    saved: "Saved",
  },
  topics: topicNames,
  about: {
    newsletter: "Weekly news from the UK campaign, including events.",
    events: "Event reminders, invitations and news.",
    volunteering: "More in depth contact from staff and local groups.",
  } as Record<Topic, string>,
  ways: wayNames,
  // A topic in a sentence, as an unsubscribe says what of.
  inSentence: {
    newsletter: "the UK newsletter",
    events: "our event emails",
    volunteering: "our volunteering emails",
  } as Record<Topic, string>,
  tags: { paused: "Email paused" },
  // Under a topic, why it's on or off, from its answer.
  why: {
    // What opens why a topic is on or off, under its boxes.
    ask: "⁂ Why?",
    no: "Off since",
    reasons: {
      asked: (source: string) => `⁂ you ticked the box ${source}.`,
      chose: () => "you turned it on here.",
      "signed-up": (source: string) => `⁂ you gave us your details ${source}.`,
      subscribed: () => "you're on PauseAI UK's list with PauseAI Global.",
      following: () => "you follow our calendar on Luma.",
      "gave-number": (source: string) => `you gave your number for texts on the day ${source}.`,
      volunteered: () => "you said you'd like to volunteer when you joined PauseAI.",
      unsubscribed: (source: string) => `you unsubscribed ${source}.`,
      declined: (source: string) => `you left the box unticked ${source}.`,
    } as Partial<Record<Reason, (source: string) => string>>,
  },
  sourceWords: from,
  // The words kept beside a box ticked on the page, as what the person said yes to.
  wording: (topic: Topic, way: Way) => `⁂ PauseAI UK can send me its ${topicNames[topic]} by ${wayNames[way]}.`,
  // "No bulk emails" set, which the person can lift here.
  noBulk: {
    title: "⁂ You've asked PauseAI not to send you bulk email",
    body: (date: Date | null) =>
      `⁂ ${date ? `This was recorded on ${settingsDate(date)}. ` : ""}So you don't get any of our newsletters or event emails, or PauseAI Global's. Texts and calls aren't affected.`,
    wording: "⁂ PauseAI UK and PauseAI Global can send me bulk email again.",
    button: "⁂ Send me bulk email again",
    note: "⁂ This turns PauseAI Global's emails back on too. Then choose which of ours you want below.",
  },
  doNotEmail: {
    title: "⁂ You've asked PauseAI never to email you",
    body: "⁂ So we don't, apart from an email about something you've just done, such as this page's link. We can't change this here: if you'd like our emails again, ask PauseAI Global.",
  },
  blocked: {
    title: "⁂ We can't email this address",
    body: "⁂ Our emails to it bounced, or were marked as spam, so we don't send any more. Texts and calls aren't affected.",
  },
  global: {
    title: "PauseAI Global's emails",
    intro: "PauseAI Global, the international movement, can send its own emails:",
    lists: ["the PauseAI Newsletter", "Critical Alerts, when something urgent happens", "Local Invitations"],
    howToStop: "To stop one of them, use the unsubscribe link at the bottom of its emails.",
    // Only while Stop everything is offered, below.
    stopAll: "To stop them all, use “Stop everything” below.",
  },
  stopAll: {
    title: "Stop everything",
    body: "⁂ No more newsletters, event invitations or volunteering asks from PauseAI UK, by email, text or phone, and no bulk email from PauseAI Global either. We'll still email you about something you've just done, such as a link you asked for.",
    button: "Stop all emails, texts and calls",
  },
  // The box at the top of the page an email's unsubscribe link opens.
  unsubscribe: {
    title: (topics: string) => `⁂ Unsubscribe from ${topics}?`,
    button: "⁂ Unsubscribe",
    done: (topics: string) => `⁂ You've unsubscribed from ${topics}`,
    doneBody: "⁂ You won't get it by email any more.",
    still: (topic: string, why: string) => `⁂ You'll still get ${topic} emails, because ${why}`,
    and: "⁂ and",
  },
  // The page from an old email's unsubscribe link: the button still works, the rest doesn't.
  pageExpired: "⁂ To see and change everything else, ask for a new link to your contact preferences.",
};
