-- What goes wrong on the site outside a job's run (lib/server/errors-seen.ts):
-- a row for each error, counted each time it happens. Two happenings are one
-- error when their key matches: where it was, its class, and its code or its
-- words with what varies taken out (lib/error-key.ts). `words` is those, and
-- the `latest_` columns are the newest happening's, as it came.
CREATE TABLE errors_seen (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text NOT NULL UNIQUE,
  -- What was running: a page, a route handler, a Server Action or the proxy,
  -- as Next names them; a problem reported outside a run (problem()); or the
  -- browser, a page that fell over or anything else it threw.
  kind text NOT NULL
    CHECK (kind IN ('render', 'route', 'action', 'proxy', 'problem', 'browser-page', 'browser-other')),
  -- The route's pattern (/staff/politicians/[id]); for the browser's, the
  -- page's path with what varies taken out; empty for a problem.
  route text NOT NULL,
  name text NOT NULL,
  code text,
  words text NOT NULL,
  latest_words text NOT NULL,
  latest_stack text,
  latest_browser text,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 1 CHECK (count > 0),
  -- When staff were last to be emailed about it, and its count then: the
  -- email went, or the hour's limit on emails left it out.
  alerted_at timestamptz,
  alerted_count integer NOT NULL DEFAULT 0,
  CHECK (last_seen >= first_seen),
  CHECK (alerted_count BETWEEN 0 AND count),
  CHECK ((alerted_at IS NULL) = (alerted_count = 0)),
  CHECK (latest_browser IS NULL OR kind IN ('browser-page', 'browser-other'))
);

-- The staff page lists them newest first, and the nightly tidying deletes
-- those not seen for a month.
CREATE INDEX errors_seen_last_seen ON errors_seen (last_seen DESC, id DESC);
