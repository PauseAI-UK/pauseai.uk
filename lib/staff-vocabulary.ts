// The words every part of the staff interface (/staff) shares: the page
// title, the trail above a page, deleting, the houses, statuses, countries
// and fields, and a list's search, filters, paging and downloads. Each
// feature's own words are in its copy object.

import { plural } from "@/lib/content/plural";

export const staffVocabulary = {
  metaTitle: "PauseAI Staff",
  // The tooltip on a link out of the site, beside its arrow, which a screen reader reads as its description.
  opensInNewTab: "(opens in a new tab)",
  // The trail above a page's head, as a screen reader names it.
  breadcrumb: "Where this page is",
  // Any Delete pressed twice (DeleteTwice), after its first press, asking for a second.
  deleteIt: "Press again to delete it",
  // The same, short, where there's little room (a note's buttons).
  deleteItShort: "Confirm?",
  houses: {
    commons: "House of Commons",
    lords: "House of Lords",
    "scottish-parliament": "Scottish Parliament",
    senedd: "Welsh Parliament",
    "ni-assembly": "Northern Ireland Assembly",
    other: "Other",
  } as Record<string, string>,
  // A person's answer to an ask (lib/asks/asks.ts): a letter's yes, an event's yes, then either's other answer
  // (what it was is in its note) and no.
  statuses: {
    signed: "Signed",
    going: "Going",
    other: "Other",
    declined: "Declined",
    // No answer to an ask, of any kind.
    noAnswer: "No answer",
  } as Record<string, string>,
  // Whether a notable person is in office.
  personStatuses: {
    in_office: "In office",
    died: "Died",
    retired: "Retired",
    left_office: "No longer in office",
  } as Record<string, string>,
  countries: {
    england: "England",
    scotland: "Scotland",
    wales: "Wales",
    "northern-ireland": "Northern Ireland",
  } as Record<string, string>,
  fields: {
    name: "Name",
    salutation: "Salutation",
    constituency: "Constituency",
    party: "Party",
    email: "Email",
    house: "House",
  },
  // The button beside a list's search box; its other filters apply as soon as they're chosen.
  search: "Search",
  // After a list's filters: the list with none.
  resetFilters: "Clear filters",
  // A list's filters: the × in the search box, + Filter, which offers the filters not on, and on a filter's
  // chip, the way to take it off.
  filters: {
    // A date filter's choices: those of the last so many days.
    lastDays: (days: number) => `Last ${days} days`,
    clearSearch: "Clear the search",
    add: "+ Filter",
    // The other half of + Filter: adds a choice the list leaves out. Its menu's heading, and a left-out choice's chip.
    except: "Except",
    exceptHeading: "Leave out those with",
    not: "not",
    notChip: (label: string, value: string) => `${label}: not ${value}`,
    // The choices of a filter on one chip, in its words, which finds any of them, or leaves them all out.
    anyOf: (values: string[]) => values.join(" or "),
    // In a chip's menu: the same choices, left out rather than found, or found rather than left out, one or several.
    exceptThis: "Except this",
    exceptThese: "Except these",
    onlyThis: "Only this",
    onlyThese: "Only these",
    // In a chip's menu: turns its rows to boxes, to choose several; then, in its place, back to one.
    addChoice: "+ Add",
    justOne: "Just one",
    remove: "Remove",
    // Over a long list of a filter's choices: narrows them as it's typed in.
    narrow: "Search these",
    // A place filter's distance, for a screen reader.
    within: "Within",
    // A list's page title, in the browser's tab, with its search and filters that are on, shortened.
    pageTitle: (title: string, filters: string) => `${title}: ${filters}`,
    // The chip at the right of a list's filters: its saved filters, and saving what's on.
    saved: {
      chip: "Saved",
      save: "Save",
      edited: "edited",
      saveTitle: "Save this filter",
      name: "Name",
      shared: "All staff see the same saved filters.",
      cancel: "Cancel",
      find: "Find a saved filter",
      count: (n: number) => `${n} saved ${plural(n, "filter", "filters")}, shared by all staff`,
      none: "No saved filters yet. Set some filters and press Save.",
      update: "Update for all",
      saveAsNew: "Save as new",
      undo: "Undo my changes",
      // A row's menu, its button named after the row.
      rowMenu: (name: string) => `More for ${name}`,
      rename: "Rename",
      deleteForEveryone: "Delete for all",
      // Over the list, when a saved filter names something that has gone.
      gone: (what: string) => `Part of this saved filter no longer exists: “${what}”. It has been left out.`,
      // A saved filter's name when erasing a supporter's details leaves none of it.
      erasedName: "Saved filter",
    },
  },
  // Under a list of more than one page.
  paging: {
    previous: "Previous",
    next: "Next",
    // The paging's name, for a screen reader.
    label: "Pages",
    // A page's number, for a screen reader.
    page: (n: number) => `Page ${n}`,
    // On a phone, between Previous and Next.
    of: (page: number, pages: number) => `Page ${page} of ${pages}`,
    // Under the list: the rows on this page, of how many.
    range: (from: number, to: number, total: number) => `${from}–${to} of ${total}`,
  },
  // Over a list, after its count: the rows on this page, when there's more than one; then its downloads, of every page.
  lists: {
    showing: (from: number, to: number) => `showing ${from}–${to}`,
    // The button that opens the downloads, of every page, and each format in its menu.
    download: "Download",
    formats: { csv: "CSV, for a spreadsheet", json: "JSON, for an agent", vcf: "vCard, for WhatsApp" },
  },
};
