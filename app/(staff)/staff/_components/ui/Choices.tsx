import { Fragment, type ReactNode } from "react";
import type { FilterOption } from "@/lib/staff-list-filters";
import ChoiceSearch from "./ChoiceSearch";
import StaffLink from "./StaffLink";
import styles from "./FilterBar.module.css";

/**
 * A list of choices, in their groups, each a link, those chosen marked; or
 * each what `row` draws. One `under` another listed is set in beneath it,
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
            <li className={option.group ? styles.inGroup : [undefined, styles.under, styles.underTwice][depth(option)]}>
              {row ? (
                row(option)
              ) : (
                <StaffLink
                  href={href!(option.value)}
                  aria-current={current.includes(option.value) ? "true" : undefined}
                >
                  {option.label}
                  {option.detail && <span className={styles.detail}>{option.detail}</span>}
                </StaffLink>
              )}
            </li>
          </Fragment>
        ))}
      </ul>
    </>
  );
}
