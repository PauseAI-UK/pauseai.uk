import GroupPage from "@/components/groups/GroupPage";
import { groupMetadata, groupPages } from "@/lib/content/group-pages";

export const metadata = groupMetadata("Scotland", "PauseAI Scotland hosts events and conversations on AI risk.");

export default function ScotlandPage() {
  return <GroupPage content={groupPages["Scotland"]} />;
}
