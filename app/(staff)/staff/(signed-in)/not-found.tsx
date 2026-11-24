import StaffNotFound from "../_components/shell/StaffNotFound";

// In place of a signed-in page whose record isn't there, inside this layout, so the navigation stays, and what a
// form has just said at the page's top, such as that someone deleted it.
export default function PageNotFound() {
  return <StaffNotFound />;
}
