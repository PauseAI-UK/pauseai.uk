import { whatsappJoinPath } from "@/lib/content/site";
import { ButtonLink } from "@/components/ui/Button";
import styles from "./Closing.module.css";

/**
 * The call to action at the bottom of a page: join the WhatsApp community,
 * or find more ways to get involved, under an optional line. `from` names
 * the page, for the join form to keep as where they came from.
 */
export default function Closing({ from, line }: { from: string; line?: string }) {
  return (
    <section className={styles.closing}>
      <div className="container">
        {line && <p className={styles.line}>{line}</p>}
        <div className={styles.actions}>
          <ButtonLink variant="primary" href={whatsappJoinPath(from)}>
            Join the WhatsApp community
          </ButtonLink>
          <ButtonLink variant="ghost" href="/#join">
            More ways to get involved
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
