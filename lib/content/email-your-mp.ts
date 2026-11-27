// The Email your MP campaigns: what the form and the server need to know about
// each, and every word the tool shows or sends. Each campaign's page has its
// own words (app/(site)/campaigns/<slug>/page.tsx).

// Relative, as next.config.ts imports this file and its loader resolves only its own "@/" imports.
import { CONTROLAI_LETTER_ASK, FRONTIER_AI_LETTER_ASK, type AskStatus, type AskStatuses } from "@/lib/asks/asks";
import { CAMPAIGN_NAMES } from "./campaigns";

/** The MP's answer to each ask, keyed by the ask's slug (lib/asks/asks.ts). */
export type MpStatuses = AskStatuses;

/** What a letter needs to know about who it's from and who it's to. */
export type LetterDetails = {
  /** "Ms Dummy". */
  salutation: string;
  /** The MP's name: "Dummy MP". */
  mpName: string;
  constituency: string;
  senderName: string;
  /** What the MP has done, so a letter can have parts only for MPs who did it. */
  statuses: MpStatuses;
};

export type Attachment = {
  /** File name in public/pdfs/. */
  file: string;
  /** Thumbnail in public/pdfs/, shown on the form. */
  thumbnail: string;
  title: string;
  subtitle: string;
};

type CampaignCommon = {
  /**
   * The page is app/(site)/campaigns/<slug>/page.tsx, which has the
   * page's own words. Letters in the database are keyed by it, and each
   * campaign has a row in the campaigns table, with the same title and ask.
   */
  slug: string;
  /** Its name in the staff interface. */
  title: string;
  /** What it asks the MP to do, whose answer we record (lib/asks/asks.ts), if anything. */
  ask?: string;
  attachments: Attachment[];
};

/**
 * A campaign an MP can have done, so its page moves on from them, or one
 * nobody has done, which is always there to move on to. The last campaign
 * must be one nobody has done (lib/email-your-mp.test.ts).
 */
export type Campaign = CampaignCommon &
  (
    | {
        ask: string;
        /** The ask's status that means this MP has done what the campaign asks. */
        done: AskStatus;
        /**
         * Shown instead of the form when the MP has already done it but the
         * page couldn't move on, because the browser wouldn't keep the lookup.
         */
        alreadyDone: string;
        /**
         * Shown on the next campaign's page when this one's page has moved on
         * to it, because the MP had already done this.
         */
        movedOn: string;
      }
    | { done?: undefined; alreadyDone?: undefined; movedOn?: undefined }
  );

/**
 * In priority order, each named in ./campaigns.ts. Plain /campaigns redirects to the first, and a
 * campaign's page moves on to the first one the MP hasn't done. The last is
 * one nobody has done, so there's always one.
 */
export const campaigns: Campaign[] = [
  {
    ...CAMPAIGN_NAMES[0],
    ask: FRONTIER_AI_LETTER_ASK,
    done: "signed",
    alreadyDone: "Good news: your MP has already signed the letter to the PM.",
    movedOn:
      "Good news! Your MP has already signed the letter to the PM. You can write to them about this related campaign instead.",
    attachments: [
      {
        file: "Frontier-AI-Open-Letter.pdf",
        thumbnail: "Frontier-AI-Open-Letter.jpg",
        title: "Open Letter",
        subtitle: "To the Prime Minister",
      },
      {
        file: "Frontier-AI-Risks-Policy-Briefing.pdf",
        thumbnail: "Frontier-AI-Risks-Policy-Briefing.jpg",
        title: "Policy Briefing",
        subtitle: "On frontier AI risks",
      },
    ],
  },
  {
    ...CAMPAIGN_NAMES[1],
    // No ask and no "done": everyone is asked to go to the debate, so it's
    // always there to move on to.
    // The bill's PDFs aren't written yet.
    attachments: [],
  },
];

