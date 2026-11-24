import Page from "../ui/Page";
import PageHead from "../ui/PageHead";
import { shellCopy } from "./copy";

/**
 * What a staff page says in place of itself when what it's about isn't
 * there (the signed-in pages' not-found.tsx): beside the navigation, which
 * stays, and under whatever the page's top says, such as that someone has
 * just deleted it (ui/ResultForm's RefusalPlace).
 */
export default function StaffNotFound() {
  const copy = shellCopy.notFound;
  return (
    <Page kind="form">
      <PageHead intro={copy.words}>{copy.title}</PageHead>
    </Page>
  );
}
