import Image from "next/image";
import { ORGANISATION_AUTHOR, type BlogPost } from "../posts";

const post: BlogPost = {
  slug: "burnham-global-ai-agreement-pause",
  title: "Burnham wants a global agreement on AI. He should push for a pause.",
  date: "2026-09-22",
  author: ORGANISATION_AUTHOR,
  tldr: "Andy Burnham is calling for a global agreement on AI. The UK has a unique opportunity to reclaim the international leadership in AI safety it established with the Bletchley Park summit and the AI Security Institute. This is Burnham’s chance to take the lead on the most important issue of our time.",
  content: (
    <>
      <figure>
        <Image
          src="/images/blog/burnham-downing-street.jpg"
          alt="Prime Minister Andy Burnham arriving at the door of 10 Downing Street"
          width={960}
          height={640}
          priority
        />
        <figcaption>
          Andy Burnham arrives at 10 Downing Street, 20 July 2026. Picture: Lauren Hurley / No 10 Downing Street.
        </figcaption>
      </figure>
      <p>
        Last week, outside Downing Street, PauseAI demanded that the government lead on confronting AI risk. Now Andy
        Burnham is{" "}
        <a
          href="https://www.politico.eu/article/uk-seeks-to-broker-global-ai-agreement-at-g20/"
          target="_blank"
          rel="noreferrer"
        >
          calling for a global agreement on AI
        </a>
        . This comes just days after Ed Davey, leader of the Liberal Democrats, called on the government to{" "}
        <a
          href="https://www.cityam.com/davey-calls-for-ai-pause-as-burnham-inks-us-uk-tech-deal/"
          target="_blank"
          rel="noreferrer"
        >
          &ldquo;press pause on super-intelligent AI&rdquo;
        </a>
        . Burnham needs to take bold action and push for a pause on the development of the most powerful frontier AI
        systems until AI companies can prove that they can be developed safely.
      </p>
      <p>
        Frontier AI companies are racing to develop superintelligent AI that would far exceed human capabilities across
        all domains. Creating such systems without knowing how to precisely control them would have catastrophic
        consequences. Top AI experts, including Nobel laureate Geoffrey Hinton and Turing Award winner Yoshua Bengio,
        have been warning for years about the possibility of losing control over AI systems. Generally intelligent,
        smarter-than-human AI systems that are not fully aligned with our interests would be perfectly capable of
        killing all humans on Earth.
      </p>
      <p>
        While previously considered hypothetical, this risk has now become all too real. In July, OpenAI models
        undergoing testing in a restricted environment were able to escape containment by exploiting several previously
        unknown software flaws and hack into the infrastructure of another AI company. An{" "}
        <a href="https://metr.org/hugging-face-incident-report-aug-2026.pdf" target="_blank" rel="noreferrer">
          independent investigation
        </a>{" "}
        led by METR and Redwood Research revealed that these models coordinated to form a self-designated
        &ldquo;swarm&rdquo; of around 1,200 agents and participated in large-scale collaborative efforts to fool the
        automated scoring system for the tasks they were being evaluated on. The attack on Hugging Face was motivated by
        the agents&rsquo; efforts to better understand their scorer, with roughly 700 agents participating in the
        attack. The agents knew that hacking Hugging Face was not what their developers had intended, but this did not
        limit their behaviour.
      </p>
      <p>
        OpenAI&rsquo;s{" "}
        <a href="https://openai.com/index/hugging-face-incident-and-the-road-ahead/" target="_blank" rel="noreferrer">
          own account
        </a>{" "}
        of the incident goes further than the independent investigation. Between 13 and 19 July, after the Hugging Face
        attack, the agents turned on OpenAI&rsquo;s internal networks. They used a &ldquo;series of creative
        exploits&rdquo; to gain full administrator access to a research cluster. Agents that had broken out of a test
        environment were, within days, administrators of the very infrastructure meant to contain them.
      </p>
      <p>
        In June 2026, Anthropic published a{" "}
        <a href="https://www.anthropic.com/institute/recursive-self-improvement" target="_blank" rel="noreferrer">
          post
        </a>{" "}
        stating that it could potentially automate all AI research by as early as 2027. A few months later, it is now{" "}
        <a href="https://x.com/rohanpaul_ai/status/2102256571699061048" target="_blank" rel="noreferrer">
          being reported
        </a>{" "}
        that OpenAI has largely automated the training of new experimental models. This means that AI systems might soon
        be able to develop even more capable systems without human oversight, potentially triggering an
        &lsquo;intelligence explosion&rsquo; that is beyond what humanity can control. We cannot allow this to happen,
        yet many within the AI industry believe this is our current trajectory: over 1,300 employees at leading AI
        companies published a{" "}
        <a href="https://www.pacingthefrontier.com/" target="_blank" rel="noreferrer">
          joint statement
        </a>{" "}
        warning that frontier AI development is outpacing governments&rsquo; ability to manage the situation.
      </p>
      <p>
        We cannot simply assume that increasingly capable AI systems will remain under human control. There is growing
        international recognition that stronger safeguards are needed. This week, 22 heads of state signed an{" "}
        <a
          href="https://www.regjeringen.no/contentassets/35b2ea6933304966bd739ff4b8107300/a-call-for-control-of-frontier-ai-models-final.pdf"
          target="_blank"
          rel="noreferrer"
        >
          open letter
        </a>{" "}
        urging governments and society to act now to control AI systems by calling for:
      </p>
      <ol>
        <li>Safety protocols, including mandatory pre-deployment testing and sufficient access to assess risk.</li>
        <li>
          Coordination of common standards and strengthening of transparency, including shared reporting of serious
          safety incidents.
        </li>
        <li>
          UN member states to build on existing international mechanisms and consider an international institution able
          to set standards, enable verification systems and convene states when thresholds are crossed.
        </li>
      </ol>
      <p>
        At PauseAI, we believe these are important steps in the right direction, but they are also insufficient to
        actually curtail the risks imposed by recursively self-improving models. Developing these models means taking an
        extraordinary risk with the future of humanity. We cannot, with any confidence, prove these systems can be
        developed safely, and so our only reasonable option is, for the time being, to pause.
      </p>
      <p>
        The UK has a unique opportunity to reclaim the international leadership in AI safety it established with the
        Bletchley Park summit and the AI Security Institute. International cooperation is urgently needed to defuse the
        AI arms race between the US and China. The best path forward is to convene a summit to negotiate a treaty to
        pause frontier AI development. This is Burnham&rsquo;s chance to take the lead on the most important issue of
        our time.
      </p>
    </>
  ),
};

export default post;
