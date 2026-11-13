-- Fake data for a development database, so every staff page has something
-- on it without importing anything: scripts/db-reset.mjs loads this with
-- DATA_FIXTURES=1 (addFixtureData in scripts/fresh-database.mjs). Every
-- table has rows, and every situation the app knows has an example. Dates
-- are relative to now(), so the dashboard's last week and the week before
-- each hold something whenever it's loaded, and each number differs
-- between the two.
--
-- The Luma people, events and first guests with "fixture" in their IDs are
-- the Luma fixtures' (lib/server/fixtures/luma-*.json and
-- outside-services.ts), and the politicians and members with Airtable IDs
-- Airtable's (airtable-*.json), by the same IDs, so an import writes the
-- same rows again rather than doubling them. The rest are made up, with
-- "seed" in their IDs. The letters go to the test MPs (lib/test-mps.json),
-- which must be in the database already, and most recent ones then to
-- Airtable's two. Supporters and their links are written once everyone
-- else is, as the matcher (lib/server/supporters.ts) would make them: one
-- per email, then one per UK mobile number.

-- ---------------------------------------------------------------- staff

-- Besides the migration's admin: Jo, who may see supporters, logged in on
-- two devices, one session kept; Samuel, who last logged in two days ago
-- and whose link since then expired unused; and an account alone, who has
-- never logged in. The audit log has another, removed last month.
INSERT INTO staff_accounts (email, permissions, added_by, added_at, last_login_at, last_seen_at) VALUES
  ('jo@pauseai.uk', '{supporters}', 'admin@pauseai.uk', now() - interval '100 days', now() - interval '3 hours', now() - interval '20 minutes'),
  ('samuel.whitlock@pauseai.uk', '{}', 'admin@pauseai.uk', now() - interval '100 days', now() - interval '2 days', now() - interval '2 days'),
  ('policy@pauseai.uk', '{}', 'admin@pauseai.uk', now() - interval '6 days', NULL, NULL);
INSERT INTO staff_sessions (token_hash, email, created_at, expires_at, remember, user_agent) VALUES
  ('seed-session-jo-kept', 'jo@pauseai.uk', now() - interval '3 days', now() + interval '27 days', true,
   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'),
  ('seed-session-jo-phone', 'jo@pauseai.uk', now() - interval '3 hours', now() + interval '21 hours', false,
   'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'),
  ('seed-session-jo-old', 'jo@pauseai.uk', now() - interval '20 days', now() - interval '19 days', false, NULL);
INSERT INTO staff_login_links (token_hash, email, browser_hash, created_at, expires_at, used_at, remember) VALUES
  ('seed-link-used', 'jo@pauseai.uk', 'seed-browser', now() - interval '3 days', now() - interval '3 days' + interval '15 minutes', now() - interval '3 days' + interval '2 minutes', true),
  ('seed-link-expired', 'samuel.whitlock@pauseai.uk', 'seed-browser', now() - interval '1 day', now() - interval '1 day' + interval '15 minutes', NULL, false);

-- ---------------------------------------------------------- politicians

-- Airtable's politicians, as the sync copies them (airtable-politicians.json,
-- by the same IDs): three MPs, one an important target with notes; an MSP, a
-- personal connection; one who retired and one who left office. Then a peer
-- the signatory import added, whom the sync takes to be Airtable's; a peer
-- who died; and an MP whose record is gone from Airtable, kept. Then made-up
-- ones for every other body, varying in party, status, markers and whether
-- we have an address, with accents to search for.
CREATE TEMP TABLE seed_politicians (airtable_id text, house text, name text, salutation text, constituency text, party text, country text, email text, status text, notes text, important boolean, connection boolean, removed interval, created interval, updated interval);
INSERT INTO seed_politicians VALUES
  ('recDummy', 'commons', 'Ms Dora Dummy', 'Ms Dummy', 'Hackney North and Stoke Newington', 'Labour', 'england', 'mp90001.office@parliament.uk', 'in_office', '', false, false, NULL, '60 days', '60 days'),
  ('recPlaceholder', 'commons', 'Polly Placeholder', 'Ms Placeholder', 'Cities of London and Westminster', 'Labour (Co-op)', 'england', 'polly.placeholder.mp@parliament.uk', 'in_office', E'Met at the example fair.\nRecommended', true, false, NULL, '60 days', '9 days'),
  ('recMorag', 'scottish-parliament', 'Morag Example', 'Ms Example', 'Exampleshire North', 'Example Party', 'scotland', 'morag.example.msp@parliament.example', 'in_office', '', false, true, NULL, '40 days', '40 days'),
  ('recRetired', 'commons', 'Rita Retired', 'Ms Retired', 'Old Seat', 'Independent', 'wales', NULL, 'retired', '', false, false, NULL, '40 days', '40 days'),
  ('recMo', 'commons', 'Mo Example', 'Mx Example', 'Manchester Central', 'Labour', 'england', 'mp90003.office@parliament.uk', 'in_office', '', false, false, NULL, '60 days', '60 days'),
  ('recGone', 'commons', 'Gordon Gone', 'Mr Gone', 'Former Seat', 'Independent', 'england', 'gordon.gone.mp@parliament.uk', 'left_office', '', false, false, NULL, '60 days', '20 days'),
  (NULL, 'lords', 'Lord Seedling of Example', 'Lord Seedling', NULL, 'Crossbench', NULL, NULL, 'in_office', '', false, false, NULL, '30 days', '12 days'),
  ('recDeparted', 'lords', 'Lord Departed of Example', 'Lord Departed', NULL, 'Crossbench', NULL, NULL, 'died', '', false, false, NULL, '40 days', '25 days'),
  ('recRemoved', 'commons', 'Rob Removed', 'Mr Removed', 'Removed Seat', 'Example Party', 'england', 'rob.removed.mp@parliament.uk', 'in_office', '', false, false, '6 days', '40 days', '6 days'),
  ('recSeedBaroness', 'lords', 'Baroness Sample of Testwick', 'Baroness Sample', NULL, 'Conservative', NULL, 'sampleb@parliament.example', 'in_office', 'Spoke in the AI debate.', true, false, NULL, '30 days', '30 days'),
  ('recSeedAngus', 'scottish-parliament', 'Angus Placeholder', 'Mr Placeholder', 'Glen Example', 'Scottish National Party', 'scotland', 'angus.placeholder.msp@parliament.example', 'retired', '', false, false, NULL, '50 days', '50 days'),
  ('recSeedSian', 'senedd', 'Siân Enghraifft', 'Ms Enghraifft', 'Ceredigion Example', 'Plaid Cymru', 'wales', 'sian.enghraifft.ms@senedd.example', 'in_office', 'Writes back in Welsh.', false, true, NULL, '45 days', '10 days'),
  ('recSeedDafydd', 'senedd', 'Dafydd Dummy', 'Mr Dummy', 'Cardiff Example', 'Welsh Labour', 'wales', 'dafydd.dummy.ms@senedd.example', 'in_office', '', true, false, NULL, '45 days', '45 days'),
  ('recSeedRhys', 'senedd', 'Rhys Ymadawedig', 'Mr Ymadawedig', 'Old Valley', 'Welsh Conservatives', 'wales', NULL, 'left_office', '', false, false, NULL, '70 days', '70 days'),
  ('recSeedAoife', 'ni-assembly', 'Aoife Ó Sampla', 'Ms Ó Sampla', 'Belfast Example', 'Sinn Féin', 'northern-ireland', 'aoife.osampla.mla@niassembly.example', 'in_office', '', false, false, NULL, '35 days', '35 days'),
  ('recSeedWilliam', 'ni-assembly', 'William Example', 'Mr Example', 'Lagan Example', 'DUP', 'northern-ireland', NULL, 'in_office', '', true, true, NULL, '35 days', '35 days'),
  ('recSeedMayor', 'other', 'Mayor Mo Mockup', 'Mayor Mockup', 'Greater Example', 'Labour', 'england', 'mayor@greaterexample.example', 'in_office', 'Metro mayor.', false, false, NULL, '25 days', '25 days'),
  ('recSeedCllr', 'other', 'Cllr Fiona Fixture', 'Cllr Fixture', 'Example Ward', 'Green', 'england', 'fiona.fixture@council.example', 'in_office', '', false, false, '3 days', '25 days', '3 days');
WITH people AS (
  INSERT INTO notable_people (kind, airtable_id, name, salutation, email, status, notes, important_target, personal_connection, airtable_removed_at, created_at, updated_at)
  SELECT 'politician', airtable_id, name, salutation, email, status, notes, important, connection, now() - removed, now() - created, now() - updated
  FROM seed_politicians RETURNING id, name
)
INSERT INTO politicians (id, house, constituency, party, country)
SELECT p.id, s.house, s.constituency, s.party, s.country FROM people p JOIN seed_politicians s USING (name);
DROP TABLE seed_politicians;

-- Made-up politicians, enough for 250 with the test MPs, so the list has
-- three pages: mostly MPs, then peers and members of the other bodies, each
-- with a party of their body; a few retired or gone, a few marked, a few
-- with no address. Not Airtable's, so a sync leaves them be: the made-up
-- record ID only joins each to its row here.
CREATE TEMP TABLE made_politicians AS
SELECT i, 'recMade' || i AS airtable_id,
  (ARRAY['Alex','Bea','Cal','Dee','Eli','Fay','Gus','Hal','Ivy','Jon','Kit','Lou','Mo','Ned','Ola','Pip','Quin','Ros','Sid','Tess','Uma','Viv','Wes','Zoe'])[1 + i % 24] AS first,
  (ARRAY['Abbott','Barker','Carter','Dalton','Ellis','Fenwick','Garner','Hollis','Ingram','Jarvis','Keller','Lister','Marsh','Norris','Oakley','Parry','Quayle','Rowe','Slater','Thorne','Upton','Vance','Webb','Yates'])[1 + (i / 24 + 5 * i) % 24] AS last,
  (ARRAY['Ashford','Bramley','Colton','Dunmore','Eastwick','Farley','Glenholm','Harwood','Inverby','Kelso','Langley','Morden','Northam','Oxley','Penrith','Rydal','Stanmore','Tarleton','Westby','Yarrow'])[1 + (i * 3) % 20] AS town,
  -- A peer's territorial title, a place of its own: the town above repeats
  -- every 20, which would give peers the same names.
  CASE WHEN i % 10 IN (6, 7) THEN (ARRAY['Ashford','Bramley','Colton','Dunmore','Eastwick','Farley','Glenholm','Harwood','Inverby','Kelso','Langley','Morden','Northam','Oxley','Penrith','Rydal','Stanmore','Tarleton','Westby','Yarrow'])[1 + (i / 10 * 2 + i % 10 - 6 + i / 20) % 20] END AS seat,
  CASE WHEN i % 10 < 6 THEN 'commons' WHEN i % 10 < 8 THEN 'lords' WHEN i % 10 = 8 THEN 'scottish-parliament' WHEN i % 20 = 9 THEN 'senedd' ELSE 'ni-assembly' END AS house
FROM generate_series(1, 227) i;
WITH people AS (
  INSERT INTO notable_people (kind, airtable_id, name, salutation, email, status, notes, important_target, personal_connection, created_at, updated_at)
  SELECT 'politician', airtable_id,
    CASE WHEN house = 'lords' THEN (CASE WHEN i % 4 = 0 THEN 'Baroness ' ELSE 'Lord ' END) || last || ' of ' || seat ELSE first || ' ' || last END,
    CASE WHEN house = 'lords' THEN (CASE WHEN i % 4 = 0 THEN 'Baroness ' ELSE 'Lord ' END) || last ELSE (CASE WHEN i % 2 = 0 THEN 'Ms ' ELSE 'Mr ' END) || last END,
    CASE WHEN i % 9 = 0 THEN NULL ELSE lower(first || '.' || last || '.' || i) || '@parliament.example' END,
    CASE WHEN i % 15 = 0 THEN 'retired' WHEN i % 23 = 0 THEN 'left_office' ELSE 'in_office' END,
    '', i % 17 = 0, i % 19 = 0, now() - make_interval(days => 10 + i % 50), now() - make_interval(days => i % 10)
  FROM made_politicians RETURNING id, airtable_id
)
INSERT INTO politicians (id, house, constituency, party, country)
SELECT p.id, m.house,
  CASE WHEN m.house = 'lords' THEN NULL ELSE m.town || ' ' || (ARRAY['North','South','East','West','Central','and District'])[1 + m.i % 6] END,
  CASE m.house
    WHEN 'commons' THEN (ARRAY['Labour','Conservative','Liberal Democrat','Reform UK','Green','Scottish National Party','Independent'])[1 + m.i % 7]
    WHEN 'lords' THEN (ARRAY['Crossbench','Conservative','Labour','Liberal Democrat'])[1 + m.i % 4]
    WHEN 'scottish-parliament' THEN (ARRAY['Scottish National Party','Scottish Labour','Scottish Conservatives'])[1 + m.i % 3]
    WHEN 'senedd' THEN (ARRAY['Plaid Cymru','Welsh Labour','Welsh Conservatives'])[1 + m.i % 3]
    ELSE (ARRAY['DUP','Sinn Féin','Alliance','SDLP'])[1 + m.i % 4]
  END,
  CASE m.house
    WHEN 'commons' THEN (ARRAY['england','england','england','scotland','wales','northern-ireland'])[1 + m.i % 6]
    WHEN 'lords' THEN NULL
    WHEN 'scottish-parliament' THEN 'scotland'
    WHEN 'senedd' THEN 'wales'
    ELSE 'northern-ireland'
  END
FROM people p JOIN made_politicians m USING (airtable_id);
UPDATE notable_people SET airtable_id = NULL WHERE airtable_id IN (SELECT airtable_id FROM made_politicians);
DROP TABLE made_politicians;

-- Two asks staff added: one no one has answered, so it can be changed or
-- deleted; and one Polly and Dora have, so its kind is fixed and it can't
-- be deleted.
INSERT INTO asks (slug, title, kind, date, url, asked_by) VALUES
  ('winter-reception-dec-2026', 'Winter reception', 'event', '2026-12-09', NULL, '{pauseai}'),
  ('ai-safety-briefing-jan-2027', 'AI safety briefing in Westminster, January 2027', 'event', '2027-01-20',
    'https://luma.com/ai-safety-briefing', '{pauseai}');
INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, status_date, note, updated_by, updated_at)
SELECT id, 'ai-safety-briefing-jan-2027', 'event', CASE airtable_id WHEN 'recPlaceholder' THEN 'going' ELSE 'declined' END,
  (now() - interval '5 days')::date, '', 'jo@pauseai.uk', now() - interval '5 days'
FROM notable_people WHERE airtable_id IN ('recPlaceholder', 'recDummy');

-- A letter with more answers than a column shows, and more than a page holds:
-- 150 made-up politicians signed it and 12 declined.
INSERT INTO asks (slug, title, kind, date, url, asked_by) VALUES
  ('pause-treaty-letter', 'Letter calling for a pause treaty', 'letter', '2026-03-10', NULL, '{pauseai}');
INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, status_date, note, updated_by, updated_at)
SELECT id, 'pause-treaty-letter', 'letter', CASE WHEN rank <= 150 THEN 'signed' ELSE 'declined' END,
  '2026-03-20', '', 'jo@pauseai.uk', '2026-03-20'
FROM (SELECT id, row_number() OVER (ORDER BY name) AS rank FROM notable_people WHERE email LIKE '%@parliament.example') made
WHERE rank <= 162;

-- Statuses: Polly signed the letter to the PM last month; Dora this week;
-- the peer backs the bill, from ControlAI's letter, the week before; Backy
-- McTestface MP's bill status (lib/test-mps.json) was already there. Then
-- answers from Airtable, as production has them: each letter and the statement, and every answer an event
-- allows, across the conference and Go to Parliament, all copied with each
-- ask, 20 days ago, so dated the ask's day, or that day if the ask's is still
-- to come.
INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, status_date, note, updated_by, updated_at)
SELECT id, 'frontier-ai-letter', 'letter', 'signed', (now() - interval '35 days')::date, 'Told us at the march', 'jo@pauseai.uk', now() - interval '34 days' FROM notable_people WHERE airtable_id = 'recPlaceholder';
INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, status_date, note, updated_by, updated_at)
SELECT id, 'frontier-ai-letter', 'letter', 'signed', (now() - interval '2 days')::date, '', 'samuel.whitlock@pauseai.uk', now() - interval '2 days' FROM notable_people WHERE airtable_id = 'recDummy';
INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, status_date, note, updated_by, updated_at)
SELECT id, 'controlai-letter', 'letter', 'signed', '2026-09-11', '', 'controlai', now() - interval '10 days' FROM notable_people WHERE name = 'Lord Seedling of Example';
INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, status_date, note, updated_by, updated_at)
SELECT id, 'controlai-letter', 'letter', 'signed', (now() - interval '3 days')::date, '', 'jo@pauseai.uk', now() - interval '3 days' FROM politicians WHERE test_postcode = 'ZZ99ZZ';
INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, status_date, note, updated_by, updated_at)
SELECT id, 'frontier-ai-letter', 'letter', 'signed', (now() - interval '1 day')::date, 'Confirmed by their office', 'jo@pauseai.uk', now() - interval '1 day' FROM politicians WHERE test_postcode = 'ZZ99ZH';
INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, note, status_date, updated_by, updated_at)
SELECT n.id, a.ask, a.kind, a.status, a.note, least(k.date, (now() - interval '20 days')::date), 'airtable', now() - interval '20 days'
FROM (VALUES
  ('recPlaceholder', 'controlai-statement', 'letter', 'signed', ''),
  ('recPlaceholder', 'edinburgh-conference-2026', 'event', 'declined', ''),
  ('recPlaceholder', 'go-to-parliament-oct-2026', 'event', 'other', 'Meeting a member of their staff instead'),
  ('recDummy', 'go-to-parliament-oct-2026', 'event', 'going', ''),
  ('recDummy', 'edinburgh-conference-2026', 'event', 'other', 'Tentatively said yes'),
  ('recGone', 'go-to-parliament-oct-2026', 'event', 'other', 'Declined, but offered a surgery appointment instead'),
  ('recRemoved', 'go-to-parliament-oct-2026', 'event', 'other', 'Tentatively agreed to a meeting with a member of their staff'),
  ('recMorag', 'edinburgh-conference-2026', 'event', 'going', ''),
  ('recDeparted', 'edinburgh-conference-2026', 'event', 'other', 'Passed the request on'),
  ('recDeparted', 'deepmind-letter', 'letter', 'signed', ''),
  ('recRetired', 'frontier-ai-letter', 'letter', 'signed', ''),
  ('recMorag', 'deepmind-letter', 'letter', 'other', 'Wants to meet first')
) AS a (airtable_id, ask, kind, status, note) JOIN notable_people n USING (airtable_id) JOIN asks k ON k.slug = a.ask;

-- ----------------------------------------------------------------- luma

