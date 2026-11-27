/**
 * The statuses a guest row can have, in the order an event's page lists
 * them: Luma's others (invited, or a ticket's) aren't registrations.
 */
export const GUEST_STATUSES = ["approved", "pending_approval", "waitlist", "declined"] as const;
export type GuestStatus = (typeof GUEST_STATUSES)[number];

/** Whether Luma's `status` is a registration's, one the import keeps. */
export function isGuestStatus(status: string): status is GuestStatus {
  return (GUEST_STATUSES as readonly string[]).includes(status);
}
