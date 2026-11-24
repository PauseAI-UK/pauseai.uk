// The words of supporters that the server or pure code uses, as well as the
// staff pages: the supporters list, its filters and a supporter's page, with
// their consents and history, and the problems their contact preferences
// report. The staff pages' own are in app/(staff)/staff/_components/supporters/copy.ts.
import type { List, Reason, Topic, Way } from "./contact-permissions";
import { count, plural } from "@/lib/content/plural";
import { defineProblems } from "@/lib/problems";

export const supportersCopy = {
  // The supporters list (/staff/supporters) and a supporter's page.
  supporters: {
    title: "Supporters",
    // Under the title.
    intro: "Everyone who has signed up, come to an event or written to their MP",
    none: "Nobody found.",
    // Over the list: how many there are.
    total: (total: number) => count(total, "supporter", "supporters"),
    filters: {
      search: "Name, email or phone",
      // The date filters: when they were first seen, last registered for an event, and opted out of any consent.
      first: "First seen",
      registered: "Registered for an event",
      unsubscribed: "Opted out",
      // Whether we have a phone number, or an email, for them.
      // The Near filter: a postcode or a town, and how far from it.
      near: "Near",
      nearPlaceholder: "Postcode or town",
      miles: (n: number) => `${n} miles`,
      // In the Near chip, when what was typed couldn't be placed.
      notFound: (text: string) => `${text} (not found)`,
      failed: (text: string) => `${text} (couldn't look it up)`,
      // The Event filter's choices: an event and its day.
      event: "Event",
      eventChoice: (name: string, day: string) => `${name}, ${day}`,
      // The Campaign filter, and its second half: whether they wrote in it.
      campaign: "Campaign",
      wrote: { "": "Wrote", no: "Didn't write" } as Record<string, string>,
      // The other filters are named after their columns.
      // The Consent filter: its lists under their way's heading; each way's chip named for it, before the lists it
      // finds or "not" and those it leaves out. Broadcasts name the list they go to the same way.
      lists: {
        updates: "Updates",
        "updates-luma": "Updates + Luma",
        volunteering: "Volunteering",
      } as Record<List, string>,
      ways: { email: "Email", text: "Text", call: "Call" } as Record<Way, string>,
      wayChips: {
        email: "Email consent",
        text: "Text consent",
        call: "Call consent",
      } as Record<Way, string>,
    },
    columns: {
      name: "Name",
      email: "Email",
      phone: "Phone",
      place: "Place",
      badges: "Activities",
      subscriptions: "Consent",
      // With the Consent filter: why each answer it finds is what it is.
      consentReason: "Consent reason",
      firstSeen: "First sign-up",
      lastActive: "Last activity",
      events: "Events",
      letters: "Letters to MP",
      // How many broadcasts each was sent a copy of, as their page's card of them lists them.
      broadcasts: "Broadcasts",
      // How many notes staff have written on each.
      notes: "Notes",
      // Added by the Event filter: how their registration for the event stands, each event named when there are several.
      registrations: "At the event",
      // Added by the Campaign filter: when they first wrote in the campaign.
      wrote: "Wrote",
    },
    noName: "(no name)",
    // The badges: the sources a supporter is in, and what they did there.
    badges: {
      lumaContact: "Luma contact",
      registered: "Luma events",
      letter: "Wrote to MP",
      member: "Member",
      march: "March sign-up",
      paper: "Paper sign-up",
      whatsapp: "WhatsApp group",
    },
    // In a download, each list they're on and the ways it reaches them, as the Consent column's lozenges say.
    subscriptions: {
      listBy: (list: string, ways: string[]) => `${list} by ${ways.join(", ").toLowerCase()}`,
    },
    sources: {
      luma: "Luma",
      "email-your-mp": "Letter",
      "web-form": "pauseai.info letter",
      "march-2026-11": "November 2026 march sign-up",
      "march-2027-04": "April 2027 march sign-up",
      "paper-signup": "Paper sign-up",
      "whatsapp-community": "WhatsApp community",
      civicrm: "Member",
    } as Record<string, string>,
    // In a supporter's history, what an opt-out was from.
    lists: {
      newsletter: "Updates",
      events: "Luma messages",
      volunteering: "Volunteering",
    } as Record<string, string>,
    // A supporter's page: one box of what we know, then the history.
    detail: {
      emails: "Email",
      phone: "Phone",
      // By a number no topic lets us use.
      unusable: "Don't use",
      postcode: "Postcode",
      city: "City",
      /** What they chose on the join form, as CiviCRM says it; "keep_informed" and "none" say nothing more. */
      intents: {
        volunteer: "wants to volunteer",
        lead: "wants to lead",
        act_now: "wants to act now",
      } as Record<string, string>,
      // From when we first saw them to their last activity.
      active: "Active",
      // The box under the band: a row per topic and address, saying whether we'd contact them about it, and why.
      listsTitle: "Can we contact them?",
      // Folded at the foot of the page, after the history, a table: every value each source record gave, as it gave it.
      everythingTitle: "Everything we hold",
      held: {
        columns: { when: "When", what: "What", value: "Value", from: "From" },
        name: "Name",
        point: "Point",
        town: "Town",
      },
      permissions: {
        // By the way, so the answer says how.
        answers: {
          email: { yes: "Can email", no: "Can't email" },
          text: { yes: "Can text", no: "Can't text" },
          call: { yes: "Can call", no: "Can't call" },
        } as Record<Way, Record<"yes" | "no", string>>,
        // By the address or number, so a screen reader says what it is.
        email: "Email",
        phone: "Phone",
        why: "details",
        // The short reason under the answer, with when, where it came from in the words of `sources` below, and its
        // topic. CiviCRM gives no dates, so its are when we saw it, which is "by" then.
        reasons: {
          asked: (when: string, source: string) => `Ticked the box on ${source}, ${when}`,
          "signed-up": (when: string) => `Signed up on a paper form, ${when}`,
          "joined-whatsapp": (when: string) => `In our WhatsApp community, uploaded ${when}`,
          wrote: (when: string, source: string) => `Wrote ${source} before it asked about emails, ${when}`,
          member: (when: string) => `A member of the UK chapter in CiviCRM, since ${when}`,
          subscribed: (when: string) => `On volunteer list in CiviCRM, ${when}`,
          following: (when: string) => `Follows the Luma calendar, since ${when}`,
          "gave-number": (when: string, source: string) => `Gave it on ${source} for texts about events, ${when}`,
          // From CiviCRM, a number given when joining; from the preferences page, volunteering chosen there.
          volunteered: (when: string, source: string) =>
            source === "CiviCRM"
              ? `Gave it when joining as a volunteer or lead, ${when}`
              : `Chose volunteering on ${source}, ${when}`,
          chose: (when: string) => `Chose it in their contact preferences, ${when}`,
          blocked: () => "",
          "do-not-email": (when: string, source: string) =>
            source === "CiviCRM" ? `“Do not email” in CiviCRM, ${when}` : `No email at all, via ${source}, ${when}`,
          "no-bulk-email": (when: string, source: string) =>
            source === "CiviCRM" ? `“No bulk emails” in CiviCRM, ${when}` : `No bulk email, via ${source}, ${when}`,
          "do-not-sms": (when: string) => `“Do not SMS” is set in CiviCRM, by ${when}`,
          "do-not-phone": (when: string) => `“Do not phone” is set in CiviCRM, by ${when}`,
          unsubscribed: (when: string, source: string) => `Unsubscribed via ${source}, ${when}`,
          declined: (when: string, source: string) => `Left the box unticked on ${source}, ${when}`,
          "not-volunteer": (when: string) => `Gave it when joining, not as a volunteer, ${when}`,
          "not-following": () => "Not a follower of the Luma calendar",
          left: (when: string, source: string) => `No longer shared with us by ${source}, ${when}`,
        } as Record<Reason, (when: string, source: string, topic?: Topic) => string>,
        // Where an answer came from, by its source: a form, Luma, its webhook or its list of the calendar's
        // contacts, or CiviCRM.
        sources: {
          "email-your-mp": "their letter to their MP",
          "web-form": "their pauseai.info letter",
          "march-2026-11": "the march sign-up",
          "march-2027-04": "the march sign-up",
          "paper-signup": "a paper sign-up form",
          "whatsapp-community": "our WhatsApp community",
          luma: "Luma",
          "luma-webhook": "Luma",
          "luma-contacts": "Luma",
          civicrm: "CiviCRM",
          link: "the link in our email",
          "list-unsubscribe": "their mail app's Unsubscribe button",
          "postmark-complaint": "marking our email as spam",
          reply: "staff, from their reply to our email",
          staff: "telling staff",
          preferences: "our contact preferences page",
          "civicrm-check": "PauseAI Global's records",
          whatsapp: "stopping our texts in WhatsApp",
        } as Record<string, string>,
        otherSource: "their newest form",
        // Behind a list's "?", on a supporter's page, in the Consent filter's menus and beside a broadcast's list: the
        // list, who it's for, then what put them on it.
        topicTitle: (list: string) => list,
        whoIsOn: "Who's on it",
        details: {
          updates: {
            about: "Everyone who wants to hear from PauseAI UK.",
            on: [
              "Joined PauseAI in the UK",
              "Emailed their MP",
              "Signed up on paper",
              "Joined our WhatsApp (if imported)",
            ],
          },
          "updates-luma": {
            about: "Everyone on Updates, plus everyone on our Luma calendar.",
            on: [],
          },
          volunteering: {
            about: "Everyone who offered to help.",
            on: ["Offered to volunteer or lead when joining"],
          },
        } as Record<List, { about: string; on: string[] }>,
        // Where a person's lists are shown, inc. Luma is only where Luma alone reaches them, so it's named so.
        lumaOnly: {
          name: "Updates + Luma",
          about: "On our Luma calendar, but not a member or similar. Only Updates + Luma go to them.",
          on: [] as string[],
        },
        // The "?" beside one list where a broadcast's is chosen, which opens what it means.
        listHelp: (name: string) => `What ${name} means`,
        // In place of the rows, when no list has an answer for them: we hold no address or number of theirs; or we
        // do, but nothing they've done is a yes or a no to any list.
        none: {
          noAddress: "No. We have no email address or phone number for them.",
          noAnswer: "No. They haven't said we can.",
        },
        // The last row: whether Luma's own emails go to each address that has joined our Luma calendar. Its name,
        // which "Unsubscribe them" offers too; what its "?" says; and the lozenge for an address on it now, or off.
        luma: {
          name: "Luma messages",
          // A paragraph each.
          about: [
            "Invitations and blasts that we send using Luma to people on our Luma calendar. Can be via email or text, depending on Luma settings.",
          ],
          on: "On calendar",
          off: "Off calendar",
        },
        // Why a blocked address is a no, under each of its topics: what blocked it, then the link to the list.
        blockedBecause: {
          hard: (when: string) => `An email to it bounced, ${when}`,
          complaint: (when: string) => `They marked an email as spam, ${when}`,
          hold: (when: string) => `On hold in CiviCRM, ${when}`,
        } as Record<string, (when: string) => string>,
        seeBlocked: "See bounced emails",
        // Under the consents: staff record an opt-out the person told them of some way the site doesn't hear, what
        // of, and how they said it. Nothing staff record can opt someone back in.
        recordOptOut: {
          open: "Unsubscribe them",
          what: "What they opted out of",
          choose: "Choose…",
          bulk: "Every bulk email",
          how: "How they told us",
          howPlaceholder: "e.g. “at a stall”, “by phone”",
          global: "Email opt-outs go to PauseAI Global and Luma too. Only the supporter can opt back in.",
          record: "Record opt-out",
          cancel: "Cancel",
          already: "They were already opted out of that.",
          // Why an opt-out wasn't recorded.
          refused: {
            // Under how they told us, when it's only spaces.
            blank: "Say how they told us.",
            // At the top of the page, when the supporter was erased or merged after the page loaded.
            gone: "This supporter is no longer here, so nothing was recorded.",
          },
        },
      },
      activityTitle: "History",
      // Where they are, and what it's from: their postcode, a city they gave, or an event's place.
      place: "Place",
      placeFrom: {
        postcode: (given: string) => `from their postcode, ${given}`,
        city: () => "from the city they gave",
        event: (given: string) => `from where ${given} was`,
        group: (given: string) => `from the WhatsApp group ${given}`,
      } as Record<string, (given: string) => string>,
      // In the band at the top: their MP, linked to their page, how they first came, under when they were active,
      // and how many events they registered for and letters they wrote, each linked to its table.
      theirMp: "Their MP",
      // Under when they were active, how they first came, by the source of their first record.
      firstCame: {
        civicrm: "first came by joining PauseAI",
        "email-your-mp": "first came by writing to their MP",
        "web-form": "first came by writing to their MP on pauseai.info",
        luma: "first came through Luma",
        "march-2026-11": "first came by signing up for the march",
        "march-2027-04": "first came by signing up for the march",
        "paper-signup": "first came on a paper sign-up form",
        "whatsapp-community": "first came via WhatsApp community",
      } as Record<string, string>,
      eventsCounted: (n: number) => plural(n, "event", "events"),
      lettersCounted: (n: number) => plural(n, "letter to an MP", "letters to MPs"),
      broadcastsCounted: (n: number) => plural(n, "broadcast", "broadcasts"),
      notesCounted: (n: number) => plural(n, "note", "notes"),
      // Beside the box of what we hold: the events they registered for, and their letters, a table each.
      eventsTitle: "Events",
      noEvents: "No events.",
      lettersTitle: "Letters to MPs",
      noLetters: "No letters.",
      columns: {
        // The Events table's: when they registered or became host, their part in it, which event, and when it is.
        eventDate: "Event date",
        event: "Event",
        status: "Role",
        joined: "Joined",
        to: "To",
        campaign: "Campaign",
        letter: "Status",
        sent: "Sent",
      },
      // A registration that went through, where the status says nothing more.
      registered: "Registered",
      // In the Events table's status column, for an event they hosted.
      host: "Host",
      // Between the MP a letter went to, or who answered it, and its campaign.
      about: "about",
      noActivity: "Nothing yet.",
      kinds: {
        "luma-contact": "Became a contact of the Luma calendar",
        "luma-registered": "Registered for",
        "luma-hosted": "Became host for",
        letter: "Wrote to",
        "letter-replied": "Letter replied to by",
        "form-entry": "Filled in",
        "whatsapp-joined": "In the WhatsApp group",
        "member-joined": "Joined PauseAI",
        "member-left": "Left PauseAI UK",
        "opted-out": "Unsubscribed from",
        resubscribed: "Subscribed again to",
      } as Record<string, string>,
      // After an opt-out staff recorded, in the history: who, and how the person told them, or that it was their reply.
      toldStaff: (by: string, how: string) => `recorded by ${by}: “${how}”`,
      // Before "their reply", which links to it.
      fromReply: (by: string) => `recorded by ${by}, from `,
      theirReply: "their reply",
      // After an opt-out from one of our broadcasts, in the history: a link to the email and what came of it.
      theEmail: "the email",
      // After a form entry's form: the link they came by, and what Luma said if the form adds people to an event.
      cameFrom: (source: string) => `came by “${source}”`,
      luma: {
        added: "added to Luma",
        skipped: "Luma skipped them",
        "not-configured": "not sent to Luma",
        failed: "Luma failed",
      } as Record<string, string>,
      // A registration's status, shown only when it isn't approved.
      statuses: {
        pending_approval: "awaiting approval",
        waitlist: "waitlisted",
        declined: "declined",
      } as Record<string, string>,
    },
  },
};

