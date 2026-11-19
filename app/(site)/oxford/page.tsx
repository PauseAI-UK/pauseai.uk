import GroupPage from "@/components/groups/GroupPage";
import { groupMetadata, groupPages } from "@/lib/content/group-pages";

export const metadata = groupMetadata(
  "Oxford",
  "PauseAI Oxford links students, researchers, and locals to discuss and act on AI safety.",
);

export default function OxfordPage() {
  return <GroupPage content={groupPages["Oxford"]} />;
}
