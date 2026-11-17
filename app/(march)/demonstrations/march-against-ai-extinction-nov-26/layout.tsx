import SiteFrame from "@/components/layout/SiteFrame";
import { m } from "./_components/classes";
import MarchSignupFrame from "./_components/MarchSignupFrame";

// The march sign-up: the site's header and footer, but no march banner, as
// this is what the banner points to. A skip link comes first, past the
// header's links to the page.
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
