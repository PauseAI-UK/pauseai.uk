import type { ReactNode } from "react";
import Footer from "./Footer";
import FrameOnce from "./FrameOnce";
import Nav from "./Nav";

/**
 * The site's header and footer around a page: the only place they're drawn
 * (tests/checks/site-frame.test.ts), and drawn once, however many layouts a
 * page is inside (FrameOnce). `before` comes ahead of the header, such as a
 * skip link; `after` under it, such as the march banner.
 */
export default function SiteFrame({
  before,
  after,
  children,
}: {
  before?: ReactNode;
  after?: ReactNode;
  children: ReactNode;
}) {
  return (
    <FrameOnce
      header={
        <>
          {before}
          <Nav />
          {after}
        </>
      }
      footer={<Footer />}
    >
      {children}
    </FrameOnce>
  );
}
