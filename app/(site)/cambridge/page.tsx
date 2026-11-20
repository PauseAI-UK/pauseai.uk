import GroupPage from "@/components/groups/GroupPage";
import { groupMetadata, groupPages } from "@/lib/content/group-pages";

export const metadata = groupMetadata(
  "Cambridge",
  "PauseAI Cambridge links students, researchers, and locals to discuss and act on AI safety.",
);

export default function CambridgePage() {
  return <GroupPage content={groupPages["Cambridge"]} />;
}
