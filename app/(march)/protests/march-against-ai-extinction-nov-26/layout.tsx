import Footer from "@/components/layout/Footer";
import Nav from "@/components/layout/Nav";
import { m } from "./_components/classes";
import MarchSignupFrame from "./_components/MarchSignupFrame";

// The march sign-up: the site's header and footer, but no march banner, as
// this is what the banner points to. A skip link comes first, past the
// header's links to the page.
export default function MarchLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className={m("skip-link")} href="#main">
        Skip to content
      </a>
      <Nav />
      <MarchSignupFrame>{children}</MarchSignupFrame>
      <Footer />
    </>
  );
}
