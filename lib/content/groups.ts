import { localGroups, type LocalGroup, type LocalGroupName } from "./local-groups";

/** The words of a group's page and header that carry its name. */
export type GroupWords = {
  /** The page's heading, and its title on social cards. */
  title: string;
  /** The group in a few words: under "PauseAI UK" in the header, and the browser tab's title. */
  label: string;
  /** The heading over its events to come. */
  upcoming: string;
  /** What that section says when there are none, before it points to the UK calendar. */
  nothingOn: string;
  /** The heading over its past events. */
  past: string;
};

/** A group of people with something in common other than where they live. */
export type AffinityGroupName = "Parents" | "Teachers";

export type AffinityGroup = {
  name: AffinityGroupName;
  href: string;
  /** What the Groups menu calls it. */
  menu: string;
  /**
   * Words that mark a calendar event as this group's, matched as a local
   * group's place names are (lib/content/local-groups.ts). The group meets
   * online and in any town, so its events say whose they are in their names.
   */
  eventMatchers: string[];
  words: GroupWords;
};

export const affinityGroups: AffinityGroup[] = [
  {
    name: "Parents",
    href: "/parents",
    menu: "⁂ Parents",
    eventMatchers: ["Parents"],
    words: {
      title: "⁂ PauseAI Parents",
      label: "⁂ Parents",
      upcoming: "⁂ Upcoming events for parents",
      nothingOn: "⁂ Nothing is listed for parents just now.",
      past: "⁂ Past events for parents",
    },
  },
  {
    name: "Teachers",
    href: "/teachers",
    menu: "⁂ Teachers",
    eventMatchers: ["Teachers"],
    words: {
      title: "⁂ Teachers for a Pause",
      label: "⁂ Teachers for a Pause",
      upcoming: "⁂ Upcoming events for teachers",
      nothingOn: "⁂ Nothing is listed for teachers just now.",
      past: "⁂ Past events for teachers",
    },
  },
];

export type GroupName = LocalGroupName | AffinityGroupName;

/** What a group's page and the header need of it, whichever kind it is. */
export type Group = {
  name: GroupName;
  href: string;
  eventMatchers: string[];
  logo?: LocalGroup["logo"];
  words: GroupWords;
};

/** A local group's words, which all follow from its place's name. */
function localGroupWords(name: LocalGroupName): GroupWords {
  return {
    title: `PauseAI ${name}`,
    label: `${name} Group`,
    upcoming: `Upcoming events in ${name}`,
    nothingOn: `Nothing is listed in ${name} just now.`,
    past: `Past events in ${name}`,
  };
}

/** Every group with a page: the local groups, then the affinity groups. */
export const groups: Group[] = [
  ...localGroups.map((group) => ({ ...group, words: localGroupWords(group.name) })),
  ...affinityGroups,
];

/** The group of that name. GroupName only admits names that are in `groups`. */
export function groupNamed(name: GroupName): Group {
  return groups.find((group) => group.name === name)!;
}
