import ChannelIcon from "@/components/ui/ChannelIcon";
import type { SignupKind } from "@/lib/supporters/signup-csv";

/**
 * What an upload's sign-ups are, as a line icon (ChannelIcon's style): a page
 * of a form, with lines on it, for paper sign-ups, or a text's speech bubble
 * for a WhatsApp group. Decoration: the kind's words go beside it. `size` is
 * its width and height in pixels.
 */
export default function SignupKindIcon({ kind, size = 12 }: { kind: SignupKind; size?: number }) {
  if (kind === "whatsapp") return <ChannelIcon channel="text" size={size} />;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M9 11h6M9 15h6" />
    </svg>
  );
}
