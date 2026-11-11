import type { Channel, Way } from "@/lib/contact-permissions";

/**
 * How we'd reach someone, as a small line icon: an envelope for email, a
 * speech bubble with three dots for a text (WhatsApp too), a handset for a
 * call or a phone number. By `channel`, it's the kind of address; by a way,
 * how we'd use it. With `label`, it's named so; without, it's decoration
 * beside words that already say it.
 */
export default function ChannelIcon({ channel, label }: { channel: Channel | Way; label?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {channel === "email" ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </>
      ) : channel === "text" ? (
        <>
          <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
          <path d="M8 11h.01M12 11h.01M16 11h.01" />
        </>
      ) : (
        <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
      )}
    </svg>
  );
}
