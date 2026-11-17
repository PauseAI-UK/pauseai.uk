-- Every phone number is kept in international format, as phoneNumber() in
-- lib/phone.ts writes each as it comes in, or none where it can't be read as
-- one: no text or call can use such a number, and CiviCRM's check refuses it.
-- A WhatsApp member with no email must keep their number
-- (form_entries_email_check), and the upload never takes one it can't read.

UPDATE form_entries SET phone = t.number
FROM (SELECT id, CASE WHEN phone_number(phone) ~ '^\+[1-9][0-9]{6,14}$' THEN phone_number(phone) END AS number
      FROM form_entries WHERE phone IS NOT NULL) t
WHERE form_entries.id = t.id AND form_entries.phone IS DISTINCT FROM t.number;

UPDATE luma_guests SET phone = t.number
FROM (SELECT id, CASE WHEN phone_number(phone) ~ '^\+[1-9][0-9]{6,14}$' THEN phone_number(phone) END AS number
      FROM luma_guests WHERE phone IS NOT NULL) t
WHERE luma_guests.id = t.id AND luma_guests.phone IS DISTINCT FROM t.number;

UPDATE civicrm_contacts SET phone = t.number
FROM (SELECT contact_id, CASE WHEN phone_number(phone) ~ '^\+[1-9][0-9]{6,14}$' THEN phone_number(phone) END AS number
      FROM civicrm_contacts WHERE phone IS NOT NULL) t
WHERE civicrm_contacts.contact_id = t.contact_id AND civicrm_contacts.phone IS DISTINCT FROM t.number;
