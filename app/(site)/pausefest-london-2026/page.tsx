import { pageMetadata } from "@/lib/metadata";
import { pausefest } from "@/lib/content/pausefest";
import { getPauseFestLive } from "@/lib/server/pausefest";
import Programme from "./_components/Programme";
import PauseFestHero from "./_components/PauseFestHero";

export const metadata = pageMetadata({
  title: pausefest.name,
  description: `${pausefest.tagline}: sign-making, the March Against AI Extinction, flyering for the next march, a conference in Parliament and a fireside chat with Siliconversations.`,
  path: pausefest.path,
  // PauseFest's poster, in the shape link previews are drawn.
  images: {
    openGraph: { url: "/images/pausefest-london-2026/link-preview-1200-630.jpg", width: 1200, height: 630 },
    twitter: "/images/pausefest-london-2026/link-preview-1200-630.jpg",
  },
});

export default async function PauseFestPage() {
  const live = await getPauseFestLive();
  return (
    <main>
      <PauseFestHero />
      <Programme days={pausefest.days} live={live} />
    </main>
  );
}
