import GroupPage from "@/components/groups/GroupPage";
import { groupMetadata, groupPages } from "@/lib/content/group-pages";

export const metadata = groupMetadata(
  "Manchester",
  "Join the Manchester group of PauseAI for meetups, outreach, and AI safety action.",
);

export default function ManchesterPage() {
  return <GroupPage content={groupPages["Manchester"]} />;
}
