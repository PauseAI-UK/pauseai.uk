import GroupPage from "@/components/groups/GroupPage";
import { groupMetadata, groupPages } from "@/lib/content/group-pages";

export const metadata = groupMetadata("London", "Join PauseAI London for meetups, protests, and AI safety advocacy.");

export default function LondonPage() {
  return <GroupPage content={groupPages["London"]} />;
}
