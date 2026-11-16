# Broadcasts: first improvements

Broadcasts (`/staff/broadcasts`) sends email by Gmail or Postmark and
texts by WhatsApp, takes replies and handles unsubscribes, all tested in
production.

The weekly email is a long list of every region's events. It gets more
focused on each reader, and is sent automatically. The next steps, not
specified yet:

1. More fields and conditionals, so the email can carry such things as
   the events near the reader rather than every region's, the main
   events with how many have signed up, and their MP.
2. An ask to write to their MP, for readers who haven't yet.
3. The weekly sent automatically each week.
