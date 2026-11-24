import BriefingBox from "@/components/briefings/BriefingBox";
import BriefingColumns from "@/components/briefings/BriefingColumns";
import BriefingFigure from "@/components/briefings/BriefingFigure";
import BriefingFlags from "@/components/briefings/BriefingFlags";
import BriefingQuote from "@/components/briefings/BriefingQuote";
import BriefingSources from "@/components/briefings/BriefingSources";
import { Accent, ColumnList, Subhead } from "@/components/briefings/BriefingText";
import WeekCalendar from "@/components/briefings/WeekCalendar";
import { cite, defineBriefing } from "./define";

const US = { code: "us", name: "United States" };

const briefing = defineBriefing({
  slug: "ai-news-weekly-briefing-13th-20th-november",
  title: "AI News Weekly Briefing - 13th-20th November",
  date: "2026-11-20",
  author: "Annabelle Collins",
  week: [
    {
      date: "2026-11-16",
      events: [
        { what: "OpenAI assessments", tone: "industry" },
        { what: "Turing AI Fellows", tone: "good" },
      ],
    },
    {
      date: "2026-11-17",
      events: [
        { what: "GPT-6.2 Astra", tone: "industry" },
        { what: "Isomorphic £3.8bn", tone: "good" },
      ],
    },
    {
      date: "2026-11-18",
      events: [
        { what: "BIST AI report", tone: "parliament" },
        { what: "California report", tone: "international" },
      ],
    },
    {
      date: "2026-11-19",
      events: [
        { what: "Commons AI debate", tone: "parliament" },
        { what: "Anthropic IPO", tone: "industry" },
      ],
    },
    { date: "2026-11-20", events: [] },
  ],
  keyStories: [
    {
      lead: "Wednesday: MPs call for AI regulator.",
      body: (
        <>
          The report released makes recommendations for a regulator separate to the AI Security Institute, a bill to
          enshrine it in law, and G20 objectives about international convention on AI safety.
        </>
      ),
    },
    {
      lead: "Wednesday: California regulation?",
      body: (
        <>
          A report from Governor Newsom’s office calls for California powers to shut down dangerous AI and powers to cap
          recursive self-improvement (RSI).
        </>
      ),
    },
  ],
  content: (
    <>
      <BriefingBox title="This week in Westminster" tone="parliament">
        <h3>
          <Accent>Weds 18th Nov</Accent> - MPs call for an AI Safety and Security Bill
        </h3>
        <BriefingColumns layout="figure">
          <div>
            <p>
              The Business, Innovation, Science and Trade Committee released a report “
              <em>Guardrails for Growth: Making AI Safe</em>” listing ten gaps in current protections, and seeking
              evidence on how the UK could broker an international agreement.{cite(1)}
            </p>
            <Subhead>What they ask for:</Subhead>
            <ul>
              <li>
                an AI Safety and Security bill to “enshrine aspects of the new protections we set out in this report”
              </li>
              <li>
                a regulator, separate to the AI Security Institute, able to:
                <ul>
                  <li>pause risky training</li>
                  <li>require independent checks</li>
                  <li>delay or prohibit dangerous releases</li>
                </ul>
              </li>
              <li>ministers to set out G20 objectives within 3 months{cite(1)}</li>
            </ul>
          </div>
          <BriefingFigure
            src="/images/briefings/regulator-at-every-stage.png"
            alt="Diagram: MPs want a regulator that can act at every stage of a model’s life. Training: pause risky training runs. Release decision: delay or prohibit a model release. In service: withdraw services if risks uncontained. Material change: fresh assessment on material change."
            width={1140}
            height={978}
            cite={cite(1)}
            beside
          />
        </BriefingColumns>
        <BriefingColumns layout="even">
          <BriefingQuote size="small">
            “Inevitably, this Bill will need to dovetail with, and enshrine key elements of, an international convention
            on AI safety which should be the centrepiece of the UK’s G20 Presidency.”{cite(1)}
          </BriefingQuote>
          <BriefingQuote size="small">
            “Given the speed with which this technology is evolving, we accept it may prove essential that ministers are
            granted order-making powers, which allow them to act to safeguard the public quickly.”{cite(1)}
          </BriefingQuote>
        </BriefingColumns>

        <h3>
          <Accent>Thurs 19th Nov</Accent> - Commons General Debate on emerging risks of advanced AI
        </h3>
        <p>
          On Thursday we saw the first debate in the Commons chamber on regulating advanced AI, hoped to be the first of
          many. Led by Plaid Cymru MP Ben Lake, MPs from across the political spectrum spoke about the risks of runaway
          machine intelligence and the case for binding rules on the most powerful AI systems.{cite(2)}
        </p>
        <BriefingQuote who="Ben Lake, MP">
          “Companies appear to be locked in a race to develop systems that are even smarter and more autonomous with the
          ability to outcompete humanity, what is sometimes referred to as ‘Superintelligent AI’ or runaway machine
          intelligence”{cite(2)}
        </BriefingQuote>

        <BriefingColumns layout="even">
          <div>
            <h3>
              <Accent>Sat 14th Nov</Accent> - Walking the Streets
            </h3>
            <p>
              An estimated 6000 Brits marched through Edinburgh last Saturday 14th to demand a say over the expansion of
              datacentres across Scotland.
              <br />
              More than 80 organisations and community groups backed the protest.{cite(3)}
            </p>
          </div>
          <div>
            <p>
              The March Against AI Extinction, set to be the largest AI safety protest so far, is scheduled 21st Nov in
              London.{cite(4)}
            </p>
            <BriefingFigure
              src="/images/briefings/march-route-london.png"
              alt="London march, Saturday 21 November, 12 to 3pm, from All Souls’ Place to Downing Street"
              width={1140}
              height={252}
              cite={cite(4)}
              beside
            />
          </div>
        </BriefingColumns>
      </BriefingBox>

      <BriefingBox title="International & cooperation" tone="international">
        <BriefingQuote who="Susan Rice, National Security Advisor to the Obama administration at March for an AI Treaty, Sat 14th Nov">
          “There is nothing more urgent than stopping AI from achieving superintelligence and preventing catastrophic
          risk to humanity.”{cite(5)}
        </BriefingQuote>

        <h3>
          <Accent>Wed 18th Nov</Accent> - California proposes a power to shut down dangerous AI systems
        </h3>
        <BriefingFlags countries={[US]} />
        <BriefingColumns layout="even">
          <p>
            Governor Newsom’s office issued a report Wednesday calling for California to have the authority to prevent
            companies from developing AI that exceeds human control, dubbed “emergency brakes”.{cite(6)}
          </p>
          <BriefingQuote size="small">
            “Loss-of-control incidents, once the stuff of AI theory, now occur with disturbing frequency.”{cite(6)}
          </BriefingQuote>
        </BriefingColumns>
        <Subhead>The report calls for:</Subhead>
        <ColumnList>
          <li>emergency shutdown authority</li>
          <li>mandatory third-party oversight & inspections</li>
          <li>baseline standards for all developers</li>
          <li>the power to impose a cap on recursive self improvement (RSI).{cite(6)}</li>
        </ColumnList>

        <h3>
          <Accent>Fri 20th Nov</Accent> - Trump says he and Xi agreed to pursue AI guardrails
        </h3>
        <BriefingFlags countries={[US, { code: "cn", name: "China" }]} />
        <BriefingQuote who="Donald Trump, after meeting Xi Jinping in Shenzhen at the Asia-Pacific Economic Cooperation (APEC) summit">
          “It’s not artificial intelligence. It’s not artificial, it’s super. The problem is, it may be too super. So
          President Xi and I agree that we’re going to do some joint guardrails”{cite(7)}
        </BriefingQuote>
      </BriefingBox>

      <BriefingBox title="Frontier AI Labs" tone="industry">
        <h3>
          <Accent>Mon 16th Nov</Accent> - OpenAI’s embedded assessments fall short of “employee-like” access
        </h3>
        <p>
          OpenAI announced external evaluators from four organisations: METR, Apollo Research, Transluce and Goodfire,
          would get “deep access” to internal models for the purposes of embedded safety assessments. The conditions
          agreed drew criticism for allowing less access than previously promised.{cite(8)}
        </p>
        <p>
          For example, assessors get no Slack access, OpenAI picks which staff they talk to, and a “tattletale” clause
          forces evaluators to route concerns raised by other staff back through OpenAI.{cite(9)}
        </p>

        <h3>
          <Accent>Tues 17th Nov</Accent> - OpenAI releases GPT-6.2 Astra, first released model to rate “High” risk for
          self-improvement.
        </h3>
        <p>
          OpenAI released new models GPT-6.2 Astra and the smaller GPT-6.2 Sol.{cite(10)} External evaluation by AISI
          found that pre-release versions of GPT-6.2 Astra were substantially easier to jailbreak than GPT-6 Astra;
          OpenAI says it believes it has mitigated this, but as of 17 November AISI had not independently tested the
          changes.
          {cite(11)}
        </p>
        <BriefingColumns layout="even">
          <BriefingQuote who="Kanishka Narayan MP, UK AI Minister" size="small">
            “AISI identified a substantial regression in the strength of GPT-6.2 Astra’s safeguards versus GPT-6
            Astra’s”{cite(9)}
          </BriefingQuote>
          <BriefingQuote who="Tomek Korbak, ex OpenAI" size="small">
            “overall I think GPT-6.2 Astra harder to monitor than GPT-6 Astra in the contexts we care about.”{cite(9)}
          </BriefingQuote>
        </BriefingColumns>

        <h3>
          <Accent>Thurs 19th Nov</Accent> - Anthropic’s record IPO / The MisAnthropic Statement.
        </h3>
        <p>
          Anthropic, one of the big two and maker of the AI “Claude”, went public. Shares were initially priced at $83
          per share, and it closed its first day of trading at $97.17.{cite(12)} “The misAnthropic Statement” was
          released on the eve of the listing{cite(13)} and protests occurred outside Anthropic offices in San Francisco
          & the Nasdaq in New York City.{cite(12)}
        </p>
        <BriefingQuote who="- The MisAnthropic Statement">
          “Anthropic warns that recursively self-improving AI could concentrate power and escape human control, yet
          races to build it first. The company uses safety branding to court investors, employees, and the public—even
          as it has quietly weakened its safety pledges and lobbied for self-serving regulation. Anthropic is not a safe
          AI company, and we must reject its reckless attempt to amass power in the name of the greater good.”{cite(13)}
        </BriefingQuote>
      </BriefingBox>

      <BriefingColumns layout="pair">
        <BriefingBox title="Good news!" tone="good">
          <p>
            <strong>UK company seeking to “solve all disease” is funded:</strong>
            <br />
            London-based Isomorphic Labs, founded by Sir Demis Hassabis, secured £3.8 billion investment, the largest
            ever for a British AI company.{cite(14)} This advances Britain’s position as a world-leader in AI-powered
            medicine.
          </p>
          <p>
            <strong>UKRI invests in 20 Turing AI Fellows to strengthen UK capability</strong>: “A new cohort of
            researchers will use artificial intelligence (AI) to tackle some of society’s biggest challenges.” such as
            cleaner energy and healthcare{cite(15)}
          </p>
        </BriefingBox>
        <BriefingBox title="Next week key dates" tone="diary">
          <WeekCalendar
            days={[
              { date: "2026-11-23", events: [{ what: "PauseAI conference in Parliament", tone: "parliament" }] },
              { date: "2026-11-24", events: [] },
              { date: "2026-11-25", events: [] },
              { date: "2026-11-26", events: [{ what: "Lords AI evidence call closes 5pm", tone: "parliament" }] },
              { date: "2026-11-27", events: [] },
            ]}
          />
          <ul>
            <li>
              <strong>Sat 21 Nov:</strong> March Against AI Extinction, London.{cite(4)}
            </li>
            <li>
              <strong>Mon 23 Nov:</strong> PauseAI Conference in Parliament.
            </li>
            <li>
              <strong>Thu 26 Nov:</strong> Lords AI evidence deadline.{cite(16)}
            </li>
          </ul>
        </BriefingBox>
      </BriefingColumns>

      <BriefingSources>
        <li id="source-1">
          Business, Innovation, Science and Trade Committee (2026) <em>Guardrails for Growth: Making AI Safe</em>. House
          of Commons, 18 November. Available at:{" "}
          <a
            href="https://committees.parliament.uk/committee/365/business-innovation-science-and-trade-committee/news/219006/close-ai-safety-gaps-to-secure-britains-400-billion-ai-growth-opportunity-mps-urge/"
            target="_blank"
            rel="noreferrer"
          >
            https://committees.parliament.uk/committee/365/business-innovation-science-and-trade-committee/news/219006/close-ai-safety-gaps-to-secure-britains-400-billion-ai-growth-opportunity-mps-urge/
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
        <li id="source-2">
          Hansard (2026) <em>AI: Emerging Risks</em>. HC Deb, 19 November, vol. 793. Available at:{" "}
          <a
            href="https://hansard.parliament.uk/Commons/2026-11-19/debates/d7cd8c55-d645-4e2f-a244-a46d76b1f3f6/CommonsChamber"
            target="_blank"
            rel="noreferrer"
          >
            https://hansard.parliament.uk/Commons/2026-11-19/debates/d7cd8c55-d645-4e2f-a244-a46d76b1f3f6/CommonsChamber
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
        <li id="source-3">
          Edinburgh Evening News (2026){" "}
          <em>Thousands march against AI data centres in Edinburgh as campaigners call for ‘national conversation’</em>.
          14 November. Available at:{" "}
          <a
            href="https://www.edinburghnews.scotsman.com/news/edinburgh-protests-ai-data-centres-thousands-join-march-nation-conversation-9351417"
            target="_blank"
            rel="noreferrer"
          >
            https://www.edinburghnews.scotsman.com/news/edinburgh-protests-ai-data-centres-thousands-join-march-nation-conversation-9351417
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
        <li id="source-4">
          PauseAI UK (2026) <em>March Against AI Extinction</em> [event listing]. EA Forum. Available at:{" "}
          <a
            href="https://forum.effectivealtruism.org/events/8swxbQHRQKyFpuYkq/march-against-ai-extinction"
            target="_blank"
            rel="noreferrer"
          >
            https://forum.effectivealtruism.org/events/8swxbQHRQKyFpuYkq/march-against-ai-extinction
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
        <li id="source-5">
          Lovely, G. [@GarrisonLovely] (2026) [X post quoting @CalltoActivism: Susan Rice speaking at the March for an
          AI Treaty], 15 November. Available at:{" "}
          <a href="https://x.com/GarrisonLovely" target="_blank" rel="noreferrer">
            https://x.com/GarrisonLovely
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
        <li id="source-6">
          California Government Operations Agency (2026) <em>AI Safety in 2026 and Beyond</em>. State of California, 16
          November (released 18 November). Available at:{" "}
          <a
            href="https://www.govops.ca.gov/wp-content/uploads/sites/11/2026/11/FINAL_-AI-Safety-in-2026-and-Beyond-v2.pdf"
            target="_blank"
            rel="noreferrer"
          >
            https://www.govops.ca.gov/wp-content/uploads/sites/11/2026/11/FINAL_-AI-Safety-in-2026-and-Beyond-v2.pdf
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
        <li id="source-7">
          NPR (2026) <em>Trump touts meeting with Xi and Putin but offers little results</em>. 20 November. Available
          at:{" "}
          <a
            href="https://www.wskg.org/npr-news/2026-11-20/trump-touts-meeting-with-xi-and-putin-but-offers-little-results"
            target="_blank"
            rel="noreferrer"
          >
            https://www.wskg.org/npr-news/2026-11-20/trump-touts-meeting-with-xi-and-putin-but-offers-little-results
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
        <li id="source-8">
          OpenAI (2026) <em>Our first phase of embedded assessments</em>. 16 November. Available at:{" "}
          <a href="https://openai.com/index/our-first-phase-of-embedded-assessments/" target="_blank" rel="noreferrer">
            https://openai.com/index/our-first-phase-of-embedded-assessments/
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
        <li id="source-9">
          Posts on X, 16–17 November 2026: Balesni, M. [@balesni], 16 Nov; Kokotajlo, D. [@DKokotajlo], 16 Nov; Adler,
          S. [@sjgadler], 16 Nov; Narayan, K. [@KanishkaNarayan], thread post 2/6, 17 Nov; Korbak, T. [@tomekkorbak], 17
          Nov. Available at:{" "}
          <a href="https://x.com/balesni" target="_blank" rel="noreferrer">
            https://x.com/balesni
          </a>
          ;{" "}
          <a href="https://x.com/DKokotajlo" target="_blank" rel="noreferrer">
            https://x.com/DKokotajlo
          </a>
          ;{" "}
          <a href="https://x.com/sjgadler" target="_blank" rel="noreferrer">
            https://x.com/sjgadler
          </a>
          ;{" "}
          <a href="https://x.com/KanishkaNarayan" target="_blank" rel="noreferrer">
            https://x.com/KanishkaNarayan
          </a>
          ;{" "}
          <a href="https://x.com/tomekkorbak" target="_blank" rel="noreferrer">
            https://x.com/tomekkorbak
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
        <li id="source-10">
          OpenAI (2026) <em>Introducing GPT-6.2 Astra and Sol</em>. 17 November. Available at:{" "}
          <a href="https://openai.com/index/introducing-gpt-6-2-astra-sol/" target="_blank" rel="noreferrer">
            https://openai.com/index/introducing-gpt-6-2-astra-sol/
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
        <li id="source-11">
          OpenAI (2026) <em>GPT-6.2 System Card</em>, section 2.2.6.3: External Evaluations of Cyber Safeguards – UK
          AISI. OpenAI Deployment Safety Hub, 17 November. Available at:{" "}
          <a href="https://deploymentsafety.openai.com/gpt-6-2-astra-sol" target="_blank" rel="noreferrer">
            https://deploymentsafety.openai.com/gpt-6-2-astra-sol
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
        <li id="source-12">
          CNBC (2026) [Live updates: Anthropic’s first day of trading on the Nasdaq], 19 November. Available at:{" "}
          <a
            href="https://www.cnbc.com/2026/11/19/anthropic-ipo-ant-live-updates.html"
            target="_blank"
            rel="noreferrer"
          >
            https://www.cnbc.com/2026/11/19/anthropic-ipo-ant-live-updates.html
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
        <li id="source-13">
          Center for AI Safety (2026) <em>Anthropic is not a safe AI company</em> [the misAnthropic Statement]. 18
          November. Available at:{" "}
          <a href="https://safe.ai/news/anthropic-is-not-a-safe-ai-company" target="_blank" rel="noreferrer">
            https://safe.ai/news/anthropic-is-not-a-safe-ai-company
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
        <li id="source-14">
          BioIndustry Association (2026) <em>BIA response to Isomorphic £3.8 billion raise</em>. 17 November. Available
          at:{" "}
          <a
            href="https://www.bioindustry.org/resource/bia-response-to-isomorphic-3-8-billion-raise.html"
            target="_blank"
            rel="noreferrer"
          >
            https://www.bioindustry.org/resource/bia-response-to-isomorphic-3-8-billion-raise.html
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
        <li id="source-15">
          UK Research and Innovation (2026) <em>UKRI invests in 20 Turing AI Fellows to strengthen UK capability</em>.
          16 November. Available at:{" "}
          <a
            href="https://www.ukri.org/news/ukri-invests-in-20-turing-ai-fellows-to-strengthen-uk-capability/"
            target="_blank"
            rel="noreferrer"
          >
            https://www.ukri.org/news/ukri-invests-in-20-turing-ai-fellows-to-strengthen-uk-capability/
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
        <li id="source-16">
          Resultsense (2026) [Lords International Relations and Defence Committee opens call for evidence on AI
          governance], 23 October. Available at:{" "}
          <a
            href="https://www.resultsense.com/news/2026-10-23-lords-committee-ai-governance-inquiry/"
            target="_blank"
            rel="noreferrer"
          >
            https://www.resultsense.com/news/2026-10-23-lords-committee-ai-governance-inquiry/
          </a>{" "}
          (Accessed: 20 November 2026).
        </li>
      </BriefingSources>
    </>
  ),
});

export default briefing;
