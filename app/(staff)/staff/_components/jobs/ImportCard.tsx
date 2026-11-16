import StaffLink from "../ui/StaffLink";
import type { ReactNode } from "react";
import styles from "./ImportCard.module.css";
import Grid, { Card } from "../ui/Grid";

/** The Scheduled jobs page's cards, side by side where there's room. */
export function ImportCards({ children }: { children: ReactNode }) {
  return <Grid even>{children}</Grid>;
}

type Props = {
  /** The job's name: the link to its page. */
  title: string;
  href: string;
  /** Where it reads from, before the name. */
  icon: ReactNode;
  /** Its lozenges, after the name. */
  tags?: ReactNode;
  /** What it does, and where from, if it says. */
  intro?: ReactNode;
  /** How its newest run ended: under the name. */
  children: ReactNode;
  /** When it next runs on its own, if it does: at its foot, under a rule. */
  next?: ReactNode;
};

/**
 * One import or check on the Scheduled jobs page: a card with its icon, name and lozenges,
 * how its newest run ended, what it does if it says, and at its foot when it next runs. The whole card opens the job's page;
 * the links in its description still open where it reads from.
 */
export default function ImportCard({ title, href, icon, tags, intro, children, next }: Props) {
  return (
    <Card span={2} className={styles.card}>
      <div className={styles.head}>
        {icon}
        <h3 className={styles.title}>
          <StaffLink href={href} className={styles.open}>
            {title}
          </StaffLink>
          {tags}
        </h3>
      </div>
      <div className={styles.status}>{children}</div>
      {intro && <p className={styles.intro}>{intro}</p>}
      {next && <p className={styles.next}>{next}</p>}
    </Card>
  );
}
