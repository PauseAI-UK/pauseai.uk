// Every word of the contact preferences page (/contact-preferences) and the emails
// that link to it: how PauseAI UK contacts someone, by email, text or call,
// why, and how to change it. Plain and short: what each choice does, the truth of it, nothing more.

import type { Reason, Topic, Way } from "@/lib/supporters/contact-permissions";

/** A date as the page says it: 2 November 2026. */
export function settingsDate(date: Date | null): string {
  return date
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })
    : "";
}

// As the staff pages name them (supportersCopy.supporters.detail.permissions.topics).
const topicNames: Record<Topic, string> = {
  newsletter: "Newsletter",
  events: "Events only",
  volunteering: "Volunteering",
};

const wayNames: Record<Way, string> = { email: "Email", text: "Text", call: "Call" };

// What each topic is, under its name on the page.
const about: Record<Topic, string> = {
  newsletter: "Weekly news from PauseAI UK",
  events: "Event reminders, invitations and news.",
  volunteering: "More in depth contact from staff and local groups.",
};

// "No bulk emails" set, which the person can lift on the page.
const noBulk = {
  title: "You've turned off bulk email",
  body: "So no newsletters or event emails from PauseAI UK or PauseAI Global.",
  button: "Restart emails",
};

// "No bulk emails" as Stop everything set it, which its button undoes in full.
const stopped = {
  title: "You've stopped everything",
  body: "So no emails, texts or calls from PauseAI UK, and no bulk email from PauseAI Global.",
  button: "Restart all emails, texts and calls",
};

/** A lift's box as the person saw it, and the button they pressed: what's kept as what they said yes to. */
const pressed = (box: { title: string; body: string; button: string }): string =>
  `${box.title}. ${box.body} [${box.button}]`;

