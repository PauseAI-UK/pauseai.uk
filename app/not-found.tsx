import Footer from "@/components/layout/Footer";
import Nav from "@/components/layout/Nav";
import NotFoundMain from "@/components/layout/NotFoundMain";

// An address no page has, outside any layout with a header and footer of its
// own; one a public page says it can't find is app/(site)/not-found.tsx.
export default function NotFound() {
  return (
    <>
      <Nav />
      <NotFoundMain />
      <Footer />
    </>
  );
}
