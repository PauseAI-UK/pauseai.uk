"use client";

import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/Controls";
import { staffCopy } from "@/lib/content/staff-interface";
import { chosenValues } from "@/lib/filter-choices";
import { filtersPath, NOT, type Params } from "@/lib/staff-search";
import Choices from "./Choices";
import type { FilterOption } from "./FilterBar";
import StaffLink from "./StaffLink";
import styles from "./FilterBar.module.css";

const copy = staffCopy.filters;

/**
 * The inside of a repeating filter's lozenge's menu: `here` are the choices it
 * has, found or with `not` left out. Each row is a link that swaps to that
 * choice alone. "+ Add" turns the rows to boxes with those it has ticked, as
 * they are from the start when it has several, and "Just one", in its place,
 * turns them back, keeping the first ticked. Closing the menu, by a click
 * away or Escape, loads the list with what's ticked, unless a link has been
 * followed. `turns` offers turning what it has the other way, and `removes`
 * taking it off; without that, as a lozenge's second half, a blank row or
 * nothing ticked is its default.
 */
export default function ManyChoices({
  path,
  values,
  name,
  all,
  here,
  not,
  oneEach,
  options,
  every,
  search,
  turns,
  removes,
}: {
  path: string;
  values: Params;
  name: string;
  /** Every value of the filter, as its URL has them. */
  all: string[];
  here: string[];
  not: boolean;
  oneEach: boolean;
  options: FilterOption[];
  /** All the filter's choices, whether offered here or not. */
  every: string[];
  search?: string;
  turns: boolean;
  removes: boolean;
}) {
  const was = here.map((value) => (not ? NOT + value : value));
  const [boxes, setBoxes] = useState(here.length > 1);
  const [ticked, setTicked] = useState(here);
  const wrapper = useRef<HTMLDivElement>(null);
  const apply = useRef<HTMLAnchorElement>(null);
  const followed = useRef(false);
  const hrefOf = (chosen: string[], way = not) =>
    filtersPath(path, values, { page: "", [name]: chosenValues({ all, was, chosen, not: way, oneEach, every }) });
  const changed = ticked.length !== here.length || ticked.some((value) => !here.includes(value));
  useEffect(() => {
    const menu = wrapper.current!.closest("[popover]")!;
    const closed = (event: Event) => {
      if ((event as ToggleEvent).newState !== "closed") return;
      if (changed && !followed.current) apply.current!.click();
      followed.current = false;
    };
    menu.addEventListener("toggle", closed);
    return () => menu.removeEventListener("toggle", closed);
  }, [changed]);
  const isTicked = (value: string) => ticked.includes(value);
  return (
    <div
      ref={wrapper}
      onClickCapture={(event) => {
        if ((event.target as Element).closest("a")) followed.current = true;
      }}
    >
      {boxes ? (
        <Choices
          options={options.filter((option) => option.value)}
          current={ticked}
          search={search}
          row={(option) => (
            <span className={styles.tick}>
              <Checkbox
                checked={isTicked(option.value)}
                onChange={() =>
                  setTicked(
                    isTicked(option.value)
                      ? ticked.filter((value) => value !== option.value)
                      : [...ticked, option.value],
                  )
                }
              >
                {option.label}
                {option.detail && <span className={styles.detail}>{option.detail}</span>}
              </Checkbox>
            </span>
          )}
        />
      ) : (
        <Choices
          options={options}
          current={ticked.length ? ticked : [""]}
          href={(value) => hrefOf(value ? [value] : [])}
          search={search}
        />
      )}
      <p className={styles.actions}>
        <button
          type="button"
          onClick={() => {
            setBoxes(!boxes);
            if (boxes) setTicked(ticked.slice(0, 1));
          }}
        >
          {boxes ? copy.justOne : copy.addChoice}
        </button>
        {turns && (
          <StaffLink href={hrefOf(ticked, !not)}>
            {not
              ? ticked.length > 1
                ? copy.onlyThese
                : copy.onlyThis
              : ticked.length > 1
                ? copy.exceptThese
                : copy.exceptThis}
          </StaffLink>
        )}
        {removes && <StaffLink href={hrefOf([])}>{copy.remove}</StaffLink>}
      </p>
      <StaffLink ref={apply} href={hrefOf(ticked)} hidden aria-hidden="true" tabIndex={-1} />
    </div>
  );
}
