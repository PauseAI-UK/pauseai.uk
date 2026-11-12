import { staffCopy } from "@/lib/content/staff-interface";
import StaffLink from "./StaffLink";
import styles from "./Breadcrumb.module.css";

/** A step of the trail above this page: where it leads, and its name. */
export type Crumb = { href: string; label: string };

/**
 * Above a page's head, where the page is: each page above it as a link, the
 * navigation's first ("Supporters › Jane Smith"), then this page, `here`,
 * which isn't one. ui/Page puts it there.
 */
export default function Breadcrumb({ steps, here }: { steps: Crumb[]; here: string }) {
  return (
    <nav aria-label={staffCopy.breadcrumb} className={styles.trail}>
      <ol>
        {steps.map((step) => (
          <li key={step.href}>
            <StaffLink href={step.href}>{step.label}</StaffLink>
          </li>
        ))}
        <li aria-current="page">{here}</li>
      </ol>
    </nav>
  );
}
