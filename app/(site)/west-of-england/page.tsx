import GroupPage from "@/components/groups/GroupPage";
import { groupMetadata, groupPages } from "@/lib/content/group-pages";

export const metadata = groupMetadata(
  "West of England",
  "Join the West of England group of PauseAI for meetups, outreach, and AI safety action around Bristol and the wider region.",
);

export default function WestOfEnglandPage() {
  return <GroupPage content={groupPages["West of England"]} />;
}
