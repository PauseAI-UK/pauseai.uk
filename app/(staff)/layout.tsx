import type { Metadata } from "next";
import { cookies } from "next/headers";
import NoAnalytics from "@/components/layout/NoAnalytics";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { NAV_FOLD_KEY } from "@/lib/staff-nav";
import styles from "./layout.module.css";

// The staff interface (/staff): no site header or footer, no analytics,
// kept out of search. Under the root layout, so the consent banner still
// shows.
// Every page here calls requireStaff(). Whether the sidebar is folded is
// drawn on the server, from its cookie (lib/staff-nav.ts), on a box around
// the pages that lays nothing out itself.
export const metadata: Metadata = {
  title: { default: staffVocabulary.metaTitle, template: `%s - ${staffVocabulary.metaTitle}` },
  robots: { index: false, follow: false },
};

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const folded = (await cookies()).get(NAV_FOLD_KEY)?.value === "folded";
  return (
    <>
      <NoAnalytics />
      <div className={styles.staff} data-staff-nav={folded ? "folded" : "open"}>
        {children}
      </div>
    </>
  );
}