-- The fixture calendar's events, past and future, and four more: a talk
-- and a training that are over, a picnic taken off Luma, cancelled, and a
-- partner's event we may only view.
INSERT INTO luma_events (id, name, url, start_at, access, city, latitude, longitude, first_seen_at, changed_at, guests_synced_at, guests_error) VALUES
  ('evt-fixture-past-glasgow-stall', 'Glasgow street stall', 'fixture-past-glasgow-stall', now() - interval '270 days', 'manage', 'Glasgow', 55.8617, -4.2583, now() - interval '30 days', now() - interval '30 days', now() - interval '1 hour', NULL),
  ('evt-fixture-past-london-march', 'PauseAI London March', 'fixture-past-london-march', now() - interval '250 days', 'manage', 'London', 51.5045, -0.1262, now() - interval '30 days', now() - interval '30 days', now() - interval '1 hour', NULL),
  ('evt-seed-manchester-talk', 'AI and jobs: a talk in Manchester', 'seed-manchester-talk', now() - interval '10 days 18 hours', 'manage', 'Manchester', 53.4794, -2.2453, now() - interval '30 days', now() - interval '10 days 18 hours', now() - interval '1 hour', NULL),
  ('evt-seed-online-training', 'Lobbying your MP (online training)', 'seed-online-training', now() - interval '4 days', 'manage', NULL, NULL, NULL, now() - interval '30 days', now() - interval '4 days', now() - interval '1 hour', NULL),
  ('evt-fixture-london-protest', 'PauseAI London: Protest at Parliament', 'fixture-london-protest', now() + interval '20 days', 'manage', 'London', 51.5007, -0.1268, now() - interval '30 days', now() - interval '1 day', now() - interval '1 hour', NULL),
  ('evt-fixture-online-intro', 'Introduction to PauseAI UK (online)', 'fixture-online-intro', now() + interval '22 days', 'manage', NULL, NULL, NULL, now() - interval '30 days', now() - interval '5 days', now() - interval '1 hour', NULL),
  ('evt-fixture-manchester-social', 'PauseAI Manchester Social', 'fixture-manchester-social', now() + interval '25 days', 'manage', 'Manchester', 53.4794, -2.2453, now() - interval '30 days', now() - interval '5 days', now() - interval '1 hour', NULL),
  ('evt-fixture-scotland-meeting', 'PauseAI Scotland Meeting', 'fixture-scotland-meeting', now() + interval '28 days', 'manage', NULL, NULL, NULL, now() - interval '30 days', now() - interval '5 days', NULL, NULL),
  ('evt-fixture-oxford-talk', 'AI risk talk', 'fixture-oxford-talk', now() + interval '30 days', 'manage', 'Oxford', 51.7548, -1.2544, now() - interval '30 days', now() - interval '5 days', NULL, NULL),
  ('evt-fixture-bristol-leafleting', 'Leafleting in Bristol', 'fixture-bristol-leafleting', now() + interval '32 days', 'manage', 'Bristol', 51.4545, -2.5879, now() - interval '30 days', now() - interval '5 days', NULL, NULL),
  ('evt-fixture-leicester-meetup', 'PauseAI Leicester meetup', 'fixture-leicester-meetup', now() + interval '36 days', 'manage', 'Leicester', 52.6369, -1.1398, now() - interval '30 days', now() - interval '5 days', NULL, NULL),
  ('evt-seed-cancelled-picnic', 'PauseAI Cambridge picnic', 'seed-cancelled-picnic', now() + interval '10 days', 'manage', 'Cambridge', 52.2053, 0.1218, now() - interval '30 days', now() - interval '3 days', now() - interval '3 days', NULL),
  ('evt-seed-view-only', 'A partner''s event we can only view', 'seed-view-only', now() + interval '15 days', 'view', 'Leeds', 53.8008, -1.5491, now() - interval '30 days', now() - interval '5 days', now() - interval '1 hour', 'Luma answered 403: guests are not shared with viewers');

