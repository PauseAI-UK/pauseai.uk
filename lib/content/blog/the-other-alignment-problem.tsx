import Image from "next/image";
import Link from "next/link";
import type { BlogPost } from "../posts";

const post: BlogPost = {
  slug: "the-other-alignment-problem",
  title: "The Other Alignment Problem",
  date: "2026-09-25",
  author: "Abi Palmer",
  tldr: "AI researchers worry about getting machines to share human values. The leaders building them are showing us they have an alignment problem of their own.",
  content: (
    <>
      <figure>
        <Image
          src="/images/blog/ai-ceos.jpg"
          alt="Side-by-side photos of three AI company leaders speaking at public events"
          width={1200}
          height={773}
          priority
        />
      </figure>
      <p>
        When AI researchers talk about &ldquo;alignment&rdquo;, they are talking about the process of getting an AI
        model to behave in a way that fits with human values. Preserving human lives. Respecting human dignity. Planning
        for a shared human future. Alignment researchers have{" "}
        <a
          href="https://theconversation.com/the-decades-old-ai-alignment-problem-has-finally-become-a-reality-solving-it-wont-be-easy-289812"
          target="_blank"
          rel="noreferrer"
        >
          struggled
        </a>{" "}
        to instil these basic rules in AI models, but apparently the machines aren&rsquo;t the only ones who missed the
        &ldquo;humanity=good&rdquo; memo. It seems the AI creators might need a reminder too.
      </p>
      <p>
        I&rsquo;ve <Link href="/blog/ai-companies-knew-and-kept-quiet">written previously</Link> about the culture of
        dishonesty within AI companies: risk alerts squashed; grave dangers dismissed&hellip; dodgy practices that we
        had to learn about through tragedies and court cases. But when it comes to the question of human values, we
        don&rsquo;t need an expos&eacute; to show us that some AI creators&rsquo; moral compasses are malfunctioning.
        They are telling us so themselves.
      </p>
      <p>
        We got a glimpse of this on 9th September, when Jacob Coxon dramatically resigned from Anthropic claiming that
        AI companies are &ldquo;gambling with our lives&rdquo;.{" "}
        <a
          href="https://theconversation.com/we-really-do-earnestly-believe-ai-could-kill-all-humans-if-ai-labs-are-so-worried-about-ai-doom-why-dont-they-stop-291595"
          target="_blank"
          rel="noreferrer"
        >
          Even more disturbing
        </a>{" "}
        was his colleague Evan Hubinger, who excitedly responded &ldquo;we really do earnestly believe AI could kill all
        humans! I personally think it is &gt;10% within the next decade&rdquo;.
      </p>
      <p>
        From an aligned model, the next words would be, &ldquo;so we&rsquo;ve stopped building it for now&rdquo;. But we
        have an alignment problem on our hands. And not the digital kind. The warped values exhibited by AI models
        haven&rsquo;t just sprung from cyberspace. They&rsquo;ve grown from a primordial soup of reckless tech industry
        disruption culture and elitist disregard for ordinary public interests. In other words, from misaligned humans.
      </p>
      <p>
        Take Elon Musk&rsquo;s &ldquo;MechaHitler&rdquo; incident. I won&rsquo;t rehash the details of it here;
        it&rsquo;s not difficult to infer how a scandal with that name unfolded. The point is: this failing didn&rsquo;t
        start with AI misalignment. It started with{" "}
        <a
          href="https://www.pbs.org/newshour/politics/why-does-the-ai-powered-chatbot-grok-post-false-offensive-things-on-x"
          target="_blank"
          rel="noreferrer"
        >
          a human&rsquo;s choice
        </a>{" "}
        to build a model pandering to the unnerving whims of his followers. It started with one man&rsquo;s preference
        for gratifying bad users over protecting the public. The AI&rsquo;s harmful actions were founded on these
        distorted priorities which trickled down from its human progenitor into its &ldquo;
        <a
          href="https://theconversation.com/how-do-you-stop-an-ai-model-turning-nazi-what-the-grok-drama-reveals-about-ai-training-261001"
          target="_blank"
          rel="noreferrer"
        >
          systemic ideological programming
        </a>
        &rdquo;. We may not know exactly how AI values emerge, but this episode reminds us that humans set the
        incentives around the model creation process.
      </p>
      <p>
        Then there&rsquo;s Sam Altman&rsquo;s ongoing tightrope walk between doomsaying and techno-optimism. Back in
        2015, he distastefully{" "}
        <a href="https://youtube.com/shorts/YE5adUeTe_I?si=yqqrxDGo0Hm6aalO" target="_blank" rel="noreferrer">
          suggested
        </a>
        , &ldquo;I think AI will probably, like, most likely, sort of lead to the end of the world, but in the meantime,
        uh, there will be great companies created with serious machine learning&rdquo;. That was the year he founded
        OpenAI. Now a seasoned CEO, he is more careful and image-savvy, emphasising the potential medical and
        educational benefits of his products to the UN security council, while also telling them, &ldquo;
        <a href="https://www.youtube.com/watch?v=bT-LB6MCb8E" target="_blank" rel="noreferrer">
          we could lose control of the future to AI
        </a>
        &rdquo;. Not that he&rsquo;s going to stop making it, or anything.
      </p>
      <p>
        These guys&rsquo; attitudes do not reflect normal human values. Let&rsquo;s acknowledge that. While everyone is
        worrying that machines might forget &ldquo;people=friends&rdquo;, these jolly harbingers of the apocalypse are
        proving we should be more concerned about their organic forebears.
      </p>
      <p>
        But wait! In the context of AI leaders&rsquo; new commitment to &ldquo;
        <a href="https://darioamodei.com/post/we-must-pace-the-frontier" target="_blank" rel="noreferrer">
          pace the frontier
        </a>
        &rdquo;, should we be open to the idea that these grinning reapers have turned over a new leaf? Well&hellip;
        commentators have expressed scepticism about this apparent pivot to prudence. It&rsquo;s been called{" "}
        <a
          href="https://www.theguardian.com/technology/2026/sep/13/too-little-too-late-critics-perplexed-and-suspicious-of-ai-leaders-call-for-a-slowdown"
          target="_blank"
          rel="noreferrer"
        >
          &ldquo;too little, too late&rdquo;
        </a>
        .
      </p>
      <p>
        Some say it&rsquo;s an attempt at{" "}
        <a
          href="https://www.theregister.com/ai-and-ml/2026/09/14/big-ai-sets-out-its-terms-for-regulatory-capture-and-calls-it-pace-the-frontier/5296067"
          target="_blank"
          rel="noreferrer"
        >
          regulatory capture
        </a>
        . Economist Christian Catalini{" "}
        <a
          href="https://www.forbes.com/sites/christiancatalini/2026/07/29/dont-pace-the-frontier-look-inside-the-trojan-horse/"
          target="_blank"
          rel="noreferrer"
        >
          called it
        </a>
        , &ldquo;virtue signalling and cheap insurance when things go wrong&rdquo;. What I know for sure is this:
        misaligned machines don&rsquo;t build themselves. We should not give credence to people who claim they are
        trying their best to keep us all safe while developing a technology which they say could be the end of humanity.
        It takes a loose cannon to release a rogue cannonball. So, let&rsquo;s dampen the gunpowder. Let&rsquo;s Pause
        AI.
      </p>
      <p>
        Read about how you can act{" "}
        <a href="https://pauseai.info/action" target="_blank" rel="noreferrer">
          here
        </a>
        .
      </p>
    </>
  ),
};

export default post;
