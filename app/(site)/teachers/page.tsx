import GroupPage from "@/components/groups/GroupPage";
import { groupMetadata, groupPages } from "@/lib/content/group-pages";

export const metadata = groupMetadata(
  "Teachers",
  "⁂ Teachers for a Pause: teachers, lecturers and school staff campaigning to stop the race to superintelligent AI.",
);

export default function TeachersPage() {
  return <GroupPage content={groupPages["Teachers"]} />;
}
