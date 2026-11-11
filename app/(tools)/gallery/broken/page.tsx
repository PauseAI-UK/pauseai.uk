import { pageMetadata } from "@/lib/metadata";
import Broken from "../_components/Broken";
import { requireGallery } from "../_components/enabled";

// A page that breaks in the browser when asked, for the storyboard to show
// what happens when one does. Only fixture builds have it, as the gallery.
export const metadata = {
  ...pageMetadata({ title: "A page that breaks", description: "For the storyboard.", path: "/gallery/broken" }),
  robots: { index: false, follow: false },
};

export default function BrokenPage() {
  requireGallery();
  return <Broken />;
}
