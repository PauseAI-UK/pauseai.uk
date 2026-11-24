import { json, type Fake } from "../fake";
import civicrmContacts from "../civicrm-contacts.json";

// CiviCRM's API for the UK chapter's contacts.

export const civicrmFake: Fake = ({ hostname, pathname, searchParams }, init) => {
  if (hostname === "crm.pauseai.info" && pathname === "/civicrm/ajax/api4/PauseaiChapterContact/get") {
    // The UK chapter contacts staff-data.sql holds, and Erin's, erased there: a page after a contact ID.
    const params = JSON.parse(searchParams.get("params") ?? "{}") as { limit?: number; after_contact_id?: number };
    const values = civicrmContacts.values.filter((contact) => contact.contact_id > (params.after_contact_id ?? 0));
    return json({ values: values.slice(0, params.limit ?? values.length) });
  }
  if (hostname === "crm.pauseai.info" && pathname === "/civicrm/ajax/api4/PauseaiChapterContact/checkSuppression") {
    // An address of a contact with "No bulk emails" is blocked from bulk email; any other, in CiviCRM or not, from
    // none, as no fixture contact has "Do not email". A number has the flags of the contact holding it, if any.
    const { email = [], phone = [] } = JSON.parse(new URLSearchParams(String(init?.body)).get("params") ?? "{}") as {
      email?: string[];
      phone?: string[];
    };
    return json({
      values: [
        ...email.map((address) => {
          const contact = civicrmContacts.values.find((one) => one.email === address);
          const block = contact?.no_bulk_email ? "bulk" : "none";
          return { email: address, block };
        }),
        ...phone.map((number) => {
          const contact = civicrmContacts.values.find((one) => one.phone === number);
          return {
            phone: number,
            do_not_phone: contact?.do_not_phone ?? false,
            do_not_sms: contact?.do_not_sms ?? false,
          };
        }),
      ],
    });
  }
  if (hostname === "crm.pauseai.info" && pathname === "/civicrm/ajax/api4/PauseaiChapterContact/updateSubscriptions") {
    // Every opt-out is accepted. A lift of "No bulk emails" is refused for an address that isn't a UK contact's.
    const { events = [] } = JSON.parse(new URLSearchParams(String(init?.body)).get("params") ?? "{}") as {
      events?: { event_id: string; email: string; change: string }[];
    };
    return json({
      values: events.map((event) =>
        event.change === "allow_bulk_email" && !civicrmContacts.values.some((one) => one.email === event.email)
          ? { event_id: event.event_id, status: "refused", reason: "not_in_uk" }
          : { event_id: event.event_id, status: "accepted" },
      ),
    });
  }
  return undefined;
};
