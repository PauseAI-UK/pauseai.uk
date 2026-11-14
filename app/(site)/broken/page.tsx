import { pageMetadata } from "@/lib/metadata";
import { fixturesOnly } from "@/lib/server/fixtures-only.server";
import Broken from "./Broken";

// A page that breaks in the browser when asked, for the storyboard to show
// what a visitor sees when one does, and that the site is told. Only fixture
// builds have it, as the gallery.
export const metadata = {
  ...pageMetadata({ title: "A page that breaks", description: "For the storyboard.", path: "/broken" }),
  robots: { index: false, follow: false },
};

export default function BrokenPage() {
  fixturesOnly();
  return <Broken />;
}