/** Where a yes or an opt-out came from, as the page tells the person: the form, or how they did it. */
const sources: Record<string, string> = {
  "march-2026-11": "when you signed up for the March Against AI Extinction",
  "email-your-mp": "when you wrote to your MP",
  "web-form": "when you wrote to your MP",
  "paper-signup": "on a paper sign-up form",
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
  whatsapp: "in WhatsApp",
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
    subject: "You asked to hear from PauseAI UK",
    body: (where: string, link: string, days: number) =>
      `You ticked the box to hear from PauseAI UK on ${where}. But you've asked PauseAI not to send you bulk email, so we won't send you anything yet.\n\nIf you'd like our emails, you can change that here:\n\n${link}\n\nThe link works for ${days} days. If you'd rather not hear from us, do nothing: we won't email you about this again.`,
    where: {
      "march-2026-11": "the March Against AI Extinction sign-up",
      "email-your-mp": "our Email your MP form",
    } as Record<string, string>,
    paper: (where: string, date: string) => `a paper form at ${where} on ${date}`,
  },
  // At the foot of every copy of a broadcast, with its own link to the page, which opens with an Unsubscribe button.
  footer: {
    text: (link: string) =>
      `You get this because you said PauseAI UK could email you. Unsubscribe or change what we send you: ${link}`,
    html: (link: string) =>
      `You get this because you said PauseAI UK could email you. <a href="${link}">Unsubscribe or change what we send you</a>.`,
  },
  // A text's foot, a grey line under its words, the same on every text, so any template can go under any topics. A
  // reply of "stop" to it stops the topics the text went under. WhatsApp takes at most 60 characters.
  textFooter: "Reply STOP to stop these texts",
  // WhatsApp's answer to a reply of "stop", naming what it stopped (textTopics, in a list), with a link to the page
  // for the number.
  stopAnswer: (topics: string, link: string) =>
    `You won't get any more ${topics} texts from PauseAI UK. To change what we send you: ${link}`,
  textTopics: { newsletter: "newsletter", events: "event", volunteering: "volunteering" } as Record<Topic, string>,
  // Between the last two topics of a list; a comma between the others.
  listAnd: "and",
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
    // Beside a topic's boxes, as a change of them is saved; as the staff pages' drafts say it.
    saving: "Saving…",
    saved: "Saved",
  },
  topics: topicNames,
  about,
  ways: wayNames,
  // A topic in a sentence, as an unsubscribe says what of.
  inSentence: {
    newsletter: "the UK newsletter",
    events: "our event emails",
    volunteering: "our volunteering emails",
  } as Record<Topic, string>,
  // Under a topic, why it's on or off, from its answer.
  why: {
    yes: "Why:",
    // A topic they've given no answer for.
    unasked: "you haven't asked for these.",
    // The "?" beside a topic's name on a phone, which opens why in a bubble.
    ask: "Why?",
    reasons: {
      asked: (source: string) => `you ticked the box ${source}.`,
      chose: () => "you turned them on here.",
      "signed-up": (source: string) => `you gave us your details ${source}.`,
      subscribed: () => "you're on PauseAI UK's list with PauseAI Global.",
      following: () => "you follow our calendar on Luma.",
      "gave-number": (source: string) => `you gave your number for texts on the day ${source}.`,
      volunteered: () => "you said you'd like to volunteer when you joined PauseAI.",
      unsubscribed: (source: string) => `you unsubscribed ${source}.`,
      declined: (source: string) => `you left the box unticked ${source}.`,
    } as Partial<Record<Reason, (source: string) => string>>,
  },
  sourceWords: from,
  // What's kept beside a box ticked on the page, as what the person said yes to: the topic as the page shows it, and the box.
  wording: (topic: Topic, way: Way) => `${topicNames[topic]} (${about[topic]}): ${wayNames[way]}`,
  // Each lift's box, and what's kept beside it: the box as they saw it and the button they pressed.
  noBulk: { ...noBulk, wording: pressed(noBulk) },
  stopped: { ...stopped, wording: pressed(stopped) },
  // Under what only PauseAI Global can lift, then a link to its contact page and a full stop.
  onlyGlobal: {
    body: "Only PauseAI Global can change that. Please",
    link: "contact them",
    url: "https://pauseai.info/contact",
  },
  // What a hold on email doesn't stop, for someone with a number.
  numbersStill: "It doesn't stop texts or calls.",
  // PauseAI Global's "Do not SMS" and "Do not phone" on every number of theirs, under each onlyGlobal.
  doNotText: { title: "You've asked PauseAI never to text you" },
  doNotCall: { title: "You've asked PauseAI never to call you" },
  // Both, in one box.
  doNotTextOrCall: { title: "You've asked PauseAI never to text or call you" },
  doNotEmail: { title: "You've asked PauseAI never to email you" },
  blocked: {
    title: "We can't email this address",
    body: "Our emails to it bounced or were marked as spam.",
    // Before our address, as a link to email it.
    ask: "If it works now, email",
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
    body: "Stops everything from PauseAI UK by email, text or phone, and PauseAI Global's bulk email. We'll still email you about things you do with us, like a link you request.",
    button: "Stop all emails, texts and calls",
  },
  // The box at the top of the page an email's unsubscribe link opens.
  unsubscribe: {
    title: (topics: string) => `Unsubscribe from ${topics}?`,
    button: "Unsubscribe",
    done: (topics: string) => `You've unsubscribed from ${topics}`,
    // "it" for the newsletter alone, the one topic named as one thing (inSentence); "them" for any other, or two.
    doneBody: (topics: Topic[]) => `You won't get ${topics.join() === "newsletter" ? "it" : "them"} by email any more.`,
    // In place of the button, where they get none of its topics by email already, for whatever reason.
    off: (topics: string) => `You're not subscribed to ${topics}`,
    // Under that, as nothing's changed.
    offBelow: "You can choose what you get below.",
    // After it, where the page shows their choices below.
    below: "You can choose what else you get below.",
    and: "and",
  },
  // Under expired's title, on a number's page whose link has run out: there's no address to email a new one to.
  numberExpired: "For your privacy, this link only worked for 30 days. To stop our texts, reply STOP to any of them.",
  // The page from an old email's unsubscribe link: the button still works, the rest doesn't.
  pageExpired: {
    title: "This email is too old to change your other choices",
    body: "For your privacy, an email's link only opens your contact preferences for 30 days. We can email you a new one.",
  },
};
