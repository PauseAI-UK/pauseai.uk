import Tag from "@/components/ui/Tag";
import type { SupporterSummary } from "@/lib/supporters/supporters";
import { supportersCopy } from "./copy";

/** What a supporter is to us, in words, as a download has them. */
export function supporterBadgeWords(supporter: SupporterSummary): string {
  const badges = supportersCopy.supporters.badges;
  return [
    supporter.member && badges.member,
    supporter.lumaContact && badges.lumaContact,
    supporter.events > 0 && badges.registered,
    supporter.letters > 0 && badges.letter,
    supporter.sources.includes("march-2026-11") && badges.march,
    supporter.sources.includes("paper-signup") && badges.paper,
    supporter.sources.includes("whatsapp-community") && badges.whatsapp,
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * What a supporter is to us, as lozenges: a member, a contact of the Luma
 * calendar, registered for events, wrote to their MP, signed up for the
 * march, on a paper sign-up form, in our WhatsApp community. Coloured by how
 * involved it shows them to be: green for a member, blue for having taken
 * part (an event, a letter), and grey for having signed up.
 */
export default function SupporterBadges({ supporter }: { supporter: SupporterSummary }) {
  const badges = supportersCopy.supporters.badges;
  return (
    <>
      {supporter.member && <Tag tone="green">{badges.member}</Tag>}
      {supporter.lumaContact && <Tag>{badges.lumaContact}</Tag>}
      {supporter.events > 0 && <Tag tone="blue">{badges.registered}</Tag>}
      {supporter.letters > 0 && <Tag tone="blue">{badges.letter}</Tag>}
      {supporter.sources.includes("march-2026-11") && <Tag>{badges.march}</Tag>}
      {supporter.sources.includes("paper-signup") && <Tag>{badges.paper}</Tag>}
      {supporter.sources.includes("whatsapp-community") && <Tag>{badges.whatsapp}</Tag>}
    </>
  );
}
