import BriefingList from "@/components/briefings/BriefingList";
import PageHero from "@/components/ui/PageHero";
import { BRIEFINGS, briefings } from "@/lib/content/briefings";
import { feedLink, newestFirst } from "@/lib/content/posts";
import { pageMetadata } from "@/lib/metadata";

const page = pageMetadata({
  title: "Weekly briefings",
  description: "Our weekly briefings on AI news: what happened, in Parliament and beyond, and what's coming up.",
  path: "/campaigns/briefings",
});

export const metadata = { ...page, alternates: { ...page.alternates, ...feedLink(BRIEFINGS) } };

export default function BriefingsIndexPage() {
  return (
    <main>
      <PageHero
        title="Weekly briefings"
        width="wide"
        lede="Each week's UK-focussed AI news in one page: the key stories, what happened in Parliament, and the dates coming up."
      />

      <BriefingList briefings={newestFirst(briefings)} section={BRIEFINGS} />
    </main>
  );
}
