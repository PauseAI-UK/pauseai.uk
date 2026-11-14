import { buttonClass } from "@/components/ui/Button";
import { Muted } from "@/components/ui/Text";
import styles from "./EraseLink.module.css";
import StaffLink from "../ui/StaffLink";
import { erasureCopy } from "@/lib/erasure/copy";

/** At the foot of a supporter's page, out of the way: a note of when to erase them, and the red button to the page that does. */
export default function EraseLink({ supporterId }: { supporterId: number }) {
  return (
    <p className={styles.erase}>
      <StaffLink
        className={buttonClass({ variant: "danger", size: "small" })}
        href={`/staff/supporters/${supporterId}/erase`}
      >
        {erasureCopy.erase.title}
      </StaffLink>
      <Muted>{erasureCopy.erase.note}</Muted>
    </p>
  );
}
