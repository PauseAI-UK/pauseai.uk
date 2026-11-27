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
 * "+ Only those who…", or "Everyone except…" (`not`): a button, in the look
 * of the box it makes (PartBox), whose menu, titled the same, offers who the
 * paragraph at the cursor is for, or isn't. Each group of
 * conditions: one with a single choice, such as having an MP, is chosen
 * there; any other opens its choices beside the menu, searchable where
 * there are many, such as events. Each says how many recipients it takes
 * in. Choosing one calls `choose` with its condition, marked NOT_CONDITION
 * for except. Pressing it keeps the focus where it was, so a letter being
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
  const title = not ? copy.wayExceptTitle : copy.wayOnly;
  // The group whose choices are open beside the menu; none while none is.
  const [open, setOpen] = useState<string>();
  const menu = useRef<HTMLDivElement>(null);
  const groups = [...new Set(conditions.map((condition) => condition.group!))];
  const inGroup = (group: string) => conditions.filter((condition) => condition.group === group);
  const keep = (event: React.MouseEvent) => event.preventDefault();
  // How many a choice takes in, the way the switch is set.
  const takesIn = (condition: MailingChoice) =>
    not && recipients !== undefined ? recipients - condition.covers! : condition.covers!;
  const pick = (condition: MailingChoice) => {
    menu.current?.hidePopover();
    setOpen(undefined);
    choose(`${not ? NOT_CONDITION : ""}${condition.id}`);
  };
  const choiceRow = (condition: MailingChoice, label: string) => (
    <button
      type="button"
      role="menuitem"
      className={menuRow.row}
      onMouseDown={keep}
      onClick={() => pick(condition)}
    >
      <span className={menuRow.head}>
        <span className={styles.choice}>{label}</span>
        <span className={menuRow.facts}>{copy.covers(takesIn(condition))}</span>
      </span>
    </button>
  );
  const choices = open === undefined ? [] : inGroup(open);
  return (
    <>
      <button
        type="button"
        className={partButton(not)}
        popoverTarget={id}
        onMouseDown={keep}
        style={{ anchorName: `--${id}` } as React.CSSProperties}
      >
        {not ? <NotIcon /> : "+ "}
        {not ? copy.wayExcept : copy.wayOnly}
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        className={styles.pop}
        role="menu"
        aria-label={title}
        style={{ positionAnchor: `--${id}` } as React.CSSProperties}
        onToggle={(event) => event.newState === "closed" && setOpen(undefined)}
      >
        {open !== undefined && (
          <div className={`${menuClass} ${styles.box} ${styles.side}`}>
            <p className={styles.sideTitle}>{open}</p>
            <Choices
              options={choices.map((condition) => ({ value: condition.id, label: condition.option! }))}
              current={[]}
              search={choices.some((condition) => condition.searchable) ? staffVocabulary.filters.narrow : undefined}
              row={(option) => choiceRow(choices.find((one) => one.id === option.value)!, option.label)}
            />
          </div>
        )}
        <div className={`${menuClass} ${styles.box}`}>
          <p className={styles.question}>{title}</p>
          <ul className={menuItemsClass}>
            {groups.map((group) => {
              const all = inGroup(group);
              const one = all.length === 1 && !all[0].searchable ? all[0] : undefined;
              return (
                <li key={group}>
                  {one ? (
                    <button
                      type="button"
                      role="menuitem"
                      className={`${menuItemClass} ${styles.group}`}
                      onMouseDown={keep}
                      onClick={() => pick(one)}
                    >
                      <span className={styles.choice}>{one.label}</span>
                      <span className={styles.covers}>{copy.covers(takesIn(one))}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      aria-expanded={open === group}
                      className={`${menuItemClass} ${styles.group}`}
                      onMouseDown={keep}
                      onClick={() => setOpen(open === group ? undefined : group)}
                    >
                      <span className={styles.choice}>{group}</span>
                      <span className={styles.count}>{copy.choiceCount(all.length)}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
