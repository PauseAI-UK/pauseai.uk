"use client";

import { useId, useRef, useState } from "react";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { NOT_CONDITION } from "@/lib/mailings/doc";
import type { MailingChoice } from "@/lib/mailings/fields";
import Choices from "../ui/Choices";
import { menuClass, menuItemClass, menuItemsClass } from "../ui/Menu";
import { menuRow } from "../ui/MenuSelect";
import NotIcon from "../ui/NotIcon";
import styles from "./ConditionMenu.module.css";
import { partButton } from "./PartBox";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.mailingEditor;

/**
 * "+ Only for those who…", or "Except those who…" (`not`): a button, in the
 * look of the box it makes (PartBox), that opens the asks, as the filter
 * bar's Answer does, then the answers to the one chosen, each with how many
 * recipients it takes in, searchable where there are many, such as events:
 * a menu's box and choices (Menu), and its answers as the template menu's
 * (MenuSelect), each with its count at the far end of its line.
 * Choosing one calls `choose` with its condition, marked NOT_CONDITION for
 * except. Pressing it keeps the focus where it was, so a letter being
 * written keeps its cursor.
 */
export default function ConditionMenu({
  not,
  conditions,
  recipients,
  choose,
}: {
  not: boolean;
  conditions: MailingChoice[];
  /** How many recipients there are, to say how many all but some is. */
  recipients?: number;
  choose: (condition: string) => void;
}) {
  const id = `${useId().replace(/:/g, "")}-${not ? "except" : "only"}`;
  // The ask chosen, whose answers the menu now offers; none for the list of asks.
  const [ask, setAsk] = useState<string>();
  const menu = useRef<HTMLDivElement>(null);
  const asks = [...new Set(conditions.map((condition) => condition.group!))];
  const inAsk = conditions.filter((condition) => condition.group === ask);
  const searchable = inAsk.some((condition) => condition.searchable);
  const keep = (event: React.MouseEvent) => event.preventDefault();
  return (
    <>
      <button
        type="button"
        className={partButton(not)}
        popoverTarget={id}
        onMouseDown={keep}
        style={{ anchorName: `--${id}` } as React.CSSProperties}
      >
        {not && <NotIcon />}
        {not ? copy.except : copy.addOnlyFor}
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        className={menuClass}
        role="menu"
        aria-label={not ? copy.except : copy.addOnlyFor}
        style={{ positionAnchor: `--${id}` } as React.CSSProperties}
      >
        {ask === undefined ? (
          <ul className={menuItemsClass}>
            {asks.map((group) => (
              <li key={group}>
                <button
                  type="button"
                  role="menuitem"
                  className={`${menuItemClass} ${styles.toAsk}`}
                  onMouseDown={keep}
                  onClick={() => setAsk(group)}
                >
                  {group}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <button
              type="button"
              className={`${menuItemClass} ${styles.back}`}
              onMouseDown={keep}
              onClick={() => setAsk(undefined)}
            >
              {copy.backToAsks}
            </button>
            <p className={styles.askTitle}>{ask}</p>
            <Choices
              options={inAsk.map((condition) => ({ value: condition.id, label: condition.option! }))}
              current={[]}
              search={searchable ? staffVocabulary.filters.narrow : undefined}
              row={(option) => {
                const condition = inAsk.find((one) => one.id === option.value)!;
                const n = not && recipients !== undefined ? recipients - condition.covers! : condition.covers!;
                return (
                  <button
                    type="button"
                    role="menuitem"
                    className={menuRow.row}
                    onMouseDown={keep}
                    onClick={() => {
                      // Not popoverTargetAction: by then the asks have replaced this button.
                      menu.current?.hidePopover();
                      setAsk(undefined);
                      choose(`${not ? NOT_CONDITION : ""}${condition.id}`);
                    }}
                  >
                    <span className={menuRow.head}>
                      <span className={menuRow.name}>{option.label}</span>
                      <span className={menuRow.facts}>{copy.covers(n)}</span>
                    </span>
                  </button>
                );
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
