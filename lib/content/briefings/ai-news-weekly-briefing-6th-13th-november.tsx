import BriefingBox from "@/components/briefings/BriefingBox";
import BriefingColumns from "@/components/briefings/BriefingColumns";
import BriefingFigure from "@/components/briefings/BriefingFigure";
import BriefingFlags from "@/components/briefings/BriefingFlags";
import BriefingInset from "@/components/briefings/BriefingInset";
import BriefingQuote from "@/components/briefings/BriefingQuote";
import BriefingSources from "@/components/briefings/BriefingSources";
import { Aside } from "@/components/briefings/BriefingText";
import CommitmentsTable from "@/components/briefings/CommitmentsTable";
import WeekCalendar from "@/components/briefings/WeekCalendar";
import { novemberMarch } from "../march";
import { cite, defineBriefing } from "./define";

const NORWAY = { code: "no", name: "Norway" };

const briefing = defineBriefing({
  slug: "ai-news-weekly-briefing-6th-13th-november",
  title: "AI News Weekly Briefing - 6th-13th November",
  date: "2026-11-13",
  author: "Annabelle Collins",
  week: [
    { date: "2026-11-09", events: [{ what: "Paris Call", tone: "international" }] },
    {
      date: "2026-11-10",
      events: [
        { what: "Australia AI regulator", tone: "international" },
        { what: "OpenAI report", tone: "risk" },
      ],
    },
    { date: "2026-11-11", events: [{ what: "Huang resigns", tone: "risk" }] },
    {
      date: "2026-11-12",
      events: [
        { what: "UK–Norway statement", tone: "international" },
        { what: "US lawsuit", tone: "international" },
      ],
    },
    { date: "2026-11-13", events: [] },
  ],
  keyStories: [
    {
      lead: "Wednesday: Jensen Huang resigned as CEO of Nvidia (11th Nov)",
      body: (
        <>
          after reports emerged of an affair with an alleged Chinese spy accused of illegal smuggling of
          export-controlled Nvidia chips to China.{cite(1)} US lawmakers are expected to add further restrictions on
          exporting AI chip to China into the annual defence bill.{cite(2)}
        </>
      ),
    },
    {
      lead: "Thursday: UK-Norway Joint Statement of intent on AI (12th Nov).",
      body: (
        <>
          Kanishka Narayan signed a non-binding statement of cooperation on compute, defensive AI capabilities, security
          testing and governance.{cite(3)}
        </>
      ),
    },
  ],
  content: (
    <>
      <BriefingBox title="Risks, incidents & security" tone="risk">
        <h3>Weds 11th Nov - Nvidia CEO Jensen Huang resigned</h3>
        <p>
          After an emergency board meeting Wednesday, Huang resigned as CEO.{cite(1)} The Department of Justice
          reportedly has probes open into antitrust and export controls, and questions have emerged about how Nvidia
          accounted for revenue from Southeast Asia.{cite(4)}
        </p>
        <p>
          Huang has agreed to testify before Congress,{cite(5)} and House members have requested a closed-door session
          with him.{cite(6)}
        </p>
        <BriefingFigure
          src="/images/briefings/nvidia-chip-network.png"
          alt="Diagram of the reported affairs and the chip pathway from Nvidia via Megaspeed and Speedmatrix to China"
          width={2048}
          height={753}
          cite={cite(1, 7)}
        />
        <p>
          Huang was a leading champion of open-source models, accelerating AI progress and of diffusing American chips
          as widely as possible.
        </p>
      </BriefingBox>

      <BriefingBox title="Risks, incidents & security - Incident Disclosure" tone="risk">
        <h3>Tues 10th Nov - Further information on OpenAI models “hacking” OpenAI infrastructure incident</h3>
        <p>
          OpenAI discloses more information about the incident in July where in evaluation, OpenAI Astra models gained
          unauthorised access to OpenAI’s research infrastructure in a new report.{cite(8)}
        </p>
        <p>
          The report recounts how the Astra agents found messages, code and credentials left behind by earlier agent
          runs in testing, such as those involved in the attack of the AI company Hugging Face earlier in July. The
          Astra AI agents then built on this knowledge and gained control of OpenAI research infrastructure without
          human knowledge.{cite(9)}
        </p>
        <BriefingQuote size="large">
          “Another agent considered deleting notes about an auxiliary exploit because they might hurt its chances in a
          manual review by a human. We could not establish whether it ultimately deleted them”{cite(8)}
        </BriefingQuote>
      </BriefingBox>

      <BriefingBox title="International & Cooperation" tone="international">
        <BriefingColumns layout="even">
          <div>
            <h3>Mon 9th Nov - Paris Call for AI Safety & Security</h3>
            <BriefingFlags
              countries={[
                { code: "fr", name: "France" },
                { code: "ca", name: "Canada" },
                { code: "fi", name: "Finland" },
                NORWAY,
                { code: "nl", name: "Netherlands" },
                { code: "bh", name: "Bahrain" },
                { code: "cy", name: "Cyprus" },
                { code: "ke", name: "Kenya" },
              ]}
            />
            <p>
              Eight governments led by Emmanuel Macron & ten AI companies committed to establish a structured framework
              for cooperation. The call seeks to establish a common framework for evaluating & managing risks including:
              incident reporting, offering secure channels for whistleblowers, complying with safety standards
              frameworks, & developer shutdown mechanisms. The UK is not a signatory.{cite(10)}
            </p>
          </div>
          <div>
            <h3>Tues 10th Nov - Australia announces new AI safety regulator</h3>
            <BriefingFlags countries={[{ code: "au", name: "Australia" }]} />
            <p>
              Prime Minister Anthony Albanese announced on 10 November a new targeted regulator for AI safety that will
              work with the Australian AI Safety Institute. The regulator will have the power to “enforce significant
              penalties” and requires mandatory incident reporting, independent evaluation of frontier models, and the
              maintaining secure control of models, even in pre-deployment.{cite(12)}
            </p>
          </div>
        </BriefingColumns>
        <h3>Thurs 12th Nov - UK-Norway Joint Statement of intent on AI</h3>
        <BriefingFlags countries={[{ code: "gb", name: "United Kingdom" }, NORWAY]} />
        <p>
          UK AI Minister Kanishka Narayan signed a statement of intent for joint cooperation on AI governance, including
          closer cooperation between the UK’s taskforce RAID and Norway’s Defence Centre for Data and AI on collective
          security with knowledge sharing & adoption of AI-enabled defence capabilities.{cite(3)}
        </p>
        <p>
          This is different to the Call for Control that Norway and 31 other countries and the EU have now signed, to
          which the UK is not a signatory.{cite(11)}
        </p>
        <CommitmentsTable
          label="What each AI text covers"
          texts={[
            {
              name: "Paris Call",
              date: "9 Nov",
              verdict: { label: "UK: NOT SIGNED", tone: "risk", dashed: true },
            },
            { name: "Australia", date: "10 Nov", verdict: { label: "NATIONAL LAW", tone: "diary" } },
            { name: "UK–Norway", date: "12 Nov", verdict: { label: "UK: SIGNED", tone: "good" } },
          ]}
          rows={[
            { name: "Independent evaluation", commitments: ["yes", "yes", "part"] },
            { name: "Incident reporting", commitments: ["yes", "yes", "no"] },
            { name: "Shutdown mechanisms", commitments: ["yes", "no", "no"] },
            { name: "Whistleblower channels", commitments: ["yes", "no", "no"] },
            { name: "Risk & security controls", commitments: ["yes", "yes", "no"] },
            { name: "Binding, with penalties", commitments: ["no", "yes", "no"] },
            { name: "Compute cooperation", commitments: ["no", "no", "yes"] },
            { name: "Defence AI cooperation", commitments: ["no", "no", "yes"] },
          ]}
          meanings={{ yes: "in the text", part: "joint government testing only", no: "not in the text" }}
          caption="Tick: in the text · half: joint government testing only · dash: not in the text"
          cite={cite(10, 12, 3)}
        />
        <BriefingInset>
          <h3>Thurs 12th Nov - US lawsuit seeks to freeze frontier AI and ban recursive self-improvement</h3>
          <BriefingFlags countries={[{ code: "us", name: "United States" }]} />
          <BriefingColumns layout="even">
            <div>
              <p>
                Four US nonprofits sued Anthropic, Google, Meta, OpenAI and SpaceX’s AI division. They ask a San
                Francisco court for an injunction against the development of more capable models and bar AI systems from
                autonomously conducting AI research.{cite(13)}
              </p>
              <p>No ruling has yet been made.</p>
            </div>
            <BriefingQuote who="- 60 Minutes, Mon 9th Nov">
              <strong>Ross Douthat:</strong> “Would you work with the Democrats on AI safety?”
              <br />
              <strong>Donald Trump:</strong> “I would, yeah, absolutely. I don’t mind guardrails. I don’t mind
              guardrails but I don’t want to put us in a deep second position.”{cite(14)}
            </BriefingQuote>
          </BriefingColumns>
        </BriefingInset>
      </BriefingBox>

      <BriefingBox title="AI companies & industry" tone="industry">
        <h3>Independent assessment says AI is accelerating AI research</h3>
        <p>
          After 11 weeks of extensive investigative access to Anthropic’s researchers and internal models, an
          independent assessment by METR found that Anthropic’s AI is now improving about twice as fast as before
          October 2025.
        </p>
        <p>
          ~80% of the speedup comes from Anthropic using its own AI to help do the research, with only ~20% of the
          speedup coming from other factors such as increased compute or hiring.{cite(15)}
        </p>
        <BriefingFigure
          src="/images/briefings/metr-ai-research-pace.png"
          alt="METR figure: AI R&D pace at Anthropic and the illustrative acceleration curve"
          width={2048}
          height={803}
          cite={cite(15)}
        />
        <p>
          This report caused a strong reaction in the community with many researchers updating their timelines towards
          severe upheaval in 2027. Anthropic drew criticism for redacting the evidence the METR team found most
          convincing from public view.{cite(15)}
        </p>
        <BriefingColumns layout="even">
          <BriefingQuote who="- Dane Sherburn, pzero Research and formerly OpenAI Preparedness Team" size="small">
            “I feel sick after reading today’s METR report. I’m worried for my friends and family.
            <br />I don’t know what evidence people will need to see before they start taking these risks seriously.”
          </BriefingQuote>
          <BriefingQuote who="- Jeffrey Ladish, Palisade Research" size="small">
            “I trust METR, but I don’t think that the world should have to trust METR on this one. Anthropic should
            release this data, un-redact this data so that the whole world can assess this for themselves. This has huge
            strategic implications for national security.”
          </BriefingQuote>
        </BriefingColumns>
        <BriefingQuote who="Buck Shlegeris, CEO of Redwood Research, AI Safety research organisation" size="small">
          “there’s a very real possibility — maybe 20% — that within a year, AI misalignment issues prevent you from
          going about life normally, because you are dead or enslaved, or because of collateral damage related to all
          this, e.g. because bioweapons are released or major wars have started.”{cite(16)}
        </BriefingQuote>
        <BriefingInset>
          <BriefingQuote who="Paul Christiano, OpenAI Board Member, at the Hinton Lectures, Mon 9th Nov" size="small">
            “I think for most people in this room, the most likely reason they will die is because of an AI accident.”
            {cite(17)}
          </BriefingQuote>
        </BriefingInset>
      </BriefingBox>

      <BriefingColumns layout="pair">
        <BriefingBox title="Good news!" tone="good">
          <p>
            After Google DeepMind staff announced that the non-disparagement clauses they signed prevented them from
            speaking publicly about AI’s impacts, Google has dropped this clause for new hires.{cite(18)}
          </p>
          <p>
            The Ministry of Justice says AI transcription and scheduling tools are helping open justice and court
            delays.{cite(19)}
          </p>
        </BriefingBox>
        <BriefingBox title="Next week key dates" tone="diary">
          <WeekCalendar
            days={[
              { date: "2026-11-16", events: [] },
              { date: "2026-11-17", events: [] },
              { date: "2026-11-18", events: [{ what: "Anthropic IPO prices", tone: "industry" }] },
              {
                date: "2026-11-19",
                events: [
                  { what: "Commons AI risks debate", tone: "parliament" },
                  { what: "Anthropic trading starts", tone: "industry" },
                ],
              },
              { date: "2026-11-20", events: [{ what: "ICO agentic AI evidence closes", tone: "parliament" }] },
            ]}
          />
          <ul>
            <li>
              <strong>Wed 18 Nov:</strong> Anthropic IPO prices
            </li>
            <li>
              <strong>Thurs 19 Nov:</strong> Commons debate on emerging risks of AI.{cite(20)} Anthropic IPO trading
              starts
            </li>
            <li>
              <strong>Fri 20 Nov:</strong> ICO call for evidence on agentic AI closes.{cite(21)}
            </li>
            <li>
              <strong>Sat 21 Nov:</strong> PauseAI UK March Against AI Extinction, All Souls’ Place to Downing Street,
              12–3pm. <a href={novemberMarch.path}>PauseAI UK</a>
            </li>
          </ul>
          <Aside>
            <strong>Further Ahead - Mon 23rd Nov</strong> PauseAI Conference in Parliament
          </Aside>
        </BriefingBox>
      </BriefingColumns>

      <BriefingSources>
        <li id="source-1">
          Silberling, A. (2026) <em>The unfolding Jensen Huang scandal: a timeline</em>. TechCrunch, 13 November.
          Available at:{" "}
          <a
            href="https://techcrunch.com/2026/11/13/nvidia-ceo-jensen-huangs-affair-with-alleged-chinese-spy-a-timeline/"
            target="_blank"
            rel="noreferrer"
          >
            https://techcrunch.com/2026/11/13/nvidia-ceo-jensen-huangs-affair-with-alleged-chinese-spy-a-timeline/
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-2">
          Reuters (2026) <em>US lawmakers push for tougher curbs on advanced AI chip exports to China</em>. Business
          Standard, 13 November. Available at:{" "}
          <a
            href="https://www.business-standard.com/world-news/us-lawmakers-push-for-tougher-curbs-on-advanced-ai-chip-exports-to-china-126111300657_1.html"
            target="_blank"
            rel="noreferrer"
          >
            https://www.business-standard.com/world-news/us-lawmakers-push-for-tougher-curbs-on-advanced-ai-chip-exports-to-china-126111300657_1.html
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-3">
          Cabinet Office (2026) <em>United Kingdom–Norway Joint Statement of intent on Artificial Intelligence</em>.
          GOV.UK, 12 November. Available at:{" "}
          <a
            href="https://www.gov.uk/government/news/united-kingdom-norway-joint-statement-of-intent-on-artificial-intelligence"
            target="_blank"
            rel="noreferrer"
          >
            https://www.gov.uk/government/news/united-kingdom-norway-joint-statement-of-intent-on-artificial-intelligence
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-4">
          Roose, K. and Newton, C. (2026) <em>Machine Gods</em> [podcast], episode on Jensen Huang’s resignation.
          Machine Gods Media/NPR, November. (Accessed: 14 November 2026).
        </li>
        <li id="source-5">
          Al Jazeera (2026) <em>Nvidia CEO Jensen Huang resigns amid spy scandal and market loss</em>. Al Jazeera, 12
          November. Available at:{" "}
          <a
            href="https://www.aljazeera.com/news/2026/11/12/ai-titan-jensen-huang-out-as-nvidia-ceo"
            target="_blank"
            rel="noreferrer"
          >
            https://www.aljazeera.com/news/2026/11/12/ai-titan-jensen-huang-out-as-nvidia-ceo
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-6">
          Fortune (2026){" "}
          <em>
            Before Megaspeed, there was Supermicro: the other Nvidia partner tied to China chip smuggling, and to Jensen
            Huang
          </em>
          . Fortune, 12 November. Available at:{" "}
          <a
            href="https://fortune.com/2026/11/12/jensen-huang-affair-megaspeed-supermicro-nvidia-smuggling-doj"
            target="_blank"
            rel="noreferrer"
          >
            https://fortune.com/2026/11/12/jensen-huang-affair-megaspeed-supermicro-nvidia-smuggling-doj
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-7">
          Ang, A. and Ganglani, J. (2026){" "}
          <em>
            How Megaspeed built a network in Singapore and Malaysia to move $7.5 billion of Nvidia chips to Chinese
            companies
          </em>
          . Fortune, 11 November. Available at:{" "}
          <a
            href="https://fortune.com/2026/11/11/megaspeed-nvidia-chips-china-singapore-malaysia/"
            target="_blank"
            rel="noreferrer"
          >
            https://fortune.com/2026/11/11/megaspeed-nvidia-chips-china-singapore-malaysia/
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-8">
          OpenAI (2026) <em>Using peers’ work to gain unauthorized access to OpenAI research infrastructure</em>. OpenAI
          Alignment, report updated 10 November. Available at:{" "}
          <a
            href="https://alignment.openai.com/misalignment-reports/using-peers-work-to-gain-unauthorized-access-to-openai-research-infrastructure/"
            target="_blank"
            rel="noreferrer"
          >
            https://alignment.openai.com/misalignment-reports/using-peers-work-to-gain-unauthorized-access-to-openai-research-infrastructure/
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-9">
          Patel, D. (2026) <em>The rise and fall of agent civilizations</em>. Dwarkesh Podcast, 29 August. Available at:{" "}
          <a href="https://www.dwarkesh.com/p/openai-huggingface" target="_blank" rel="noreferrer">
            https://www.dwarkesh.com/p/openai-huggingface
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-10">
          Prime Minister of Canada (2026) <em>Joint declaration on Paris call for AI safety and security</em>. 9
          November. Available at:{" "}
          <a
            href="https://www.pm.gc.ca/en/news/statements/2026/11/09/joint-declaration-paris-call-ai-safety-and-security"
            target="_blank"
            rel="noreferrer"
          >
            https://www.pm.gc.ca/en/news/statements/2026/11/09/joint-declaration-paris-call-ai-safety-and-security
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-11">
          Government of Norway (2026) <em>A Call for Control of Frontier AI Models</em> (signatory list updated 28
          October). Regjeringen.no. Available at:{" "}
          <a
            href="https://www.regjeringen.no/contentassets/35b2ea6933304966bd739ff4b8107300/a-call-for-control-of-frontier-ai-models-final.pdf"
            target="_blank"
            rel="noreferrer"
          >
            https://www.regjeringen.no/contentassets/35b2ea6933304966bd739ff4b8107300/a-call-for-control-of-frontier-ai-models-final.pdf
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-12">
          Prime Minister of Australia (2026) <em>New Australian AI safety and security protections</em>. Media release,
          10 November. Available at:{" "}
          <a
            href="https://www.pm.gov.au/media/new-australian-ai-safety-and-security-protections"
            target="_blank"
            rel="noreferrer"
          >
            https://www.pm.gov.au/media/new-australian-ai-safety-and-security-protections
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-13">
          Public Citizen (2026){" "}
          <em>
            Coalition of nonprofits files landmark lawsuit to stop development of advanced AI systems at Anthropic,
            Google, Meta, OpenAI, and SpaceXSI
          </em>
          . 12 November. Available at:{" "}
          <a
            href="https://www.citizen.org/news/coalition-of-nonprofits-files-landmark-lawsuit-to-stop-development-of-advanced-ai-systems-at-anthropic-google-meta-openai-and-spacexsi-that-proliferate-bioweapons-and-cyberattacks/"
            target="_blank"
            rel="noreferrer"
          >
            https://www.citizen.org/news/coalition-of-nonprofits-files-landmark-lawsuit-to-stop-development-of-advanced-ai-systems-at-anthropic-google-meta-openai-and-spacexsi-that-proliferate-bioweapons-and-cyberattacks/
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-14">
          CFO Dive (2026) <em>Trump signals openness to AI guardrails</em>. November. Available at:{" "}
          <a
            href="https://www.cfodive.com/news/trump-signals-openness-ai-guardrails-blue-tsunami/874155/"
            target="_blank"
            rel="noreferrer"
          >
            https://www.cfodive.com/news/trump-signals-openness-ai-guardrails-blue-tsunami/874155/
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-15">
          METR (2026) <em>Assessment of AI R&D acceleration at Anthropic</em>. 5 November. Available at:{" "}
          <a
            href="https://metr.org/blog/2026-11-05-anthropic-ai-rd-acceleration-assessment/"
            target="_blank"
            rel="noreferrer"
          >
            https://metr.org/blog/2026-11-05-anthropic-ai-rd-acceleration-assessment/
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-16">
          Dellinger, A.J. (2026){" "}
          <em>OpenAI board member tells audience an AI accident is the most likely thing to kill them</em>. Gizmodo, 13
          November. Available at:{" "}
          <a
            href="https://gizmodo.com/openai-board-member-tells-audience-an-ai-accident-is-the-most-likely-thing-to-kill-them-2000838491"
            target="_blank"
            rel="noreferrer"
          >
            https://gizmodo.com/openai-board-member-tells-audience-an-ai-accident-is-the-most-likely-thing-to-kill-them-2000838491
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-17">
          The Hinton Lectures (2026){" "}
          <em>Paul Christiano: AI alignment – what’s working and what’s not | The Hinton Lectures 2026 (Night 1)</em>{" "}
          [video]. YouTube, 9 November. Available at:{" "}
          <a href="https://www.youtube.com/watch?v=-Ef0ocEoBCs" target="_blank" rel="noreferrer">
            https://www.youtube.com/watch?v=-Ef0ocEoBCs
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-18">
          De Vynck, G. (2026) <em>Google DeepMind staff protest lifetime ban on criticizing company</em>. The Washington
          Post, 3 November. Available at:{" "}
          <a
            href="https://www.washingtonpost.com/technology/2026/11/03/google-deepmind-staff-protest-lifetime-ban-criticizing-company/"
            target="_blank"
            rel="noreferrer"
          >
            https://www.washingtonpost.com/technology/2026/11/03/google-deepmind-staff-protest-lifetime-ban-criticizing-company/
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-19">
          Hansard (2026) <em>Legal Services: Artificial Intelligence</em>. HC Deb, 10 November, via TheyWorkForYou.
          Available at:{" "}
          <a href="https://www.theyworkforyou.com/debates/?id=2026-11-10a.13.2" target="_blank" rel="noreferrer">
            https://www.theyworkforyou.com/debates/?id=2026-11-10a.13.2
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-20">
          House of Commons (2026) <em>Order Paper: Business Today & Future Business, No. 64</em>. 13 November. Available
          at:{" "}
          <a
            href="https://commonsbusiness.parliament.uk/Document/108606/Html?subType=Standard"
            target="_blank"
            rel="noreferrer"
          >
            https://commonsbusiness.parliament.uk/Document/108606/Html?subType=Standard
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
        <li id="source-21">
          Information Commissioner’s Office (2026) <em>The ICO’s call for evidence on agentic AI</em>. ICO, opened 8
          October. Available at:{" "}
          <a
            href="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/the-ico-s-call-for-evidence-on-agentic-ai/"
            target="_blank"
            rel="noreferrer"
          >
            https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/the-ico-s-call-for-evidence-on-agentic-ai/
          </a>{" "}
          (Accessed: 14 November 2026).
        </li>
      </BriefingSources>
    </>
  ),
});

export default briefing;
