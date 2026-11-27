import "server-only";
import { supportersSearch, type SupportersSearch } from "@/lib/staff-search";
import { LIST_TOPICS } from "@/lib/supporters/contact-permissions";
import { listSupporters } from "@/lib/supporters/records.server";
import { termsValues } from "./broadcasts";

// Who a broadcast from an event's staff page goes to: those registered for
// it, as the supporters list's Event filter counts them, by email, under
// PauseAI UK Updates including Luma, the list an event's news goes to.

/**
 * The supporters list's filters for a broadcast to event `eventId`'s guests,
 * and how many supporters they find, for its button.
 */
export async function eventAudience(eventId: string): Promise<{ search: SupportersSearch; total: number }> {
  const { filter, ...search } = supportersSearch({
    event: eventId,
    contact: termsValues({ channel: "email", topics: LIST_TOPICS["updates-luma"] }),
  });
  const { total } = await listSupporters(filter);
  return { search, total };
}
