import { Fragment } from "react";
import type { Briefing } from ".";

// What a briefing's file writes it with.

export function defineBriefing(fields: Omit<Briefing, "tldr">): Briefing {
  return { ...fields, tldr: fields.keyStories.map((story) => story.lead).join(" ") };
}

/** Marks citing a briefing's sources by number, each linking to its note: "2,3". */
export function cite(...sources: number[]) {
  return (
    <sup>
      {sources.map((source, i) => (
        <Fragment key={source}>
          {i > 0 && ","}
          <a href={`#source-${source}`} aria-label={`Source ${source}`}>
            {source}
          </a>
        </Fragment>
      ))}
    </sup>
  );
}
