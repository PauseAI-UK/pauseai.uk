import { ButtonLink } from "@/components/ui/Button";
import ProsePage from "@/components/ui/ProsePage";

/**
 * What a 404 says, between whatever header and footer its page has: the
 * page's <main>, or `as="div"` inside another's, as the component gallery
 * shows it.
 */
export default function NotFoundMain({ as: Tag = "main" }: { as?: "main" | "div" }) {
  return (
    <Tag>
      <ProsePage>
        <p>404</p>
        <h1>Page not found</h1>
        <p>Sorry, we couldn&apos;t find what you were looking for.</p>
        <ButtonLink variant="primary" href="/">
          Go to homepage
        </ButtonLink>
      </ProsePage>
    </Tag>
  );
}
