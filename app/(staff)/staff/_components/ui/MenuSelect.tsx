"use client";

import { useState } from "react";
import { Label } from "@/components/ui/Field";
import type { FilterOption } from "@/lib/staff-list-filters";
import Choices from "./Choices";
import Menu from "./Menu";
import styles from "./MenuSelect.module.css";

/** A choice in words, with its group's name, as the icon beside it doesn't say it aloud. */
const named = (option: FilterOption): string =>
  option.group ? `${option.label}, ${option.group.label}` : option.label;

/**
 * A dropdown in a form, for choices in groups with icons, which a native
 * select can't show: a field's box with the choice made, or `placeholder`,
 * that opens the list filters' own menu (Menu, Choices), each group's icon
 * beside its name. Picking one closes it. The form sends the choice as
 * `name`, blank till one's picked; `onChange` hears each pick. Its label is
 * over it, and names it with the choice made. `id` must be unique on the page.
 */
export default function MenuSelect({
  id,
  name,
  label,
  options,
  placeholder,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  options: FilterOption[];
  placeholder: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const chosen = options.find((option) => option.value === value);
  const shown = chosen ? named(chosen) : placeholder;
  return (
    <div className={styles.field}>
      <Label>{label}</Label>
      <input type="hidden" name={name} value={value} />
      <Menu
        id={id}
        trigger={styles.trigger}
        name={`${label}: ${shown}`}
        label={
          chosen ? (
            <span className={styles.chosen}>
              {chosen.group?.icon}
              {shown}
            </span>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )
        }
      >
        <Choices
          options={options}
          current={value ? [value] : []}
          row={(option) => (
            <button
              type="button"
              popoverTarget={id}
              popoverTargetAction="hide"
              aria-current={option.value === value ? "true" : undefined}
              aria-label={named(option)}
              onClick={() => {
                setValue(option.value);
                onChange?.(option.value);
              }}
            >
              {option.label}
            </button>
          )}
        />
      </Menu>
    </div>
  );
}
