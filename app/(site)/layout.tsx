import MarchBanner from "@/components/layout/MarchBanner";
import SiteFrame from "@/components/layout/SiteFrame";

// Public pages: the site header, then the page, then the footer. The cookie
// consent is in the root layout.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteFrame after={<MarchBanner />}>{children}</SiteFrame>;
}
