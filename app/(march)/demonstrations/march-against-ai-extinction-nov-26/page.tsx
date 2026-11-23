import JsonLd from "@/components/layout/JsonLd";
import { marchEventJsonLd, novemberMarch } from "@/lib/content/march";
import { getNovemberMarchGuests, getNovemberMarchSignupCount } from "@/lib/events/march.server";
import { pageMetadata } from "@/lib/metadata";
import MarchOver from "../_components/MarchOver";
import SignupCase from "../_components/SignupCase";
import SignupDemand from "../_components/SignupDemand";
import SignupHero from "../_components/SignupHero";
import SignupPhotos from "../_components/SignupPhotos";
import SignupTurnout from "../_components/SignupTurnout";

export const metadata = pageMetadata({
  title: `${novemberMarch.name} — ${novemberMarch.dateShort}, ${novemberMarch.city}`,
  description: `⁂ PauseAI UK marched through ${novemberMarch.city} for AI safety on ${novemberMarch.dateLong}.`,
  path: novemberMarch.path,
  absoluteTitle: true,
  openGraph: { title: `${novemberMarch.name} — ${novemberMarch.dateLong}` },
  // Made by scripts/march-preview.mjs.
  images: {
    openGraph: { url: "/images/march-signup/open-graph-1200-630.jpg", width: 1200, height: 630 },
    twitter: "/images/march-signup/open-graph-1600-840.jpg",
  },
});

// The march of November 2026, as a record now it's over: the sign-up's
// page with how many registered in the end, and without the day's details
// or the form.
export default async function NovemberMarchPage() {
  const [registered, guests] = await Promise.all([getNovemberMarchSignupCount(), getNovemberMarchGuests()]);
  return (
    <main id="main">
      <JsonLd data={marchEventJsonLd(novemberMarch)} />
      <SignupHero march={novemberMarch} past registered={registered} guests={guests} />
      <SignupCase past />
      <SignupDemand />
      <SignupTurnout past />
      <SignupPhotos />
      <MarchOver />
    </main>
  );
}