-- The fixture's people and more. Those with contact_since follow the
-- calendar's emails, and its texts if they gave a number; Pat, Tom and
-- Yuki followed until they unsubscribed (opt_outs, below). Erin was
-- erased (luma_erased), so the import skips her; her row goes with her
-- supporter, once supporters are made.
INSERT INTO luma_people (user_id, email, name, contact_since, changed_at) VALUES
  ('usr-fixture-1', 'jane.fixture@example.com', 'Jane Fixture', now() - interval '31 days', now() - interval '1 day'),
  ('usr-fixture-2', 'sam.fixture@example.com', 'Sam Fixture', NULL, now() - interval '1 day'),
  ('usr-fixture-3', 'alex.fixture@example.com', 'Alex Fixture', now() - interval '20 days', now() - interval '1 day'),
  ('usr-fixture-4', 'declined.fixture@example.com', 'Dee Clined', NULL, now() - interval '1 day'),
  -- Following since she registered for the protest.
  ('usr-fixture-5', 'pat.fixture@example.com', 'Pat Fixture', now() - interval '5 days', now() - interval '1 day'),
  ('usr-fixture-6', 'follower.fixture@example.com', 'Fay Follower', now() - interval '80 days', now() - interval '1 day'),
  -- A host of the London protest, and nothing else: Luma has no name for them.
  ('usr-fixture-7', 'host.fixture@example.com', '', NULL, now() - interval '1 day'),
  ('usr-seed-7', 'omar.seed@example.com', 'Omar Seed', now() - interval '3 days', now() - interval '1 day'),
  ('usr-seed-8', 'priya.seed@example.com', 'Priya Seed', now() - interval '2 days', now() - interval '1 day'),
  ('usr-seed-9', 'tom.seed@example.com', 'Tom Seed', now() - interval '100 days', now() - interval '1 day'),
  ('usr-seed-10', 'li.seed@example.com', 'Li Seed', now() - interval '9 days', now() - interval '1 day'),
  ('usr-seed-11', 'grace.seed@example.com', 'Grace Seed', NULL, now() - interval '1 day'),
  ('usr-seed-12', 'ahmed.seed@example.com', 'Ahmed Seed', now() - interval '11 days', now() - interval '1 day'),
  ('usr-seed-13', 'rosa.seed@example.com', 'Rosa Seed', NULL, now() - interval '1 day'),
  ('usr-seed-14', 'ben.seed@example.com', 'Ben Seed', NULL, now() - interval '1 day'),
  ('usr-seed-15', 'yuki.seed@example.com', 'Yuki Seed', now() - interval '50 days', now() - interval '1 day'),
  ('usr-seed-16', 'noah.seed@example.com', 'Noah Seed', NULL, now() - interval '1 day'),
  ('usr-seed-17', 'ines.seed@example.com', 'Ines Seed', NULL, now() - interval '1 day'),
  ('usr-seed-18', 'kwame.seed@example.com', 'Kwame Seed', now() - interval '6 days', now() - interval '1 day'),
  ('usr-seed-19', 'mia.seed@example.com', 'Mia Seed', NULL, now() - interval '1 day'),
  ('usr-seed-20', 'erased.seed@example.com', 'Erin Erased', now() - interval '70 days', now() - interval '1 day'),
  -- Robin follows the calendar at one address and is a member at another
  -- (CiviCRM's contact 112), one supporter by their mobile; this one is blocked further down.
  ('usr-seed-22', 'robin.events@example.com', 'Robin Rivers', now() - interval '40 days', now() - interval '1 day'),
  -- Following the calendar since an hour ago: the newest contact.
  ('usr-seed-21', 'nia.seed@example.com', 'Nia Seed', now() - interval '1 hour', now() - interval '1 hour');
INSERT INTO luma_erased (user_id, erased_at) VALUES ('usr-seed-20', now() - interval '15 days');
INSERT INTO luma_import_state (list, full_pass_at, cursor) VALUES
  ('events', now() - interval '1 hour', ''),
  ('contacts', now() - interval '3 days', 'seed-cursor-page-4');

-- Registrations: a few long ago, nine in the week before last, six in the
-- last week (approved and not removed, as the dashboard counts them), plus
-- a waitlist, a decline, one awaiting approval and one removed.
INSERT INTO luma_guests (id, event_id, user_id, approval_status, registered_at, phone, postcode, utm_source, removed_at, changed_at) VALUES
  -- long ago
  ('gst-1', 'evt-fixture-past-london-march', 'usr-fixture-1', 'approved', now() - interval '260 days', '+447700900001', 'M1 1AE', 'brixton', NULL, now() - interval '30 days'),
  ('gst-2', 'evt-fixture-past-london-march', 'usr-fixture-2', 'approved', now() - interval '258 days', NULL, NULL, 'stratford', NULL, now() - interval '30 days'),
  ('gst-3', 'evt-fixture-past-glasgow-stall', 'usr-fixture-3', 'approved', now() - interval '275 days', NULL, 'G1 1AA', 'brixton', NULL, now() - interval '30 days'),
  ('gst-seed-yuki-march', 'evt-fixture-past-london-march', 'usr-seed-15', 'approved', now() - interval '255 days', NULL, 'SE1 7PB', NULL, NULL, now() - interval '30 days'),
  ('gst-seed-erased-march', 'evt-fixture-past-london-march', 'usr-seed-20', 'approved', now() - interval '255 days', NULL, NULL, NULL, now() - interval '15 days', now() - interval '15 days'),
  ('gst-seed-robin-march', 'evt-fixture-past-london-march', 'usr-seed-22', 'approved', now() - interval '254 days', '+447700900333', NULL, NULL, NULL, now() - interval '30 days'),
  -- the Manchester talk, 11 days ago: the week before last
  ('gst-seed-7-talk', 'evt-seed-manchester-talk', 'usr-seed-7', 'approved', now() - interval '13 days', '+447700900007', 'M4 1HQ', 'instagram', NULL, now() - interval '12 days'),
  ('gst-seed-8-talk', 'evt-seed-manchester-talk', 'usr-seed-8', 'approved', now() - interval '13 days', NULL, 'M20 2RN', 'instagram', NULL, now() - interval '12 days'),
  ('gst-seed-9-talk', 'evt-seed-manchester-talk', 'usr-seed-9', 'approved', now() - interval '12 days', '+447700900456', NULL, NULL, NULL, now() - interval '12 days'),
  ('gst-seed-10-talk', 'evt-seed-manchester-talk', 'usr-seed-10', 'approved', now() - interval '12 days', '+447700900010', 'SK4 1AA', 'poster', NULL, now() - interval '12 days'),
  ('gst-seed-11-talk', 'evt-seed-manchester-talk', 'usr-seed-11', 'approved', now() - interval '11 days', NULL, NULL, NULL, NULL, now() - interval '11 days'),
  ('gst-seed-12-talk', 'evt-seed-manchester-talk', 'usr-seed-12', 'approved', now() - interval '11 days', '+447700900012', 'M1 1AE', NULL, NULL, now() - interval '11 days'),
  ('gst-seed-13-training', 'evt-seed-online-training', 'usr-seed-13', 'approved', now() - interval '10 days', NULL, NULL, 'newsletter', NULL, now() - interval '10 days'),
  ('gst-seed-14-training', 'evt-seed-online-training', 'usr-seed-14', 'approved', now() - interval '9 days', NULL, 'BS1 1AA', 'newsletter', NULL, now() - interval '9 days'),
  ('gst-seed-3-training', 'evt-seed-online-training', 'usr-fixture-3', 'approved', now() - interval '8 days', NULL, 'G1 1AA', NULL, NULL, now() - interval '8 days'),
  -- the last week: the protest and the intro
  ('gst-fixture-1-protest', 'evt-fixture-london-protest', 'usr-fixture-1', 'approved', now() - interval '6 days', '+447700900001', 'm1 1ae', 'brixton', NULL, now() - interval '6 days'),
  ('gst-5', 'evt-fixture-london-protest', 'usr-fixture-5', 'approved', now() - interval '5 days', '+447700900005', NULL, NULL, NULL, now() - interval '5 days'),
  ('gst-seed-16-protest', 'evt-fixture-london-protest', 'usr-seed-16', 'approved', now() - interval '4 days', NULL, 'E1 6AN', 'tiktok', NULL, now() - interval '4 days'),
  ('gst-seed-17-protest', 'evt-fixture-london-protest', 'usr-seed-17', 'approved', now() - interval '3 days', NULL, NULL, 'tiktok', NULL, now() - interval '3 days'),
  ('gst-seed-18-intro', 'evt-fixture-online-intro', 'usr-seed-18', 'approved', now() - interval '2 days', NULL, NULL, NULL, NULL, now() - interval '2 days'),
  ('gst-seed-19-intro', 'evt-fixture-online-intro', 'usr-seed-19', 'approved', now() - interval '1 day', NULL, 'LS1 1AA', NULL, NULL, now() - interval '1 day'),
  -- not counted: declined, waitlisted, awaiting approval, removed
  ('gst-4', 'evt-fixture-london-protest', 'usr-fixture-4', 'declined', now() - interval '5 days', NULL, NULL, 'brixton', NULL, now() - interval '5 days'),
  ('gst-fixture-2-intro', 'evt-fixture-online-intro', 'usr-fixture-2', 'waitlist', now() - interval '3 days', NULL, NULL, NULL, NULL, now() - interval '3 days'),
  ('gst-seed-9-protest', 'evt-fixture-london-protest', 'usr-seed-9', 'pending_approval', now() - interval '1 day', NULL, NULL, NULL, NULL, now() - interval '1 day'),
  ('gst-seed-11-protest', 'evt-fixture-london-protest', 'usr-seed-11', 'approved', now() - interval '4 days', NULL, NULL, NULL, now() - interval '2 days', now() - interval '2 days');

-- Opt-outs: some in the last week, one the week before, one long ago,
-- each by Luma's webhook but Ahmed's; Sam unsubscribed and then subscribed
-- again. Each stops Luma's texts to the
-- number its Luma account gave as well: Pat's two hours after the
-- PauseCon room change text reached her, Tom's between broadcasts being
-- written and sent, so they skipped him (the broadcasts, at the end).
INSERT INTO opt_outs (address, list, source, source_ref, unsubscribed_at, resubscribed_at) VALUES
  ('pat.fixture@example.com', 'events', 'luma-webhook', 'seed-unsubscribe-pat', now() - interval '3 days' + interval '2 hours', NULL),
  ('tom.seed@example.com', 'events', 'luma-webhook', 'seed-unsubscribe-tom', now() - interval '6 days 12 hours', NULL),
  ('yuki.seed@example.com', 'events', 'luma-webhook', 'seed-unsubscribe-yuki', now() - interval '10 days', NULL),
  ('erased.seed@example.com', 'events', 'luma-webhook', 'seed-unsubscribe-erased', now() - interval '60 days', NULL),
  ('sam.fixture@example.com', 'events', 'luma-webhook', 'seed-unsubscribe-sam', now() - interval '20 days', now() - interval '17 days'),
  -- Gone from Luma's list of contacts with no webhook, as after a removal: the contacts pass noticed.
  ('ahmed.seed@example.com', 'events', 'luma-contacts', 'usr-seed-12 seed-pass', now() - interval '1 day', NULL);

-- ------------------------------------------------------ CiviCRM contacts

-- The UK chapter contacts civicrm-contacts.json holds, by the same IDs and
-- values, so a pull there changes nothing, as first pulled two days ago:
-- Jane on both lists; Owen never opted in, having left "Keep me informed"
-- unticked; Rhea on the newsletter but with "No bulk emails";
-- Kit unsubscribed from the newsletter yesterday, an opt-out from CiviCRM;
-- Tom, who joined before June, never opted in, with "Do not phone" on their
-- number; Gil, gone from the chapter since yesterday; Casey, on hold, which
-- blocks the address; Sasha, on the newsletter, a volunteer with a number;
-- Mara, who joined three days ago to lead, on both lists; and Lee and
-- Robin, who joined before June, never opted in. Jane, Tom and Lee are also
-- a Luma guest or a letter writer. Erin's contact, erased with her, is
-- skipped.
INSERT INTO civicrm_contacts (contact_id, airtable_id, email, first_name, last_name, city, postal_code, joined_date,
  intent, phone, on_hold, on_hold_since, no_bulk_email, no_bulk_email_since,
  do_not_email, do_not_email_since, do_not_phone, do_not_phone_since, do_not_sms, do_not_sms_since,
  newsletter, newsletter_since, volunteer_updates, volunteer_updates_since, first_seen_at, gone_at)
SELECT c.id, c.airtable_id, c.email, c.first_name, c.last_name, c.city, c.postal_code, c.joined_date::date, c.intent,
  c.phone, c.on_hold, f, c.no_bulk, f, c.no_email, f, c.no_phone, f, c.no_sms, f,
  c.newsletter, coalesce(now() - c.newsletter_ago, f), c.volunteer, f, f, now() - c.gone_ago
FROM (VALUES
  (101, 'recMemberJane', 'jane.fixture@example.com', 'Jane', 'Fixture', 'Manchester', 'M1 1AE', '2026-09-12', 'volunteer', NULL, false, false, false, false, false, 'subscribed', NULL::interval, 'subscribed', NULL::interval),
  (103, 'recMemberOwen', 'owen.member@example.com', 'Owen', 'Member', 'Bristol', NULL, '2026-10-06', 'act_now', NULL, false, false, true, false, false, 'not_opted_in', NULL, 'not_on_list', NULL),
  (104, 'recMemberRhea', 'rhea.member@example.com', 'Rhea', 'Member', 'Cardiff', NULL, '2026-07-10', 'keep_informed', NULL, false, true, false, false, false, 'subscribed', NULL, 'not_on_list', NULL),
  (105, 'recMemberKit', 'kit.member@example.com', 'Kit', 'Member', 'Oxford', 'OX1 1AA', '2026-03-03', 'volunteer', NULL, false, false, false, false, false, 'unsubscribed', interval '1 day', 'subscribed', NULL),
  (106, 'recMemberTom', 'tom.seed@example.com', 'Tom', 'Seed', 'London', NULL, '2024-11-03', NULL, '+447700900456', false, false, false, true, true, 'not_opted_in', NULL, 'not_on_list', NULL),
  (107, 'recMemberGil', 'gil.member@example.com', 'Gil', 'Member', 'Leeds', 'LS1 1AA', '2026-08-01', 'act_now', NULL, false, false, false, false, false, 'subscribed', NULL, 'not_on_list', interval '1 day'),
  (108, NULL, 'casey.chapter@example.com', 'Casey', 'Chapter', 'Glasgow', 'G1 1AA', '2026-10-20', 'none', NULL, true, false, false, false, false, 'subscribed', NULL, 'not_on_list', NULL),
  (109, NULL, 'sasha.chapter@example.com', 'Sasha', 'Chapter', 'Belfast', NULL, '2026-11-02', 'volunteer', '+447700900987', false, false, false, false, false, 'subscribed', NULL, 'not_on_list', NULL),
  (110, 'recMemberMara', 'mara.member@example.com', 'Mara', 'Member', 'London', NULL, '2026-10-13', 'lead', '+447700900123', false, false, false, false, false, 'subscribed', NULL, 'subscribed', NULL),
  (111, 'recMemberLee', 'lee.letter@example.com', 'Lee', 'Letter', 'Bristol', 'BS1 1AA', '2025-11-29', NULL, NULL, false, false, false, false, false, 'not_opted_in', NULL, 'not_on_list', NULL),
  (112, 'recMemberRobin', 'robin.rivers@example.com', 'Robin', 'Rivers', 'Leeds', NULL, '2026-05-01', 'keep_informed', '+447700900333', false, false, false, false, false, 'not_opted_in', NULL, 'not_on_list', NULL)
) c (id, airtable_id, email, first_name, last_name, city, postal_code, joined_date, intent, phone, on_hold, no_bulk, no_email,
  no_phone, no_sms, newsletter, newsletter_ago, volunteer, gone_ago)
CROSS JOIN (SELECT now() - interval '2 days' AS f) first;
INSERT INTO civicrm_erased (contact_id, erased_at) VALUES (199, now() - interval '15 days');
-- Sasha pressed Stop everything on the contact preferences page
-- (stopEverything): every bulk email, and every text and call to her
-- number, one group, which Restart undoes.
INSERT INTO opt_outs (address, list, way, source, source_ref, unsubscribed_at) VALUES
  ('sasha.chapter@example.com', 'bulk', 'email', 'preferences',
   'preferences stop-all seed-sasha email bulk sasha.chapter@example.com', now() - interval '1 day'),
  ('+447700900987', 'all', 'text', 'preferences',
   'preferences stop-all seed-sasha text all +447700900987', now() - interval '1 day'),
  ('+447700900987', 'all', 'call', 'preferences',
   'preferences stop-all seed-sasha call all +447700900987', now() - interval '1 day');
INSERT INTO opt_outs (address, list, way, source, source_ref, unsubscribed_at)
SELECT email, 'newsletter', 'email', 'civicrm', contact_id || ' newsletter ' || newsletter_since, newsletter_since
FROM civicrm_contacts WHERE newsletter = 'unsubscribed';
INSERT INTO one_off_erased (account, gmail_message_id, rfc_sha256, erased_at) VALUES ('policy@pauseai.uk', 'gmailErased', encode(sha256('erased@example.com'::bytea), 'hex'), now() - interval '15 days');

-- --------------------------------------------------------------- places

-- Where postcodes.io placed the postcodes and towns above, as the hourly
-- lookup stores them; the test postcodes it doesn't know.
INSERT INTO postcode_places (postcode, latitude, longitude, place, country) VALUES
  ('BS11AA', 51.4545, -2.5879, 'Bristol, City of', 'england'),
  ('E16AN', 51.5205, -0.0726, 'Tower Hamlets', 'england'),
  ('E151AA', 51.5413, -0.0039, 'Newham', 'england'),
  ('EC1A1BB', 51.5202, -0.0978, 'City of London', 'england'),
  ('G11AA', 55.8609, -4.249, 'Glasgow City', 'scotland'),
  ('HU11AA', 53.7443, -0.3326, 'Kingston upon Hull, City of', 'england'),
  ('LE11AA', 52.6345, -1.13, 'Leicester', 'england'),
  ('LS11AA', 53.797, -1.5492, 'Leeds', 'england'),
  ('LS27EY', 53.8079, -1.5566, 'Leeds', 'england'),
  ('M11AE', 53.4794, -2.2353, 'Manchester', 'england'),
  ('M41HQ', 53.484, -2.237, 'Manchester', 'england'),
  ('M202RN', 53.4317, -2.2303, 'Manchester', 'england'),
  ('NR11AA', 52.6286, 1.2925, 'Norwich', 'england'),
  ('OX11AA', 51.752, -1.2577, 'Oxford', 'england'),
  ('SE17PB', 51.5007, -0.1167, 'Lambeth', 'england'),
  ('SK41AA', 53.4106, -2.1575, 'Stockport', 'england'),
  ('YO17HH', 53.9617, -1.0817, 'York', 'england'),
  ('SW1A1AA', 51.501009, -0.141588, 'Westminster', 'england'),
  ('ZZ99ZB', NULL, NULL, NULL, NULL),
  ('ZZ99ZH', NULL, NULL, NULL, NULL),
  ('ZZ99ZN', NULL, NULL, NULL, NULL),
  ('ZZ99ZS', NULL, NULL, NULL, NULL),
  ('ZZ99ZZ', NULL, NULL, NULL, NULL);
-- And each one's constituency, where a fixture MP has it.
UPDATE postcode_places SET constituency_checked = true,
  constituency = CASE postcode WHEN 'EC1A1BB' THEN 'Cities of London and Westminster' WHEN 'M11AE' THEN 'Manchester Central' END;
INSERT INTO named_places (name, latitude, longitude, place, country) VALUES
  ('manchester', 53.4794, -2.2453, 'Manchester', 'england'),
  ('london', 51.5072, -0.1276, 'London', 'england'),
  ('bristol', 51.4545, -2.5879, 'Bristol', 'england'),
  ('cardiff', 51.4816, -3.1791, 'Cardiff', 'wales'),
  ('oxford', 51.752, -1.2577, 'Oxford', 'england'),
  ('leeds', 53.7997, -1.5492, 'Leeds', 'england'),
  ('glasgow', 55.8642, -4.2518, 'Glasgow', 'scotland'),
  ('leicester', 52.6369, -1.1398, 'Leicester', 'england');
-- The calendar's tags: big days and online events, which say nothing of where people live.
UPDATE luma_events SET tags = '{Big events,London}' WHERE id IN ('evt-fixture-past-london-march', 'evt-fixture-london-protest');
UPDATE luma_events SET tags = '{Online}' WHERE id IN ('evt-seed-online-training', 'evt-fixture-online-intro');
UPDATE luma_events SET tags = '{Scotland}' WHERE id IN ('evt-fixture-past-glasgow-stall', 'evt-fixture-scotland-meeting');
UPDATE luma_events SET tags = '{Manchester}' WHERE id IN ('evt-seed-manchester-talk', 'evt-fixture-manchester-social');
UPDATE luma_events SET tags = '{Oxford}' WHERE id = 'evt-fixture-oxford-talk';
UPDATE luma_events SET tags = '{West of England}' WHERE id = 'evt-fixture-bristol-leafleting';
UPDATE luma_events SET tags = '{Leicester}' WHERE id = 'evt-fixture-leicester-meetup';
-- Taken off Luma: the import found it gone from the calendar.
UPDATE luma_events SET removed_at = now() - interval '3 days' WHERE id = 'evt-seed-cancelled-picnic';
-- Each made on Luma six weeks before it starts, and seen by the import no earlier.
UPDATE luma_events SET created_at = start_at - interval '42 days';
UPDATE luma_events SET first_seen_at = greatest(first_seen_at, created_at);
-- Hosts the import has read. Those to come are the Luma fixture's
-- (lib/server/fixtures/outside-services.ts): the London protest's three, Sam,
-- Jane, who registered for it too, and one Luma has no name for; Alex for
-- each of the rest. Read two hours ago, so the next import reads them again.
-- Of those over, read the day before and never again: the past London march's, Jane, so it's
-- two rows on her page and one event in her count; the Glasgow stall's,
-- Alex; and the Manchester talk's, Omar.
INSERT INTO luma_event_hosts (event_id, user_id) VALUES
  ('evt-fixture-london-protest', 'usr-fixture-2'),
  ('evt-fixture-london-protest', 'usr-fixture-7'),
  ('evt-fixture-london-protest', 'usr-fixture-1'),
  ('evt-fixture-online-intro', 'usr-fixture-3'),
  ('evt-fixture-manchester-social', 'usr-fixture-3'),
  ('evt-fixture-scotland-meeting', 'usr-fixture-3'),
  ('evt-fixture-oxford-talk', 'usr-fixture-3'),
  ('evt-fixture-bristol-leafleting', 'usr-fixture-3'),
  ('evt-fixture-leicester-meetup', 'usr-fixture-3'),
  ('evt-fixture-past-london-march', 'usr-fixture-1'),
  ('evt-fixture-past-glasgow-stall', 'usr-fixture-3'),
  ('evt-seed-manchester-talk', 'usr-seed-7');
UPDATE luma_events SET hosts_synced_at = now() - interval '2 hours' WHERE start_at > now() AND removed_at IS NULL
  AND id LIKE 'evt-fixture-%';
UPDATE luma_events SET hosts_synced_at = start_at - interval '1 day'
  WHERE id IN ('evt-fixture-past-london-march', 'evt-fixture-past-glasgow-stall', 'evt-seed-manchester-talk');
-- Jane was made a host of the London protest after its first read, so her
-- page dates it then, not when the event was made.
UPDATE luma_event_hosts SET added_at = now() - interval '3 days'
  WHERE event_id = 'evt-fixture-london-protest' AND user_id = 'usr-fixture-1';

-- Owners for some of our events, past and to come; the rest coming up have
-- none, so the events page shows them as needing one. One has its Google Doc.
INSERT INTO event_owners (event_id, owner, assigned_by, assigned_at) VALUES
  ('evt-fixture-past-london-march', 'jo@pauseai.uk', 'jo@pauseai.uk', now() - interval '260 days'),
  ('evt-seed-manchester-talk', 'samuel.whitlock@pauseai.uk', 'sync', now() - interval '20 days'),
  ('evt-fixture-london-protest', 'jo@pauseai.uk', 'sync', now() - interval '20 days'),
  ('evt-fixture-online-intro', 'samuel.whitlock@pauseai.uk', 'jo@pauseai.uk', now() - interval '6 days');
INSERT INTO event_docs (event_id, url, set_by, set_at) VALUES
  ('evt-fixture-london-protest', 'https://docs.google.com/document/d/fixture-protest-plan/edit', 'jo@pauseai.uk', now() - interval '10 days');

-- -------------------------------------------------------------- letters

-- Letters to the test MPs in every state. Seven sent in the last week and
-- four the week before; two replied to this week and three the week before;
-- one bounce this week and two the week before. postmark_mailbox doubles as a
-- handle for the rows below.
CREATE TEMP TABLE seed_letters (hash text, postcode text, campaign text, sender text, email text, address text, sender_postcode text, consent boolean, subject text, status text, created interval, sent interval, replied interval) ON COMMIT DROP;
INSERT INTO seed_letters VALUES
  -- long ago
  ('old-jane', 'ZZ99ZZ', 'regulate-letter-pm', 'Jane Fixture', 'Jane.Fixture@example.com', '1 Fixture Street, Manchester', 'M1 1AE', true, 'Please back a pause on frontier AI', 'sent', '45 days', '45 days', '38 days'),
  ('old-yuki', 'ZZ99ZS', 'regulate-letter-pm', 'Yuki Seed', 'yuki.seed@example.com', '2 Seed Row, London', 'SE1 7PB', true, 'A pause before it''s too late', 'sent', '40 days', '40 days', NULL),
  ('old-gone', 'ZZ99ZZ', 'regulate-letter-pm', 'Priya Seed', 'priya.seed@example.com', '3 Seed Row, Manchester', 'M20 2RN', false, 'Frontier AI needs rules', 'sent', '30 days', '30 days', '27 days'),
  -- the week before last: four sent, three replied, two bounced
  ('prev-lee', 'ZZ99ZS', 'regulate-letter-pm', 'Lee Letter', 'lee.letter@example.com', '2 Fixture Road, Bristol', 'BS1 1AA', false, 'AI safety matters to your constituents', 'sent', '13 days', '13 days', '11 days'),
  ('prev-omar', 'ZZ99ZB', 'support-sobel-bill', 'Omar Seed', 'omar.seed@example.com', '4 Seed Row, Manchester', 'M4 1HQ', true, 'Back the Sobel bill', 'sent', '12 days', '12 days', '9 days'),
  ('prev-li', 'ZZ99ZZ', 'regulate-letter-pm', 'Li Seed', 'li.seed@example.com', '5 Seed Row, Stockport', 'SK4 1AA', true, 'Please support a pause', 'sent', '11 days', '11 days', '8 days'),
  ('prev-ahmed', 'ZZ99ZB', 'support-sobel-bill', 'Ahmed Seed', 'ahmed.seed@example.com', '6 Seed Row, Manchester', 'M1 1AE', false, 'The Sobel bill deserves your vote', 'sent', '9 days', '9 days', NULL),
  ('prev-bounce-1', 'ZZ99ZH', 'regulate-letter-pm', 'Bo Bounce', 'bo.bounce@example.com', '3 Fixture Lane, Leeds', 'LS1 1AA', true, 'Please support a pause', 'bounced', '12 days', '12 days', NULL),
  ('prev-bounce-2', 'ZZ99ZH', 'support-sobel-bill', 'Rosa Seed', 'rosa.seed@example.com', '7 Seed Row, Norwich', 'NR1 1AA', true, 'Back the bill', 'bounced', '10 days', '10 days', NULL),
  -- the last week: seven sent, two replied, one bounced, one not sent, one still sending, one complained about
  ('week-sam', 'ZZ99ZB', 'support-sobel-bill', 'Sam Fixture', 'sam.fixture@example.com', '4 Fixture Way, Stratford', 'E15 1AA', true, 'Back the Sobel bill', 'sent', '6 days', '6 days', '4 days'),
  ('week-ben', 'ZZ99ZZ', 'regulate-letter-pm', 'Ben Seed', 'ben.seed@example.com', '8 Seed Row, Bristol', 'BS1 1AA', true, 'A pause on frontier AI', 'sent', '6 days', '6 days', NULL),
  ('week-grace', 'ZZ99ZS', 'regulate-letter-pm', 'Grace Seed', 'grace.seed@example.com', '9 Seed Row, Oxford', 'OX1 1AA', false, 'Please act on AI risk', 'sent', '5 days', '5 days', '2 days'),
  ('week-kwame', 'ZZ99ZZ', 'regulate-letter-pm', 'Kwame Seed', 'kwame.seed@example.com', '10 Seed Row, Leicester', 'LE1 1AA', true, 'Regulate AI developers now', 'sent', '4 days', '4 days', NULL),
  ('week-mia', 'ZZ99ZB', 'support-sobel-bill', 'Mia Seed', 'mia.seed@example.com', '11 Seed Row, Leeds', 'LS1 1AA', true, 'Support the bill', 'sent', '3 days', '3 days', NULL),
  ('week-ines', 'ZZ99ZS', 'regulate-letter-pm', 'Ines Seed', 'ines.seed@example.com', '12 Seed Row, London', 'E1 6AN', false, 'AI and our future', 'sent', '2 days', '2 days', NULL),
  ('week-noah', 'ZZ99ZZ', 'regulate-letter-pm', 'Noah Seed', 'noah.seed@example.com', '13 Seed Row, London', 'E1 6AN', true, 'A pause, please', 'sent', '1 day', '1 day', NULL),
  ('week-bounce', 'ZZ99ZH', 'regulate-letter-pm', 'Cass Seed', 'cass.seed@example.com', '14 Seed Row, Leeds', 'LS2 7EY', true, 'Please support a pause', 'bounced', '3 days', '3 days', NULL),
  ('week-nora', 'ZZ99ZN', 'regulate-letter-pm', 'Nora Noaddress', 'nora@example.com', '5 Fixture Close, Norwich', 'NR1 1AA', false, 'A pause on frontier AI', 'not_sent', '2 days', NULL, NULL),
  ('week-sending', 'ZZ99ZZ', 'regulate-letter-pm', 'Sal Sending', 'sal.sending@example.com', '15 Seed Row, Hull', 'HU1 1AA', true, 'Regulate AI', 'sending', '20 minutes', NULL, NULL),
  ('week-spam', 'ZZ99ZS', 'regulate-letter-pm', 'Grumpy Gus', 'grumpy@example.com', '16 Seed Row, York', 'YO1 7HH', false, 'Stop AI', 'spam_complaint', '5 days', '5 days', NULL);
CREATE TEMP TABLE seeded_letters ON COMMIT DROP AS
SELECT nextval(pg_get_serial_sequence('letters', 'id')) AS id, s.* FROM seed_letters s;
INSERT INTO letters (id, kind, notable_person_id, status, created_at, sent_at, replied_at) OVERRIDING SYSTEM VALUE
SELECT s.id, 'supporter', p.id, s.status, now() - s.created, now() - s.sent + interval '4 seconds', now() - s.replied
FROM seeded_letters s JOIN politicians p ON p.test_postcode = s.postcode;
-- Each sender is a form entry with their letter's ID.
INSERT INTO form_entries (id, form, created_at, name, email, address, postcode, contact_consent) OVERRIDING SYSTEM VALUE
SELECT s.id, 'email-your-mp', l.created_at, s.sender, s.email, s.address, s.sender_postcode, s.consent
FROM seeded_letters s JOIN letters l ON l.id = s.id;
INSERT INTO letters_from_supporters (id, entry_id, campaign, subject, postmark_mailbox)
SELECT s.id, s.id, s.campaign, s.subject, 'seed-' || s.hash FROM seeded_letters s JOIN letters l ON l.id = s.id;
-- Most of the recent letters went to Airtable's two MPs, so the dashboard,
-- which leaves the test MPs out, counts them; the bounces stay on Bouncy's.
UPDATE letters SET notable_person_id = (SELECT id FROM notable_people WHERE airtable_id = 'recDummy')
WHERE id IN (SELECT id FROM letters_from_supporters WHERE postmark_mailbox IN ('seed-prev-lee', 'seed-prev-li', 'seed-week-ben', 'seed-week-kwame', 'seed-week-noah'));
UPDATE letters SET notable_person_id = (SELECT id FROM notable_people WHERE airtable_id = 'recPlaceholder')
WHERE id IN (SELECT id FROM letters_from_supporters WHERE postmark_mailbox IN ('seed-prev-omar', 'seed-week-sam', 'seed-week-grace', 'seed-week-mia'));
-- Gus's went to Rob Removed, who marked it as spam (below).
UPDATE letters SET notable_person_id = (SELECT id FROM notable_people WHERE airtable_id = 'recRemoved')
WHERE id IN (SELECT id FROM letters_from_supporters WHERE postmark_mailbox = 'seed-week-spam');
-- The seed letters, with their handles.
CREATE TEMP VIEW seed_letter_rows AS SELECT l.*, s.postmark_mailbox FROM letters l JOIN letters_from_supporters s USING (id) WHERE s.postmark_mailbox LIKE 'seed-%';

-- Their history: sending, then sent, then what followed.
INSERT INTO letter_events (letter_id, at, status, details) SELECT id, created_at, 'sending', '{}' FROM seed_letter_rows WHERE true;
INSERT INTO letter_events (letter_id, at, status, details) SELECT id, sent_at, 'sent', jsonb_build_object('to', (SELECT lower(email) FROM notable_people WHERE id = notable_person_id), 'messageId', 'seed-message-' || id) FROM seed_letter_rows WHERE sent_at IS NOT NULL;
INSERT INTO letter_events (letter_id, at, status, details) SELECT id, replied_at, 'replied', jsonb_build_object('from', 'The office of ' || (SELECT name FROM notable_people WHERE id = notable_person_id), 'to', postmark_mailbox || '@letters.pauseai.uk', 'backend', 'postmark') FROM seed_letter_rows WHERE replied_at IS NOT NULL;
INSERT INTO letter_events (letter_id, at, status, details) SELECT id, sent_at + interval '2 minutes', 'auto_reply', jsonb_build_object('from', 'Backy McTestface MP', 'to', postmark_mailbox || '@letters.pauseai.uk', 'subject', 'Out of office', 'backend', 'postmark') FROM seed_letter_rows WHERE postmark_mailbox IN ('seed-prev-ahmed', 'seed-week-mia');
INSERT INTO letter_events (letter_id, at, status, details) SELECT id, sent_at + interval '1 minute', 'bounced', '{"type": "HardBounce", "description": "The address does not exist"}' FROM seed_letter_rows WHERE status = 'bounced';
INSERT INTO letter_events (letter_id, at, status, details) SELECT id, sent_at + interval '3 hours', 'spam_complaint', jsonb_build_object('type', 'SpamComplaint', 'reason', 'Marked as spam', 'email', (SELECT lower(email) FROM notable_people WHERE id = notable_person_id)) FROM seed_letter_rows WHERE status = 'spam_complaint';

-- Replies kept whole, as the letters inbox keeps them: Polly Placeholder's to
-- her three answered letters, whose text is kept too; and Dora Dummy's to one
-- from before letters' text was kept, which says it isn't. Another of those
-- answered, Priya's, has its reply noted in its events and nothing kept.
UPDATE letters_from_supporters SET letter = jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
  jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Dear Ms Placeholder,'))),
  jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Please support this. It matters to me and to many people here.')))))
WHERE postmark_mailbox IN ('seed-prev-omar', 'seed-week-sam', 'seed-week-grace');
INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, from_address, from_name,
  subject, at, from_us, from_supporter, blob_key, size)
SELECT r.id, 'fixture-letters@pauseai.uk', 'gmail-' || r.postmark_mailbox, 'thread-' || r.postmark_mailbox, r.postmark_mailbox || '-reply@parliament.example',
  lower(n.email), n.name, 'Re: ' || s.subject, r.replied_at, false, false, 'fixture/' || f.file || '.eml.gz', 512
FROM seed_letter_rows r JOIN letters_from_supporters s USING (id) JOIN notable_people n ON n.id = r.notable_person_id
  JOIN (VALUES ('seed-prev-omar', 'polly-reply-bill'), ('seed-week-sam', 'polly-reply-sobel'), ('seed-week-grace', 'polly-reply-ai'), ('seed-prev-li', 'dora-reply'))
    AS f (postmark_mailbox, file) ON f.postmark_mailbox = r.postmark_mailbox;

-- Every email that went out, or didn't: the letters, two forwarded replies,
-- staff login links, a bounce alert; one refused by a block, one that failed.
INSERT INTO email_sends (at, purpose, letter_id, address, outcome, message_id)
SELECT sent_at, 'letter', id, (SELECT coalesce(email, '') FROM notable_people WHERE id = notable_person_id), 'sent', 'seed-message-' || id FROM seed_letter_rows WHERE sent_at IS NOT NULL;
INSERT INTO email_sends (at, purpose, letter_id, address, outcome, message_id)
SELECT replied_at + interval '1 minute', 'forwarded-reply', id, 'replies@pauseai.uk', 'sent', 'seed-forward-' || id FROM seed_letter_rows WHERE replied_at IS NOT NULL AND postmark_mailbox IN ('seed-week-sam', 'seed-week-grace');
INSERT INTO email_sends (at, purpose, letter_id, address, outcome, message_id) VALUES
  (now() - interval '3 days', 'staff-login', NULL, 'jo@pauseai.uk', 'sent', 'seed-login-jo'),
  (now() - interval '1 day', 'staff-login', NULL, 'samuel.whitlock@pauseai.uk', 'sent', 'seed-login-sam'),
  (now() - interval '3 days' + interval '5 minutes', 'staff-alert', NULL, 'admin@pauseai.uk', 'sent', 'seed-alert-bounce'),
  (now() - interval '1 day', 'letter', NULL, 'no-such-mailbox@pauseai.uk', 'refused', NULL),
  (now() - interval '8 days', 'letter', NULL, 'polly.placeholder.mp@parliament.uk', 'failed', NULL);

