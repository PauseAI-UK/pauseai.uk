import type { ReactNode } from "react";
import type { PageKind } from "@/lib/staff-page-kinds";
import { staffPageHref, type StaffPageId } from "@/lib/staff-sections";
import Breadcrumb, { type Crumb } from "./Breadcrumb";
import styles from "./Page.module.css";
import { shellCopy } from "../shell/copy";

/** Where a page below the navigation's is: the navigation's page it's under, any pages between, and its own name. */
type Trail = { under: StaffPageId; via?: Crumb[]; here: string };

type Props = { kind: PageKind; children: ReactNode } & (Trail | { [Key in keyof Trail]?: undefined });

/**
 * A staff page, whole: every page.tsx returns one, saying which kind of page
 * it is (lib/staff-page-kinds.ts). A page the navigation leads to starts
 * with its head. Any other says where it is, and starts with the trail to
 * there (Breadcrumb): the navigation's own name for the page it's `under`,
 * so the trail and the link marked in the sidebar agree, then the pages
 * `via` which it's reached, then `here`.
 */
export default function Page({ kind, under, via = [], here, children }: Props) {
  return (
    <div className={styles.page} data-page-kind={kind}>
      {under && (
        <Breadcrumb steps={[{ href: staffPageHref(under), label: shellCopy.nav[under] }, ...via]} here={here} />
      )}
      {children}
    </div>
  );
}
