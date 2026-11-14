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
export function NotWords({ label }: { label: string }) {
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
 * back, keeping the first ticked. Each tick changes the list at once, replacing
 * the URL so Back isn't full of them, the router dropping one still on its way
 * for a newer. Meanwhile the bar is held (ui/FilterBarLines), so the menu stays
 * open and the chip stays, even with nothing ticked, until the menu closes; only
 * the chip's words change. As a lozenge's second half (`half`) it's there with
 * none chosen too, named for its blank choice, and has nothing to turn round or
 * remove. `turns` offers turning what it has the other way. `icon`, before
 * its choices, says what they all are, so its words leave out their group
 * (a Consent lozenge's way). `boxOptions`, if given, are those "+ Add" offers
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
  return (
    <Menu
      id={id}
      trigger={not ? `${styles.chip} ${styles.not}` : styles.chip}
      label={
        half ? (
          chosenWords.length > 0 ? (
            chosenWords
          ) : (
            words("")
          )
        ) : (
          <>
            {not && <NotIcon />}
            {not ? <NotWords label={label} /> : `${label}: `}
            {icon ? <IconText icon={icon}>{chosenWords}</IconText> : chosenWords}
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
                <Checkbox
                  checked={ticked.includes(option.value)}
                  onChange={() =>
                    tick(
                      ticked.includes(option.value)
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
              hold();
              setBoxes(!boxes);
              if (boxes && ticked.length > 1) tick(ticked.slice(0, 1));
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
          {!half && <StaffLink href={hrefOf([])}>{copy.remove}</StaffLink>}
        </p>
      </div>
    </Menu>
  );
}
