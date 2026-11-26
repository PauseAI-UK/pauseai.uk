-- PauseAI UK's press coverage, which /press lists, and what the nightly
-- press survey (import-press) finds for staff to check on /staff/press.

-- An outlet: the name readers know it by. Its lean is from AllSides, Ad
-- Fontes and Media Bias/Fact Check where they rate it, never guessed.
CREATE TABLE press_outlets (
  id    bigserial PRIMARY KEY,
  name  text NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  lean  text CHECK (lean IN ('Left', 'Lean Left', 'Center', 'Lean Right', 'Right')),
  -- Why it's kept apart from a related outlet, or anything else staff should know.
  note  text
);

-- A piece of coverage. A piece cross-posted across platforms has `links`,
-- each {label, url}, in place of one `url`. `note` says what connects it to
-- us. Staff take a piece off /press by marking it removed, so the survey
-- never finds it again as new.
CREATE TABLE press_coverage (
  id         bigserial PRIMARY KEY,
  outlet_id  bigint NOT NULL REFERENCES press_outlets ON DELETE RESTRICT,
  title      text NOT NULL CHECK (btrim(title) <> ''),
  medium     text NOT NULL CHECK (medium IN ('Article', 'Video', 'Photos')),
  url        text,
  links      jsonb CHECK (jsonb_typeof(links) = 'array' AND jsonb_array_length(links) > 0),
  published  date,
  note       text,
  state      text NOT NULL DEFAULT 'shown' CHECK (state IN ('shown', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  updated_at timestamptz,
  updated_by text,
  CHECK (num_nonnulls(url, links) = 1)
);

-- What the survey found in Google News, by the link Google gave, until staff
-- add it to the coverage or turn it down. It's read in turn: decoded to the
-- article's own address, the page read, and Claude asked. `unread` until
-- then; `known` if the article is in the coverage already, or found before
-- under another link; `waiting` for staff; `not ours` if Claude or staff
-- said so; `added` once it's in press_coverage.
CREATE TABLE press_finds (
  id            bigserial PRIMARY KEY,
  google_link   text NOT NULL UNIQUE,
  title         text NOT NULL,
  -- The outlet as Google News names it, or as staff named it once they've edited the find.
  outlet_name   text,
  -- Its site: its article's, once read, else Google News's for it (press_sources).
  site          text,
  published     date,
  found_at      timestamptz NOT NULL DEFAULT now(),
  state         text NOT NULL DEFAULT 'unread' CHECK (state IN ('unread', 'known', 'waiting', 'not ours', 'added')),
  -- The article's own address, once decoded.
  url           text,
  -- What the page says of us, a passage or a photo's caption, as read.
  passage       text,
  -- Its kind, worked out when the survey reads it (lib/press/medium.ts); none while it's unread.
  medium        text CHECK (medium IN ('Article', 'Video', 'Photos')),
  -- Claude's answer: whether it's ours, which PauseAI it's about, and why.
  verdict       text CHECK (verdict IN ('ours', 'not ours', 'unclear')),
  org           text CHECK (org IN ('uk', 'global', 'us', 'lookalike', 'none', 'unclear')),
  reason        text,
  -- Why the last try at reading it failed, as keptError() keeps an error, and how many tries.
  read_failure  jsonb,
  reads         integer NOT NULL DEFAULT 0,
  -- When the notification inbox was told it was waiting.
  notified_at   timestamptz,
  coverage_id   bigint UNIQUE REFERENCES press_coverage ON DELETE RESTRICT,
  -- What staff wrote of it, its note on /press in place of Claude's reason; and when they last edited it.
  note          text,
  edited_at     timestamptz,
  decided_by    text,
  decided_at    timestamptz,
  CHECK ((state = 'added') = (coverage_id IS NOT NULL)),
  CHECK ((verdict IS NULL) = (org IS NULL) AND (verdict IS NULL) = (reason IS NULL))
);
CREATE INDEX press_finds_unread ON press_finds (found_at) WHERE state = 'unread';
CREATE INDEX press_finds_url ON press_finds (url) WHERE url IS NOT NULL;

-- How far the survey's search has reached: it searches from the day after,
-- a week at a time, up to today. Starting at the end of September, so its
-- first search takes in October, the month of the newest piece the coverage
-- had when it came here (The Japan Times, 7 October 2026); a piece already in
-- the coverage is found known.
CREATE TABLE press_search (
  one          boolean PRIMARY KEY DEFAULT true CHECK (one),
  searched_to  date NOT NULL
);
INSERT INTO press_search (searched_to) VALUES ('2026-09-30');

-- The coverage as lib/content/press-coverage.ts had it, in its order, with
-- the comments written beside each piece as its note.
INSERT INTO press_outlets (id, name, lean, note) VALUES
  (1, 'Financial Times', 'Center', NULL),
  (2, 'Wired Italia', NULL, NULL),
  (3, 'Cosmopolitan Italia', NULL, NULL),
  (4, 'Gizmodo', 'Lean Left', NULL),
  (5, 'Wall Street Journal', 'Center', NULL),
  (6, 'Business Insider', 'Lean Left', NULL),
  (7, 'TIME', 'Lean Left', NULL),
  (8, 'Fortune', 'Center', NULL),
  (9, 'MIT Technology Review', 'Center', NULL),
  (10, 'The Guardian', 'Left', NULL),
  (11, 'BBC', 'Center', NULL),
  (12, 'The Observer', NULL, NULL),
  (13, 'The Independent', 'Lean Left', NULL),
  (14, 'Futurism', NULL, NULL),
  (15, 'Real Media', NULL, NULL),
  (16, 'SW Londoner', NULL, NULL),
  (17, 'Politis', 'Left', NULL),
  (18, 'Daily Mail', 'Right', NULL),
  (19, 'New Statesman', 'Left', NULL),
  (20, 'Channel 4', 'Center', NULL),
  (21, 'ITV', 'Center', NULL),
  (22, 'Al Arabiya', 'Lean Right', NULL),
  (23, 'Imago Images', NULL, NULL),
  (24, 'Reuters Connect (Anadolu Agency)', NULL, NULL),
  (25, 'Reuters Connect (Zuma Press)', NULL, NULL),
  (26, 'Reuters Connect (Nurphoto)', NULL, NULL),
  (27, 'Boston Globe', 'Lean Left', NULL),
  (28, 'Vox', 'Left', NULL),
  (29, 'Manchester Evening News', 'Lean Left', NULL),
  (30, 'Daily Sabah', 'Right', NULL),
  (31, 'International Business Times', 'Center', NULL),
  (32, 'GB News', 'Right', NULL),
  (33, 'TalkTV', 'Right', NULL),
  (34, 'Islington Tribune', NULL, NULL),
  (35, 'Westminster Extra', NULL, NULL),
  (36, 'The National News Desk (KRCR)', NULL, NULL),
  (37, 'The Japan Times', NULL, NULL);
SELECT setval(pg_get_serial_sequence('press_outlets', 'id'), (SELECT max(id) FROM press_outlets));

INSERT INTO press_coverage (id, outlet_id, title, medium, url, links, published, note, created_by) SELECT *, 'press-coverage.ts' FROM (VALUES
  (1, 1, 'Peter Kyle agreed to include ''more positive language'' in AI speech after Mandelson''s advice', 'Article', 'https://www.ft.com/content/1b3e3117-b979-4187-b983-c785d230c09b', NULL, NULL, NULL),
  (2, 2, 'Movements against AI are growing — inside the groups trying to stop it', 'Article', 'https://www.wired.it/article/movimenti-contro-intelligenza-artificiale-mappa-nomi-pauseai-stopai-controlai/', NULL, '2026-05-30'::date, NULL),
  (3, 3, 'Gen Z is losing faith in AI — and protest movements are growing', 'Article', 'https://www.cosmopolitan.com/it/lifecoach/news-attualita/a71455730/gen-z-paura-intelligenza-artificiale-ansia/', NULL, '2026-06-02'::date, NULL),
  (4, 4, 'The OpenAI–Anthropic Cold War Comes to Illinois', 'Article', 'https://gizmodo.com/the-openai-anthropic-cold-war-comes-to-illinois-2000746324', NULL, '2026-04-14'::date, 'Article text never names PauseAI — it''s about an unrelated Illinois AI lobbying bill. Hero image is genuinely one of ours though: a protester holding a "PAUSEAI" sign, credited Justin Tallis/AFP via Getty — the same photographer credited on confirmed PauseAI UK photos elsewhere in this file.'),
  (5, 5, 'AI Giants Go on Charm Offensive to Avert Public Backlash', 'Article', 'https://www.wsj.com/tech/ai/ai-companies-public-relations-ae312d79', NULL, '2026-04-07'::date, NULL),
  (6, 6, 'Protesters accuse Google DeepMind of breaking AI safety promises', 'Article', 'https://www.businessinsider.com/protesters-accuse-google-deepmind-breaking-promises-ai-safety-2025-6', NULL, '2025-06-30'::date, NULL),
  (7, 7, '60 U.K. lawmakers accuse Google of breaking AI safety pledge', 'Article', 'https://time.com/7313320/google-deepmind-gemini-ai-safety-pledge/', NULL, '2025-08-29'::date, NULL),
  (8, 8, 'Lawmakers press Google DeepMind over delayed safety report', 'Article', 'https://fortune.com/2025/08/29/british-lawmakers-accuse-google-deepmind-of-breach-of-trust-over-delayed-gemini-2-5-pro-safety-report/', NULL, '2025-08-29'::date, NULL),
  (9, 9, 'I checked out one of the biggest anti-AI protests yet', 'Article', 'https://www.technologyreview.com/2026/03/02/1133814/i-checked-out-londons-biggest-ever-anti-ai-protest/', NULL, '2026-03-02'::date, NULL),
  (10, 10, 'UK arts must not be sacrificed for speculative AI gains, peers say', 'Article', 'https://www.theguardian.com/technology/2026/mar/06/uk-arts-must-not-be-sacrificed-for-speculative-ai-gains-peers-say', NULL, '2026-03-06'::date, 'Article text never names PauseAI — it''s about a House of Lords copyright report. Hero image is genuinely one of ours: protesters holding "Pull The Plug" and "It''s not too late... to regulate" signs from the same march covered elsewhere in this file.'),
  (11, 10, '''A critical moment'': concern UK is not up to speed in acting on AI risks', 'Article', 'https://www.theguardian.com/technology/2026/sep/18/a-critical-moment-concern-uk-is-not-up-to-speed-in-acting-on-ai-risks', NULL, '2026-09-18'::date, 'Body text never names PauseAI; hero image caption does ("Protesters from Pause AI block the entrance to Downing Street on Wednesday", photo: Ian Davidson/SOPA Images), from the 16 Sep protest.'),
  (12, 10, '''Pull the plug'': protesters resort to direct action against AI firms', 'Article', 'https://aol.co.uk/articles/pull-plug-protesters-resort-direct-060004000.html', NULL, '2026-10-06'::date, 'theguardian.com blocks our fetch tooling outright, so this links the AOL syndication copy instead — same Robert Booth byline, same text. Quotes Joseph Miller at length, described as having suspended his Oxford doctorate "to run Pause AI''s UK branch", plus PauseAI Global CEO Maxime Fournes. Covers the post-16-Sep surge in sign-ups and direct-action sentiment.'),
  (13, 11, 'Hundreds of people march for tighter controls on AI', 'Video', 'https://youtu.be/-0CRojvk1FE?t=146', NULL, '2026-02-28'::date, 'This URL is a third-party reupload/compilation channel ("Mark 1333"), not BBC''s own channel — searched BBC''s own site and YouTube''s official BBC News channel and couldn''t find the original source. Content looks like a genuine BBC London bulletin segment (28 Feb 2026), just not a verifiable BBC source link. Swap this for the real BBC link if it turns up.'),
  (14, 11, 'Why some experts increasingly fear AI will take over', 'Article', 'https://www.bbc.co.uk/news/articles/c74edv9887eo', NULL, '2026-09-10'::date, NULL),
  (15, 11, 'Why are there concerns AI could threaten humanity?', 'Article', 'https://www.bbc.co.uk/news/articles/c790xvnzgnno', NULL, '2026-09-14'::date, NULL),
  (16, 12, 'Endgame: Can we live with Artificial General Intelligence? - The People vs AI', 'Article', 'https://open.spotify.com/episode/3jPBSckJzWIq6Y2agpVSKH', NULL, '2026-06-10'::date, 'TODO verify: written episode description has no PauseAI mention, but this is a 33-min interview — audio may name us and there''s no transcript to check. Confirm by listening before treating as confirmed UK coverage.'),
  (17, 13, 'Pro-human AI declaration gains diverse support amid calls for stronger safety measures', 'Article', 'https://www.independent.co.uk/tech/ai-safety-declaration-steve-bannon-b2932570.html', NULL, '2026-03-05'::date, NULL),
  (18, 14, 'The rage at OpenAI has grown so immense that there are entire protests against it', 'Article', 'https://futurism.com/artificial-intelligence/rage-openai-protests', NULL, '2026-03-05'::date, 'Article text doesn''t name PauseAI by name (covers the SF "QuitGPT" protest plus a vague "London" mention), but the hero photo is confirmed to be one of our own UK protests.'),
  (19, 15, 'Pull the plug — Pause AI: a timely call for urgent regulation', 'Article', 'https://realmedia.press/pull-the-plug', NULL, '2026-03-06'::date, NULL),
  (20, 16, 'Pressing pause on AI: London activists to march in largest AI safety protest yet', 'Article', 'https://www.swlondoner.co.uk/news/27022026-pressing-pause-on-ai-london-activists-to-march-in-largest-ai-safety-protest-yet', NULL, '2026-02-27'::date, NULL),
  (21, 17, 'L''image : à Londres, une marche contre l''IA', 'Article', 'https://www.politis.fr/articles/2026/03/limage-a-londres-une-marche-contre-lia/', NULL, '2026-03-03'::date, NULL),
  (22, 18, 'When given a choice, AI opts for self-preservation over human life — and that should terrify us all', 'Article', 'https://www.dailymail.com/debate/article-16032063/AI-opts-self-preservation-human-life.html', NULL, '2026-08-05'::date, NULL),
  (23, 19, 'The anti-AI revolt is here', 'Article', 'https://www.newstatesman.com/politics/society/2026/08/the-anti-ai-revolt-is-here', NULL, '2026-08-19'::date, NULL),
  (24, 20, 'Hundreds of protesters rally against AI outside Downing Street', 'Article', 'https://www.channel4.com/news/hundreds-of-protesters-rally-against-ai-outside-downing-street', NULL, '2026-09-16'::date, 'Direct protest coverage — preferred over the newer explainer video.'),
  (25, 20, 'The danger of AI and the global race to control it - explained', 'Video', 'https://www.youtube.com/watch?v=rDb5qlSAmvQ&t=249s', NULL, '2026-09-17'::date, NULL),
  (26, 20, 'PauseAI activists stage emergency protest outside Downing Street', 'Video', NULL, '[{"label":"Facebook","url":"https://www.facebook.com/reel/1522309576272007/"},{"label":"X","url":"https://x.com/Channel4News/status/2100298598772605015"},{"label":"YouTube","url":"https://www.youtube.com/shorts/2JRtI-dDwgc"}]'::jsonb, '2026-09-16'::date, NULL),
  (27, 21, 'Science Correspondent breaks down the ''terrifying'' risks of superintelligent AI', 'Video', 'https://www.youtube.com/watch?v=cvMRaa6h8tM&t=486s', NULL, '2026-09-16'::date, NULL),
  (28, 21, 'Protesters demand pause on AI development', 'Video', NULL, '[{"label":"Instagram","url":"https://www.instagram.com/p/DdWzB4Gxkv_/"},{"label":"YouTube","url":"https://www.youtube.com/shorts/TFxdevKHM8s"}]'::jsonb, '2026-09-16'::date, NULL),
  (29, 21, 'Why is AI safety back in the spotlight', 'Video', 'https://www.youtube.com/shorts/rkgvZRnoytA', NULL, '2026-09-16'::date, NULL),
  (30, 22, 'Activists gather outside Downing Street in London, calling on governments to pause AI development', 'Video', 'https://www.instagram.com/p/DdWvDuejvh7/', NULL, '2026-09-16'::date, NULL),
  (31, 23, 'Pause AI, urging the government to limit the development of artificial intelligence amid warnings that it could lead to human extinction', 'Photos', 'https://www.imago-images.com/st/0867004406', NULL, '2026-09-16'::date, NULL),
  (32, 24, 'PauseAI activists stage emergency protest outside Downing Street in London', 'Photos', 'https://www.reutersconnect.com/item/pauseai-activists-stage-emergency-protest-outside-downing-street-in-london/dGFnOnJldXRlcnMuY29tLDIwMjY6bmV3c21sX01UMUFOQURMMDAwTkZPN1hH', NULL, '2026-09-16'::date, NULL),
  (33, 25, 'Pause AI Protest Outside Downing Street', 'Photos', 'https://www.reutersconnect.com/item/pause-ai-protest-outside-downing-street/dGFnOnJldXRlcnMuY29tLDIwMjY6bmV3c21sX01UMVpVTUEwMDBGRzlOVEs', NULL, '2026-09-16'::date, NULL),
  (34, 26, 'Pause AI Emergency Protest In London', 'Photos', 'https://www.reutersconnect.com/item/pause-ai-emergency-protest-in-london/dGFnOnJldXRlcnMuY29tLDIwMjY6bmV3c21sX01UMU5VUlBITzAwMDhGQTJTVg', NULL, '2026-09-16'::date, NULL),
  (35, 27, 'AI rivals found rare agreement on safety. Putting it into practice is harder.', 'Photos', 'https://www.bostonglobe.com/2026/09/16/business/ai-slowdown-safety/', NULL, '2026-09-16'::date, NULL),
  (36, 27, 'As Trump weighs in, AI leaders debate how to slow down without crippling the economy', 'Photos', 'https://www.bostonglobe.com/2026/09/20/business/ai-threat-slowdown-pause-economy/', NULL, '2026-09-21'::date, 'Body text never names us; the photo caption does ("A protest by civic action group PauseAI UK in London on Sept 16..."), from the Downing Street protest. TODO verify date: the URL path reads /2026/09/20/ but the byline on the page reads September 21.'),
  (37, 28, 'Should we be skeptical about the AI panic?', 'Photos', 'https://www.vox.com/podcasts/502875/ai-existential-risk-jacob-coxon-anthropic-dario-amodei', NULL, '2026-09-16'::date, NULL),
  (38, 29, 'King Charles to issue ''deeply concerning'' message to AI leaders after doomsday warnings', 'Photos', 'https://www.manchestereveningnews.co.uk/news/uk-news/king-charles-issue-deeply-concerning-34629383', NULL, '2026-09-17'::date, NULL),
  (39, 30, 'From hallucinations to wiping out humanity: How AI''s path advanced', 'Photos', 'https://www.dailysabah.com/business/tech/from-hallucinations-to-wiping-out-humanity-how-ai-path-advanced', NULL, '2026-09-17'::date, NULL),
  (40, 31, '''10% Chance of Extinction'': AI Protesters Take Scientists'' Warning to Downing Street', 'Article', 'https://www.ibtimes.co.uk/london-protesters-demand-tougher-advanced-ai-controls-1820296', NULL, '2026-09-17'::date, NULL),
  (41, 32, 'Should we shut down AI? GB News debate', 'Video', 'https://www.youtube.com/watch?v=kTc_Q72q7hY', NULL, '2026-07-24'::date, 'PauseAI Global CEO Maxime Fournes (not PauseAI UK specifically), debating Maxwell Marlow of the Adam Smith Institute.'),
  (42, 33, '"It Could Be Human Extinction" | AI Expert Warns Of Internet Catastrophe In SIX MONTHS', 'Video', 'https://www.youtube.com/watch?v=CuwQkwhhfdM', NULL, '2026-09-14'::date, 'PauseAI Global CEO Maxime Fournes (not PauseAI UK specifically), interviewed by Ian Collins.'),
  (43, 34, 'Watch out! The robots are coming', 'Article', 'https://www.islingtontribune.co.uk/article/watch-out-the-robots-are-coming', NULL, '2023-05-26'::date, NULL),
  (44, 34, 'Tech firms urged to put the brakes on AI', 'Article', 'https://www.islingtontribune.co.uk/article/tech-firms-urged-to-put-the-brakes-on-ai', NULL, '2025-06-27'::date, 'Quotes Joseph Miller as director of PauseAI UK ahead of the June 2025 DeepMind protest.'),
  (45, 34, 'What happens in Bletchley, stays in…', 'Article', 'https://www.islingtontribune.co.uk/article/what-happens-in-bletchley-stays-in', NULL, '2023-11-03'::date, 'Names the "Pause AI" movement and quotes Kabir Kumar, identified as "a PauseAI protester", at the Bletchley Park AI Safety Summit demonstration.'),
  (46, 34, 'Stark warning from protesters calling for AI pause: It''s going to turn out bad', 'Article', 'https://www.islingtontribune.co.uk/article/stark-warning-from-protesters-calling-for-ai-pause-its-going-to-turn-out-bad', NULL, '2025-07-04'::date, 'Covers a Pause AI mock trial outside Google DeepMind''s King''s Cross office. Quotes communications lead Tom Bibby ("if anyone builds it, everyone is going to die") and organiser Ella Hughes; mentions Joseph Miller without labelling him Pause AI.'),
  (47, 35, 'Warning… ‘governments are racing ahead’ with AI', 'Article', 'https://www.westminsterextra.co.uk/article/warning-governments-are-racing-ahead-with-ai', NULL, '2025-02-14'::date, 'Quotes Joseph Miller on the Parliament Square protest held during the Paris AI summit week.'),
  (48, 35, 'New Pause AI demand for moratorium', 'Article', 'https://www.westminsterextra.co.uk/article/new-pause-ai-demand-for-moratorium', NULL, '2023-10-20'::date, 'Quotes Alistair Stewart, named as "one of the founders of Pause AI in this country", ahead of the Bletchley Park summit.'),
  (49, 35, 'Extinction fear boost for Pause AI', 'Article', 'https://www.westminsterextra.co.uk/article/extinction-fear-boost-for-pause-ai', NULL, '2026-09-18'::date, 'Calls the group "Pause AI UK" and quotes director Joseph Miller at length ("We are just asking not to develop the next generation of AI"), tying growth in sign-ups to the 16 Sep Downing Street protest.'),
  (50, 36, 'AI concerns beginning to mirror Y2K-era as push for regulation continues', 'Article', 'https://krcrtv.com/news/nation-world/ai-concerns-beginning-to-mirror-y2k-era-as-push-for-regulation-continues', NULL, '2026-09-18'::date, 'Body text never names us; the photo caption does, identifying PauseAI activists with placards near Downing Street on 16 Sep.'),
  (51, 37, 'Hedging the AI doomsday risk', 'Article', 'https://www.japantimes.co.jp/commentary/2026/10/07/world/ai-doomsday-risk/', NULL, '2026-10-07'::date, 'Body text is Dambisa Moyo''s syndicated Project Syndicate column — no PauseAI mention. Hero image caption does: "Demonstrators take part in a civic protest organized by the group PauseAI UK outside Downing Street in central London on Sept. 16." Credit: AFP-JIJI.')
) AS c;
SELECT setval(pg_get_serial_sequence('press_coverage', 'id'), (SELECT max(id) FROM press_coverage));

-- Each news site the press survey has met, by its address's host without
-- "www.": its tier, and the outlet on /press it is, as Claude judged it the
-- first time the site turned up (lib/press/sources.server.ts). A tier says
-- how much a piece there is worth to us: 1, UK national news; 2, major news
-- elsewhere and the wires; 3, other real journalism; 4, what isn't
-- independent journalism. None is a site Claude didn't know, taken as 3.
CREATE TABLE press_sources (
  site       text PRIMARY KEY,
  -- As Google News first named it.
  name       text NOT NULL,
  -- What kind of source it is, as Claude judged it, from which its tier follows (KINDS in
  -- lib/press/sources.ts); none for a site whose tier was set by hand, or that Claude didn't know.
  kind       text CHECK (kind IN (
    'uk-national', 'international', 'news-agency', 'uk-regional', 'local-elsewhere', 'specialist', 'student',
    'state-media', 'press-release', 'content-farm', 'aggregator', 'finance-crypto', 'photo-agency'
  )),
  tier       smallint CHECK (tier BETWEEN 1 AND 4),
  outlet_id  bigint REFERENCES press_outlets ON DELETE SET NULL,
  -- Claude's reason for the tier, in a sentence; or who set it.
  reason     text,
  judged_at  timestamptz NOT NULL DEFAULT now()
);

-- The sites the coverage on /press is on, each under its outlet, with its
-- tier set by hand. A site several outlets share is left to the rows below.
INSERT INTO press_sources (site, name, tier, outlet_id, reason)
SELECT DISTINCT ON (s.site) s.site, o.name, t.tier, o.id, 'Set by hand, from the coverage on /press'
  FROM (VALUES
    ('Al Arabiya', 2), ('BBC', 1), ('Boston Globe', 2), ('Business Insider', 2), ('Channel 4', 1),
    ('Cosmopolitan Italia', 3), ('Daily Mail', 1), ('Daily Sabah', 4), ('Financial Times', 1), ('Fortune', 2),
    ('Futurism', 3), ('GB News', 1), ('Gizmodo', 3), ('ITV', 1), ('Imago Images', 4),
    ('International Business Times', 3), ('Islington Tribune', 3), ('MIT Technology Review', 2),
    ('Manchester Evening News', 3), ('New Statesman', 1), ('Politis', 3), ('Real Media', 3), ('SW Londoner', 3),
    ('TIME', 2), ('TalkTV', 1), ('The Guardian', 1), ('The Independent', 1), ('The Japan Times', 2),
    ('The National News Desk (KRCR)', 3), ('The Observer', 1), ('Vox', 2), ('Wall Street Journal', 2),
    ('Westminster Extra', 3), ('Wired Italia', 3)
  ) AS t(name, tier)
  JOIN press_outlets o ON o.name = t.name
  JOIN press_coverage c ON c.outlet_id = o.id
  CROSS JOIN LATERAL (
    SELECT regexp_replace(lower(substring(link FROM '^https?://([^/:?#]+)')), '^www\.', '') AS site
      FROM (SELECT c.url UNION ALL SELECT l->>'url' FROM jsonb_array_elements(c.links) AS l) AS links(link)
     WHERE link IS NOT NULL
  ) AS s
 WHERE s.site NOT IN ('youtube.com', 'youtu.be', 'instagram.com', 'x.com', 'twitter.com', 'facebook.com',
                      'tiktok.com', 'open.spotify.com', 'aol.co.uk', 'aol.com', 'msn.com', 'yahoo.com',
                      'news.yahoo.com', 'uk.news.yahoo.com', 'news.google.com', 'reutersconnect.com')
 ORDER BY s.site, t.tier;

-- Sites many outlets post on or copy to, under none of them: the copies and
-- the pictures for sale are tier 4; a video or a post is worth what its
-- maker is, which the site doesn't say, so it has no tier.
INSERT INTO press_sources (site, name, tier, reason) VALUES
  ('aol.co.uk', 'AOL', 4, 'Set by hand: copies of others'' pieces'),
  ('aol.com', 'AOL', 4, 'Set by hand: copies of others'' pieces'),
  ('msn.com', 'MSN', 4, 'Set by hand: copies of others'' pieces'),
  ('yahoo.com', 'Yahoo', 4, 'Set by hand: copies of others'' pieces'),
  ('news.yahoo.com', 'Yahoo News', 4, 'Set by hand: copies of others'' pieces'),
  ('uk.news.yahoo.com', 'Yahoo News UK', 4, 'Set by hand: copies of others'' pieces'),
  ('reutersconnect.com', 'Reuters Connect', 4, 'Set by hand: pictures for sale'),
  ('youtube.com', 'YouTube', NULL, 'Set by hand: anyone''s videos'),
  ('youtu.be', 'YouTube', NULL, 'Set by hand: anyone''s videos'),
  ('instagram.com', 'Instagram', NULL, 'Set by hand: anyone''s posts'),
  ('x.com', 'X', NULL, 'Set by hand: anyone''s posts'),
  ('twitter.com', 'X', NULL, 'Set by hand: anyone''s posts'),
  ('facebook.com', 'Facebook', NULL, 'Set by hand: anyone''s posts'),
  ('tiktok.com', 'TikTok', NULL, 'Set by hand: anyone''s videos'),
  ('open.spotify.com', 'Spotify', NULL, 'Set by hand: anyone''s podcasts')
ON CONFLICT (site) DO NOTHING;

ALTER TABLE import_runs DROP CONSTRAINT import_runs_job_check;
ALTER TABLE import_runs ADD CONSTRAINT import_runs_job_check
  CHECK (job IN ('import-parliament', 'import-scottish-parliament', 'import-senedd',
    'import-ni-assembly', 'import-controlai', 'import-controlai-statement', 'import-edm', 'import-luma',
    'read-gmail', 'send-mailings', 'tidy-logs', 'import-civicrm', 'import-press'));
