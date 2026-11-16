-- A box ticked on the contact preferences page for the newsletter or
-- volunteering by email goes to CiviCRM as a resubscribe to its list, as a
-- lift of "No bulk emails" does: the person's own choice, with the box's
-- words and its row of preference_choices.
ALTER TABLE civicrm_updates
  DROP CONSTRAINT civicrm_updates_change_check,
  ADD CONSTRAINT civicrm_updates_change_check CHECK (change IN ('unsubscribe', 'resubscribe', 'no_bulk_email',
    'allow_bulk_email', 'do_not_sms', 'do_not_phone')),
  DROP CONSTRAINT civicrm_updates_check1,
  ADD CONSTRAINT civicrm_updates_check1 CHECK ((choice_id IS NOT NULL) = (change IN ('allow_bulk_email', 'resubscribe'))),
  DROP CONSTRAINT civicrm_updates_check2,
  ADD CONSTRAINT civicrm_updates_check2 CHECK ((change IN ('unsubscribe', 'resubscribe')) = (list IS NOT NULL)),
  DROP CONSTRAINT civicrm_updates_check3,
  ADD CONSTRAINT civicrm_updates_check3 CHECK ((change IN ('allow_bulk_email', 'resubscribe')) = (wording IS NOT NULL));