-- Delivery problems: the bounces that blocked Bouncy's address, Rob
-- Removed marking Gus's letter as spam, which blocked his address, as
-- recordProblem() (lib/server/email.ts) blocks whoever complained; a block
-- from the week before last on an MP's
-- old address, bouncing an email the site has no record of sending, so of
-- no type we know, and a bounce that blocked Polly's address until Jo
-- unblocked it (the audit log).
INSERT INTO email_problems (id, at, address, message_id, kind, reason, can_reset, details) OVERRIDING SYSTEM VALUE VALUES
  (1, now() - interval '12 days' + interval '1 minute', 'no-such-mailbox@pauseai.uk', NULL, 'hard', 'The address does not exist', true, '{"type": "HardBounce"}'),
  (2, now() - interval '10 days' + interval '1 minute', 'no-such-mailbox@pauseai.uk', NULL, 'hard', 'The address does not exist', true, '{"type": "HardBounce"}'),
  (3, now() - interval '9 days', 'gordon.gone.mp@parliament.uk', 'not-sent-by-the-site', 'hard', 'Mailbox closed', true, '{"type": "HardBounce"}'),
  (4, now() - interval '5 days' + interval '3 hours', 'rob.removed.mp@parliament.uk', NULL, 'complaint', 'Marked as spam', false, '{"type": "SpamComplaint"}'),
  (5, now() - interval '4 days', 'polly.placeholder.mp@parliament.uk', NULL, 'hard', '550 5.4.1 Recipient address rejected: Access denied. For more information see https://aka.ms/EXOSmtpErrors [AB1CDEF000123GH.eurprd01.prod.outlook.com 2026-10-12T09:14:03.232Z 08DE0000000000AA]', true, '{"type": "HardBounce"}'),
  (6, now() - interval '3 days' + interval '1 minute', 'no-such-mailbox@pauseai.uk', NULL, 'hard', 'The address does not exist', true, '{"type": "HardBounce"}');
UPDATE email_problems p SET message_id = 'seed-message-' || l.id FROM seed_letter_rows l WHERE l.postmark_mailbox = 'seed-prev-bounce-1' AND p.id = 1;
UPDATE email_problems p SET message_id = 'seed-message-' || l.id FROM seed_letter_rows l WHERE l.postmark_mailbox = 'seed-prev-bounce-2' AND p.id = 2;
UPDATE email_problems p SET message_id = 'seed-message-' || l.id FROM seed_letter_rows l WHERE l.postmark_mailbox = 'seed-week-spam' AND p.id = 4;
UPDATE email_problems p SET message_id = 'seed-message-' || l.id FROM seed_letter_rows l WHERE l.postmark_mailbox = 'seed-week-bounce' AND p.id = 6;
-- Blocked: Bouncy's address by the first bounce, Gordon's by his, Rob's by
-- his complaint; Polly's no longer.
INSERT INTO email_blocks (address, problem_id) VALUES
  ('no-such-mailbox@pauseai.uk', 1),
  ('gordon.gone.mp@parliament.uk', 3),
  ('rob.removed.mp@parliament.uk', 4);

-- A letter from the letters inbox, long ago, so it counts in neither week:
-- Pat's proxy and the test MP's; the letter as sent, and the draft it was
-- written from; her copy; the office's acknowledgement and reply to her
-- proxy, kept whole (lib/server/fixtures/letter-replies/) and relayed to her.
INSERT INTO proxies (tag, supporter_email, created_at) VALUES ('pat.proxy', 'pat.proxy@example.com', now() - interval '50 days');
INSERT INTO proxies (tag, notable_person_id, created_at)
SELECT 'testy.mctestface.mp', id, now() - interval '50 days' FROM politicians WHERE test_postcode = 'ZZ99ZZ';
CREATE TEMP TABLE seed_proxied ON COMMIT DROP AS SELECT nextval(pg_get_serial_sequence('letters', 'id')) AS id;
INSERT INTO letters (id, kind, notable_person_id, status, created_at, sent_at, replied_at) OVERRIDING SYSTEM VALUE
SELECT s.id, 'supporter', p.id, 'sent', now() - interval '50 days', now() - interval '50 days', now() - interval '48 days'
FROM seed_proxied s, politicians p WHERE p.test_postcode = 'ZZ99ZZ';
INSERT INTO form_entries (id, form, created_at, name, email, address, postcode, contact_consent) OVERRIDING SYSTEM VALUE
SELECT id, 'email-your-mp', now() - interval '50 days', 'Pat Proxy', 'pat.proxy@example.com', '17 Seed Row, Leeds', 'LS1 1AA', true
FROM seed_proxied;
INSERT INTO letters_from_supporters (id, entry_id, campaign, subject, proxy_id, letter, draft, draft_approximate, own_words, copy_state)
SELECT s.id, s.id, 'regulate-letter-pm', 'Please back a pause on frontier AI', (SELECT id FROM proxies WHERE tag = 'pat.proxy'),
  '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Dear Mr McTestface,"}]}, {"type": "paragraph", "content": [{"type": "text", "text": "Please back a pause on frontier AI. My children ask me about it every week."}]}, {"type": "paragraph", "content": [{"type": "text", "text": "Pat Proxy"}]}]}',
  E'Dear Mr McTestface,\n\nPlease back a pause on frontier AI. It is the most urgent issue of our time.\n\nPat Proxy',
  false, 0.4, 'sent'
FROM seed_proxied s;
INSERT INTO email_sends (at, purpose, letter_id, address, outcome, message_id, backend, sender, rfc_message_id, gmail_thread_id)
SELECT now() - interval '50 days', 'letter', id, 'test-mp@parliament.example', 'sent', 'gmail-seed-proxied-letter', 'gmail',
  'fixture-letters@pauseai.uk', 'fixture-proxied-letter@pauseai.uk', 'thread-seed-proxied'
FROM seed_proxied
UNION ALL
SELECT now() - interval '50 days', 'letter-copy', id, 'pat.proxy@example.com', 'sent', 'gmail-seed-proxied-copy', 'gmail',
  'fixture-letters@pauseai.uk', 'fixture-proxied-copy@pauseai.uk', 'thread-seed-proxied-copy'
FROM seed_proxied
UNION ALL
SELECT now() - interval '48 days', 'relay', id, 'pat.proxy@example.com', 'sent', 'gmail-seed-proxied-relay', 'gmail',
  'fixture-letters@pauseai.uk', 'fixture-proxied-relay@pauseai.uk', 'thread-seed-proxied-copy'
FROM seed_proxied;
INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, from_address, from_name,
  subject, at, from_us, from_supporter, blob_key, size)
SELECT id, 'fixture-letters@pauseai.uk', 'gmail-seed-office-reply', 'thread-seed-office-reply', 'fixture-office-reply@parliament.example',
  'test-mp@parliament.example', 'Testy McTestface MP', 'Re: Please back a pause on frontier AI', now() - interval '48 days',
  false, false, 'fixture/office-reply-to-proxy.eml.gz', 512
FROM seed_proxied;
INSERT INTO letter_relays (letter_id, reply_id, to_supporter, status, created_at, sent_at, rfc_message_id)
SELECT s.id, r.id, true, 'sent', now() - interval '48 days', now() - interval '48 days', 'fixture-proxied-relay@pauseai.uk'
FROM seed_proxied s JOIN letter_replies r ON r.letter_id = s.id;
INSERT INTO letter_events (letter_id, at, status, details)
SELECT id, now() - interval '50 days', 'sent', '{"from": "\"Pat Proxy (via PauseAI)\" <fixture-letters+pat.proxy@pauseai.uk>", "to": "test-mp@parliament.example", "backend": "gmail", "account": "fixture-letters@pauseai.uk"}'::jsonb FROM seed_proxied
UNION ALL
SELECT id, now() - interval '50 days', 'copy_sent', '{"from": "\"Pat Proxy (via PauseAI)\" <fixture-letters+pat.proxy@pauseai.uk>", "to": "pat.proxy@example.com", "replyTo": "\"Testy McTestface MP (via PauseAI)\" <fixture-letters+testy.mctestface.mp@pauseai.uk>", "backend": "gmail", "account": "fixture-letters@pauseai.uk"}'::jsonb FROM seed_proxied
UNION ALL
SELECT id, now() - interval '48 days', 'replied', '{"from": "test-mp@parliament.example", "name": "Testy McTestface MP", "to": "fixture-letters+pat.proxy@pauseai.uk", "gmailMessageId": "gmail-seed-office-reply", "backend": "gmail", "account": "fixture-letters@pauseai.uk"}'::jsonb FROM seed_proxied
UNION ALL
SELECT id, now() - interval '48 days', 'relayed', '{"from": "\"Testy McTestface MP (via PauseAI)\" <fixture-letters+testy.mctestface.mp@pauseai.uk>", "to": "pat.proxy@example.com", "messageId": "fixture-proxied-relay@pauseai.uk", "gmailMessageId": "gmail-seed-office-reply", "backend": "gmail", "account": "fixture-letters@pauseai.uk"}'::jsonb FROM seed_proxied;
-- Before the reply, the office's acknowledgement, of several paragraphs,
-- kept whole and relayed to her: the letter's page folds it to its first.
INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, from_address, from_name,
  subject, at, from_us, from_supporter, blob_key, size)
SELECT id, 'fixture-letters@pauseai.uk', 'gmail-seed-office-acknowledgement', 'thread-seed-office-acknowledgement',
  'fixture-office-acknowledgement@parliament.example', 'test-mp@parliament.example', 'Testy McTestface MP',
  'Automatic reply: Please back a pause on frontier AI', now() - interval '50 days' + interval '2 minutes',
  false, false, 'fixture/office-acknowledgement.eml.gz', 512
FROM seed_proxied;
INSERT INTO letter_relays (letter_id, reply_id, to_supporter, status, created_at, sent_at, rfc_message_id)
SELECT s.id, r.id, true, 'sent', r.at, r.at, 'fixture-proxied-acknowledgement-relay@pauseai.uk'
FROM seed_proxied s JOIN letter_replies r ON r.letter_id = s.id AND r.gmail_message_id = 'gmail-seed-office-acknowledgement';
INSERT INTO letter_events (letter_id, at, status, details)
SELECT id, now() - interval '50 days' + interval '2 minutes', 'auto_reply', '{"from": "test-mp@parliament.example", "name": "Testy McTestface MP", "to": "fixture-letters+pat.proxy@pauseai.uk", "gmailMessageId": "gmail-seed-office-acknowledgement", "backend": "gmail", "account": "fixture-letters@pauseai.uk"}'::jsonb FROM seed_proxied
UNION ALL
SELECT id, now() - interval '50 days' + interval '2 minutes', 'relayed', '{"from": "\"Testy McTestface MP (via PauseAI)\" <fixture-letters+testy.mctestface.mp@pauseai.uk>", "to": "pat.proxy@example.com", "messageId": "fixture-proxied-acknowledgement-relay@pauseai.uk", "gmailMessageId": "gmail-seed-office-acknowledgement", "backend": "gmail", "account": "fixture-letters@pauseai.uk"}'::jsonb FROM seed_proxied;

-- And Pat's letter to Signy, queued while the letters inbox was at its daily limit.
INSERT INTO proxies (tag, notable_person_id, created_at)
SELECT 'signy.mctestface.mp', id, now() - interval '50 days' FROM politicians WHERE test_postcode = 'ZZ99ZS';
CREATE TEMP TABLE seed_queued ON COMMIT DROP AS SELECT nextval(pg_get_serial_sequence('letters', 'id')) AS id;
INSERT INTO letters (id, kind, notable_person_id, status, created_at) OVERRIDING SYSTEM VALUE
SELECT s.id, 'supporter', p.id, 'queued', now() - interval '50 days' FROM seed_queued s, politicians p WHERE p.test_postcode = 'ZZ99ZS';
INSERT INTO form_entries (id, form, created_at, name, email, address, postcode, contact_consent) OVERRIDING SYSTEM VALUE
SELECT id, 'email-your-mp', now() - interval '50 days', 'Pat Proxy', 'pat.proxy@example.com', '17 Seed Row, Leeds', 'LS1 1AA', true
FROM seed_queued;
INSERT INTO letters_from_supporters (id, entry_id, campaign, subject, proxy_id, letter, draft, draft_approximate, own_words, copy_state)
SELECT s.id, s.id, 'support-sobel-bill', 'Back the Sobel bill', (SELECT id FROM proxies WHERE tag = 'pat.proxy'),
  '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Dear Ms McTestface, please back the bill. Pat Proxy"}]}]}',
  'Dear Ms McTestface, please back the bill. Pat Proxy', true, 0, 'queued'
FROM seed_queued s;
INSERT INTO letter_events (letter_id, at, status, details) SELECT id, now() - interval '50 days', 'queued', '{"reason": "daily_limit"}' FROM seed_queued;

-- --------------------------------------------- letters from Airtable

-- Letters supporters sent through pauseai.info's old form, as they were
-- copied from Airtable: to the letter to the PM, with
-- consent; to the liability letter, before the form asked, so no; and to the
-- DeepMind letter, saying no. No address, and no address of their own.
CREATE TEMP TABLE seed_web_form (airtable_id text, politician text, campaign text, sender text, email text, postcode text, consent boolean, subject text, sent interval) ON COMMIT DROP;
INSERT INTO seed_web_form VALUES
  ('recWebWendyFrontier', 'recPlaceholder', 'pauseai-info-frontier-ai', 'Wendy Webform', 'Wendy.Webform@example.com', 'EC1A 1BB', true, 'Please sign the letter on frontier AI', '31 days'),
  ('recWebWendyLiability', 'recDummy', 'pauseai-info-liability', 'Wendy Webform', 'wendy.webform@example.com', 'EC1A 1BB', false, 'AI companies should be liable', '450 days'),
  ('recWebDee', 'recDeparted', 'pauseai-info-deepmind', 'Dee Deepmind', 'dee.deepmind@example.com', 'M1 1AE', false, 'Dear Sir Demis', '460 days');
CREATE TEMP TABLE seeded_web_form ON COMMIT DROP AS
SELECT nextval(pg_get_serial_sequence('letters', 'id')) AS id, w.* FROM seed_web_form w;
INSERT INTO letters (id, kind, notable_person_id, status, created_at, sent_at) OVERRIDING SYSTEM VALUE
SELECT w.id, 'supporter', n.id, 'sent', now() - w.sent, now() - w.sent + interval '1 minute'
FROM seeded_web_form w JOIN notable_people n ON n.airtable_id = w.politician;
INSERT INTO form_entries (id, form, created_at, name, email, postcode, contact_consent) OVERRIDING SYSTEM VALUE
SELECT w.id, 'web-form', l.created_at, w.sender, w.email, w.postcode, w.consent FROM seeded_web_form w JOIN letters l ON l.id = w.id;
INSERT INTO letters_from_supporters (id, entry_id, campaign, subject, airtable_id)
SELECT w.id, w.id, w.campaign, w.subject, w.airtable_id FROM seeded_web_form w JOIN letters l ON l.id = w.id;
SELECT setval(pg_get_serial_sequence('form_entries', 'id'), (SELECT max(id) FROM form_entries));

-- An upload of paper sign-ups: one person imported, one held back. Forms from
-- five days ago, so the new supporter shows in the dashboard's week.
INSERT INTO signup_uploads (filename, signed_on, note, imported, held_back, uploaded_by, uploaded_at)
VALUES ('flyering.csv', current_date - 5, 'Flyering at Camden Town', 1, 1, 'jo@pauseai.uk', now() - interval '4 days');
WITH entry AS (
  INSERT INTO form_entries (form, created_at, name, email, postcode, contact_consent)
  VALUES ('paper-signup', current_date - 5 + time '12:00', 'Robin Flyer', 'robin.flyer@example.com', 'SE15', true)
  RETURNING id
)
INSERT INTO signup_upload_entries (entry_id, upload_id, new_entry) SELECT id, 1, true FROM entry;

-- ---------------------------------------------------- march sign-ups

-- Sign-ups for the march, as the route keeps them: Ben, who also wrote
-- to his MP, came by the newsletter's link, ticked the box and is on Luma's
-- list; Mo came by no link, didn't tick it, and Luma skipped them. Dana
-- signed up twice with one mobile, so is one supporter with two addresses,
-- each ticking the box; her old one is blocked further down.
WITH entries AS (
  INSERT INTO form_entries (form, created_at, name, email, phone, city, postcode, contact_consent, utm_source) VALUES
    ('march-2026-11', now() - interval '2 days', 'Ben Seed', 'ben.seed@example.com', '07700 900111', 'Bristol', 'BS1 1AA', true, 'nl'),
    ('march-2026-11', now() - interval '1 day', 'Mo March', 'mo.march@example.com', NULL, 'Leeds', NULL, false, NULL),
    ('march-2026-11', now() - interval '4 days', 'Dana Double', 'dana.old@example.com', '07700 900222', 'Leeds', 'LS1 1AA', true, NULL),
    ('march-2026-11', now() - interval '3 days', 'Dana Double', 'dana.double@example.com', '07700 900222', 'Leeds', 'LS1 1AA', true, NULL)
  RETURNING id, email
)
INSERT INTO form_entry_luma (entry_id, event_id, status)
SELECT id, 'evt-hfOj1RR5K1gBNEW', CASE WHEN email LIKE 'mo.%' THEN 'skipped' ELSE 'added' END FROM entries;

-- PauseAI's emails, as they were copied from Airtable's Emails table:
-- one of each mailing, personalised or not, the DeepMind letter's by its title, as it has no box.
CREATE TEMP TABLE seed_emails (airtable_id text, politician text, mailing text, personalised boolean, sent interval) ON COMMIT DROP;
INSERT INTO seed_emails VALUES
  ('recEmailCsrb', 'recDummy', 'CSRB Iqbal Amendment', false, '138 days'),
  ('recEmailEdinburghPolly', 'recPlaceholder', 'Edinburgh Conference Nov 26 Invitation', true, '25 days'),
  ('recEmailEdinburghMorag', 'recMorag', 'Edinburgh Conference Nov 26 Invitation', false, '25 days'),
  ('recEmailBenLake', 'recDummy', 'Ben Lake October 2026 Debate', false, '11 days'),
  ('recEmailDocumentary', 'recDummy', 'Documentary Invitation', false, '420 days'),
  ('recEmailWestminster', 'recPlaceholder', 'Westminster Hall Debate Invitation', true, '390 days'),
  ('recEmailDeepMind', 'recPlaceholder', 'DeepMind letter', true, '470 days');
CREATE TEMP TABLE seeded_emails ON COMMIT DROP AS
SELECT nextval(pg_get_serial_sequence('letters', 'id')) AS id, e.* FROM seed_emails e;
INSERT INTO letters (id, kind, notable_person_id, status, created_at, sent_at) OVERRIDING SYSTEM VALUE
SELECT e.id, 'pauseai', n.id, 'sent', now() - e.sent, now() - e.sent
FROM seeded_emails e JOIN notable_people n ON n.airtable_id = e.politician;
INSERT INTO letters_from_pauseai (id, mailing_id, airtable_id, personalised)
SELECT e.id, m.id, e.airtable_id, e.personalised FROM seeded_emails e
JOIN mailings m ON coalesce(m.airtable_field, m.title) = e.mailing;

-- Mailings written on the site: Jo's draft to the Commons, with a merge
-- field, a part only for those who signed the Frontier AI letter, and a
-- file; one scheduled for three days' time; one sent last week, one letter
-- of it bounced and one replied to.
CREATE TEMP TABLE seed_letter ON COMMIT DROP AS SELECT
  '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Dear "}, {"type": "field", "attrs": {"field": "salutation"}}, {"type": "text", "text": ","}]}, {"type": "onlyFor", "attrs": {"condition": "frontier-ai-letter:signed"}, "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Thank you for signing the letter."}]}]}, {"type": "paragraph", "content": [{"type": "text", "text": "Will you come and meet us?"}]}]}'::jsonb AS body;
