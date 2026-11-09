import type { BlogPost } from "../posts";

const post: BlogPost = {
  slug: "ai-companies-knew-and-kept-quiet",
  title: "Three times AI companies knew something was wrong and kept quiet",
  date: "2026-08-24",
  author: "Abi Palmer",
  tldr: "AI companies possess substantial non-public information about the risks of their products. Here are three examples of when they knew about a problem, and kept it to themselves.",
  cover: {
    src: "/images/front-page-hero-optimized/deepmind-close-up.webp",
    alt: "Protesters outside Google DeepMind, one holding a sign reading: If you can't steer, don't race",
    width: 800,
    height: 450,
  },
  content: (
    <>
      <p>
        In 2024, thirteen current and former employees from OpenAI, Google and Anthropic signed an{" "}
        <a href="https://righttowarn.ai/" target="_blank" rel="noreferrer">
          open letter
        </a>{" "}
        stating that &ldquo;AI companies possess substantial non-public information about... the risk levels of
        different kinds of harm&rdquo;. They were demanding the right to warn the public. Their words reflect a wider
        public concern that AI companies are introducing a new set of dangers into the world, but those same companies
        may be unwilling to level with us about the risks.
      </p>
      <p>Here are just three examples of when AI companies knew about a problem, and kept it to themselves:</p>
      <h2>1. OpenAI chose not to report a ChatGPT mass killer until it was too late</h2>
      <p>
        In{" "}
        <a href="https://www.bbc.co.uk/news/articles/cn4gq352w89o" target="_blank" rel="noreferrer">
          June 2025
        </a>
        , Jesse Van Rootselaar was having some dangerous conversations with an AI. The Canadian teenager had allegedly
        been &ldquo;
        <a href="https://www.bbc.co.uk/news/articles/c309y25prnlo" target="_blank" rel="noreferrer">
          planning scenarios involving gun violence
        </a>
        &rdquo; with the help of ChatGPT. These conversations were on the radar of some OpenAI employees, who have{" "}
        <a
          href="https://www.eset.com/blog/en/home-topics/cybersecurity-protection/is-chatgpt-safe-2026-guide/"
          target="_blank"
          rel="noreferrer"
        >
          access
        </a>{" "}
        to users&rsquo; chat prompts. In fact, about twelve employees{" "}
        <a href="https://www.bbc.co.uk/news/articles/c2e4nvyjwnno" target="_blank" rel="noreferrer">
          noticed the potential harm
        </a>{" "}
        that Van Rootselaar posed to the public. They raised it with OpenAI&rsquo;s leaders. But despite warnings that
        the posts signalled an &ldquo;imminent risk&rdquo;, OpenAI leadership &ldquo;
        <a href="https://www.bbc.co.uk/news/articles/c309y25prnlo" target="_blank" rel="noreferrer">
          rebuffed
        </a>
        &rdquo; requests to alert the Canadian police.
      </p>
      <p>
        Then in February 2026, Van Rootselaar killed eight people and injured 27 others in a{" "}
        <a
          href="https://www.theguardian.com/world/2026/feb/11/tumbler-ridge-canada-shooting-school-mark-carney"
          target="_blank"
          rel="noreferrer"
        >
          mass shooting
        </a>
        . The victims{" "}
        <a href="https://www.bbc.co.uk/news/articles/c2e4nvyjwnno" target="_blank" rel="noreferrer">
          included
        </a>{" "}
        five young school children, a member of staff at the school, and the shooter&rsquo;s own mother and 11-year-old
        step-brother.
      </p>
      <p>
        A lawsuit is ongoing to determine if OpenAI acted negligently. The plaintiffs&rsquo; lawyer{" "}
        <a
          href="https://www.theguardian.com/technology/2026/apr/29/openai-tumbler-ridge-shooter-chatgpt-lawsuit"
          target="_blank"
          rel="noreferrer"
        >
          Jay Edelson has said
        </a>
        , &ldquo;the fact that Sam and the leadership overruled the safety team, and then children died, adults died,
        the whole town was ruined, is pretty close to the definition of evil to me.&rdquo;
      </p>
      <h2>
        2. Microsoft tried to suppress a warning about DALL&middot;E 3&rsquo;s &ldquo;disturbing, violent images&rdquo;
      </h2>
      <p>
        In December 2023, a Microsoft lead software developer called Shane Jones raised the{" "}
        <a
          href="https://s.wsj.net/public/resources/documents/SHANE_JONES_MICROSOFTFTCLETTER.pdf"
          target="_blank"
          rel="noreferrer"
        >
          AI safety alarm
        </a>
        . His concern was about DALL&middot;E 3, the image-generating AI model behind Microsoft&rsquo;s Copilot Designer
        app. Jones had found that it was possible to bypass the AI&rsquo;s guardrails and create harmful content that
        was supposed to be impossible. He told Microsoft, then he told OpenAI on Microsoft&rsquo;s instruction.
      </p>
      <p>
        But OpenAI did not respond, so Jones took to LinkedIn with an open letter, urging the startup to remove
        DALL&middot;E 3 until it could be stopped from producing &ldquo;disturbing, violent images&rdquo;. He also
        suggested that their system for filtering training data may be &ldquo;not rigorously tested&rdquo;.
      </p>
      <p>
        Then Microsoft&rsquo;s legal department stepped in. Jones was told to remove the LinkedIn post immediately. He
        was told he would get an explanation for the demand later. For the next month, he waited for that promised
        explanation but heard nothing. During this time, Microsoft was still age-rating the app as{" "}
        <a
          href="https://uk.pcmag.com/ai/151324/copilot-designer-creates-harmful-images-says-microsoft-ai-engineer"
          target="_blank"
          rel="noreferrer"
        >
          &ldquo;E for Everyone&rdquo;
        </a>
        .
      </p>
      <p>
        In January 2024, Jones&rsquo; warnings came true. News broke that non-consensual deepfakes of women were being
        shared online. The most high-profile story was of deepfake porn images of Taylor Swift.{" "}
        <a href="https://www.404media.co/ai-generated-taylor-swift-porn-twitter/" target="_blank" rel="noreferrer">
          404 media reported
        </a>{" "}
        that Microsoft&rsquo;s AI tools had been used to create them. Jones blew the whistle. You can read his
        correspondence related to this case{" "}
        <a
          href="https://s.wsj.net/public/resources/documents/SHANE_JONES_MICROSOFTFTCLETTER.pdf"
          target="_blank"
          rel="noreferrer"
        >
          here
        </a>
        .
      </p>
      <h2>3. IntelliVision knew about facial recognition racial bias five years before its advertising ban</h2>
      <p>
        U.S.-based security firm IntelliVision was marketing AI-powered facial recognition software. This type of
        technology is often used in retail, on ATMs, and, in this case, home security. Facial recognition is used in
        security by identifying the faces of known individuals, for example, matching an active shoplifter&rsquo;s face
        to a photo that the retailer already has on file. It&rsquo;s important that a match is accurate, because a false
        match could result in a harmless individual being targeted by the system. And the opposite can happen too; a
        real match can be missed.
      </p>
      <p>
        When an AI is more likely to make mistakes with some groups than others, this is called bias. Testers can spot
        racial bias in experiments. And that is exactly what the U.S. National Institute of Standards and Technology
        (NIST) did with IntelliVision&rsquo;s software. Their results clearly showed that the AI was less reliable when
        identifying people of African or Asian descent compared to identifying white people.{" "}
        <a href="https://nvlpubs.nist.gov/nistpubs/ir/2019/NIST.IR.8280.pdf" target="_blank" rel="noreferrer">
          These findings
        </a>{" "}
        were accessible to IntelliVision back in 2019.
      </p>
      <p>
        But in 2024, IntelliVision were still marketing themselves as a bias-free security solution despite knowing the
        truth, according to the U.S. Federal Trade Commission (FTC). In December 2024, the FTC lodged a{" "}
        <a
          href="https://www.ftc.gov/system/files/ftc_gov/pdf/2323023c4809intellivisionfinalconsent.pdf"
          target="_blank"
          rel="noreferrer"
        >
          complaint
        </a>{" "}
        alleging that IntelliVision had misled the public about the bias in its AI model. In January 2025, IntelliVision
        was{" "}
        <a
          href="https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-order-prohibiting-intellivision-making-deceptive-claims-about-its-facial-recognition"
          target="_blank"
          rel="noreferrer"
        >
          banned
        </a>{" "}
        from advertising their service as bias-free, without credible evidence of improvement.
      </p>
      <h2>Why is this important?</h2>
      <p>
        AI is evolving all the time, at speed. And with every change comes the possibility of new harms: perhaps a
        teenager gets lethal information from a machine that seems like a friend. Perhaps a woman logs into social media
        one day to see a nude photo of herself that she never took. Perhaps a shopper is pulled aside by security
        because an AI thinks he looks like a criminal. Indeed, we are now seeing early examples of exactly this{" "}
        <a href="https://www.bbc.co.uk/news/articles/cddjlmeqjgyo" target="_blank" rel="noreferrer">
          happening in the UK
        </a>
        . The next generation of AI will bring another set of risks altogether. We are already seeing the rise of
        autonomous AI cyber attacks, where an AI model causes a cybersecurity breach without human help; we know about
        cases caused by{" "}
        <a href="https://www.bbc.co.uk/news/articles/c2el319vzr3o" target="_blank" rel="noreferrer">
          OpenAI
        </a>
        ,{" "}
        <a href="https://www.bbc.co.uk/news/articles/cz7dl7w8y7po" target="_blank" rel="noreferrer">
          Anthropic
        </a>
        , and{" "}
        <a href="https://www.bbc.co.uk/news/articles/cx2kgdnyk2po" target="_blank" rel="noreferrer">
          Meta
        </a>{" "}
        models. The AI companies have lost control. If we can&rsquo;t trust their creators to be honest about what they
        know, then we must push for urgent change.
      </p>
      <h2>What can we do?</h2>
      <p>
        We don&rsquo;t have to accept these dangers. At Pause AI, we are campaigning to regulate AI developers now. We
        want to make AI companies share the responsibility for keeping us safe from massive cyber attacks and other
        harms to the public. You can read our{" "}
        <a href="/pdfs/Frontier-AI-Open-Letter.pdf" target="_blank" rel="noreferrer">
          open letter to the Prime Minister here
        </a>
        , and learn more about our campaigning <a href="/campaigns/">here</a>. You can help us keep the public safe by{" "}
        <a href="/campaigns/#email-your-mp">emailing your MP</a>, or sharing our campaign with your friends and family.
        Let&rsquo;s protect our future. Let&rsquo;s Pause AI.
      </p>
    </>
  ),
};

export default post;
