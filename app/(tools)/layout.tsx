import MarchBanner from "@/components/layout/MarchBanner";
import NoAnalytics from "@/components/layout/NoAnalytics";
import SiteFrame from "@/components/layout/SiteFrame";

// Unlisted volunteer tools and trackers (hidden from the sitemap): the site
// header and footer, and no analytics.
export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteFrame
      after={
        <>
          <MarchBanner />
          <NoAnalytics />
        </>
      }
    >
      {children}
    </SiteFrame>
  );
}