INSERT INTO mailings (title, subject, audience, channel, filter, body, created_by, sent_from, from_name, due_at, state, ask, created_at, opened_at)
SELECT m.title, m.title, 'politicians', 'email', m.filter::jsonb, b.body, 'jo@pauseai.uk', m.sent_from, m.from_name, now() + m.due, m.state,
  'edinburgh-conference-2026', least(now(), now() + m.due) - interval '2 days', now() - interval '1 hour'
FROM seed_letter b, (VALUES
  ('Meet us in Westminster', '{"list": "politicians", "params": {"house": "commons"}}', NULL, NULL, NULL::interval, 'draft'),
  ('Edinburgh reminder', '{"list": "politicians", "params": {"nation": "scotland"}}', 'jo@pauseai.uk', 'Jo Seed', interval '3 days', 'scheduled'),
  ('Edinburgh follow-up', '{"list": "politicians", "params": {}}', 'jo@pauseai.uk', 'Jo Seed', interval '-7 days', 'sent')
) m (title, filter, sent_from, from_name, due, state);
INSERT INTO mailing_attachments (mailing_id, filename, content_type, content)
-- A one-page PDF, the smallest a reader draws: "Briefing" on an A4 page.
SELECT id, 'briefing.pdf', 'application/pdf', convert_to($pdf$%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj
4 0 obj <</Length 39>> stream
BT /F1 48 Tf 72 720 Td (Briefing) Tj ET
endstream endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
trailer <</Root 1 0 R>>
%%EOF
$pdf$, 'UTF8') FROM mailings WHERE title = 'Meet us in Westminster';
CREATE TEMP TABLE seed_written ON COMMIT DROP AS
SELECT nextval(pg_get_serial_sequence('letters', 'id')) AS id, m.id AS mailing_id, m.state, m.due_at, m.created_at, n.id AS person,
  -- By name: Morag first, then Dora, then Polly.
  n.salutation, n.name, row_number() OVER (PARTITION BY m.id ORDER BY n.name) AS n
FROM mailings m JOIN notable_people n ON n.airtable_id IN ('recDummy', 'recPlaceholder', 'recMorag')
WHERE m.title IN ('Edinburgh reminder', 'Edinburgh follow-up');
INSERT INTO letters (id, kind, notable_person_id, status, created_at, sent_at, replied_at) OVERRIDING SYSTEM VALUE
SELECT w.id, 'pauseai', w.person,
  CASE WHEN w.state = 'scheduled' THEN 'scheduled' WHEN w.n = 1 THEN 'bounced' ELSE 'sent' END,
  w.created_at, CASE WHEN w.state = 'sent' THEN w.due_at END,
  CASE WHEN w.state = 'sent' AND w.n = 3 THEN w.due_at + interval '1 day' END
FROM seed_written w;
INSERT INTO letters_from_pauseai (id, mailing_id, merge_values)
SELECT w.id, w.mailing_id, json_build_object('values', json_build_object('salutation', w.salutation, 'name', w.name), 'meets', '[]'::json)
FROM seed_written w;
-- The follow-up went from Jo's Gmail: each letter's send, with its
-- Message-ID and thread; Morag's bounced, as Jo's mailbox showed, and Polly
-- answered hers, the reply kept whole (lib/server/fixtures/letter-replies/).
INSERT INTO email_sends (at, purpose, letter_id, address, outcome, message_id, backend, sender, rfc_message_id, gmail_thread_id)
SELECT w.due_at, 'mailing', w.id, lower(n.email), 'sent', 'gmail-seed-' || w.n, 'gmail', 'jo@pauseai.uk',
  'fixture-letter-' || w.n || '@pauseai.uk', 'thread-seed-' || w.n
FROM seed_written w JOIN notable_people n ON n.id = w.person WHERE w.state = 'sent';
SELECT setval(pg_get_serial_sequence('email_problems', 'id'), (SELECT max(id) FROM email_problems));
INSERT INTO email_problems (at, address, message_id, kind, reason, can_reset, gmail_message_id)
SELECT w.due_at + interval '5 minutes', lower(n.email), 'gmail-seed-1', 'soft',
  '452 4.2.2 The recipient''s inbox is out of storage space.', true, 'gmail-seed-bounce'
FROM seed_written w JOIN notable_people n ON n.id = w.person WHERE w.state = 'sent' AND w.n = 1;
INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, from_address, from_name,
  subject, at, from_us, blob_key, size)
SELECT w.id, 'jo@pauseai.uk', 'gmail-seed-reply', 'thread-seed-3', 'fixture-polly-thanks@example.org', lower(n.email), n.name,
  'Re: Edinburgh follow-up', w.due_at + interval '1 day', false, 'fixture/polly-thanks.eml.gz', 512
FROM seed_written w JOIN notable_people n ON n.id = w.person WHERE w.state = 'sent' AND w.n = 3;
-- What happened to each, as sending and reading Jo's Gmail record it: in
-- the mailing sent, sent, and the bounce and the reply.
INSERT INTO letter_events (letter_id, at, status, details)
SELECT id, due_at, 'sent', jsonb_build_object('from', 'jo@pauseai.uk', 'to', (SELECT lower(email) FROM letters l JOIN notable_people p ON p.id = l.notable_person_id WHERE l.id = seed_written.id), 'messageId', 'fixture-letter-' || n || '@pauseai.uk',
  'threadId', 'thread-seed-' || n)
FROM seed_written WHERE state = 'sent';
INSERT INTO letter_events (letter_id, at, status, details)
SELECT w.id, w.due_at + interval '5 minutes', 'bounced', jsonb_build_object('status', '4.2.2', 'account', 'jo@pauseai.uk',
  'reason', '452 4.2.2 The recipient''s inbox is out of storage space.', 'email', lower(n.email))
FROM seed_written w JOIN notable_people n ON n.id = w.person WHERE w.state = 'sent' AND w.n = 1;
INSERT INTO letter_events (letter_id, at, status, details)
SELECT w.id, w.due_at + interval '1 day', 'replied', jsonb_build_object('from', lower(n.email), 'name', n.name,
  'gmailMessageId', 'gmail-seed-reply')
FROM seed_written w JOIN notable_people n ON n.id = w.person WHERE w.state = 'sent' AND w.n = 3;

-- A mailing stopped part-way, with no ask, with every way a letter can
-- fail: one sent; three skipped, as he'd left office, he had no address,
-- and his address was blocked; one Gmail refused; and one never sent, as
-- the mailing was stopped first.
INSERT INTO mailings (title, subject, audience, channel, filter, body, created_by, sent_from, from_name, due_at, state, created_at)
SELECT 'Briefing on the bill', 'Briefing on the bill', 'politicians', 'email', '{"list": "politicians", "params": {}}', b.body,
  'jo@pauseai.uk', 'jo@pauseai.uk', 'Jo Seed', now() - interval '4 days', 'cancelled', now() - interval '6 days'
FROM seed_letter b;
CREATE TEMP TABLE seed_stopped ON COMMIT DROP AS
SELECT nextval(pg_get_serial_sequence('letters', 'id')) AS id, n.id AS person, n.salutation, n.name, s.status, s.reason
FROM (VALUES
  ('recMo', 'sent', NULL),
  ('recGone', 'skipped', 'left-office'),
  ('recSeedWilliam', 'skipped', 'no-email'),
  ('recSeedDafydd', 'skipped', 'blocked'),
  ('recSeedSian', 'not_sent', NULL),
  ('recSeedBaroness', 'cancelled', NULL)
) s (airtable_id, status, reason) JOIN notable_people n USING (airtable_id);
INSERT INTO letters (id, kind, notable_person_id, status, created_at, sent_at) OVERRIDING SYSTEM VALUE
SELECT id, 'pauseai', person, status, now() - interval '6 days', CASE WHEN status = 'sent' THEN now() - interval '4 days' END
FROM seed_stopped;
INSERT INTO letters_from_pauseai (id, mailing_id, merge_values, skip_reason)
SELECT s.id, m.id, json_build_object('values', json_build_object('salutation', s.salutation, 'name', s.name), 'meets', '[]'::json), s.reason
FROM seed_stopped s JOIN mailings m ON m.title = 'Briefing on the bill';
INSERT INTO letter_events (letter_id, at, status, details)
SELECT id, now() - interval '4 days', CASE status WHEN 'not_sent' THEN 'failed' ELSE status END,
  CASE WHEN reason IS NULL THEN '{}' ELSE jsonb_build_object('reason', reason) END
FROM seed_stopped WHERE status <> 'cancelled';

-- A broadcast to supporters, by email, to those following the calendar,
-- sent last week. Its copies are with the other broadcasts', at the end.
INSERT INTO mailings (title, subject, audience, channel, topic, filter, body, created_by, sent_from, from_name, due_at, state, created_at)
SELECT 'Events this month', 'Events this month', 'supporters', 'email', 'events',
  '{"list": "supporters", "params": {"contact": "email:events:yes"}}',
  '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hi "}, {"type": "field", "attrs": {"field": "firstName"}}, {"type": "text", "text": ","}]}, {"type": "paragraph", "content": [{"type": "text", "text": "Here''s what''s on this month: a talk in Leeds on the 12th, and flyering in London on the 20th. Come along to either."}]}, {"type": "paragraph", "content": [{"type": "text", "text": "PauseAI UK"}]}]}',
  'jo@pauseai.uk', 'hello@pauseai.uk', 'PauseAI UK', now() - interval '6 days 2 hours', 'sent', now() - interval '8 days 2 hours';

-- ---------------------------------------------------------- import log

-- Every job, in every state: Luma runs hourly, stopping short in each way;
-- syncs from when only MPs were read, applied by themselves, held then
-- discarded, held then applied; politician syncs unchanged, applied with
-- statuses, and one held now, changing more politicians than a sync may
-- unchecked and renaming one; checks with and without problems; ControlAI
-- reads, one failed; and the signatory import, once.
INSERT INTO import_runs (at, job, started_by, status, error, result, decided_by) VALUES
  (now() - interval '3 days', 'import-luma', 'nightly', 'ok', NULL, '{"events": 12, "eventsSynced": 8, "eventsLeft": 4, "guestsChanged": 40, "people": 18, "contacts": 9, "supportersAdded": 15, "linked": 20, "requests": 150, "stoppedBy": "rate-limit"}', NULL),
  (now() - interval '2 days', 'import-luma', 'nightly', 'ok', NULL, '{"events": 0, "eventsSynced": 4, "eventsLeft": 0, "guestsChanged": 6, "people": 2, "contacts": 1, "supportersAdded": 2, "linked": 2, "requests": 60, "stoppedBy": "time"}', NULL),
  (now() - interval '2 days' + interval '1 minute', 'import-luma', 'jo@pauseai.uk', 'unchanged', NULL, '{"events": 0, "eventsSynced": 0, "eventsLeft": 0, "guestsChanged": 0, "people": 0, "contacts": 0, "supportersAdded": 0, "linked": 0, "requests": 0, "stoppedBy": "running"}', NULL),
  (now() - interval '1 day', 'import-luma', 'nightly', 'failed', 'Luma answered 500', '{}', NULL),
  (now() - interval '1 hour', 'import-luma', 'nightly', 'ok', NULL, '{"events": 1, "eventsSynced": 1, "eventsLeft": 0, "guestsChanged": 2, "people": 1, "contacts": 0, "supportersAdded": 1, "linked": 1, "requests": 5}', NULL),
  (now() - interval '20 days', 'sync-politicians', 'nightly', 'applied', NULL, '{"changes": {"added": [], "removed": [{"airtableId": "recGone", "name": "Gordon Gone", "salutation": "Mr Gone", "constituency": "Former Seat", "party": "Independent", "email": "gordon.gone.mp@parliament.uk"}], "changed": []}, "mps": []}', NULL),
  (now() - interval '19 days', 'sync-politicians', 'nightly', 'discarded', NULL, '{"changes": {"added": [], "removed": [{"airtableId": "recGone", "name": "Gordon Gone", "salutation": "Mr Gone", "constituency": "Former Seat", "party": "Independent", "email": "gordon.gone.mp@parliament.uk"}], "changed": []}}', 'jo@pauseai.uk'),
  (now() - interval '18 days', 'sync-politicians', 'jo@pauseai.uk', 'applied', NULL, '{"changes": {"added": [], "removed": [{"airtableId": "recGone", "name": "Gordon Gone", "salutation": "Mr Gone", "constituency": "Former Seat", "party": "Independent", "email": "gordon.gone.mp@parliament.uk"}], "changed": []}}', 'admin@pauseai.uk'),
  (now() - interval '1 day' + interval '1 hour', 'sync-politicians', 'nightly', 'unchanged', NULL, '{"changes": {"added": [], "removed": [], "changed": []}, "renamed": [], "statuses": {"added": 0, "changed": 0, "removed": 0}}', NULL),
  (now() - interval '6 days', 'sync-politicians', 'nightly', 'applied', NULL, '{"changes": {"added": [], "removed": [{"airtableId": "recRemoved", "name": "Rob Removed", "salutation": "Mr Removed", "email": "rob.removed.mp@parliament.uk", "status": "in_office", "house": "commons", "constituency": "Removed Seat", "party": "Example Party", "country": "england", "notes": "", "importantTarget": false, "personalConnection": false}], "changed": []}, "renamed": [], "statuses": {"added": 2, "changed": 1, "removed": 0}}', NULL),
  (now() - interval '1 hour' + interval '5 minutes', 'sync-politicians', 'nightly', 'held', NULL, jsonb_set('{"renamed": [{"airtableId": "recPlaceholder", "from": "Polly Placeholder", "to": "Pauline Placeholder"}], "statuses": {"added": 0, "changed": 0, "removed": 0}, "records": [], "changes": {"added": [{"airtableId": "recNew", "name": "Nina New", "salutation": "Ms New", "constituency": "New Seat", "party": "Green", "email": "nina.new.mp@parliament.uk"}], "removed": [], "changed": [{"airtableId": "recPlaceholder", "name": "Polly Placeholder", "salutation": "Ms Placeholder", "constituency": "Cities of London and Westminster", "party": "Labour (Co-op)", "email": "polly.placeholder@parliament.uk"}]}}'::jsonb, '{changes,removed}', (SELECT jsonb_agg(jsonb_build_object('airtableId', 'recSeedGone' || n, 'name', 'Gone McSeed ' || n || ' MP', 'salutation', '', 'constituency', 'Seed Seat ' || n, 'party', '', 'email', NULL) ORDER BY n) FROM generate_series(1, 22) n)), NULL),
  (now() - interval '2 days' + interval '1 hour', 'check-mps', 'nightly', 'ok', NULL, '{"problems": []}', NULL),
  (now() - interval '1 day' + interval '1 hour', 'check-mps', 'nightly', 'ok', NULL, '{"problems": [{"kind": "email", "constituency": "Cities of London and Westminster", "name": "Polly Placeholder", "airtable": "polly.placeholder.mp@parliament.uk", "parliament": ["polly.placeholder@parliament.uk"]}, {"kind": "missing", "constituency": "New Seat", "parliament": "Nina New"}]}', NULL),
  (now() - interval '2 days' + interval '2 hours', 'import-controlai', 'nightly', 'ok', NULL, '{"pdfUrl": "https://images.controlai.com/letter.pdf", "signatories": 86, "matched": 74, "added": 1, "removed": 0, "problems": [{"name": "Baroness Nobody", "kind": "nobody", "candidates": []}]}', NULL),
  (now() - interval '1 day' + interval '2 hours', 'import-controlai', 'nightly', 'failed', 'No PDF linked from the letter page', '{}', NULL),
  -- CiviCRM's first pull, Kit's unsubscribe and Gil leaving the chapter the next day, then nothing new.
  (now() - interval '2 days', 'import-civicrm', 'nightly', 'ok', NULL, '{"contacts": 11, "added": 11, "changed": 0, "gone": 0, "optOuts": 0, "blocked": 1}', NULL),
  (now() - interval '1 day', 'import-civicrm', 'nightly', 'ok', NULL, '{"contacts": 10, "added": 0, "changed": 1, "gone": 1, "optOuts": 1, "blocked": 0}', NULL),
  (now() - interval '1 hour' + interval '30 minutes', 'import-civicrm', 'nightly', 'unchanged', NULL, '{"contacts": 10, "added": 0, "changed": 0, "gone": 0, "optOuts": 0, "blocked": 0}', NULL),
  (now() - interval '2 hours' + interval '20 minutes', 'read-gmail', 'nightly', 'ok', NULL, '{"accounts": [{"account": "mailings@pauseai.uk", "replies": 1, "autoReplies": 2, "bounces": 0}]}', NULL),
  (now() - interval '1 hour' + interval '20 minutes', 'read-gmail', 'nightly', 'unchanged', NULL, '{"accounts": [{"account": "mailings@pauseai.uk", "replies": 0, "autoReplies": 0, "bounces": 0}]}', NULL),
  -- The newest read found mail in the letters inbox it couldn't handle, which the dashboard shows.
  (now() - interval '30 minutes', 'read-gmail', 'nightly', 'ok', NULL, '{"accounts": [{"account": "mailings@pauseai.uk", "replies": 0, "autoReplies": 0, "bounces": 0}, {"account": "fixture-letters@pauseai.uk", "replies": 1, "autoReplies": 0, "bounces": 0, "relayed": 1, "spam": 1, "uncertain": 0, "notUnderstood": [{"gmailMessageId": "18c0ffee00000001", "from": "stranger@example.com", "subject": "Hello", "reason": "stranger"}]}]}', NULL);

-- The held sync keeps every record, as it read them: those here, with
-- Airtable's statuses, and Nina New, so applying it changes only what it
-- says.
UPDATE import_runs SET result = jsonb_set(result, '{records}', (
  SELECT jsonb_agg(r) FROM (
    SELECT jsonb_build_object(
      'politician', jsonb_build_object('airtableId', n.airtable_id, 'name', n.name, 'salutation', n.salutation, 'email', n.email, 'status', n.status, 'house', p.house,
        'constituency', p.constituency, 'party', p.party, 'country', p.country, 'notes', n.notes,
        'importantTarget', n.important_target, 'personalConnection', n.personal_connection),
      'statuses', coalesce((SELECT jsonb_object_agg(s.ask, s.status) FROM ask_statuses s
        WHERE s.notable_person_id = n.id AND s.updated_by = 'airtable' AND s.ask <> 'go-to-parliament-oct-2026'), '{}')) AS r
    FROM notable_people n JOIN politicians p USING (id) WHERE n.airtable_id IS NOT NULL AND n.airtable_removed_at IS NULL
    UNION ALL
    SELECT '{"politician": {"airtableId": "recNew", "name": "Nina New", "salutation": "Ms New", "email": "nina.new.mp@parliament.uk", "status": "in_office", "house": "commons", "constituency": "New Seat", "party": "Green", "country": "england", "notes": "", "importantTarget": false, "personalConnection": false}, "statuses": {}}'::jsonb
  ) records))
WHERE job = 'sync-politicians' AND status = 'held';

-- ------------------------------------------------------------ audit log

