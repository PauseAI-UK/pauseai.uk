import NotFoundMain from "@/components/layout/NotFoundMain";
import SiteFrame from "@/components/layout/SiteFrame";

// An address no page has: the site's header and footer around the 404,
// unless a section's layout already drew them (SiteFrame draws them once).
export default function NotFound() {
  return (
    <SiteFrame>
      <NotFoundMain />
    </SiteFrame>
  );
}
