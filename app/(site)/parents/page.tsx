import GroupPage from "@/components/groups/GroupPage";
import { groupMetadata, groupPages } from "@/lib/content/group-pages";

export const metadata = groupMetadata(
  "Parents",
  "PauseAI Parents: parents and carers campaigning to stop the race to superintelligent AI.",
);

export default function ParentsPage() {
  return <GroupPage content={groupPages["Parents"]} />;
}
