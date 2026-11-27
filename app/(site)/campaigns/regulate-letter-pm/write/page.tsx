import { copy } from "@/lib/content/email-your-mp";
import { pageMetadata } from "@/lib/metadata";
import { connection } from "next/server";
import { publishedLetter } from "@/lib/mailings/campaign-letters.server";
import LetterStep from "../../_components/LetterStep";
import LetterWrite from "../../_components/LetterWrite";

// Writing this campaign's letter, after finding the MP, from the version
// staff last published. Unlisted, and kept out of search. Made on each
// visit, as staff publish new versions, and never at build time, which
// runs before a deploy's migrations.
export const metadata = {
  ...pageMetadata({
    title: copy.write.title,
    description: copy.write.title,
    path: "/campaigns/regulate-letter-pm/write",
  }),
  robots: { index: false, follow: false },
};

export default async function Page() {
  await connection();
  const letter = await publishedLetter("regulate-letter-pm");
  return (
    <LetterStep title={copy.write.title}>
      <LetterWrite campaignSlug="regulate-letter-pm" letter={letter} />
    </LetterStep>
  );
}
