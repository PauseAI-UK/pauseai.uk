"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Label } from "@/components/ui/Field";
import Tag from "@/components/ui/Tag";
import type { FilterOption } from "@/lib/staff-list-filters";
import Choices from "./Choices";
import Menu from "./Menu";
import styles from "./MenuSelect.module.css";

/**
 * A choice, and what the menu shows with it: a tag beside its name, a line
 * of its words under it, cut off at the menu's edge, and facts under those.
 */
export type MenuOption = FilterOption & { tag?: string; mark?: ReactNode; words?: string; facts?: string[] };

/** A row's parts, as MenuSelect draws a choice with facts, for a list of Choices drawn elsewhere (TextTop's places found). */
export const menuRow = { row: styles.rich, head: styles.head, name: styles.name, facts: styles.facts };

/** A choice in words, with its group's name, as the icon beside it doesn't say it aloud. */
const named = (option: FilterOption): string =>
  option.group ? `${option.label}, ${option.group.label}` : option.label;

/**
 * A dropdown, for choices a native select can't show: in groups with
 * icons, or each with its name in bold, a tag, its words and facts about it,
 * each a line that never wraps, a rule between each (`MenuOption`), in a
 * wider menu, and in the box once chosen. A field's box
 * with the choice made, or `placeholder`, that opens the list filters' own
 * menu (Menu, Choices), each group's icon beside its name, and `last`, if
 * given, at its foot under a rule, as a select's list draws one. Picking one
 * closes it. In a form, it sends the choice as `name`, blank till one's
 * picked. It keeps its own choice, or shows `value`, which its page keeps;
 * `onChange` hears each pick. `disabled`, it can't be opened. Its label is
 * over it, and names it with the choice made. `id` must be unique on the page.
 */
export default function MenuSelect({
  id,
  name,
  label,
  options,
  last,
  placeholder,
  value: given,
  disabled = false,
  onChange,
}: {
  id: string;
  name?: string;
  label: string;
  options: MenuOption[];
  last?: MenuOption;
  placeholder: string;
  value?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  const [own, setOwn] = useState("");
  const value = given ?? own;
  const all = last ? [...options, last] : options;
  const chosen = all.find((option) => option.value === value);
  const shown = chosen ? named(chosen) : placeholder;
  const rich = options.some((option) => option.facts);
  // What's beside a choice's name: a mark of its own, or else its tag.
  const besideOf = ({ mark, tag }: Pick<MenuOption, "mark" | "tag">) => mark ?? (tag && <Tag>{tag}</Tag>);
  // A choice with facts is in the box as it is in the menu: its name and what's beside it, its facts under them.
  const box = chosen?.facts ? (
    <span className={styles.chosenRich}>
      <span className={styles.head}>
        <span className={styles.name}>{chosen.label}</span>
        {besideOf(chosen)}
      </span>
      <span className={styles.facts}>{chosen.facts.join(" · ")}</span>
    </span>
  ) : chosen ? (
    <span className={styles.chosen}>
      {chosen.group?.icon}
      {shown}
    </span>
  ) : (
    <span className={styles.placeholder}>{placeholder}</span>
  );
  // Choices draws a filter's choices, which have none of these.
  const row = ({ tag, mark, words, facts, ...option }: FilterOption & Omit<MenuOption, keyof FilterOption>) => {
    const beside = besideOf({ mark, tag });
    // That, the words and each fact by its id, so they're read as separate words.
    const said = [...(beside ? ["tag"] : []), ...(words ? ["words"] : []), ...(facts ?? []).map((_, n) => n)].map(
      (one) => `${id}-${option.value}-${one}`,
    );
    return (
      <button
        type="button"
        className={rich ? styles.rich : undefined}
        popoverTarget={id}
        popoverTargetAction="hide"
        aria-current={option.value === value ? "true" : undefined}
        aria-label={named(option)}
        aria-describedby={said.length ? said.join(" ") : undefined}
        onClick={() => {
          setOwn(option.value);
          onChange?.(option.value);
        }}
      >
        {rich ? (
          <span className={styles.head}>
            <span className={styles.name}>{option.label}</span>
            {beside && <span id={`${id}-${option.value}-tag`}>{beside}</span>}
          </span>
        ) : (
          option.label
        )}
        {words && (
          <span id={`${id}-${option.value}-words`} className={styles.words}>
            {words}
          </span>
        )}
        {facts && (
          <span className={styles.facts}>
            {facts.map((fact, n) => (
              <Fragment key={fact}>
                {/* A dot between each, seen, not read: each fact is read by its id. */}
                {n > 0 && <span aria-hidden="true"> · </span>}
                <span id={`${id}-${option.value}-${n}`}>{fact}</span>
              </Fragment>
            ))}
          </span>
        )}
      </button>
    );
  };
  return (
    <div className={styles.field}>
      <Label>{label}</Label>
      {name && <input type="hidden" name={name} value={value} />}
      {disabled ? (
        <button type="button" className={styles.trigger} aria-label={`${label}: ${shown}`} disabled>
          {box}
        </button>
      ) : (
        <Menu id={id} trigger={styles.trigger} name={`${label}: ${shown}`} label={box} wide={rich ? "wider" : true}>
          <Choices options={options} current={value ? [value] : []} row={row} />
          {last && (
            <>
              <hr className={styles.rule} />
              <Choices options={[last]} current={value ? [value] : []} row={row} />
            </>
          )}
        </Menu>
      )}
    </div>
  );
}
