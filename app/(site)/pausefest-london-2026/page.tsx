import { pageMetadata } from "@/lib/metadata";
import { pausefest } from "@/lib/content/pausefest";
import Programme from "./_components/Programme";
import PauseFestHero from "./_components/PauseFestHero";

export const metadata = pageMetadata({
  title: pausefest.name,
  description: `${pausefest.tagline}: sign-making, the March Against AI Extinction, flyering for the next march, a conference in Parliament and a fireside chat with Siliconversations.`,
  path: pausefest.path,
  // The square PauseFest poster, at the size Facebook asks for and small enough for WhatsApp's preview.
  images: {
    openGraph: { url: "/images/pausefest-london-2026/link-preview-1200.jpg", width: 1200, height: 1200 },
    twitter: "/images/pausefest-london-2026/link-preview-1200.jpg",
  },
});

export default function PauseFestPage() {
  return (
    <main>
      <PauseFestHero />
      <Programme days={pausefest.days} />
    </main>
  );
}
