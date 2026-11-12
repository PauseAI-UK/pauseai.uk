import { ButtonLink } from "@/components/ui/Button";
import ProsePage from "@/components/ui/ProsePage";

/** What a 404 says, between whatever header and footer its page has. */
export default function NotFoundMain() {
  return (
    <main>
      <ProsePage>
        <p>404</p>
        <h1>Page not found</h1>
        <p>Sorry, we couldn&apos;t find what you were looking for.</p>
        <ButtonLink variant="primary" href="/">
          Go to homepage
        </ButtonLink>
      </ProsePage>
    </main>
  );
}
