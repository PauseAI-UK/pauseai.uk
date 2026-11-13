import { SubmitButton } from "@/components/ui/SubmitButton";
import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import type { Mark } from "@/lib/server/politician-edits";
import styles from "./PoliticianMarks.module.css";

const copy = staffCopy.politician;

const MARKS: Mark[] = ["importantTarget", "personalConnection"];

/**
 * The markers staff set on a politician, each a button that's pressed while
 * it's on and turns it off or on, each in a form of its own, or without
 * `setMark`, a tag for each that's on; then, for one of our test
 * politicians, a tag no one changes.
 */
export default function PoliticianMarks({
  politician,
  setMark,
}: {
  politician: { id: number; isTest: boolean } & Record<Mark, boolean>;
  setMark?: (form: FormData) => void | Promise<void>;
}) {
  return (
    <span className={styles.marks}>
      {MARKS.map((mark) =>
        setMark ? (
          <form key={mark} action={setMark}>
            <input type="hidden" name="politicianId" value={politician.id} />
            <input type="hidden" name="mark" value={mark} />
            <input type="hidden" name="on" value={String(!politician[mark])} />
            <SubmitButton variant={politician[mark] ? "primary" : "ghost"} size="small" aria-pressed={politician[mark]}>
              {copy[mark]}
            </SubmitButton>
          </form>
        ) : (
          politician[mark] && (
            <Tag key={mark} tone={mark === "importantTarget" ? "amber" : undefined}>
              {copy[mark]}
            </Tag>
          )
        ),
      )}
      {politician.isTest && <Tag>{staffCopy.politicians.flags.test}</Tag>}
    </span>
  );
}
