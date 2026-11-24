import SiteFrame from "@/components/layout/SiteFrame";
import { m } from "./_components/classes";
import MarchSignupFrame from "./_components/MarchSignupFrame";

// The marches' pages: the site's header and footer around the marches'
// frame. A skip link comes first, past the header's links to the page.
export default function MarchLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteFrame
      before={
        <a className={m("skip-link")} href="#main">
          Skip to content
        </a>
      }
    >
      <MarchSignupFrame>{children}</MarchSignupFrame>
    </SiteFrame>
  );
}
