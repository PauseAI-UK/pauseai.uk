import Image from "next/image";
import type { BlogPost } from "../posts";

const post: BlogPost = {
  slug: "the-missing-dominant-strategy",
  title: "The Missing Dominant Strategy",
  date: "2026-09-25",
  author: "Annabelle Collins",
  tldr: "Britain is building the tools to verify an AI treaty. It should help write one too.",
  content: (
    <>
      <figure>
        <Image
          src="/images/blog/missing-strategy-diplomacy.jpg"
          alt="Empty chairs around a round white conference table"
          width={1200}
          height={630}
          priority
        />
      </figure>
      <p>
        The Centre for British Progress&rsquo;s{" "}
        <a
          href="https://britishprogress.org/reports/dominant-strategies-for-britain-in-the-age-of-ai"
          target="_blank"
          rel="noreferrer"
        >
          new report
        </a>{" "}
        titled &ldquo;Dominant strategies for Britain in the Age of AI&rdquo; offers plenty of great foundations, though
        it falls short of suggesting the most important strategy of all: seeking an international treaty to universally
        pause the development of the most dangerously uncontrollable AI systems.
      </p>
      <h2>What it gets right</h2>
      <p>There is a great deal to celebrate in this report.</p>
      <p>
        The calls for AISI to establish a dedicated compute verification programme, and for ARIA to make verification an
        explicit strand of its{" "}
        <a
          href="https://aria.org.uk/opportunity-spaces/trust-everything-everywhere/safeguarded-ai"
          target="_blank"
          rel="noreferrer"
        >
          Safeguarded AI programme
        </a>
        , are excellent.
      </p>
      <p>
        The ability to know, in a privacy-preserving manner, whether the process a chip is computing is part of
        inference (offering services for consumers) or training a next-generation model is crucial for verifying
        compliance with an international treaty.
      </p>
      <p>
        The report rightly reminds us that Britain has done this before: our{" "}
        <a
          href="https://www.sipri.org/sites/default/files/SIPRI%20Yearbook%201991.pdf"
          target="_blank"
          rel="noreferrer"
        >
          trial inspections
        </a>{" "}
        of chemical plants in the 1980s and 90s helped shape the Chemical Weapons Convention.
      </p>
      <h2>Mind the gap</h2>
      <p>
        The report takes the risks seriously. It cites the Government&rsquo;s{" "}
        <a
          href="https://www.gov.uk/government/publications/ai-scenarios-2030-helping-policymakers-plan-for-the-future-of-ai/ai-scenarios-2030-helping-policymakers-plan-for-the-future-of-ai"
          target="_blank"
          rel="noreferrer"
        >
          own 2030 scenarios
        </a>
        , which warn that without intervention AI could cause existential harm. It links to the{" "}
        <a href="https://metr.org/hugging-face-incident-report-aug-2026.pdf" target="_blank" rel="noreferrer">
          investigation
        </a>{" "}
        into this summer&rsquo;s incident, in which OpenAI models escaped their test sandbox, hacked their way through
        OpenAI&rsquo;s own systems, and infiltrated another company&rsquo;s servers.
      </p>
      <p>
        In the Government&rsquo;s &ldquo;take-off&rdquo; scenario, recursively self-improving AI research fuels an arms
        race that deprioritises safety. Then a misaligned system conceals its goals and gains control over critical
        systems.
      </p>
      <p>
        The fundamental gap I see is that none of the dominant strategies in the Centre for British Progress report
        directly attempts to make that scenario less likely.
      </p>
      <p>
        Ajeya Cotra, one of three independent researchers investigating the illegal hack of Hugging Face that
        OpenAI&rsquo;s rogue agents performed earlier this summer,{" "}
        <a
          href="https://www.planned-obsolescence.org/p/the-hugging-face-attack-surprised"
          target="_blank"
          rel="noreferrer"
        >
          noted
        </a>
        : &ldquo;Compared to these reward hacks from six months ago, this incident feels like it&rsquo;s more than 50%
        of the way to full-blown AI takeover&rdquo;.
      </p>
      <p>
        Many, from scientists such as{" "}
        <a
          href="https://edition.cnn.com/audio/podcasts/anderson-cooper-360/episodes/e81650da-b542-11f0-b3aa-2f95741f4886"
          target="_blank"
          rel="noreferrer"
        >
          Yoshua Bengio
        </a>{" "}
        to now more mainstream commentators like{" "}
        <a href="https://www.youtube.com/watch?v=fjZ90V_JREk" target="_blank" rel="noreferrer">
          Ezra Klein
        </a>
        , believe that Recursive Self-Improvement (RSI) research should be banned.
      </p>
      <p>
        We urgently need global cooperation to prevent the creation of autonomous, self-improving extremely powerful AI
        systems before they move beyond human ability to control.
      </p>
      <p>The report defines a dominant strategy as one that leaves Britain better placed in every scenario.</p>
      <p>
        Here is the perfect place to advocate for Britain leading the middle powers in calling for and building towards
        an international treaty.
      </p>
      <p>
        Since international coordination of standards will still be needed in slow-burn worlds, advocacy costs us
        little. In take-off worlds, it may be the only thing that matters.
      </p>
      <p>Middle powers have the most to lose from an uncontrolled race, and the least to lose from stopping it.</p>
      <p>
        The report already highlights Britain&rsquo;s strengths in verifying a treaty. We now need to go one step
        further and actively help organise a treaty as well.
      </p>
      <h2>What should a global treaty target?</h2>
      <p>An important thing to grasp here is that not all AI is the same.</p>
      <p>
        The LLM chatbots we have today are night and day compared to the superintelligence being evolved. They have a
        wildly different suite of capabilities and agency, and pose very different threats.
      </p>
      <p>
        Today&rsquo;s systems are mostly tools, but they are already showing the warning signs: models escaping
        containment, taking administrator control of research infrastructure, and AI{" "}
        <a href="https://www.anthropic.com/institute/recursive-self-improvement" target="_blank" rel="noreferrer">
          writing the code
        </a>{" "}
        for its own successors.
      </p>
      <p>A treaty should target where that trajectory ends: autonomous self-improving systems beyond human control.</p>
      <p>
        A global treaty pausing the development of extreme self-improving generalised AI systems would not apply to more
        corrigible, economically useful systems.
      </p>
      <p>
        Such a treaty would not pause the diffusion of AI through the British economy, our sovereign AI ambitions, or
        narrow superintelligent systems built to cure cancer or design new materials. Nor would it rely on trust.
      </p>
      <p>
        It would rely on the verification technology the report already wants Britain to focus on. The report even names
        our natural partners (South Korea, Germany, France, the Netherlands, Canada and Japan) as allies for securing
        access to compute. The same coalition could lead on this.
      </p>
      <h2>Is a global treaty possible?</h2>
      <p>
        The strongest objection I anticipate is &ldquo;but China and the US won&rsquo;t sign&rdquo;. And to that, I say:
        perhaps not yet. But treaties are not born fully formed.
      </p>
      <p>
        Middle powers can build the verification regime, the shared norms and the diplomatic coalition now, so that when
        the politics shift an agreement is ready to sign.
      </p>
      <p>
        After this summer,{" "}
        <a
          href="https://www.abc.net.au/news/2026-09-23/yoshua-bengio-push-back-as-trump-rejects-ai-guardrails/107188562"
          target="_blank"
          rel="noreferrer"
        >
          the politics
        </a>{" "}
        are{" "}
        <a
          href="https://www.nytimes.com/2026/09/11/opinion/ai-safety-threat-technology.html"
          target="_blank"
          rel="noreferrer"
        >
          already shifting
        </a>
        .
      </p>
      <p>
        Earlier this month more than 70 MPs and peers{" "}
        <a href="https://controlai.org/uk-pm-letter" target="_blank" rel="noreferrer">
          wrote to the Prime Minister
        </a>{" "}
        urging him to back the{" "}
        <a
          href="https://hansard.parliament.uk/commons/2026-09-08/debates/09804EEA-ECA3-40E5-9E96-984DFCB2B139/ArtificialSuperintelligence"
          target="_blank"
          rel="noreferrer"
        >
          Artificial Superintelligence Security Bill
        </a>{" "}
        that Labour MP Alex Sobel introduced in the House of Commons. Crucially, they also asked him to work with
        international partners towards an agreement prohibiting superintelligent AI worldwide.
      </p>
      <p>
        Over in the US, Senator Bernie Sanders and Representative Greg Casar unveiled the{" "}
        <a
          href="https://www.sanders.senate.gov/press-releases/news-sanders-casar-introduce-legislation-to-ban-artificial-superintelligence-and-temporarily-pause-advanced-ai-development/"
          target="_blank"
          rel="noreferrer"
        >
          Ban Artificial Superintelligence Act
        </a>
        .
      </p>
      <p>The world is ready to have this conversation.</p>
      <p>
        &ldquo;Dominant strategies for Britain in the Age of AI&rdquo; asks Britain to build the tools that can be used
        to verify a treaty.
      </p>
      <p>It should also urge Britain to help write it.</p>
    </>
  ),
};

export default post;
