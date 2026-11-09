import type { BlogPost } from "../posts";

const post: BlogPost = {
  slug: "crunch-time-is-now",
  title: "Crunch Time is Now",
  date: "2026-09-15",
  author: "Lachlan Ewart",
  tldr: "A week of headlines has put AI risk in the public eye, and that is when decisions get made. Email your MP, volunteer, join the London protest, and spread the word now.",
  cover: {
    src: "/images/front-page-hero-optimized/june-2025-protest-closeup.webp",
    alt: "PauseAI protesters in London holding placards, one reading: Just don't build AGI",
    width: 800,
    height: 450,
  },
  content: (
    <>
      <p>
        The last week has seen an explosion of interest in AI safety. Following the{" "}
        <a href="https://x.com/hilbertspaess/status/2097476196791709843?s=20" target="_blank" rel="noreferrer">
          viral tweet
        </a>{" "}
        from Jacob Coxon as he quit Anthropic, various news outlets have reported that AI really might kill us all. This
        publicity means that there is an open window, where we have a chance to speak out, and be heard. President Trump
        has called AI takeover a{" "}
        <a href="https://truthsocial.com/@realDonaldTrump/117271376102039451" target="_blank" rel="noreferrer">
          hoax
        </a>
        , and legislation is not guaranteed - right now is a <em>vital</em> time to make a push for legislative change
        on frontier AI development. The public eye is on AI risk, and this is when decisions get made. So please, spend
        time now making a difference: <a href="/campaigns/#email-your-mp">email</a> or cold-call your MP, volunteer for
        pro-pause organisations
        <sup>
          <a id="fnref-1" href="#fn-1" aria-label="Footnote 1">
            1
          </a>
        </sup>
        , join the{" "}
        <a href="https://lu.ma/gjokfxob" target="_blank" rel="noreferrer">
          emergency protest
        </a>{" "}
        in London, and spread the word. Survival is a non-partisan issue - don&rsquo;t be put off by your MP being
        politically misaligned to you. Be proactive, act <strong>now</strong>, and you could make a real difference.
      </p>
      <blockquote>
        <p>
          <em>
            &lsquo;For the first time in a very long time, we actually think things might go well for humanity. Whether
            that happens is up to us.&rsquo;
          </em>
        </p>
        <p className="blog-quote-source">
          <a
            href="https://www.lesswrong.com/posts/JefmamDeQmtsMvvps/maxime-fournes-s-shortform"
            target="_blank"
            rel="noreferrer"
          >
            Maxime Fournes
          </a>
          <sup>
            <a id="fnref-2" href="#fn-2" aria-label="Footnote 2">
              2
            </a>
          </sup>
        </p>
      </blockquote>
      <ol className="blog-footnotes">
        <li id="fn-1">
          Some pro-pause organisations: PauseAI,{" "}
          <a href="https://peopleforapause.org/#contact" target="_blank" rel="noreferrer">
            People for a Pause
          </a>
          ,{" "}
          <a href="https://controlai.org/take-action" target="_blank" rel="noreferrer">
            ControlAI
          </a>
          ,{" "}
          <a href="https://humansincontrol.org/contact/" target="_blank" rel="noreferrer">
            Humans in Control
          </a>
          .{" "}
          <a className="blog-footnote-back" href="#fnref-1" aria-label="Back to text">
            &#8617;
          </a>
        </li>
        <li id="fn-2">
          Inspired by / lifted from the post of the same name,{" "}
          <a
            href="https://www.lesswrong.com/posts/JefmamDeQmtsMvvps/maxime-fournes-s-shortform"
            target="_blank"
            rel="noreferrer"
          >
            <em>Crunch Time is Now. Drop Everything</em>
          </a>
          , by Maxime Fournes (LessWrong, 14 September 2026).{" "}
          <a className="blog-footnote-back" href="#fnref-2" aria-label="Back to text">
            &#8617;
          </a>
        </li>
      </ol>
    </>
  ),
};

export default post;
