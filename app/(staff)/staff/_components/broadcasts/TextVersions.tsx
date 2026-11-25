"use client";

import type { ReactNode } from "react";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import NotIcon from "../ui/NotIcon";
import PartBox, { partButton, partButtonWords } from "../mailings/PartBox";
import { mailingsCopy } from "../mailings/copy";
import styles from "./TextVersions.module.css";

const copy = broadcastsCopy.broadcastPages.textVersions;
const parts = mailingsCopy.mailingEditor;

/** Which of a text's two versions: for those who meet its condition, or everyone else. */
export type VersionSide = "only" | "except";

/**
 * A text's two versions, once it has a condition: a tab each, in the look
 * of an email's parts, worded as the preview's toggle (`who`), with how
 * many each goes to, on one line, cut short where it's too long, as the
 * box under them says it whole; beside them, how many templates go to WhatsApp
 * for approval, while any do. The open one's words, top and buttons (`children`) are in its part's
 * box, whose × makes it the text for everyone, the other version gone.
 */
export default function TextVersions({
  who,
  counts,
  open,
  onOpen,
  templates,
  onForEveryone,
  children,
}: {
  who: string;
  counts: Record<VersionSide, number>;
  open: VersionSide;
  onOpen: (side: VersionSide) => void;
  /** How many templates go to WhatsApp for approval: two, one, or none once it has them all. */
  templates: number;
  onForEveryone?: () => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.versions}>
      <div className={styles.bar}>
        <div role="tablist" className={styles.tabs}>
          {(["only", "except"] as const).map((side) => (
            <button
              key={side}
              type="button"
              role="tab"
              aria-selected={open === side}
              className={partButton(side === "except")}
              onClick={() => onOpen(side)}
            >
              {side === "except" && <NotIcon />}
              <span className={partButtonWords}>
                {who} · {counts[side]}
              </span>
            </button>
          ))}
        </div>
        {templates > 0 && <span className={styles.templates}>{copy.templates(templates)}</span>}
      </div>
      <PartBox
        label={open === "only" ? parts.onlyForLabel(who) : parts.exceptLabel(who)}
        except={open === "except"}
        onForEveryone={onForEveryone}
      >
        {children}
      </PartBox>
    </div>
  );
}
