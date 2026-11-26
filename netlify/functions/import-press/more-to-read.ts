/** What a call to /api/cron/import-press did, and how many finds are left unread; nothing, when another run was going. */
export type PressCall = { searched?: number; read?: number; known?: number; unreadable?: number; left?: number };

/**
 * Whether calling again would read more: finds are left unread, and this
 * call got through some, or searched, so Google and the news sites are
 * answering. A call that did neither was turned away, and the rest wait for
 * the next night.
 */
export function moreToRead({ searched = 0, read = 0, known = 0, unreadable = 0, left = 0 }: PressCall): boolean {
  return left > 0 && searched + read + known + unreadable > 0;
}
