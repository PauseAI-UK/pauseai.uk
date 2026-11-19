"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/Controls";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { chosenValues } from "@/lib/filter-choices";
import { filtersPath, NOT, type Params } from "@/lib/list-params";
import Choices from "./Choices";
import type { FilterOption } from "@/lib/staff-list-filters";
import { useBarHold } from "./FilterBarLines";
import IconText from "./IconText";
import Menu from "./Menu";
import NotIcon from "./NotIcon";
import StaffLink from "./StaffLink";
import styles from "./FilterBar.module.css";

const copy = staffVocabulary.filters;

/** The start of a chip that leaves out: its filter's name, then "not", lighter than the choices that follow. */
function NotWords({ label }: { label: string }) {
  return (
    <>
      {label}: <span className={styles.joining}>{copy.not}</span>{" "}
    </>
  );
}

/**
 * A repeating filter's chip for all it finds, or with `not` all it leaves out:
 * "Kind: A or B", the "or" lighter so the eye finds the choices. `here` are the
 * choices it has. In its menu each row is a link that swaps to that choice alone
 * and closes it. "+ Add" turns the rows to boxes with those it has ticked, as they
 * are from the start when it has several, and "Just one", in its place, turns them
 * back, keeping the first ticked. A box `under` another is part of it, set in
 * beneath it: ticking that one ticks its parts, unticking a part unticks it,
 * and ticking every part ticks it, the URL keeping only it. Each tick changes the list at once, replacing
 * the URL so Back isn't full of them, the router dropping one still on its way
 * for a newer. Meanwhile the bar is held (ui/FilterBarLines), so the menu stays
 * open and the chip stays, even with nothing ticked, until the menu closes; only
 * the chip's words change. As part of a lozenge (`half`) it's there with
 * none chosen too, named for its blank choice, and has nothing to remove,
 * as removing the lozenge's first part removes it. `turns` offers turning what it has the other way. `icon`, before
 * its name, says what its choices all are, so its words leave out their
 * group (a Consent chip's way). `boxOptions`, if given, are those "+ Add" offers
 * to tick, where they're fewer than the menu offers to pick one of. `id`
 * tells its menu from another of the filter's.
 */
export default function ManyChoices({
  path,
  values,
  name,
  label,
  all,
  here,
  not,
  oneEach,
  options,
  every,
  search,
  turns,
  half,
  icon,
  boxOptions = options,
  id = `filter-${name}-${not ? "left-out" : "found"}`,
}: {
  path: string;
  values: Params;
  name: string;
  label: string;
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
  half: boolean;
  icon?: ReactNode;
  boxOptions?: FilterOption[];
  id?: string;
}) {
  const was = here.map((value) => (not ? NOT + value : value));
  const [boxes, setBoxes] = useState(here.length > 1);
  const [ticked, setTicked] = useState(here);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { hold, release } = useBarHold();
  const wrapper = useRef<HTMLDivElement>(null);
  const hrefOf = (chosen: string[], way = not) =>
    filtersPath(path, values, { page: "", [name]: chosenValues({ all, was, chosen, not: way, oneEach, every }) });
  const tick = (chosen: string[]) => {
    setTicked(chosen);
    startTransition(() => router.replace(hrefOf(chosen), { scroll: false }));
  };
  useEffect(() => {
    const menu = wrapper.current!.closest("[popover]")!;
    const toggled = (event: Event) => {
      if ((event as ToggleEvent).newState === "closed") {
        release();
        setBoxes(ticked.length > 1);
      } else if (boxes) {
        hold();
      }
    };
    menu.addEventListener("toggle", toggled);
    return () => menu.removeEventListener("toggle", toggled);
  });
  // Among the boxes, one `under` another is part of it: ticked with it, and ticking every part ticks it, keeping
  // only it in the URL, as it finds them all.
  const parentOf = (value: string) => {
    const under = boxOptions.find((one) => one.value === value)?.under;
    return boxOptions.find((one) => one.value && one.value === under)?.value;
  };
  const partsOf = (value: string) => boxOptions.filter((one) => one.under === value).map((one) => one.value);
  const shown = (value: string): boolean => {
    const parent = parentOf(value);
    return ticked.includes(value) || (parent !== undefined && shown(parent));
  };
  // What's ticked once `value`'s box is pressed.
  const toggled = (value: string): string[] => {
    const parent = parentOf(value);
    if (shown(value)) {
      // A part of one ticked unticks that one, leaving its other parts ticked.
      if (parent !== undefined && ticked.includes(parent)) {
        return [...ticked.filter((one) => one !== parent), ...partsOf(parent).filter((one) => one !== value)];
      }
      return ticked.filter((one) => one !== value);
    }
    // Ticked, it stands for its parts, which go.
    const next = [...ticked.filter((one) => !partsOf(value).includes(one)), value];
    if (parent === undefined || !partsOf(parent).every((one) => next.includes(one))) return next;
    // Every part ticked is the one they're part of.
    return [...next.filter((one) => !partsOf(parent).includes(one)), parent];
  };
  const words = (value: string) => {
    const option = options.find((one) => one.value === value)!;
    return [icon ? undefined : option.group?.label, option.label].filter(Boolean).join(", ");
  };
  const chosenWords = ticked.flatMap((value, i) =>
    i === 0
      ? [words(value)]
      : [
          <span key={value} className={styles.joining}>
            {copy.anyOf(["", ""])}
          </span>,
          words(value),
        ],
  );
  const named = (
    <>
      {not ? <NotWords label={label} /> : `${label}: `}
      {chosenWords}
    </>
  );
  return (
    <Menu
      id={id}
      trigger={not ? `${styles.chip} ${styles.not}` : styles.chip}
      label={
        half ? (
          <>
            {not && <NotIcon />}
            {chosenWords.length > 0 ? chosenWords : words("")}
          </>
        ) : (
          <>
            {not && <NotIcon />}
            {icon ? <IconText icon={icon}>{named}</IconText> : named}
          </>
        )
      }
    >
      <p className={styles.heading}>{label}</p>
      <div
        ref={wrapper}
        data-pending={pending || undefined}
        onClickCapture={(event) => {
          // A link followed goes where it says: the bar starts afresh when it gets there, closing the menu.
          if ((event.target as Element).closest("a")) release();
        }}
      >
        {boxes ? (
          <Choices
            options={boxOptions.filter((option) => option.value)}
            current={ticked}
            search={search}
            row={(option) => (
              <span className={styles.tick}>
                <Checkbox checked={shown(option.value)} onChange={() => tick(toggled(option.value))}>
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
              hold();
              setBoxes(!boxes);
              if (boxes && ticked.length > 1) tick(ticked.slice(0, 1));
            }}
          >
            {boxes ? copy.justOne : copy.addChoice}
          </button>
          {turns && ticked.length > 0 && (
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
          {!half && <StaffLink href={hrefOf([])}>{copy.remove}</StaffLink>}
        </p>
      </div>
    </Menu>
  );
}
