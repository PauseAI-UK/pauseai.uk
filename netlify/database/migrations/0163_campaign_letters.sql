-- Each Email your MP campaign's letter, as staff write it on the staff
-- site: the versions published, which supporters start from, and the
-- draft staff are working on, if any. The campaign's page, its words and
-- attachments are in code (lib/content/email-your-mp.ts).
--
-- `body` is a mailing's letter (lib/mailings/doc.ts): the MP's fields and
-- the sender's name, and parts only for MPs with an answer to an ask.
-- `version` counts a draft's saves, so a save from a page that's fallen
-- behind is refused. Publishing stamps the draft with `published_at` and
-- `published_by`, and a published row never changes after. The versions
-- this migration copies from the code have no `published_by`.
CREATE TABLE campaign_letters (
  id           bigserial PRIMARY KEY,
  campaign     text NOT NULL REFERENCES campaigns (slug) ON DELETE CASCADE,
  subject      text NOT NULL,
  body         jsonb NOT NULL CHECK (jsonb_typeof(body) = 'object'),
  version      integer NOT NULL DEFAULT 1,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text,
  published_at timestamptz,
  published_by text CHECK (published_by IS NULL OR published_at IS NOT NULL),
  UNIQUE (id, campaign)
);

-- A campaign has one draft at most.
CREATE UNIQUE INDEX campaign_letters_one_draft ON campaign_letters (campaign) WHERE published_at IS NULL;

-- A published version is what letters started from, so it never changes.
CREATE FUNCTION campaign_letters_published_fixed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'campaign letter % is published, so it can''t change', OLD.id;
END;
$$;
CREATE TRIGGER campaign_letters_published_fixed BEFORE UPDATE ON campaign_letters
  FOR EACH ROW WHEN (OLD.published_at IS NOT NULL) EXECUTE FUNCTION campaign_letters_published_fixed();

-- The version a supporter's letter started from, of the letter's own
-- campaign; none for letters from before there were versions.
ALTER TABLE letters_from_supporters
  ADD COLUMN campaign_letter_id bigint,
  ADD FOREIGN KEY (campaign_letter_id, campaign) REFERENCES campaign_letters (id, campaign);

INSERT INTO campaign_letters (campaign, subject, body, published_at) VALUES
  ('regulate-letter-pm', 'Request to co-sign letter on frontier AI risks',
    $letter${"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Dear "},{"type":"field","attrs":{"field":"salutation"}},{"type":"text","text":","}]},{"type":"paragraph","content":[{"type":"text","text":"I'm a resident of "},{"type":"field","attrs":{"field":"constituency"}},{"type":"text","text":" and a supporter of "},{"type":"text","text":"PauseAI","marks":[{"type":"bold"}]},{"type":"text","text":", a civic movement focused on averting the risks of superhuman AI. I am very concerned that AI development is racing ahead without adequate protection for the public."}]},{"type":"paragraph","content":[{"type":"text","text":"AI now poses an extremely serious risk to our national security. Parliamentarians in the United Kingdom, and politicians around the globe are moving to answer the call from AI developers, Nobel Laureates and concerned citizens to regulate AI immediately."}]},{"type":"paragraph","content":[{"type":"text","text":"The UK has no specific legal standards for frontier AI safety.","marks":[{"type":"bold"}]},{"type":"text","text":" No regulator oversees frontier AI development. And UK law does not reliably hold developers liable for damage or deaths caused by their models, even when the danger is predictable, preventable and uniquely enabled by AI."}]},{"type":"paragraph","content":[{"type":"text","text":"Please could you add your name to PauseAI's open letter (attached) in support of frontier AI legislation? To sign, just send a quick email to policy@pauseai.uk."}]},{"type":"paragraph","content":[{"type":"text","text":"I would also like you to arrange a short meeting with me to discuss this important matter."}]},{"type":"paragraph","content":[{"type":"text","text":"Thank you for your consideration,"}]},{"type":"paragraph","content":[{"type":"field","attrs":{"field":"sender"}}]}]}$letter$,
    now()),
  ('support-sobel-bill', 'Request to support the Artificial Superintelligence Bill',
    $letter${"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Dear "},{"type":"field","attrs":{"field":"salutation"}},{"type":"text","text":","}]},{"type":"paragraph","content":[{"type":"text","text":"I'm a resident of "},{"type":"field","attrs":{"field":"constituency"}},{"type":"text","text":" and a supporter of "},{"type":"text","text":"PauseAI","marks":[{"type":"bold"}]},{"type":"text","text":", a civic movement focused on averting the risks of superhuman AI. I am very concerned that AI development is racing ahead without adequate protection for the public."}]},{"type":"paragraph","content":[{"type":"text","text":"AI now poses an extremely serious risk to our national security. Parliamentarians in the United Kingdom, and politicians around the globe are moving to answer the call from AI developers, Nobel Laureates and concerned citizens to stop building out of control superintelligence."}]},{"type":"paragraph","content":[{"type":"text","text":"Alex Sobel MP has tabled the Artificial Superintelligence Bill to protect the public from this threat. It does the following:"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Makes it a crime to build an AI that could overpower the UK government"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Starts monitoring AI computing power, just as we do for nuclear weapons"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Pushes for a global ban with an international treaty"}]}]}]},{"type":"onlyFor","attrs":{"condition":"controlai-letter:signed"},"content":[{"type":"paragraph","content":[{"type":"text","text":"Thank you for signing the ControlAI letter to the Prime Minister in support of the Bill."}]}]},{"type":"paragraph","content":[{"type":"text","text":"Please consider attending the second reading debate in person to support the bill.","marks":[{"type":"bold"}]}]},{"type":"paragraph","content":[{"type":"text","text":"Thank you for your consideration,"}]},{"type":"paragraph","content":[{"type":"field","attrs":{"field":"sender"}}]}]}$letter$,
    now());
