import { Fragment, type ReactNode } from "react";
import type { FilterOption } from "@/lib/staff-list-filters";
import ChoiceSearch from "./ChoiceSearch";
import StaffLink from "./StaffLink";
import styles from "./FilterBar.module.css";

/** A choice's link, and its `help` after it on the same line, if it has one. */
function ChoiceLink({ option, href, current }: { option: FilterOption; href: string; current: boolean }) {
  const link = (
    <StaffLink href={href} aria-current={current ? "true" : undefined}>
      {option.label}
      {option.detail && <span className={styles.detail}>{option.detail}</span>}
    </StaffLink>
  );
  if (!option.help) return link;
  return (
    <span className={styles.withHelp}>
      {link}
      {option.help}
    </span>
  );
}

/**
 * A list of choices, in their groups, each a link, those chosen marked,
 * with its `help` after it, such as a "?" saying what it means; or each what
 * `row` draws. One `under` another listed is set in beneath it,
 * and one under that further in.
 * With `search`, a box over it that narrows it.
 */
export default function Choices({
  options,
  current,
  href,
  search,
  row,
}: {
  options: FilterOption[];
  current: string[];
  href?: (value: string) => string;
  search?: string;
  row?: (option: FilterOption) => ReactNode;
}) {
  // How far in a choice is set: one more than the choice it's under, if that's listed.
  const depth = (option: FilterOption): number => {
    const above = options.find((one) => option.under !== undefined && one.value === option.under);
    return above ? depth(above) + 1 : 0;
  };
  return (
    <>
      {search && <ChoiceSearch label={search} />}
      <ul className={styles.choices} data-search={search ? "empty" : undefined}>
        {options.map((option, i) => (
          <Fragment key={option.value}>
            {option.group && option.group.label !== options[i - 1]?.group?.label && (
              <li className={styles.choiceGroup}>
                {option.group.icon}
                {option.group.label}
              </li>
            )}
            <li
              className={option.group ? styles.inGroup : [undefined, styles.under, styles.underTwice][depth(option)]}
              data-untyped={option.untyped || undefined}
            >
              {row ? (
                row(option)
              ) : (
                <ChoiceLink option={option} href={href!(option.value)} current={current.includes(option.value)} />
              )}
            </li>
          </Fragment>
        ))}
      </ul>
    </>
  );
}
