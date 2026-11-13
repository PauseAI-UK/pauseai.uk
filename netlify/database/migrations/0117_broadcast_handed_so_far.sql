-- A copy being sent as handed_at arrives is taken as handed to its channel
-- since it was taken: nothing says otherwise, and so a run that stops with
-- it never sends it again, as before there was a handed_at to go by.
UPDATE broadcast_messages SET handed_at = sending_since WHERE status = 'sending';
