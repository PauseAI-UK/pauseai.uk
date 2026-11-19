import GroupPage from "@/components/groups/GroupPage";
import { groupMetadata, groupPages } from "@/lib/content/group-pages";

export const metadata = groupMetadata(
  "Cambridge",
  "⁂ Join the Cambridge group of PauseAI for talks, socials, and AI safety action.",
);

export default function CambridgePage() {
  return <GroupPage content={groupPages["Cambridge"]} />;
}
