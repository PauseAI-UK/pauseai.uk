import "server-only";

/** The MPs a supporter's postcode can find, as getSupporter() (./records.server.ts) gives theirs: each in office, but the test ones. */
export const MP_CHOICES = `SELECT n.id::int AS id, n.name, p.constituency FROM politicians p
  JOIN notable_people n ON n.id = p.id AND n.status = 'in_office'
  WHERE p.house = 'commons' AND NOT p.is_test`;
