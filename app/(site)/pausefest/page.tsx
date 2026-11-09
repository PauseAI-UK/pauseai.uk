import { pageMetadata } from "@/lib/metadata";
import { pausefest } from "@/lib/content/pausefest";
import Lineup from "./_components/Lineup";
import PauseFestHero from "./_components/PauseFestHero";

export const metadata = pageMetadata({
  title: pausefest.name,
  description: `${pausefest.tagline}: sign-making, the March Against AI Extinction, flyering, a conference in Parliament and a fireside chat with Siliconversations.`,
  path: pausefest.path,
});

export default function PauseFestPage() {
  return (
    <main>
      <PauseFestHero />
      <Lineup days={pausefest.days} />
    </main>
  );
}
