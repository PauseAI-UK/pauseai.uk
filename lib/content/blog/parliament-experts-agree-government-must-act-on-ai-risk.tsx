import Image from "next/image";
import { ORGANISATION_AUTHOR, type BlogPost } from "../posts";

const post: BlogPost = {
  slug: "parliament-experts-agree-government-must-act-on-ai-risk",
  title: "In Parliament, experts and political leaders agree: government must act on AI risk",
  date: "2026-09-11",
  author: ORGANISATION_AUTHOR,
  tldr: "At a PauseAI UK discussion in the Houses of Parliament, Stuart Russell, Brando Benifei MEP, Dame Chi Onwurah MP, Iqbal Mohamed MP, Lord Clement-Jones and Lord Tarasenko agreed that AI poses catastrophic risks and that government urgently needs to act, in the UK and internationally.",
  content: (
    <>
      <figure>
        <Image
          src="/images/parliament-conference-sep-2026/audience.jpg"
          alt="A packed committee room in the Houses of Parliament, with attendees at wooden benches on both sides of the central aisle turned to face the camera"
          width={1280}
          height={853}
          priority
        />
      </figure>
      <p>
        In a week when the catastrophic risks to humanity of AI led the news, PauseAI UK held a special discussion in
        the Houses of Parliament in which experts and political leaders agreed on the urgent need for government action
        both in the UK and internationally.
      </p>
      <p>
        <strong>Stuart Russell</strong>, Professor of Computer Science at UC Berkeley, argued that although it is hard
        to believe there is a real risk of AI leading to human extinction, we should think in terms of incompatible
        kinds of intelligence:
      </p>
      <p>
        &ldquo;If you ask gorillas, how are humans going to make you extinct, they haven&rsquo;t the faintest idea. They
        can&rsquo;t conceive of the things that we do that will make them extinct. We cannot conceive of the things that
        the AI systems will do that will make us extinct&rdquo;.
      </p>
      <p>
        The warnings from Russell were stark, with none of the possible futures looking appealing. He sees a
        &ldquo;thirty per cent chance of a Chernobyl-scale disaster with trillions of dollars of damage, perhaps
        millions of deaths&rdquo;. That would cause a huge backlash against AI.
      </p>
      <p>
        &ldquo;I would assume AI companies don&rsquo;t want that,&rdquo; Russell continued, &ldquo;but one of the AI
        CEOs told me that is currently his best-case scenario because the other scenario is that the catastrophe is
        irreversible and we lose control. So just to be clear, there is no future that contains both human beings and
        unsafe superintelligence&rdquo;.
      </p>
      <p>
        <strong>Brando Benifei MEP</strong>, Co-rapporteur and lead architect of the EU AI Act, accepted the reality of
        existential risks from AI but believed that EU regulation could reduce them: &ldquo;we have empowered the
        European Commission to actually enforce our rules for the risk mitigation of the most powerful models and the
        possibility then to request information, make investigations&rdquo;.
      </p>
      <p>
        Benifei was not dismissive of the possibilities of US regulation either, having seen the active concern of some
        Congressional Republicans who were &ldquo;from the faction that was not close to the tech bros &hellip;They want
        in fact to conserve human life and they see the vulnerabilities, for example, for children, that&rsquo;s a very
        important entry point &hellip;to build a discourse&rdquo;.
      </p>
      <p>
        <strong>Dame Chi Onwurah MP</strong>, Chair of the Commons Science, Innovation and Technology Committee agreed
        that some US mid-term election candidates were speaking out about the dangers of AI but warned of the lobbying
        power of the tech companies making the argument that &ldquo;we&rsquo;ve got to support US AI, otherwise
        we&rsquo;ll get Chinese AI&rdquo;.
      </p>
      <figure>
        <Image
          src="/images/parliament-conference-sep-2026/speakers.jpg"
          alt="The panel seated at a long wooden bench in a wood-panelled committee room in the Houses of Parliament, with PauseAI UK organisers standing behind them"
          width={1280}
          height={640}
        />
      </figure>
      <p>
        The lack of a government plan for AI regulation &ldquo;scares the hell out of me&rdquo;, said{" "}
        <strong>Iqbal Mohamed MP</strong>, a leading voice in the House of Commons on AI risks. He called for
        restrictions on the coming stock market flotation of AI companies:
      </p>
      <p>
        &ldquo;Multi-trillion-dollar IPOs &hellip;shouldn&rsquo;t be allowed to go ahead without guarantees of the
        safety of that technology. That should be a prerequisite for these companies getting rich off the risk to the
        human race and the planet&rdquo;.
      </p>
      <p>
        A note of political urgency was injected by <strong>Lord Tim Clement-Jones</strong>, Co-chair of the All-Party
        Parliamentary Group on AI, who worried that &ldquo;we&rsquo;re not really even having a debate with government
        about &lsquo;how&rsquo;, we&rsquo;re having a debate about &lsquo;whether&rsquo;, which is quite extraordinary
        given the authority with which people like Stuart [Russell] speak on this subject&rdquo;.
      </p>
      <p>
        The practicalities of AI regulation in the UK were being actively pursued by both members of the House of Lords
        on the panel, <strong>Lord Lionel Tarasenko</strong>, a crossbench peer and professor of electrical engineering
        at Oxford and Lord Clement-Jones.
      </p>
      <p>
        Lord Tarasenko told the meeting that a promised AI bill in the Labour manifesto had been dropped without
        explanation and that the Cybersecurity and Resilience Bill currently going through parliament had an
        &ldquo;AI-shaped hole&rdquo; in it which they had both been trying to fill during the Committee Stage of the
        bill last week.
      </p>
      <p>
        Lord Clement-Jones added that international standards and international regulation were crucial and that
        Britain&rsquo;s AI Security Institute needs to be given powers of inspection and &ldquo;the absolute power to
        insist on certain standards being adhered to&rdquo;.
      </p>
      <p>
        The discussion showed that politicians were taking seriously the increasingly urgent calls for safety regulation
        by AI experts. Stuart Russell&rsquo;s <em>Human Compatible</em>, an early warning of AI dangers, was a book that
        &ldquo;we should treat as our gospel&rdquo;, said Lord Clement-Jones.
      </p>
      <p>
        &ldquo;We&rsquo;re plugging away&rdquo;, he said, &ldquo;but we have a really a huge mountain to climb until the
        government actually responds in a much more effective way&rdquo;.
      </p>
    </>
  ),
};

export default post;
