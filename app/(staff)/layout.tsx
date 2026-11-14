import type { Metadata } from "next";
import NoAnalytics from "@/components/layout/NoAnalytics";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { NAV_FOLD_SCRIPT } from "@/lib/staff-nav";

// The staff interface (/staff): no site header or footer, no analytics,
// kept out of search. Under the root layout, so the consent banner still
// shows.
// Every page here calls requireStaff(). A script folds the sidebar before
// the page draws, if it was folded in this browser (lib/staff-nav.ts).
export const metadata: Metadata = {
  title: { default: staffVocabulary.metaTitle, template: `%s - ${staffVocabulary.metaTitle}` },
  robots: { index: false, follow: false },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NoAnalytics />
      <script dangerouslySetInnerHTML={{ __html: NAV_FOLD_SCRIPT }} />
      {children}
    </>
  );
}
