import { pageMetadata } from "@/lib/metadata";
import { pausefest } from "@/lib/content/pausefest";
import Programme from "./_components/Programme";
import PauseFestHero from "./_components/PauseFestHero";

export const metadata = pageMetadata({
  title: pausefest.name,
  description: `${pausefest.tagline}: sign-making, the March Against AI Extinction, flyering for the next march, a conference in Parliament and a fireside chat with Siliconversations.`,
  path: pausefest.path,
});

export default function PauseFestPage() {
  return (
    <main>
      <PauseFestHero />
      <Programme days={pausefest.days} />
    </main>
  );
}
