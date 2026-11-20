import GroupPage from "@/components/groups/GroupPage";
import { groupMetadata, groupPages } from "@/lib/content/group-pages";

export const metadata = groupMetadata(
  "Leicester",
  "Join the Leicester group of PauseAI for meetups, outreach, and AI safety action.",
);

export default function LeicesterPage() {
  return <GroupPage content={groupPages["Leicester"]} />;
}
