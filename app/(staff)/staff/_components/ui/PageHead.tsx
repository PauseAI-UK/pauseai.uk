import { Fragment, type ReactNode } from "react";
import styles from "./PageHead.module.css";

/**
 * The head of every staff page but a record's, which has the band (Band):
 * the same places on each, so a title is always where the last page's was.
 *
 * - The title, with `lead` before it (a job's icon) and `tags` beside it,
 *   for how the page's thing stands.
 * - Under it in grey, `intro`: what the page is, in a line or two with no
 *   full stop; then `source`, where what it shows comes from.
 * - Under that, `facts`: for a page about one lesser thing (a letter), what
 *   it is in a line, each fact after a dot. One that's nothing is left out.
 * - At the right, `action`: the page's main button, the one thing it's
 *   there to start (New mailing), first seen and in the same place however
 *   long the page grows. Anything else for the whole page, such as
 *   Download or the way to a page beside it, goes before it. On a phone
 *   they wrap under the title.
 *
 * The space under the head is its own, so what follows brings none.
 */
export default function PageHead({
  lead,
  tags,
  intro,
  source,
  facts = [],
  action,
  children,
}: {
  lead?: ReactNode;
  tags?: ReactNode;
  intro?: ReactNode;
  source?: ReactNode;
  facts?: ReactNode[];
  action?: ReactNode;
  children: ReactNode;
}) {
  const said = facts.filter(Boolean);
  return (
    <header className={styles.head}>
      <div className={styles.words}>
        <div className={styles.heading}>
          {lead}
          <h1>{children}</h1>
          {tags}
        </div>
        {(intro || source) && (
          <p className={styles.intro}>
            {intro}
            {intro && source && " · "}
            {source}
          </p>
        )}
        {said.length > 0 && (
          <p className={styles.facts}>
            {said.map((fact, i) => (
              <Fragment key={i}>
                {i > 0 && " · "}
                {fact}
              </Fragment>
            ))}
          </p>
        )}
      </div>
      {action && <div className={styles.actions}>{action}</div>}
    </header>
  );
}