-- Who did what, as the staff pages and the jobs log it: every kind of entry.
INSERT INTO audit_log (at, actor, action, details) VALUES
  (now() - interval '60 days', 'sync', 'add politician', '{"id": 0, "airtableId": "recDummy", "house": "commons", "name": "Ms Dora Dummy", "salutation": "Ms Dummy", "constituency": "Hackney North and Stoke Newington", "party": "Labour", "email": "mp90001.office@parliament.uk"}'),
  (now() - interval '60 days', 'sync', 'add politician', '{"id": 0, "airtableId": "recPlaceholder", "house": "commons", "name": "Polly Placeholder", "salutation": "Ms Placeholder", "constituency": "Cities of London and Westminster", "party": "Labour (Co-op)", "email": "polly.placeholder.mp@parliament.uk"}'),
  (now() - interval '60 days', 'sync', 'add politician', '{"id": 0, "airtableId": "recGone", "house": "commons", "name": "Gordon Gone", "salutation": "Mr Gone", "constituency": "Former Seat", "party": "Independent", "email": "gordon.gone.mp@parliament.uk"}'),
  (now() - interval '60 days', 'sync', 'apply MP sync', '{"added": 3, "removed": 0, "changed": 0}'),
  (now() - interval '100 days', 'admin@pauseai.uk', 'add staff account', '{"email": "jo@pauseai.uk", "to": ["supporters"]}'),
  (now() - interval '100 days', 'admin@pauseai.uk', 'add staff account', '{"email": "samuel.whitlock@pauseai.uk", "to": []}'),
  (now() - interval '40 days', 'admin@pauseai.uk', 'add staff account', '{"email": "gone@pauseai.uk", "to": []}'),
  (now() - interval '30 days', 'admin@pauseai.uk', 'add politician', '{"id": 0, "house": "lords", "name": "Lord Seedling of Example", "constituency": null, "party": "Crossbench", "email": null}'),
  (now() - interval '30 days', 'admin@pauseai.uk', 'import signatories from Airtable', '{"matched": 2, "added": 1, "alreadySet": 0}'),
  (now() - interval '25 days', 'admin@pauseai.uk', 'remove staff account', '{"email": "gone@pauseai.uk", "permissions": []}'),
  (now() - interval '20 days', 'sync', 'apply MP sync', '{"added": 0, "removed": 1, "changed": 0}'),
  (now() - interval '19 days', 'jo@pauseai.uk', 'discard held MP sync', '{"id": 7}'),
  (now() - interval '18 days', 'sync', 'remove politician', '{"id": 0, "name": "Gordon Gone"}'),
  (now() - interval '18 days', 'admin@pauseai.uk', 'apply held MP sync', '{"id": 8}'),
  (now() - interval '10 days', 'controlai', 'import ControlAI letter', '{"added": 1, "removed": 0, "problems": 1}'),
  (now() - interval '10 days', 'controlai', 'set status', '{"politicianId": 0, "ask": "controlai-letter", "status": "signed", "date": "2026-09-11", "note": ""}'),
  (now() - interval '9 days', 'sync', 'edit politician', '{"id": 0, "airtableId": "recPlaceholder", "house": "commons", "name": "Polly Placeholder", "salutation": "Ms Placeholder", "constituency": "Cities of London and Westminster", "party": "Labour (Co-op)", "email": "polly.placeholder.mp@parliament.uk"}'),
  (now() - interval '15 days', 'jo@pauseai.uk', 'erase supporter', '{"id": 99, "reference": "GDPR-2026-014", "letters": 1, "lumaUsers": 1, "members": 1}'),
  (now() - interval '12 days', 'samuel.whitlock@pauseai.uk', 'edit politician', '{"id": 0, "house": "lords", "name": "Lord Seedling of Example", "salutation": "Lord Seedling", "constituency": null, "party": "Crossbench", "email": null}'),
  (now() - interval '12 days' + interval '1 minute', 'postmark', 'block address', '{"address": "no-such-mailbox@pauseai.uk", "kind": "hard"}'),
  (now() - interval '9 days', 'postmark', 'block address', '{"address": "gordon.gone.mp@parliament.uk", "kind": "hard"}'),
  (now() - interval '6 days', 'admin@pauseai.uk', 'add staff account', '{"email": "policy@pauseai.uk", "to": []}'),
  (now() - interval '5 days' + interval '3 hours', 'postmark', 'block address', '{"address": "rob.removed.mp@parliament.uk", "kind": "complaint"}'),
  (now() - interval '4 days', 'admin@pauseai.uk', 'set staff permissions', '{"email": "samuel.whitlock@pauseai.uk", "from": [], "to": []}'),
  (now() - interval '3 days', 'jo@pauseai.uk', 'view supporter', '{"id": 1}'),
  (now() - interval '3 days', 'jo@pauseai.uk', 'set status', '{"politicianId": 0, "ask": "controlai-letter", "status": "signed", "date": null, "note": ""}'),
  (now() - interval '2 days', 'samuel.whitlock@pauseai.uk', 'set status', '{"politicianId": 0, "ask": "frontier-ai-letter", "status": "signed", "date": null, "note": ""}'),
  (now() - interval '4 days', 'postmark', 'block address', '{"address": "polly.placeholder.mp@parliament.uk", "kind": "hard"}'),
  (now() - interval '2 days' + interval '1 hour', 'jo@pauseai.uk', 'unblock address', '{"address": "polly.placeholder.mp@parliament.uk", "note": "Mailbox working again, their office says"}'),
  (now() - interval '1 day', 'jo@pauseai.uk', 'set status', '{"politicianId": 0, "ask": "frontier-ai-letter", "status": "signed", "date": null, "note": "Confirmed by their office"}'),
  (now() - interval '1 day' + interval '2 hours', 'nightly', 'import ControlAI letter', '{"error": "No PDF linked from the letter page"}'),
  (now() - interval '2 hours', 'jo@pauseai.uk', 'view supporter', '{"id": 4}'),
  (now() - interval '6 days', 'sync', 'apply politician sync', '{"added": 0, "removed": 1, "changed": 0}'),
  (now() - interval '6 days', 'sync', 'remove politician', '{"id": 0, "name": "Rob Removed"}'),
  (now() - interval '1 hour' + interval '5 minutes', 'sync', 'hold politician sync', '{"added": 1, "removed": 22, "changed": 1}'),
  (now() - interval '20 days', 'airtable', 'set status', '{"politicianId": 0, "ask": "edinburgh-conference-2026", "status": "declined", "date": null, "note": ""}'),
  (now() - interval '20 days', 'airtable', 'set status', '{"politicianId": 0, "ask": "controlai-statement", "status": "signed", "date": "2025-02-06", "note": ""}'),
  (now() - interval '5 days', 'admin@pauseai.uk', 'import web form letters', '{"imported": 3, "skipped": 3, "alreadyHere": 1, "noPolitician": 1}'),
  (now() - interval '1 day' + interval '1 hour' + interval '1 minute', 'sync', 'copy PauseAI emails', '{"added": 4}');
-- The entries about a politician name their row.
UPDATE audit_log a SET details = jsonb_set(a.details, '{id}', to_jsonb(p.id)) FROM notable_people p
  WHERE a.action IN ('add politician', 'edit politician', 'remove politician') AND p.name = a.details->>'name';
UPDATE audit_log SET details = jsonb_set(details, '{politicianId}', to_jsonb((SELECT id FROM notable_people WHERE name = 'Lord Seedling of Example'))) WHERE action = 'set status' AND actor = 'controlai';
UPDATE audit_log SET details = jsonb_set(details, '{politicianId}', to_jsonb((SELECT id FROM politicians WHERE test_postcode = 'ZZ99ZZ'))) WHERE action = 'set status' AND details->>'ask' = 'controlai-letter' AND actor = 'jo@pauseai.uk';
UPDATE audit_log SET details = jsonb_set(details, '{politicianId}', to_jsonb((SELECT id FROM notable_people WHERE airtable_id = 'recDummy'))) WHERE action = 'set status' AND details->>'note' = '' AND actor = 'samuel.whitlock@pauseai.uk';
UPDATE audit_log SET details = jsonb_set(details, '{politicianId}', to_jsonb((SELECT id FROM politicians WHERE test_postcode = 'ZZ99ZH'))) WHERE action = 'set status' AND details->>'note' = 'Confirmed by their office';
UPDATE audit_log SET details = jsonb_set(details, '{politicianId}', to_jsonb((SELECT id FROM notable_people WHERE airtable_id = 'recPlaceholder'))) WHERE action = 'set status' AND actor = 'airtable';

-- ----------------------------------------------------------- supporters

-- One supporter per email, linked to everything with that email, as the
-- matcher makes them; created when their first record was: for a Luma
-- person, following the calendar, else their first registration or event
-- hosted. Fewer arrived the week before last than in the last week.
WITH emails AS (
  SELECT email, coalesce(contact_since, least(
    (SELECT min(g.registered_at) FROM luma_guests g WHERE g.user_id = p.user_id),
    (SELECT min(coalesce(e.created_at, e.first_seen_at)) FROM luma_event_hosts h JOIN luma_events e ON e.id = h.event_id WHERE h.user_id = p.user_id)
  )) AS first_seen FROM luma_people p
  UNION ALL
  SELECT lower(trim(email)), created_at FROM form_entries
  UNION ALL
  SELECT email, civicrm_joined_at(joined_date, first_seen_at) FROM civicrm_contacts
), firsts AS (
  SELECT email, min(first_seen) AS first_seen FROM emails GROUP BY email
), made AS (
  INSERT INTO supporters (created_at) SELECT first_seen FROM firsts ORDER BY first_seen, email RETURNING id, created_at
), keyed AS (
  SELECT m.id, f.email FROM (SELECT id, created_at, row_number() OVER (ORDER BY created_at, id) AS n FROM made) m
  JOIN (SELECT email, first_seen, row_number() OVER (ORDER BY first_seen, email) AS n FROM firsts) f USING (n)
), luma_links AS (
  INSERT INTO supporter_links (supporter_id, luma_user_id, matched_by, matched_value, linked_at)
  SELECT k.id, p.user_id, 'email', k.email, now() - interval '1 hour' FROM keyed k JOIN luma_people p ON p.email = k.email
), civicrm_links AS (
  INSERT INTO supporter_links (supporter_id, civicrm_contact_id, matched_by, matched_value, linked_at)
  SELECT k.id, c.contact_id, 'email', k.email, c.first_seen_at FROM keyed k JOIN civicrm_contacts c ON c.email = k.email
)
INSERT INTO supporter_links (supporter_id, form_entry_id, matched_by, matched_value, linked_at)
SELECT k.id, f.id, 'email', k.email, f.created_at FROM keyed k JOIN form_entries f ON lower(trim(f.email)) = k.email;

-- Then those who gave the same UK mobile number are one, as the matcher
-- merges them; and Jane Fixture was once two, the other's ID long gone.
SELECT count(*) FROM merge_supporters_by_phone();
INSERT INTO supporter_merges (from_id, into_id, merged_at)
SELECT (SELECT max(id) + 1000 FROM supporters), k.supporter_id, now() - interval '20 days'
FROM supporter_links k WHERE k.luma_user_id = 'usr-fixture-1';

-- Each supporter's first seen, as refreshSupporterFacts() (lib/server/supporter-facts.ts) sets it after linking.
UPDATE supporters s SET first_seen_at = f.first_seen_at FROM supporter_first_seen f WHERE f.supporter_id = s.id;

-- Erin, erased, as eraseSupporter() (lib/server/erasure.ts) leaves it: her
-- supporter goes, and her Luma person with their registration; her
-- opt-out stays. The audit log's entry has her ID.
UPDATE audit_log SET details = jsonb_set(details, '{id}', to_jsonb(k.supporter_id))
FROM supporter_links k WHERE action = 'erase supporter' AND k.luma_user_id = 'usr-seed-20';
DELETE FROM supporters WHERE id = (SELECT supporter_id FROM supporter_links WHERE luma_user_id = 'usr-seed-20');
DELETE FROM luma_people WHERE user_id = 'usr-seed-20';

-- A saved filter on each list, one Samuel's.
INSERT INTO saved_filters (list, name, params, created_by, created_at) VALUES
  ('politicians', 'Labour in the Commons', '{"house": "commons", "party": "Labour"}', 'jo@pauseai.uk', now() - interval '2 days'),
  ('supporters', 'Near Leeds', '{"near": "Leeds", "within": "25"}', 'samuel.whitlock@pauseai.uk', now() - interval '5 days'),
  ('events', 'Past online events', '{"when": "past", "tag": "Online"}', 'jo@pauseai.uk', now() - interval '9 days');

-- Notes: two on Jane, one Jo's from an hour ago, with a link, which she can
-- still change, and Samuel's, edited; and one on Polly, from last week.
INSERT INTO notes (supporter_id, body, written_by, created_at, edited_at)
SELECT k.supporter_id, n.body, n.written_by, n.created_at, n.edited_at
FROM supporter_links k, (VALUES
  ('Met her at the London march. Slides from her talk: https://example.org/slides/london', 'jo@pauseai.uk',
   now() - interval '1 hour', NULL::timestamptz),
  ('Happy to flyer on Saturdays.', 'samuel.whitlock@pauseai.uk', now() - interval '3 days', now() - interval '3 days' + interval '10 minutes')
) n (body, written_by, created_at, edited_at)
WHERE k.luma_user_id = 'usr-fixture-1';
INSERT INTO notes (notable_person_id, body, written_by, created_at)
SELECT id, 'Her office says write to www.example.org/contact', 'jo@pauseai.uk', now() - interval '8 days'
FROM notable_people WHERE airtable_id = 'recPlaceholder';

-- A mailing to politicians sending, a third of the way: one of its three
-- letters sent, two to go. It goes from Jo's Gmail, which isn't connected
-- here, so the hourly job leaves it as it is. After every mailing a route's example names, so none of those IDs moves.
INSERT INTO mailings (title, subject, audience, channel, filter, body, created_by, sent_from, from_name, due_at, state, ask, created_at, opened_at)
SELECT 'Edinburgh: last call', 'Edinburgh: last call', 'politicians', 'email', '{"list": "politicians", "params": {}}'::jsonb, b.body,
  'jo@pauseai.uk', 'jo@pauseai.uk', 'Jo Seed', now() - interval '2 hours', 'sending', 'edinburgh-conference-2026',
  now() - interval '1 day', now() - interval '3 hours'
FROM seed_letter b;
CREATE TEMP TABLE seed_sending ON COMMIT DROP AS
SELECT nextval(pg_get_serial_sequence('letters', 'id')) AS id, m.id AS mailing_id, m.due_at, n.id AS person,
  n.salutation, n.name, row_number() OVER (ORDER BY n.name) AS n
FROM mailings m JOIN notable_people n ON n.airtable_id IN ('recDummy', 'recPlaceholder', 'recMorag')
WHERE m.title = 'Edinburgh: last call';
INSERT INTO letters (id, kind, notable_person_id, status, created_at, sent_at) OVERRIDING SYSTEM VALUE
SELECT s.id, 'pauseai', s.person, CASE WHEN s.n = 1 THEN 'sent' ELSE 'scheduled' END, s.due_at - interval '1 day',
  CASE WHEN s.n = 1 THEN s.due_at END
FROM seed_sending s;
INSERT INTO letters_from_pauseai (id, mailing_id, merge_values)
SELECT s.id, s.mailing_id, json_build_object('values', json_build_object('salutation', s.salutation, 'name', s.name), 'meets', '[]'::json)
FROM seed_sending s;
INSERT INTO letter_events (letter_id, at, status, details)
SELECT id, due_at, 'sent', jsonb_build_object('from', 'jo@pauseai.uk') FROM seed_sending WHERE n = 1;

-- Each mailing written here that has letters went to the politicians ticked
-- on the list, so it's to exactly those its letters are to.
UPDATE mailings m SET filter = m.filter || jsonb_build_object('picked', jsonb_build_object('ids',
    (SELECT jsonb_agg(l.notable_person_id ORDER BY l.notable_person_id) FROM letters_from_pauseai f JOIN letters l USING (id) WHERE f.mailing_id = m.id)))
WHERE m.audience = 'politicians' AND m.body IS NOT NULL AND EXISTS (SELECT 1 FROM letters_from_pauseai f WHERE f.mailing_id = m.id);

-- ------------------------------------------------- the old letters' text

-- What was kept of the letters written before the site could send them,
-- one of each: a form letter's text, its draft the form's version live then,
-- as each band of own words; a Postmark letter's from its copy; and the emails
-- that went, tagged imported. Their mailings, with their templates, are
-- below. Last, so no ID above moves.
UPDATE letters_from_supporters SET
  letter = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Dear Ms Placeholder"}]},{"type":"paragraph","content":[{"type":"text","text":"I am a resident of Cities of London and Westminster and a supporter of PauseAI."}]},{"type":"paragraph","content":[{"type":"text","text":"I wrote this bit myself, as I worry about my children."}]},{"type":"paragraph","content":[{"type":"text","text":"Wendy Webform"}]}]}',
  draft = E'Dear Ms Placeholder\n\nI am a resident of Cities of London and Westminster and a supporter of PauseAI.\n\nWendy Webform',
  draft_approximate = false, own_words = 0.4
WHERE airtable_id = 'recWebWendyFrontier';
UPDATE letters_from_supporters SET
  letter = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Dear Ms Dummy"}]},{"type":"paragraph","content":[{"type":"text","text":"Please hold AI companies liable."}]},{"type":"paragraph","content":[{"type":"text","text":"Wendy Webform"}]}]}',
  draft = E'Dear Ms Dummy\n\nPlease hold AI companies liable.\n\nWendy Webform',
  draft_approximate = false, own_words = 0
WHERE airtable_id = 'recWebWendyLiability';
UPDATE letters_from_supporters SET
  letter = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Please, Lord Seedling, sign. I have thought hard about this, and I write as a parent, a teacher and a voter who has never written before."}]}]}',
  draft = E'Dear Lord Seedling\n\nWould you be willing to co-sign an open letter?\n\nDee Deepmind',
  draft_approximate = false, own_words = 0.9
WHERE airtable_id = 'recWebDee';
-- A form letter's email, as Joseph's mailbox had it, and an automatic reply to one.
INSERT INTO email_sends (at, purpose, letter_id, address, outcome, message_id, backend, sender, rfc_message_id, gmail_thread_id, subject, from_address, imported)
SELECT l.sent_at, 'letter', s.id, lower(n.email), 'sent', 'gmail-old-form-' || s.id, 'gmail', 'joseph@pauseai.uk', 'old-form-' || s.id || '@mail.gmail.com', 'thread-old-form-' || s.id, s.subject, 'joseph@pauseai.uk', true
FROM letters_from_supporters s JOIN letters l USING (id) JOIN notable_people n ON n.id = l.notable_person_id
WHERE s.airtable_id IN ('recWebWendyFrontier', 'recWebWendyLiability') AND n.email IS NOT NULL;
INSERT INTO letter_events (letter_id, at, status, details)
SELECT s.id, l.sent_at + interval '1 minute', 'auto_reply', jsonb_build_object('from', lower(n.email), 'gmailMessageId', 'gmail-old-auto')
FROM letters_from_supporters s JOIN letters l USING (id) JOIN notable_people n ON n.id = l.notable_person_id
WHERE s.airtable_id = 'recWebWendyLiability';

-- A Postmark letter's text, from its copy Bcc'd to the policy inbox.
UPDATE letters_from_supporters SET letter = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Dear MP, please back the bill. This is the letter as Postmark sent it."}]}]}'
WHERE id = (SELECT min(id) FROM letters_from_supporters WHERE postmark_mailbox IS NOT NULL);

-- The old letters' mailings, each kind of text: one of a
-- template, with one letter that fits and one that doesn't; one each its own;
-- and August's, from the send before and earlier letters, approximate, with no sent email.
INSERT INTO mailings (title, subject, ask, airtable_sent_between, audience, channel, state, sent_from, old_letters_key, imported_text, imported_text_approximate) VALUES
  ('DeepMind: join 25 of your colleagues', 'Request to co-sign letter on Google''s breach of AI safety pledges', 'deepmind-letter', '[2025-07-08,2025-07-23)', 'politicians', 'email', 'sent', 'joseph@pauseai.info', 'deepmind-25',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"field","attrs":{"field":"greeting"}}]},{"type":"paragraph","content":[{"type":"text","text":"Google broke its promise. Please join 25 of your colleagues."}]},{"type":"paragraph","content":[{"type":"field","attrs":{"field":"own"}}]},{"type":"paragraph","content":[{"type":"text","text":"Thank you for your consideration,"}]}]}', false),
  ('DeepMind: August, from the personal Gmail', 'Request to co-sign letter on Google''s breach of AI safety pledges', 'deepmind-letter', '[2025-08-06,2025-08-23)', 'politicians', 'email', 'sent', NULL, 'deepmind-august',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"field","attrs":{"field":"greeting"}}]},{"type":"paragraph","content":[{"type":"text","text":"Please join "},{"type":"field","attrs":{"field":"colleagues"}},{"type":"text","text":" of your colleagues."}]}]}', true),
  ('Stuart Russell panel: invitation to speak', 'Invitation to speak on panel with Professor Stuart Russell', NULL, '[2026-06-15,2026-08-04)', 'politicians', 'email', 'sent', 'joseph@pauseai.info', 'russell-speak', NULL, false);
