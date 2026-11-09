import { buttonClass } from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import StaffLink from "./ui/StaffLink";

/** The Supporters page's way to import paper sign-ups, tagged "new" as the navigation tags a page for its first few days. */
export default function ImportSignupsButton({ isNew }: { isNew: boolean }) {
  return (
    <>
      {isNew && <Tag tone="blue">{staffCopy.nav.newTag}</Tag>}
      <StaffLink className={buttonClass({ variant: "ghost", fit: true })} href="/staff/supporters/import">
        {staffCopy.supporters.importSignups}
      </StaffLink>
    </>
  );
}
