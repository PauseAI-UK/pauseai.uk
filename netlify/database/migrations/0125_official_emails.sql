-- Emails that weren't the politician's own as their body lists it on 13
-- November 2026: the re-elected Senedd members' addresses from before May's
-- election, an MP's old-style one, and two MPs' council and department
-- addresses, from posts they held. Each politician is found by the old
-- address, so a database without them is left as it is. The edit is logged
-- as staff's are, so the old address is still theirs in the politician book
-- (lib/server/politician-book.ts) and threads from it still link to them.
WITH fixes (old, new) AS (VALUES
  ('eaglea@parliament.uk', 'angela.eagle.mp@parliament.uk'),
  ('ps.murray@dcms.gov.uk', 'ian.murray.mp@parliament.uk'),
  ('sagal.abdi-wali@camden.gov.uk', 'sagal.abdiwali.mp@parliament.uk'),
  ('adam.price@senedd.wales', 'adam.price-ms@senedd.wales'),
  ('andrewrt.davies@senedd.wales', 'andrewrt.davies-ms@senedd.wales'),
  ('cefin.campbell@senedd.wales', 'cefin.campbell-as@senedd.cymru'),
  ('darren.millar@senedd.wales', 'darren.millar-ms@senedd.wales'),
  ('delyth.jewell@senedd.wales', 'delyth.jewell-as@senedd.cymru'),
  ('heledd.fychan@senedd.wales', 'heledd.fychan-as@senedd.cymru'),
  ('huw.irranca-davies@senedd.wales', 'huw.irranca-davies-ms@senedd.wales'),
  ('james.evans@senedd.wales', 'james.evans-ms@senedd.wales'),
  ('jane.dodds@senedd.wales', 'jane.dodds-ms@senedd.wales'),
  ('janet.finch-saunders@senedd.wales', 'janet.finch-saunders-ms@senedd.wales'),
  ('jayne.bryant@senedd.wales', 'jayne.bryant-ms@senedd.wales'),
  ('ken.skates@senedd.wales', 'ken.skates-ms@senedd.wales'),
  ('laura.jones@senedd.wales', 'laura.jones-ms@senedd.wales'),
  ('llyr.gruffydd@senedd.wales', 'llyr.gruffydd-ms@senedd.wales'),
  ('lynne.neagle@senedd.wales', 'lynne.neagle-ms@senedd.wales'),
  ('mabon.ap.gwynfor@senedd.wales', 'mabon.ap.gwynfor-ms@senedd.wales'),
  ('mike.hedges@senedd.wales', 'mike.hedges-ms@senedd.wales'),
  ('natasha.asghar@senedd.wales', 'natasha.asghar-ms@senedd.wales'),
  ('paul.davies@senedd.wales', 'paul.davies-ms@senedd.wales'),
  ('peredur.owengriffiths@senedd.wales', 'peredur.owengriffiths-ms@senedd.wales'),
  ('peter.fox@senedd.wales', 'peter.fox-ms@senedd.wales'),
  ('rhun.apiorwerth@senedd.wales', 'rhun.apiorwerth-as@senedd.cymru'),
  ('sam.rowlands@senedd.wales', 'sam.rowlands-ms@senedd.wales'),
  ('sarah.murphy@senedd.wales', 'sarah.murphy-ms@senedd.wales'),
  ('sian.gwenllian@senedd.wales', 'sian.gwenllian-as@senedd.cymru'),
  ('sioned.williams@senedd.wales', 'sioned.williams-ms@senedd.wales'),
  ('vikki.howells@senedd.wales', 'vikki.howells-ms@senedd.wales')
),
fixed AS (
  UPDATE notable_people n SET email = f.new, updated_at = now()
  FROM fixes f WHERE lower(n.email) = f.old
  RETURNING n.id, n.name, f.old, f.new
)
INSERT INTO audit_log (actor, action, details)
SELECT 'migration', 'edit politician',
  jsonb_build_object('id', id, 'name', name, 'changed', jsonb_build_object('email', jsonb_build_array(old, new)))
FROM fixed;