// What went wrong without stopping the work (lib/problems.ts), each on a job's run, so on its page and in the email.
export const supporterProblems = defineProblems("supporters", {
  // On the Luma import's run: someone turned off events by email, or every bulk email, on the contact preferences
  // page or an email's unsubscribe link, Luma didn't take them off the calendar then, and the full pass over its
  // contacts, which still lists them, failed to as well. Luma goes on emailing them.
  lumaRemoveFailed:
    "Someone opted out of Luma messages but is still on our Luma calendar, so Luma will keep messaging them",
  // On the Luma import's run: looking up where supporters are failed when postcodes.io did partway. The next run
  // carries on.
  placesFailed: "Postcodes.io failed: the next run carries on.",
  // On the CiviCRM import's run: sending our opt-outs to CiviCRM failed, or it didn't answer some, or said some
  // were wrong, which follow, as CiviCRM named them. Each is tried again next hour, but a wrong one needs a
  // developer.
  civicrmUpdatesFailed: "Couldn't send opt-outs to CiviCRM. They'll go next hour",
  civicrmUpdatesUnanswered: (p: { count: number }) =>
    `${plural(p.count, "opt-out", "opt-outs")} got no answer from CiviCRM. They'll go again next hour`,
  civicrmUpdatesInvalid: (p: { count: number }) =>
    `CiviCRM rejected ${plural(p.count, "opt-out", "opt-outs")}. A developer needs to look at them:`,
});
