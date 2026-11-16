import type { Metadata } from "next";
import { cookies } from "next/headers";
import NoAnalytics from "@/components/layout/NoAnalytics";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { NAV_FOLD_KEY, navFoldOf } from "@/lib/staff-nav";
import styles from "./layout.module.css";

// The staff interface (/staff): no site header or footer, no analytics,
// kept out of search. Under the root layout, so the consent banner still
// shows.
// Every page here calls requireStaff(). Whether the sidebar is folded is
// drawn on the server, from its cookie (lib/staff-nav.ts), on a box around
// the pages that lays nothing out itself.
export const metadata: Metadata = {
  title: { default: staffVocabulary.metaTitle, template: staffVocabulary.tabTitle("%s") },
  robots: { index: false, follow: false },
};

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NoAnalytics />
      <div className={styles.staff} data-staff-nav={navFoldOf((await cookies()).get(NAV_FOLD_KEY))}>
        {children}
      </div>
    </>
  );
}