/** The form, its messages, and the page around it. */
export const copy = {
  pageTitle: "Email your MP",
  pageDescription: "Contact your Member of Parliament about AI safety",
  lookup: {
    nameLabel: "Your name",
    // Beside the postcode, so a browser fills both from a saved address. It
    // goes at the end of the letter, under their name.
    addressLabel: "First line of your address",
    addressHint: "You need to give your real address, as MPs only reply to their constituents.",
    postcodeLabel: "Your postcode",
    button: "Find my MP",
    looking: "Looking up",
    nameRequired: "Please enter your name.",
    addressRequired: "Please fill in your postal address.",
    // An email address typed in the address's first line.
    addressIsEmail: "Please give the first line of your postal address here.",
    postcodeRequired: "Please enter a postcode.",
    notFound: "Postcode not found.",
    noConstituency: "No parliamentary constituency found for this postcode.",
    noMp: "No MP found for your constituency.",
    failed: "Something went wrong on our end. Please try again in a moment.",
    // Above the MP's name, once found.
    yourMp: "Your MP",
    mpOf: (constituency: string) => `MP for ${constituency}`,
    // Outside production only, under the form: the first test postcode, and
    // the rest, with what each MP is for, behind an arrow.
    testPostcodes: "Dev site takes test postcodes only. Expand for more. Default one: ",
    testMpSigned: (ask: string) => `signed “${ask}”`,
    // The asks the test MPs have signed (lib/politicians/test-mps.json), by their titles in the asks table.
    testMpAsks: {
      [FRONTIER_AI_LETTER_ASK]: "Frontier AI letter to the Prime Minister",
      [CONTROLAI_LETTER_ASK]: "ControlAI's letter to the Prime Minister",
    } as Partial<Record<string, string>>,
    testMpNoEmail: "no email",
    testMpBounces: "emails bounce",
    noEmail: "No email found for your MP.",
    // Their address bounced before: a letter waits until staff fix it.
    unreachable:
      "Your MP's email address isn't working at the moment. You can still write, we will send your letter as soon as it works.",
  },
  form: {
    emailLabel: "Your email",
    subjectLabel: "Subject",
    letterLabel: "Message",
    tips: ["Customise the email to yourself and your MP", "MPs are very busy - keep it short!"],
    attachments: "Attachments",
    // Goes to the preview page.
    preview: "Preview",
    emailRequired: "Please fill in your email address.",
    // When the browser won't keep the draft, so there's no preview to go to.
    storageFailed: "Sorry! Something went wrong with your browser, the message wasn't saved.",
  },
  // The page for writing the letter, after finding the MP.
  write: {
    title: "Write your letter",
    // Opened with no MP looked up in this browser: straight from a link, say.
    none: "Find your MP first.",
    // For a campaign staff haven't published a letter for yet.
    notOpen: "⁂ This campaign isn't open for letters yet. Please come back soon.",
  },
  // The page between the form and sending: the letter exactly as it will go.
  preview: {
    title: "Check your letter",
    to: "To",
    edit: "Edit",
    consent: "Keep me in the loop about future campaigns by email. (You can unsubscribe at any time.)",
    replyNotice: "A copy of the letter and responses will be sent to PauseAI UK.",
    send: "Send email",
    networkError: "Network error - please try again.",
    // Opened with no letter in this browser: straight from a link, say.
    none: "You haven't written a letter yet.",
    backToForm: "Go back to campaign",
  },
  // The page after sending, in place of the form.
  sent: {
    title: "Thank you!",
    body: (mpName: string) => `Your letter has been sent to ${mpName}.`,
    // In place of body, when the letter couldn't go at once: Gmail's limits, or Gmail down, so it goes within the hour.
    queued: (mpName: string) => `Your letter to ${mpName} is on its way, and will reach them within an hour.`,
    // In place of body, when the MP's address bounced before: it goes once staff fix it.
    waiting: (mpName: string) =>
      `Your letter to ${mpName} will go as soon as their email address works again. We're looking into it.`,
    // Under that, a paragraph of its own.
    more: "Please do ask your friends to write to their MPs too, or come along to a PauseAI event.",
    // Opened without having just sent one.
    none: "No letter has been sent recently.",
  },
  // The line above the sender's copy of their letter, from the letters inbox, to their MP's proxy.
  letterCopy: (mpName: string) =>
    `This is a copy of your letter to ${mpName}. If you don't hear from them, you can follow up by replying to this email.`,
  // Our own short emails to the sender, in the thread of their copy, from the letters inbox as "PauseAI".
  notices: {
    // The letter, or a message they sent through their MP's proxy, bounced.
    bounced: (mpName: string) =>
      `Your message hasn't reached ${mpName}. Their office's email address isn't working. We're looking into it, and will send it again once it works.`,
    // It went again once the address worked.
    resent: (mpName: string) => `Your message has now been sent to ${mpName}.`,
    // It bounced, and RESEND_DAYS on the address still didn't work, so it never goes.
    notResent: (mpName: string) =>
      `We couldn't get a working email address for ${mpName} within a week, so we haven't sent your message. Try using https://www.writetothem.com/ to write to them instead.`,
    // To the MP's office, from the sender's proxy, in the thread of their reply, once it's waited a day:
    // the sender's address bounces, so we can't pass their reply on.
    office: (senderName: string) =>
      `We couldn't pass your reply on to ${senderName}. Their email address isn't working. If they get in touch with a working one, we'll send it to them then.`,
  },
  // The note on a copy of an MP's reply: to the sender, and to the shared inbox.
  forwardedReply: {
    toSender: (mpName: string) => `You've got a reply from ${mpName}. Here it is:`,
    toInbox: (mpName: string, senderName: string) =>
      `${mpName} replied to the letter that ${senderName} sent. Here is the response:`,
    // The sender wrote back to their MP, copying the letter's address.
    followUp: (senderName: string, mpName: string) =>
      `${senderName} wrote back to ${mpName} about their letter. Here is what they sent:`,
    // Under toInbox, when the sender wasn't sent a copy: the MP copied them in, or their address is blocked.
    senderCopied: (senderName: string) => `The MP copied ${senderName} in, so we didn't send them a copy.`,
    senderBlocked: (senderName: string) => `We couldn't send ${senderName} a copy, as their address is blocked.`,
  },
  // The bill's page, for an MP who signed ControlAI's letter to the PM
  // backing it (lib/controlai-letter.ts): the note above the form.
  sobelBill: {
    // The note, with a link to the letter in the middle.
    signedNote: {
      before: "Good news! Your MP is a public supporter of the Artificial Superintelligence Bill, they've signed the ",
      link: "ControlAI letter",
      after: ". Please still thank them for this, and encourage them to attend the debate of the Bill.",
    },
  },
  // Errors the server sends back to the form.
  errors: {
    missingFields: "All fields are required.",
    invalidEmail: "That email address doesn't look correct.",
    unknownCampaign: "Unknown campaign.",
    noRecipient: "We couldn't send the letter, because we don't have a valid email address for your MP.",
    testMpOnly: "You can only write to the test MP here.",
    alreadySent: "You've already written to your MP about this.",
    // The sender's email is one of ours: the letters inbox, a proxy, or the policy team's.
    ourAddress: "Please give your own email address, so your MP's reply can reach you.",
    failed: "Sorry! We failed to send the email, for technical reasons.",
  },
};
