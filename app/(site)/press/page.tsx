import { connection } from "next/server";
import { pageMetadata } from "@/lib/metadata";
import { shownCoverage } from "@/lib/press/coverage.server";
import PressKit from "./_components/PressKit";
import PageHero from "@/components/ui/PageHero";

export const metadata = pageMetadata({
  title: "Press",
  description: "Media contact, boilerplate, brand assets, and press coverage of PauseAI UK.",
  path: "/press",
});

// Made on each visit, as staff add and remove coverage (/staff/press), and
// never at build time, which runs before a deploy's migrations.
export default async function PressPage() {
  await connection();
  const coverage = await shownCoverage();
  return (
    <>
      <main>
        <PageHero
          width="wide"
          tight
          title="Press"
          lede="Resources for journalists covering PauseAI UK and the movement for safe, equitable AI."
        />

        <PressKit coverage={coverage} />
      </main>
    </>
  );
}
