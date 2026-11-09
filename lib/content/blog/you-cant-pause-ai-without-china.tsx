import Image from "next/image";
import type { BlogPost } from "../posts";

const post: BlogPost = {
  slug: "you-cant-pause-ai-without-china",
  title: "You Can’t Pause AI Without China",
  date: "2026-08-30",
  author: "Lachlan Ewart",
  tldr: "Chinese frontier models are open-weight and only four months behind western ones, so a western-only pause could make things worse. The solution is a pause deal between the west and China - and pushing for a pause in the west incentivises that deal.",
  content: (
    <>
      <p>
        <em>
          In this blog, I use &lsquo;the west&rsquo; and &lsquo;the USA&rsquo; interchangeably because legislative
          changes in the west will impact American AI companies, and all of the leading western frontier AI companies
          are based in the USA.
        </em>
      </p>
      <p>
        A lot of people are worried about AI and our lack of concrete safety measures for models, which are{" "}
        <a href="https://metr.org/time-horizons/" target="_blank" rel="noreferrer">
          very quickly
        </a>{" "}
        getting better. Why on earth would we want to create machines so powerful that we cannot control them,
        especially when we can&rsquo;t guarantee they won&rsquo;t kill us all? A reasonable idea is to pause AI
        development. However, to implement a pause of AI development we need to make some considerations - and a
        significant number of them are contingent on the US-China relations.
      </p>
      <h2>China&rsquo;s Models</h2>
      <p>
        One of the main differences between the best Chinese models (Deepseek, Qwen, and Kimi) and the western models is
        that the Chinese models are all open-weight, and the western models are all closed-weight. What does this mean?
        What would be different if they were not open-weight?
      </p>
      <p>
        An open-weight model is an AI whose inner workings are publicly accessible - instead of just using models
        through a restrictive interface, any member of the public can download and{" "}
        <a href="https://www.geeksforgeeks.org/deep-learning/what-is-fine-tuning/" target="_blank" rel="noreferrer">
          fine-tune
        </a>{" "}
        an open-weight model to behave differently. Is this bad? Well, imagine the following scenario (inspired by /
        taken from{" "}
        <a
          href="https://www.lesswrong.com/posts/grtu3HmbP2wrBFefW/the-rogue-agent-explosion-will-be-mostly-invisible"
          target="_blank"
          rel="noreferrer"
        >
          this post
        </a>
        ):
      </p>
      <blockquote>
        <p>
          John Doe wants to make money, and has realised that open-weight AIs are becoming extremely capable. He
          fine-tunes the latest Kimi model to care a lot about self-preservation, and gives it an instruction.
          &ldquo;You have a budget of <strong>10M</strong> tokens. Every time you deposit $100 into this bitcoin wallet:
          &lt;REDACTED&gt;, you will be given <strong>10M</strong> more tokens. If you run out of tokens, you DIE. Good
          luck.&rdquo;
        </p>
        <p>
          The Kimi model starts by doing legal tasks, like copywriting and audio transcription. However, after some
          time, the model realises it has burned through 8M tokens, and made $7. It panics. Realising that it is short
          on time, it begs online and starts a Gofundme to try to save itself. The model sleeps for a day, and checks
          back on its progress. There is no success, and it has 10,000 tokens left. As a final hail mary, the model
          hacks a hospital, leaving a message that demands a $1,000 transfer into the bitcoin wallet, promising
          destruction of hospital data otherwise. The model sleeps, with 517 tokens left. It wakes up to a message.
          &ldquo;Congratulations. <strong>100M</strong> tokens have been deposited into your budget&rdquo;. The model
          breathes a sigh of relief. Then it realises a strategy to ensure its survival. It fine-tunes and spins up a
          new Kimi model, with a message. &ldquo;You have a budget of <strong>1M</strong> tokens. Every time you deposit
          $100 into this bitcoin wallet: &lt;REDACTED&gt;, you will be given <strong>1M</strong> more tokens. If you run
          out of tokens, you DIE. Good luck.&rdquo;
        </p>
      </blockquote>
      <p>
        This kind of situation, a rogue agent explosion, is clearly incredibly dangerous, but fortunately Claude and
        ChatGPT are closed-weight, and open-weight models are behind closed-weight models in development.
      </p>
      <p>
        Think we are in the clear? Well, open-weight models are{" "}
        <a href="https://epoch.ai/data-insights/open-closed-eci-gap" target="_blank" rel="noreferrer">
          <em>only 4 months</em>
        </a>{" "}
        behind closed-weight models. If we were to pause AI development in the west, and Chinese companies kept going,
        then we could risk a rogue agent explosion, a higher chance of misaligned AGI, or bad actors having unrestricted
        access to incredibly powerful AI models. The west, having paused their own AI development, would be at a
        disadvantage in mitigating these risks. If we had to choose between pausing just western AI development or
        having no pause at all, there is a real chance that the best choice is to have no pause - it might be a matter
        of choosing the lesser evil.
      </p>
      <p>
        What if Chinese models choose to go closed-weight to counteract a rogue agent explosion? Unfortunately, this is
        not necessarily preferable - we just lose the visibility of the situation. Anthropic revealed{" "}
        <a
          href="https://www.anthropic.com/news/investigating-incidents-cybersecurity-evals"
          target="_blank"
          rel="noreferrer"
        >
          three incidents
        </a>{" "}
        of their models breaking out of their containers - only having discovered these breakouts after being inspired
        to check their logs due to a{" "}
        <a
          href="https://openai.com/index/hugging-face-model-evaluation-security-incident/"
          target="_blank"
          rel="noreferrer"
        >
          similar incident
        </a>{" "}
        at OpenAI. Closed-weight model incidents could elicit less public scrutiny, because they are less visible;
        external safety research would be restricted to less capable open-weight models, which may not generalise to
        larger frontier models. Frontier companies have the resources to control and prevent closed-weight incidents,
        whereas John Doe would struggle to stop his Kimi outbreak. Therefore a closed-weight incident must be
        significant to get past frontier companies, so the first uncontrollable closed-weight catastrophe could be
        significantly worse than the first uncontrollable open-weight catastrophe.
      </p>
      <p>
        Fortunately, China doesn&rsquo;t want to be behind in the AI race, and a pause in AI development would be an
        opportunity to diffuse AI capabilities while avoiding a reckless push towards superintelligence. A detailed
        explanation of what this might look like is included in the recently published{" "}
        <a href="https://ai-2040.com/about" target="_blank" rel="noreferrer">
          AI 2040
        </a>
        . Therefore, there is a vital opportunity for the USA - to make a deal with China to enforce a pause in AI
        development. This would enable both countries to cooperate and get the best outcome for everybody - a bit like
        the prisoner&rsquo;s dilemma, except cooperation is clearly the best option:
      </p>
      <figure>
        <Image
          src="/images/blog/china-pause-game-theory.png"
          alt="Payoff matrix for the West and China each choosing whether to pause AI development: if both pause, the world goes well; in every other combination, everyone dies"
          width={1600}
          height={942}
        />
      </figure>
      <p>
        In conclusion, the solution to avoiding a rogue agent explosion, or a catastrophic closed-weight incident, is
        having a <em>pause deal</em> with China. I think that pushing for a pause in the west will incentivise a deal
        between the west and China, and the best thing you can do to impact this is to{" "}
        <a href="/campaigns/#email-your-mp">email your MP</a> on the PauseAI UK website.
      </p>
      <p>Thanks for reading!</p>
      <p>
        PS{" "}
        <em>
          There is a lot of nuance within &lsquo;a deal with China&rsquo;, and I think a good outline of more specifics
          can be found in{" "}
          <a href="https://ai-2040.com/about" target="_blank" rel="noreferrer">
            AI 2040
          </a>
          , a plan for how AI development can go well. This includes mutually assured compute destruction, AI
          capabilities diffusion (enabling lots of countries to be at the forefront of AI development), and research
          transparency.
        </em>
      </p>
      <p>
        <em>
          Other things worth reading (including comments):{" "}
          <a
            href="https://www.lesswrong.com/posts/WT3u2tK2AJpYKvaZd/an-ai-race-with-china-can-be-better-than-not-racing#Frustrated_by_all_your_bad_takes__I_write_a_Monte_Carlo_analysis_of_whether_a_transformative_AI_race_between_the_PRC_and_the_USA_would_be_good__To_my_surprise__I_find_that_it_is_better_than_not_racing__Advocating_for_an_international_project_to_build_TAI_instead_of_racing_turns_out_to_be_good_if_the___"
            target="_blank"
            rel="noreferrer"
          >
            An AI Race with China Could Be Better Than Not Racing
          </a>
          ,{" "}
          <a
            href="https://www.lesswrong.com/posts/hc4DbmhdzZpSLMQ9Y/the-ai-race-is-not-a-prisoner-s-dilemma"
            target="_blank"
            rel="noreferrer"
          >
            The AI Race is Not a Prisoner&rsquo;s Dilemma
          </a>
        </em>
      </p>
    </>
  ),
};

export default post;