UPDATE mailings SET from_name = 'Joseph' WHERE old_letters_key = 'deepmind-august';
CREATE TEMP TABLE seed_old (politician text, key text, sent interval, merge_values jsonb, own_text text, reply text) ON COMMIT DROP;
INSERT INTO seed_old VALUES
  ('recPlaceholder', 'deepmind-25', '480 days', '{"values":{"greeting":"Dear Ms Placeholder,","own":"You spoke so well on the Bill."},"meets":[]}', NULL, NULL),
  ('recDummy', 'deepmind-25', '481 days', NULL, E'Dear Ms Dummy,\n\nA letter that fits no template.\n\nThank you for your consideration,', NULL),
  ('recPlaceholder', 'deepmind-august', '455 days', '{"values":{"greeting":"Dear Ms Placeholder,","colleagues":"50"},"meets":[]}', NULL, NULL),
  ('recDummy', 'russell-speak', '120 days', NULL, E'Dear Ms Dummy,\n\nWould you speak on a panel with Professor Russell?\n\nJoseph', 'fixture/morag-edinburgh.eml.gz');
CREATE TEMP TABLE seeded_old ON COMMIT DROP AS
SELECT nextval(pg_get_serial_sequence('letters', 'id')) AS id, o.* FROM seed_old o;
INSERT INTO letters (id, kind, notable_person_id, status, created_at, sent_at, replied_at) OVERRIDING SYSTEM VALUE
SELECT o.id, 'pauseai', n.id, 'sent', now() - o.sent, now() - o.sent, CASE WHEN o.reply IS NOT NULL THEN now() - o.sent + interval '1 day' END
FROM seeded_old o JOIN notable_people n ON n.airtable_id = o.politician;
INSERT INTO letters_from_pauseai (id, mailing_id, merge_values, own_text)
SELECT o.id, m.id, o.merge_values, o.own_text FROM seeded_old o JOIN mailings m ON m.old_letters_key = o.key;
-- The sent emails of those Joseph sent, imported. August's has none.
INSERT INTO email_sends (at, purpose, letter_id, address, outcome, message_id, backend, sender, rfc_message_id, gmail_thread_id, subject, from_address, imported)
SELECT now() - o.sent, 'mailing', o.id, lower(n.email), 'sent', 'gmail-old-' || o.id, 'gmail', 'joseph@pauseai.uk', 'old-' || o.id || '@mail.gmail.com', 'thread-old-' || o.id, m.subject, m.sent_from, true
FROM seeded_old o JOIN notable_people n ON n.airtable_id = o.politician JOIN mailings m ON m.old_letters_key = o.key
WHERE m.sent_from IS NOT NULL;
-- A person's reply to one, kept whole; our answer; an automatic reply to another.
INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, from_address, from_name, subject, at, from_us, blob_key, size)
SELECT o.id, 'joseph@pauseai.uk', 'gmail-old-reply-' || o.id, 'thread-old-' || o.id, 'old-reply-' || o.id || '@parliament.uk', lower(n.email), n.name, 'Re: Invitation to speak on panel with Professor Stuart Russell', now() - o.sent + interval '1 day', false, o.reply, 400
FROM seeded_old o JOIN notable_people n ON n.airtable_id = o.politician WHERE o.reply IS NOT NULL;
INSERT INTO letter_events (letter_id, at, status, details)
SELECT o.id, now() - o.sent + interval '1 minute', 'auto_reply', jsonb_build_object('from', lower(n.email), 'gmailMessageId', 'gmail-old-auto-' || o.id)
FROM seeded_old o JOIN notable_people n ON n.airtable_id = o.politician WHERE o.key = 'deepmind-25';

-- One-off emails, one of each: a thread only between PauseAI and a politician;
-- a thread with someone else in it, a volunteer forwarding what their MP said,
-- with an unknown-to-us sender; and a Parliament address we can't tie to anyone.
INSERT INTO one_off_threads (id, subject, someone_else, latest_at) OVERRIDING SYSTEM VALUE VALUES
  (1, 'Coffee next week?', false, now() - interval '30 days'),
  (2, 'Fwd: My MP''s answer', true, now() - interval '20 days'),
  (3, 'Room booking request', false, now() - interval '25 days');
SELECT setval(pg_get_serial_sequence('one_off_threads', 'id'), 3);
INSERT INTO one_off_thread_people (thread_id, notable_person_id)
SELECT t, n.id FROM (VALUES (1), (2)) AS ts (t) JOIN notable_people n ON n.airtable_id = 'recPlaceholder';
INSERT INTO one_off_messages (thread_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, in_reply_to, from_address, from_name, to_line, cc_line, addresses, subject, at, from_us, blob_key, size) VALUES
  (1, 'joseph@pauseai.uk', 'gmail-one-off-1', 't-coffee', 'fixture-one-off-joseph@mail.gmail.com', '{}', 'joseph@pauseai.uk', 'Joseph Example', 'Polly Placeholder <polly.placeholder.mp@parliament.uk>', '', '{joseph@pauseai.uk,polly.placeholder.mp@parliament.uk}', 'Coffee next week?', now() - interval '31 days', true, 'fixture/one-off-joseph.eml.gz', 300),
  (1, 'joseph@pauseai.uk', 'gmail-one-off-2', 't-coffee', 'fixture-one-off-polly@parliament.uk', '{fixture-one-off-joseph@mail.gmail.com}', 'polly.placeholder.mp@parliament.uk', 'Polly Placeholder', 'Joseph Example <joseph@pauseai.uk>', '', '{joseph@pauseai.uk,polly.placeholder.mp@parliament.uk}', 'Re: Coffee next week?', now() - interval '30 days', false, 'fixture/one-off-polly.eml.gz', 300),
  (2, 'policy@pauseai.uk', 'gmail-one-off-3', 't-forward', 'fixture-one-off-vera@example.com', '{}', 'vera.volunteer@example.com', 'Vera Volunteer', 'PauseAI UK <policy@pauseai.uk>', '', '{vera.volunteer@example.com,policy@pauseai.uk}', 'Fwd: My MP''s answer', now() - interval '20 days', false, 'fixture/one-off-volunteer.eml.gz', 300),
  (3, 'joseph@pauseai.uk', 'gmail-one-off-4', 't-room', 'fixture-one-off-office@parliament.uk', '{}', 'sam.office@parliament.uk', 'Sam Office', 'Joseph Example <joseph@pauseai.uk>', '', '{sam.office@parliament.uk,joseph@pauseai.uk}', 'Room booking request', now() - interval '25 days', false, 'fixture/one-off-office.eml.gz', 300);
-- Mail that matched nothing: one reported, one waiting for today's report.
INSERT INTO unmatched_mail (account, gmail_message_id, found_at, reported_at) VALUES
  ('policy@pauseai.uk', 'seed-unmatched-1', now() - interval '3 days', now() - interval '2 days'),
  ('policy@pauseai.uk', 'seed-unmatched-2', now() - interval '1 hour', NULL);
-- A politician's own domain.
INSERT INTO politician_domains (domain, notable_person_id)
SELECT 'pollyplaceholder.example', id FROM notable_people WHERE airtable_id = 'recPlaceholder';
-- Her other addresses: one Parliament lists, her office's, and her own Gmail, which staff added.
INSERT INTO politician_addresses (address, notable_person_id, source, added_by)
SELECT address, n.id, source, added_by FROM (VALUES
  ('placeholderp@parliament.uk', 'parliament', NULL),
  ('sam.office@parliament.uk', 'office', NULL),
  ('polly.placeholder.home@gmail.example', 'staff', 'jo@pauseai.uk')
) AS a (address, source, added_by) JOIN notable_people n ON n.airtable_id = 'recPlaceholder';
-- Each thing the send log's list can show: a sign-in, an alert and a report;
-- a refused and a failed send; a bounced email and a complained-of one.
INSERT INTO email_sends (at, purpose, address, outcome, message_id, backend, subject, from_address) VALUES
  (now() - interval '2 hours', 'staff-login', 'jo@pauseai.uk', 'sent', 'seed-log-login', 'postmark', 'Confirm sign in to PauseAI UK', 'noreply@notify.pauseai.uk'),
  (now() - interval '3 hours', 'staff-alert', 'notification@pauseai.uk', 'sent', 'seed-log-alert', 'postmark', 'An import was held', 'noreply@notify.pauseai.uk'),
  (now() - interval '4 hours', 'staff-report', 'notification@pauseai.uk', 'sent', 'seed-log-report', 'postmark', 'Emails in policy@ matched no politician', 'noreply@notify.pauseai.uk'),
  (now() - interval '5 hours', 'staff-alert', 'someone.blocked@example.com', 'refused', NULL, 'postmark', 'Refused as this address is blocked', 'noreply@notify.pauseai.uk'),
  (now() - interval '6 hours', 'staff-alert', 'failing@example.com', 'failed', NULL, 'postmark', 'Postmark would not take this', 'noreply@notify.pauseai.uk'),
  (now() - interval '7 hours', 'staff-alert', 'bouncing@example.com', 'sent', 'seed-log-bounced', 'postmark', 'One that bounced', 'noreply@notify.pauseai.uk'),
  (now() - interval '8 hours', 'staff-alert', 'complaining@example.com', 'sent', 'seed-log-complained', 'postmark', 'One marked as spam', 'noreply@notify.pauseai.uk'),
  (now() - interval '9 hours', 'mailing-test', 'jo@pauseai.uk', 'sent', 'seed-log-test', 'postmark', 'Please make the Millennium Dome into a giant pause button', 'jo@pauseai.uk'),
  (now() - interval '10 hours', 'supporter-notice', 'cass.seed@example.com', 'sent', 'seed-log-notice', 'postmark', 'Your letter hasn''t reached your MP', 'write.to@pauseai.uk'),
  (now() - interval '11 hours', 'office-notice', 'polly.placeholder.mp@parliament.uk', 'sent', 'seed-log-office', 'postmark', 'A reply couldn''t be passed on', 'write.to@pauseai.uk');
-- Each blocked its address, as a hard bounce or complaint does, as did an
-- older bounce the refused send's.
WITH problems AS (
  INSERT INTO email_problems (at, address, message_id, kind, reason, can_reset) VALUES
    (now() - interval '20 days', 'someone.blocked@example.com', NULL, 'hard', 'No such mailbox', true),
    (now() - interval '7 hours', 'bouncing@example.com', 'seed-log-bounced', 'hard', 'No such mailbox', true),
    (now() - interval '8 hours', 'complaining@example.com', 'seed-log-complained', 'complaint', 'Marked as spam', false)
  RETURNING id, address
)
INSERT INTO email_blocks (address, problem_id) SELECT address, id FROM problems;
-- Dana's old address bounced, so it's blocked; her other still says yes.
-- (Robin's calendar address bounced too, a broadcast to it, at the end.)
WITH bounced AS (
  INSERT INTO email_problems (at, address, kind, reason, can_reset) VALUES
    (now() - interval '2 days', 'dana.old@example.com', 'hard',
     '550-5.1.1 The email account that you tried to reach does not exist. Please try 550-5.1.1 double-checking the recipient''s email address for typos or 550-5.1.1 unnecessary spaces. For more information, go to 550 5.1.1 https://support.google.com/mail/?p=NoSuchUser 9xyz1234a5b6c-7d890ef1234sor5678901e87.1 - gsmtp',
     true)
  RETURNING id, address
)
INSERT INTO email_blocks (address, problem_id) SELECT address, id FROM bounced;
-- Casey's address is on hold in CiviCRM, which the first pull found.
WITH held AS (
  INSERT INTO email_problems (at, address, kind, reason, can_reset, details) VALUES
    (now() - interval '2 days', 'casey.chapter@example.com', 'hold',
     'Usually as its emails to it bounced', true, '{"contactId": 108}')
  RETURNING id, address
)
INSERT INTO email_blocks (address, problem_id) SELECT address, id FROM held;
-- The new tag: the migration's pages for each account here, so only the pages it didn't name show as new.
INSERT INTO staff_nav_seen (email, page, first_seen_at)
SELECT a.email, p.page, '2000-01-01' FROM staff_accounts a CROSS JOIN unnest(ARRAY['supporters', 'supporterEmails', 'politicians', 'asks', 'mailings', 'mpEmails', 'events', 'import', 'accounts', 'changes']) AS p (page)
ON CONFLICT DO NOTHING;

-- A press of a job still running, which its page says.
INSERT INTO job_presses (job, started_by) VALUES ('tidy-logs', 'jo@pauseai.uk');

-- Broadcasts to supporters, by email and by text, in each state a mailing has:
-- a draft, one scheduled, one sending, one sent and one stopped. A text's
-- draft also comes with no template yet, an approved one, new words, new
-- words waiting for WhatsApp's approval, and words it rejected. After the
-- rest, so no ID above moves.
CREATE FUNCTION pg_temp.seed_words(words text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
    jsonb_build_object('type', 'text', 'text', 'Hi '), jsonb_build_object('type', 'field', 'attrs', jsonb_build_object('field', 'firstName')),
    jsonb_build_object('type', 'text', 'text', ', ' || words)))))
$$;

INSERT INTO whatsapp_templates (name, body, status, created_by, approved_at, rejected_at, rejected_reason, created_at, footer)
SELECT t.name, pg_temp.seed_words(t.words), t.status, t.by,
  CASE WHEN t.status = 'approved' THEN now() - t.ago END, CASE WHEN t.status = 'rejected' THEN now() - t.ago END,
  -- WhatsApp's code for why, which the draft and the email put in words (rejectionWords, lib/broadcasts.ts).
  CASE WHEN t.status = 'rejected' THEN 'PROMOTIONAL' END, now() - t.ago - interval '1 day',
  -- Its footer as it went to WhatsApp, every text's (TEMPLATE_FOOTER).
  'Reply STOP to stop these texts'
FROM (VALUES
  ('The march meets at 11:00 at Parliament Square.', 'the march meets at 11:00 at Parliament Square. Look for the orange flags.', 'approved', 'jo@pauseai.uk', interval '10 days'),
  ('PauseCon room change', 'PauseCon has moved to the Main Hall. Doors still open at 09:30.', 'approved', 'sam@pauseai.uk', interval '12 days'),
  ('Our next event is on Saturday.', 'our next event is on Saturday. Hope to see you there.', 'approved', 'jo@pauseai.uk', interval '40 days'),
  ('We are flyering on Saturday.', 'we are flyering on Saturday. Could you spare an hour?', 'approved', 'jo@pauseai.uk', interval '50 days'),
  ('Local group meetup', 'your local group meets on Thursday. Everyone is welcome.', 'approved', 'jo@pauseai.uk', interval '60 days'),
  ('Thank you for coming.', 'thank you for coming. Here is what happens next.', 'approved', 'sam@pauseai.uk', interval '70 days'),
  ('write_to_your_mp', 'the AI bill has its second reading next week. Could you write to your MP?', 'approved', NULL, interval '80 days'),
  ('Rain on Saturday', 'bring a coat on Saturday: rain is forecast for the afternoon.', 'pending', 'jo@pauseai.uk', interval '2 hours'),
  ('Have you written to your MP?', 'have you written to your MP?', 'rejected', 'jo@pauseai.uk', interval '1 day')
) t (name, words, status, by, ago);

CREATE TEMP TABLE seed_broadcasts ON COMMIT DROP AS
SELECT nextval(pg_get_serial_sequence('mailings', 'id')) AS id, m.* FROM (VALUES
  ('Events near you this month', 'email', 'draft', NULL::interval, NULL, 'here is what is on near you this month.'),
  ('Stall on Saturday', 'email', 'scheduled', interval '3 days', NULL, 'we will be at the stall on Saturday. Come and say hello.'),
  ('Thank you for marching', 'email', 'sending', interval '-2 hours', NULL, 'thank you for marching with us.'),
  ('PauseCon: the recordings', 'email', 'cancelled', interval '-5 days', NULL, 'the recordings from PauseCon are up.'),
  ('', 'text', 'draft', NULL, NULL, NULL),
  ('Local group meetup', 'text', 'draft', NULL, 'Local group meetup', NULL),
  ('The stall needs a hand on Saturday.', 'text', 'draft', NULL, NULL, 'the stall needs a hand on Saturday.'),
  ('Have you written to your MP?', 'text', 'draft', NULL, 'Have you written to your MP?', NULL),
  ('The march meets at 11:00 at Parliament Square.', 'text', 'scheduled', interval '2 days', 'The march meets at 11:00 at Parliament Square.', NULL),
  ('Rain on Saturday', 'text', 'draft', interval '3 days', 'Rain on Saturday', NULL),
  ('Our next event is on Saturday.', 'text', 'sending', interval '-1 hour', 'Our next event is on Saturday.', NULL),
  ('PauseCon room change', 'text', 'sent', interval '-3 days', 'PauseCon room change', NULL),
  ('We are flyering on Saturday.', 'text', 'cancelled', interval '-6 days', 'We are flyering on Saturday.', NULL),
  ('End of summer social', 'email', 'sent', interval '-65 days', NULL, 'join us for an end of summer social in London next Saturday.'),
  ('Volunteer evening', 'email', 'cancelled', interval '-8 days', NULL, 'volunteers meet on Thursday evening to plan the month.')
) m (title, channel, state, due, template, words);
INSERT INTO mailings (id, title, subject, audience, channel, topic, filter, body, created_by, sent_from, from_name, due_at, state, template_id, created_at, opened_at)
  OVERRIDING SYSTEM VALUE
SELECT m.id, m.title, CASE WHEN m.channel = 'email' THEN m.title ELSE '' END, 'supporters', m.channel, 'events',
  -- Two with filters besides Consent: near a place, and those who didn't write in a campaign.
  jsonb_build_object('list', 'supporters', 'params',
    jsonb_build_object('contact', m.channel || ':events:yes')
    || CASE m.title
         WHEN 'Stall on Saturday' THEN '{"near": "M1 1AE", "within": "5"}'::jsonb
         WHEN 'Rain on Saturday' THEN '{"campaign": "regulate-letter-pm", "wrote": "no"}'::jsonb
         ELSE '{}'::jsonb
       END),
  CASE WHEN m.words IS NOT NULL THEN pg_temp.seed_words(m.words) ELSE coalesce(t.body, '{"type": "doc", "content": []}'::jsonb) END,
  'jo@pauseai.uk', CASE WHEN m.channel = 'email' THEN 'hello@pauseai.uk' ELSE '+447700900000' END, 'PauseAI UK',
  now() + m.due, m.state, t.id, least(now(), now() + m.due) - interval '2 days', now() - interval '1 hour'
FROM seed_broadcasts m LEFT JOIN whatsapp_templates t ON t.name = m.template;
-- Volunteer evening stopped as it hadn't all gone by Gmail in its seven days
-- (sendingStopsAt), so it offers to resume.
UPDATE mailings SET gave_up = true, wait_reason = 'limit', waiting_since = due_at + interval '7 days'
WHERE audience = 'supporters' AND title = 'Volunteer evening';

