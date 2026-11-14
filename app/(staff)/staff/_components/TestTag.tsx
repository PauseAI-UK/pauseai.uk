import Tag from "@/components/ui/Tag";
import { staffVocabulary } from "@/lib/staff-vocabulary";

/** After a politician's name: a space and a lozenge if they're one of ours for testing, or nothing. */
export default function TestTag({ isTest }: { isTest: boolean }) {
  return (
    isTest && (
      <>
        {" "}
        <Tag>{staffVocabulary.politicianFlags.test}</Tag>
      </>
    )
  );
}
