import "server-only";

/**
 * SQL for how many replies letter `l` has had from the politician's office,
 * for a link that says so: those kept in its thread but our answers and a
 * supporter's own messages, and at least one once it's marked replied, as
 * a reply staff noted by hand isn't kept; 0 if it hasn't been.
 */
export const REPLIES = `CASE WHEN l.replied_at IS NULL THEN 0 ELSE greatest(1,
  (SELECT count(*) FROM letter_replies r WHERE r.letter_id = l.id AND NOT r.from_us AND NOT r.from_supporter))::int END`;