-- Each copy of those sent, sending or stopped, as sending left it: one for
-- each supporter the broadcast's Consent found when it went, at their
-- address or number that said yes. Every way one can go: delivered, a text
-- also read, sent with no word back yet, failed (an email refused by Gmail
-- as it was sent, a text reported by WhatsApp after), bounced, skipped for each
-- reason, and never sent, as the broadcast was stopped first. Each agrees
-- with the supporter's own page: Robin's calendar address bounced on Events
-- this month, which blocked it, so the PauseCon email skipped it; Tom
-- unsubscribed after two emails were written and before each went, and
-- his number has PauseAI Global's "Do not SMS", so the flyering text
-- skipped it;
-- Grace no longer follows the calendar; Li's number isn't on WhatsApp; and
-- Pat and Robin, whom PauseCon room change reached, replied "stop" two
-- hours later (below), stopping event texts, and Jane answered it. Erin had the summer social
-- before she unsubscribed and was erased. Volunteer evening reached two
-- before it stopped, and never the other two. Scheduled broadcasts have no
-- copies, as sending finds who they go to. Events this month's first, so
-- its first copy is 1.
CREATE TEMP TABLE seed_copies ON COMMIT DROP AS
SELECT nextval(pg_get_serial_sequence('broadcast_messages', 'id')) AS id, c.* FROM (
  SELECT m.id AS mailing_id, m.channel, m.due_at, k.supporter_id, c.luma_user, c.status, c.reason, c.report, c.was_read, c.stopped,
    -- An email failing is Gmail refusing it as it was sent; a text's failing, WhatsApp's report after.
    m.channel = 'email' AND c.status = 'failed' AND c.report = 'failed' AS refused
  FROM (SELECT v.*, row_number() OVER () AS n FROM (VALUES
    ('Events this month', 'usr-fixture-1', 'delivered', NULL, 'delivered', false, false),
    ('Events this month', 'usr-fixture-3', 'delivered', NULL, 'delivered', false, false),
    ('Events this month', 'usr-fixture-6', 'delivered', NULL, 'delivered', false, false),
    ('Events this month', 'usr-seed-10', 'delivered', NULL, 'delivered', false, false),
    ('Events this month', 'usr-seed-12', 'delivered', NULL, 'delivered', false, false),
    ('Events this month', 'usr-seed-22', 'failed', NULL, 'bounced', false, false),
    ('Events this month', 'usr-seed-9', 'skipped', 'unsubscribed', NULL, false, false),
    ('Thank you for marching', 'usr-fixture-1', 'delivered', NULL, 'delivered', false, false),
    ('Thank you for marching', 'usr-fixture-3', 'delivered', NULL, 'delivered', false, false),
    ('Thank you for marching', 'usr-fixture-6', 'sent', NULL, NULL, false, false),
    ('Thank you for marching', 'usr-seed-18', 'sent', NULL, NULL, false, false),
    ('Thank you for marching', 'usr-seed-10', 'scheduled', NULL, NULL, false, false),
    ('Thank you for marching', 'usr-seed-7', 'scheduled', NULL, NULL, false, false),
    ('Thank you for marching', 'usr-seed-8', 'scheduled', NULL, NULL, false, false),
    ('PauseCon: the recordings', 'usr-fixture-1', 'delivered', NULL, 'delivered', false, false),
    ('PauseCon: the recordings', 'usr-fixture-3', 'delivered', NULL, 'delivered', false, false),
    ('PauseCon: the recordings', 'usr-fixture-6', 'failed', NULL, 'failed', false, false),
    ('PauseCon: the recordings', 'usr-seed-22', 'skipped', 'blocked', NULL, false, false),
    ('PauseCon: the recordings', 'usr-seed-9', 'skipped', 'unsubscribed', NULL, false, false),
    ('PauseCon: the recordings', 'usr-seed-11', 'skipped', 'no-permission', NULL, false, false),
    ('PauseCon: the recordings', 'usr-seed-10', 'cancelled', NULL, NULL, false, false),
    ('PauseCon: the recordings', 'usr-seed-12', 'cancelled', NULL, NULL, false, false),
    ('PauseCon: the recordings', 'usr-seed-18', 'cancelled', NULL, NULL, false, false),
    ('Our next event is on Saturday.', 'usr-fixture-1', 'delivered', NULL, 'delivered', true, false),
    ('Our next event is on Saturday.', 'usr-seed-7', 'delivered', NULL, 'delivered', false, false),
    -- Robin pressed Stop on PauseCon room change days before, so this one skips them.
    ('Our next event is on Saturday.', 'usr-seed-22', 'skipped', 'unsubscribed', NULL, false, false),
    ('Our next event is on Saturday.', 'usr-seed-10', 'scheduled', NULL, NULL, false, false),
    ('PauseCon room change', 'usr-fixture-1', 'delivered', NULL, 'delivered', true, false),
    ('PauseCon room change', 'usr-seed-22', 'delivered', NULL, 'delivered', true, true),
    ('PauseCon room change', 'usr-fixture-5', 'delivered', NULL, 'delivered', false, true),
    ('PauseCon room change', 'usr-seed-12', 'failed', NULL, 'failed', false, false),
    ('PauseCon room change', 'usr-seed-10', 'skipped', 'not-on-whatsapp', NULL, false, false),
    ('We are flyering on Saturday.', 'usr-fixture-1', 'delivered', NULL, 'delivered', true, false),
    ('We are flyering on Saturday.', 'usr-seed-22', 'failed', NULL, 'failed', false, false),
    ('We are flyering on Saturday.', 'usr-seed-9', 'skipped', 'no-permission', NULL, false, false),
    ('We are flyering on Saturday.', 'usr-seed-10', 'cancelled', NULL, NULL, false, false),
    ('We are flyering on Saturday.', 'usr-seed-12', 'cancelled', NULL, NULL, false, false),
    ('End of summer social', 'usr-fixture-6', 'delivered', NULL, 'delivered', false, false),
    ('End of summer social', 'usr-seed-9', 'delivered', NULL, 'delivered', false, false),
    ('End of summer social', 'usr-seed-20', 'delivered', NULL, 'delivered', false, false),
    ('Volunteer evening', 'usr-fixture-1', 'delivered', NULL, 'delivered', false, false),
    ('Volunteer evening', 'usr-fixture-3', 'delivered', NULL, 'delivered', false, false),
    ('Volunteer evening', 'usr-seed-10', 'cancelled', NULL, NULL, false, false),
    ('Volunteer evening', 'usr-seed-12', 'cancelled', NULL, NULL, false, false),
    -- Last, so no copy above moves: Thank you for marching, still sending,
    -- has already failed one and skipped Grace, who no longer follows the
    -- calendar, so the list shows them under its bar.
    ('Thank you for marching', 'usr-seed-12', 'failed', NULL, 'failed', false, false),
    ('Thank you for marching', 'usr-seed-11', 'skipped', 'no-permission', NULL, false, false)
  ) v (title, luma_user, status, reason, report, was_read, stopped)) c
  JOIN mailings m ON m.audience = 'supporters' AND m.title = c.title
  LEFT JOIN supporter_links k ON k.luma_user_id = c.luma_user
  ORDER BY c.n
) c;
-- Each with the merge values sending gives it (recipientValues in
-- lib/server/broadcast-recipients.ts): their name and first name, and the
-- campaigns they wrote in and events they registered for. Erin's, since
-- she was erased, keeps only that it went.
INSERT INTO broadcast_messages (id, mailing_id, supporter_id, address, status, provider_message_id, merge_values, skip_reason, sent_at) OVERRIDING SYSTEM VALUE
SELECT c.id, c.mailing_id, c.supporter_id,
  CASE WHEN c.channel = 'email' THEN (SELECT email FROM luma_people WHERE user_id = c.luma_user)
    ELSE (SELECT phone_number(g.phone) FROM luma_guests g WHERE g.user_id = c.luma_user AND g.phone IS NOT NULL ORDER BY g.registered_at DESC LIMIT 1) END,
  c.status, CASE WHEN c.status IN ('sent', 'delivered', 'failed') AND NOT c.refused THEN 'seed-broadcast-' || c.id END,
  CASE WHEN c.supporter_id IS NOT NULL THEN jsonb_build_object('name', s.name, 'place', (SELECT place FROM supporter_place WHERE supporter_id = c.supporter_id),
    'values', jsonb_build_object('firstName', split_part(s.name, ' ', 1), 'name', s.name),
    'meets', '["has:firstName", "has:name"]'::jsonb || coalesce((
      SELECT jsonb_agg(part ORDER BY part DESC) FROM (
        SELECT 'wrote:' || l.campaign AS part FROM supporter_links k JOIN letters_from_supporters l ON l.entry_id = k.form_entry_id WHERE k.supporter_id = c.supporter_id
        UNION SELECT 'event:' || g.event_id FROM supporter_links k JOIN luma_guests g ON g.user_id = k.luma_user_id
          WHERE k.supporter_id = c.supporter_id AND g.approval_status <> 'declined') parts), '[]'::jsonb)) END,
  c.reason, CASE WHEN c.status IN ('sent', 'delivered', 'failed') AND NOT c.refused THEN c.due_at END
FROM seed_copies c LEFT JOIN supporters_summary s ON s.id = c.supporter_id;
-- What each provider reported: delivered, failed or bounced a minute after
-- sending, read twenty minutes after, Jane's answer ten minutes later, and
-- Pat's stop two hours after. An email Gmail refused failed as it was sent,
-- and never went.
INSERT INTO broadcast_message_events (message_id, at, kind)
SELECT id, due_at, 'sent' FROM seed_copies WHERE status IN ('sent', 'delivered', 'failed') AND NOT refused
UNION ALL SELECT id, due_at + CASE WHEN refused THEN interval '0' ELSE interval '1 minute' END, report
  FROM seed_copies WHERE report IS NOT NULL
UNION ALL SELECT id, due_at + interval '20 minutes', 'read' FROM seed_copies WHERE was_read
UNION ALL SELECT id, due_at + interval '2 hours', 'opted-out' FROM seed_copies WHERE stopped;
-- Why each failed or bounced, as its provider said it: Postmark's bounce,
-- WhatsApp's error, Gmail's refusal.
UPDATE broadcast_message_events e SET details = CASE
    WHEN e.kind = 'bounced' THEN '{"reason": "No such mailbox"}'::jsonb
    WHEN s.channel = 'text' THEN '{"code": 131000, "title": "Something went wrong"}'::jsonb
    ELSE '{"reason": "Recipient address rejected"}'::jsonb END
FROM seed_copies s WHERE s.id = e.message_id AND e.kind IN ('failed', 'bounced');
-- The number WhatsApp said isn't on it, which texts skip from then on.
INSERT INTO whatsapp_unreachable (number, at, message_id)
SELECT coalesce(c.address, '+447700900099'), s.due_at, c.id
FROM broadcast_messages c JOIN seed_copies s USING (id) WHERE s.reason = 'not-on-whatsapp';
-- Robin's bounce, which blocked the address.
WITH bounced AS (
  INSERT INTO email_problems (at, address, message_id, kind, reason, can_reset, details)
  SELECT s.due_at + interval '1 minute', c.address, c.provider_message_id, 'hard', 'No such mailbox', true, '{"type": "HardBounce"}'
  FROM broadcast_messages c JOIN seed_copies s USING (id) WHERE s.report = 'bounced'
  RETURNING id, address
)
INSERT INTO email_blocks (address, problem_id) SELECT address, id FROM bounced;

-- Each copy's unsubscribe link (its token's hash) and the Message-ID it went with, as sending
-- gives them, and the topic it went under. Jane's copy of Thank you for
-- marching has a link the public pages open (tests/routes.ts).
UPDATE broadcast_messages c SET link_token_hash = encode(sha256(convert_to(CASE WHEN c.id = (
    SELECT s.id FROM seed_copies s JOIN mailings m ON m.id = s.mailing_id
    WHERE m.title = 'Thank you for marching' AND s.luma_user = 'usr-fixture-1')
  THEN 'seed-unsubscribe-jane' ELSE 'seed-link-' || c.id END, 'UTF8')), 'hex'),
  rfc_message_id = 'seed-copy-' || c.id || '@pauseai.uk', topics = ARRAY[m.topic]
FROM mailings m WHERE m.id = c.mailing_id;
-- Replies, read from hello@: Alex asking to stop, waiting for staff; Fay's
-- automatic reply; and Jane's thanks, which Jo answered.
INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, account, gmail_message_id,
  gmail_thread_id, rfc_message_id, blob_key, automatic, outcome, dealt_by, dealt_at)
SELECT s.id, s.due_at + r.after, l.email, r.subject, 'hello@pauseai.uk', r.gmail, r.gmail,
  'fixture-' || r.file || '@example.com', 'fixture/' || r.file || '.eml.gz',
  r.automatic, r.outcome, r.dealt_by, CASE WHEN r.outcome IS NOT NULL THEN s.due_at + r.after + interval '1 hour' END
FROM (VALUES
  ('Events this month', 'usr-fixture-3', interval '2 hours', 'Re: Events this month', 'seed-reply-stop', 'broadcast-reply-stop', false, NULL, NULL),
  ('Events this month', 'usr-fixture-6', interval '1 minute', 'Automatic reply: Events this month', 'seed-reply-away', 'broadcast-reply-away', true, NULL, NULL),
  ('Thank you for marching', 'usr-fixture-1', interval '50 minutes', 'Re: Thank you for marching', 'seed-reply-thanks', 'broadcast-reply-thanks', false, 'answered', 'jo@pauseai.uk')
) r (title, luma_user, after, subject, gmail, file, automatic, outcome, dealt_by)
JOIN mailings m ON m.audience = 'supporters' AND m.title = r.title
JOIN seed_copies s ON s.mailing_id = m.id AND s.luma_user = r.luma_user
JOIN luma_people l ON l.user_id = r.luma_user;
-- Replies to texts, by WhatsApp: their words, as its webhook gave them.
-- Jane's to PauseCon room change is days old, so WhatsApp takes no answer
-- now; the one to Our next event is on Saturday came 40 minutes ago, so
-- staff can answer it.
INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, provider_message_id, body, automatic)
SELECT s.id, s.due_at + r.after, c.address, '', r.id, r.words, false
FROM (VALUES
  ('PauseCon room change', 'usr-fixture-1', interval '30 minutes', 'seed-text-reply', 'Thanks! Is it still the same building?'),
  ('Our next event is on Saturday.', 'usr-seed-7', interval '20 minutes', 'seed-text-reply-recent', 'Can I bring my kids along?')
) r (title, luma_user, after, id, words)
JOIN mailings m ON m.title = r.title AND m.channel = 'text'
JOIN seed_copies s ON s.mailing_id = m.id AND s.luma_user = r.luma_user
JOIN broadcast_messages c ON c.id = s.id;
INSERT INTO broadcast_message_events (message_id, at, kind)
SELECT message_id, received_at, 'replied' FROM broadcast_replies WHERE NOT automatic;
-- Two hours after PauseCon room change came, Robin and Pat replied
-- "stop", as its footer says, which recordWhatsAppStop keeps
-- (lib/server/whatsapp-stops.ts): the text's topic, events, stopped for
-- the number, from WhatsApp. Their other text topics stay open, so
-- nothing goes to CiviCRM.
INSERT INTO opt_outs (address, list, way, source, source_ref, unsubscribed_at, message_id)
SELECT c.address, 'events', 'text', 'whatsapp', 'reply seed-text-stop-' || w.luma_user || ' events',
  s.due_at + interval '2 hours', c.id
FROM (VALUES ('usr-seed-22'), ('usr-fixture-5')) w (luma_user)
JOIN seed_copies s ON s.luma_user = w.luma_user JOIN mailings m ON m.id = s.mailing_id JOIN broadcast_messages c ON c.id = s.id
WHERE m.title = 'PauseCon room change';
-- Each stop is kept as a reply to the text, recorded as an opt-out by the
-- site (SITE_ACTOR, lib/broadcasts.ts), and answered (whatsapp-webhooks.ts):
-- what it stopped, with a link to the number's contact preferences.
INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, provider_message_id, body, automatic,
  outcome, dealt_by, dealt_at)
SELECT o.message_id, o.unsubscribed_at, o.address, '', split_part(o.source_ref, ' ', 2), 'STOP', false, 'opted-out',
  'pauseai.uk', o.unsubscribed_at
FROM opt_outs o WHERE o.source_ref LIKE 'reply seed-text-stop-%';
INSERT INTO broadcast_answers (reply_id, draft_id, sent_by, body, status, created_at, sent_at, provider_message_id)
SELECT r.id, gen_random_uuid(), 'pauseai.uk',
  jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content',
    jsonb_build_array(jsonb_build_object('type', 'text', 'text',
      'You won''t get any more event texts from PauseAI UK. To change what we send you: https://pauseai.uk/contact-preferences/seed-stop-' || r.id))))),
  'sent', r.received_at, r.received_at, 'answer-' || r.provider_message_id
FROM broadcast_replies r WHERE r.provider_message_id LIKE 'seed-text-stop-%';
INSERT INTO broadcast_answers (reply_id, draft_id, sent_by, body, status, created_at, sent_at, gmail_message_id,
  rfc_message_id)
SELECT id, '00000000-0000-4000-8000-000000000001', dealt_by,
  '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Thank you for coming, Jane! The next march is on 6 December."}]}]}',
  'sent', dealt_at, dealt_at, 'seed-answer-thanks', 'seed-answer-thanks@pauseai.uk'
FROM broadcast_replies WHERE gmail_message_id = 'seed-reply-thanks';

-- ------------------------------------------------------ contact preferences

-- Someone who's no supporter unsubscribed from the newsletter by an old
-- email's link, which CiviCRM accepted; and lifted "No bulk emails" on the
-- contact preferences page, beside its words, which CiviCRM has still to answer.
-- A link to Jane's settings, asked for an hour ago, which the public pages
-- open (tests/routes.ts).
WITH seed_out AS (
  INSERT INTO opt_outs (address, list, source, source_ref, unsubscribed_at)
  VALUES ('gone.seed@example.com', 'newsletter', 'link', 'seed-link-gone', now() - interval '4 days') RETURNING id, unsubscribed_at
)
INSERT INTO civicrm_updates (opt_out_id, change, list, email, occurred_at, source, tries, tried_at, status, answered_at)
SELECT id, 'unsubscribe', 'newsletter', 'gone.seed@example.com', unsubscribed_at, 'pauseai.uk:link', 1,
  unsubscribed_at + interval '1 hour', 'accepted', unsubscribed_at + interval '1 hour'
FROM seed_out;
WITH seed_lift AS (
  INSERT INTO preference_choices (address, way, topic, wording, chosen_at)
  VALUES ('lifted.seed@example.com', 'email', 'bulk', 'PauseAI UK and PauseAI Global can send me bulk email again.', now() - interval '20 minutes')
  RETURNING id, chosen_at, wording
)
INSERT INTO civicrm_updates (choice_id, change, email, occurred_at, source, wording)
SELECT id, 'allow_bulk_email', 'lifted.seed@example.com', chosen_at, 'pauseai.uk:preferences', wording FROM seed_lift;
INSERT INTO preference_links (token_hash, address, created_at, expires_at)
VALUES (encode(sha256('seed-settings-jane'::bytea), 'hex'), 'jane.fixture@example.com', now() - interval '1 hour', now() + interval '7 days' - interval '1 hour');

-- --------------------------------------------------------------- errors

-- What went wrong outside a job's run (lib/server/errors-seen.ts), one of
-- each kind of thing: a Postgres error in a staff page, still happening; a
-- problem our code reported, last week; a page that fell over in someone's
-- browser; and something else a browser threw, which nobody is emailed
-- about, marked done since it was last seen. Each was last due an email
-- over a day ago, so none counts towards this hour's emails.
INSERT INTO errors_seen (id, key, kind, route, name, code, words, latest_words, latest_stack, latest_browser, first_seen, last_seen, count, alerted_at, alerted_count, done_at, done_by)
OVERRIDING SYSTEM VALUE VALUES
  (1, 'seed-render', 'render', '/staff/politicians/[id]', 'error', '23505 notes_pkey',
   'duplicate key value violates unique constraint <text>', 'duplicate key value violates unique constraint "notes_pkey"',
   E'error: duplicate key value violates unique constraint "notes_pkey"\n    at async query (.next/server/chunks/ssr/lib_server_db_ts_4f2a._.js:1:2345)\n    at async addNote (.next/server/chunks/ssr/lib_server_notes_ts_9c1b._.js:1:678)',
   NULL, now() - interval '8 days', now() - interval '2 hours', 12, now() - interval '26 hours', 9, NULL, NULL),
  (2, 'seed-problem', 'problem', '', '', NULL,
   'Turnstile couldn''t be reached', 'Turnstile couldn''t be reached: fetch failed (connect ETIMEDOUT 192.0.2.7:443)',
   NULL, NULL, now() - interval '6 days', now() - interval '6 days', 7, now() - interval '6 days', 1, NULL, NULL),
  (3, 'seed-browser-page', 'browser-page', '/campaigns/<id>/write', 'TypeError', NULL,
   'can''t access property <text>, draft is undefined', 'can''t access property "content", draft is undefined',
   E'LetterEditor@https://pauseai.example.org/_next/static/chunks/4f2a.js:1:2345\nrenderWithHooks@https://pauseai.example.org/_next/static/chunks/9c1b.js:1:678',
   'Firefox 131', now() - interval '3 days', now() - interval '3 days', 1, now() - interval '3 days', 1, NULL, NULL),
  (4, 'seed-browser-other', 'browser-other', '/', 'Error', NULL,
   'ResizeObserver loop completed with undelivered notifications.', 'ResizeObserver loop completed with undelivered notifications.',
   'onResize@https://pauseai.example.org/_next/static/chunks/77aa.js:1:91',
   'Safari 18', now() - interval '20 days', now() - interval '4 days', 31, NULL, 0,
   now() - interval '3 days', 'jane.smith@pauseai.uk');
SELECT setval(pg_get_serial_sequence('errors_seen', 'id'), (SELECT max(id) FROM errors_seen));
