import Tag from "@/components/ui/Tag";
import { politiciansCopy } from "./politicians/copy";

/** After a politician's name: a space and a lozenge if they're one of ours for testing, or nothing. */
export default function TestTag({ isTest }: { isTest: boolean }) {
  return (
    isTest && (
      <>
        {" "}
        <Tag>{politiciansCopy.politicians.flags.test}</Tag>
      </>
    )
  );
}
