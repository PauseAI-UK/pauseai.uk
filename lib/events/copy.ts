// The words of staff events that the server or pure code uses, as well as
// the staff pages: the events page and its lists, the emails to an event's
// owner and about a tag the import couldn't tell, and the problems the Luma
// import and its webhooks report.
import { count, plural } from "@/lib/content/plural";

export const eventsCopy = {
  // The events page (/staff/events): our events on Luma, as the Luma import has them, and who on staff owns each.
  events: {
    title: "Events",
    // Under the title: what the page lists, ending in a link to our calendar on Luma.
    intro: { before: "Events we're running taken from our ", link: "Luma calendar" },
    none: "No events yet.",
    // The tabs over the list, and their name, for a screen reader: those still to come, soonest first, and those
    // past, latest first.
    tabs: { label: "When", future: "Future", past: "Past" },
    // A chip in the filter bar, after + Filter: what it and its menu's heading say, and, after a colon while the
    // list is grouped, which; then its menu's choices: none (a table), or lists by owner or by tag. A saved filter's
    // summary names the lists as `owner` and `tag` say.
    group: {
      chip: "Group by",
      choices: { table: "None", owner: "Owner", tag: "Tag" },
      owner: "By owner",
      tag: "By tag",
    },
    // In the lists by owner and by tag: the list of those with no tag; the other tags of an event listed under one;
    // the fold of a list's later events; and how many are going to an event.
    lists: {
      noTag: "No tag",
      also: (tags: string) => `also ${tags}`,
      more: (n: number) => `${n} more`,
      going: (n: number) => `${n} going`,
    },
    // Over the list: how many the tab and filters find; and what it says when they find none.
    total: (n: number) => count(n, "event", "events"),
    noneFound: "No events match.",
    // Under it, when a search finds none, but would among those taken off Luma, linked to them.
    removedMatches: (n: number) => `${count(n, "match", "matches")} found for events taken off Luma`,
    // The table's headings; the owner's and Google Doc's are `owner` and `doc` below. Going is how many registered
    // and were approved. Hosts are its hosts on Luma, for staff who see supporters.
    columns: { when: "When", name: "Event", tags: "Tags", place: "Place", going: "Going", hosts: "Hosts" },
    // A host Luma has no name for, in the Hosts column.
    noHostName: "No name on Luma",
    // The list's search box, and its filters but Owner's: each Luma tag; each city, and Online; and taken off Luma
    // (`removed`), which finds only those, as they're left out otherwise.
    filters: {
      // When it was held: the last so many days.
      held: "Held",
      search: "Name, host or email",
      tag: "Tag",
      place: "Place",
      removed: { yes: "Yes" } as Record<string, string>,
    },
    // Where an event online is, in the Place column and filter.
    online: "Online",
    // An event gone from our Luma calendar, kept for its history.
    removed: "Taken off Luma",
    // No owner: in red, with a warning, on one coming up, as someone must take it; the edit form's select's first choice.
    noOwner: "No owner",
    // An event's Google Doc: the link to it, in its column after the owner; with none, in red, with a warning,
    // on one coming up, as for no owner.
    doc: "Google Doc",
    // The button at a row's right, and its name for a screen reader, which opens the form to change its owner and doc.
    edit: "Edit",
    editLabel: (event: string) => `Edit ${event}`,
    // The edit form's fields and buttons.
    owner: "Owner",
    docField: "Google Doc",
    // In the empty box: the start of the link it takes (Google Drive's are taken too).
    docPlaceholder: "https://docs.google.com/…",
    save: "Save",
    // After a save that emailed anyone, in a note under the event: whom, and why. Its × closes it.
    emailed: (to: string[], owner: string) =>
      `Emailed ${to.join(" and ")} to let them know ${owner} now owns this event.`,
    closeEmailed: "Close",
    cancel: "Cancel",
    // The email when an event's owner changes: to the new owner, whoever chose them, copied to the one before, saying who
    // gave it to them and from whom; or, when the import gives events their owners by the rules, to each new owner,
    // listing them.
    // To the notification inbox: an upcoming event the Luma import couldn't tell the tags of, sent once.
    unclearTagEmail: {
      subject: (name: string) => `Which Luma tag for ${name}?`,
      // `url`: the event on Luma, where its tags are set; `link`: the events page.
      body: ({
        name,
        when,
        place,
        url,
        link,
      }: {
        name: string;
        when: string;
        place: string;
        url: string;
        link: string;
      }) =>
        `The Luma import couldn't tell which tag this event should have, so it left it untagged. Set it by hand in Luma.

${name}
${when}
${place}
${url}

All events: ${link}`,
    },
    ownerEmail: {
      subject: (n: number, first: string, owner: string) =>
        plural(n, `You're now owner for ${first}, ${owner}`, `You're now owner for ${n} events, ${owner}`),
      // `link`: the events page, showing the event, or for several, the owner's events.
      body: ({
        events,
        owner,
        previous,
        by,
        link,
      }: {
        events: { name: string; when: string; url: string }[];
        owner: string;
        previous: string | null;
        by: string | null;
        link: string;
      }) =>
        `${by ? `You're now the owner of this event, ${owner}. ${by === owner ? "You took it on" : `${by} gave it to you`}${previous ? `, from ${previous}` : ""}.` : `You're now the owner of ${plural(events.length, "this event", "these events")}, ${owner}, by the rules for who owns which events.`}\n\n${plural(events.length, "This event in the staff interface:", "Your events in the staff interface:")}\n${link}\n\n${events
          .map((event) => `${event.name}\n${event.when}\n${event.url}`)
          .join(
            "\n\n",
          )}\n\nAs the owner, you make sure the event is exceptional:\n- Be chronically early: arrive before anyone else to get everything ready, and leave last\n- Spot early what could go wrong, like an entrance that's hard to find\n- Make sure enough people come\n- Have everyone leave feeling it was better than they expected`,
    },
  },
  // What went wrong without stopping the work (lib/server/problems.ts).
  problems: {
    // On the Luma import's run, so on its page and in the email: something it carried on past.
    // Luma errored on one event's guests. Its other events carry on.
    eventGuests: (event: string) => `Couldn't read the guests of an event: ${event}`,
    // Luma errored on one event's hosts. Its other events carry on.
    eventHosts: (event: string) => `Couldn't read the hosts of an event: ${event}`,
    // Luma's rate limit stopped the run early. The next run carries on.
    lumaRefused: "Luma rate limit reached",
    // The calendar's tags couldn't be read, so nothing was tagged this run.
    lumaTagsUnread: "Luma wouldn't list its event tags, so no events were tagged",
    // The tag wouldn't go on one event; the next run tries again.
    lumaTagRefused: (event: string) => `Luma wouldn't tag ${event}`,
    // No job reaches this: it's kept as an error (lib/server/errors-seen.ts), on the errors page and emailed to
    // staff. Luma gets an error, so it sends the webhook again.
    webhookNotRecorded: "A Luma webhook couldn't be recorded",
  },
};
