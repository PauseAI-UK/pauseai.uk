import { checkPostAuthors, type BlogPost, type PostSection } from "../posts";
import aiCompaniesKnewAndKeptQuiet from "./ai-companies-knew-and-kept-quiet";
import burnhamGlobalAiAgreementPause from "./burnham-global-ai-agreement-pause";
import crunchTimeIsNow from "./crunch-time-is-now";
import emailYourMp from "./email-your-mp";
import monopolyOnAiViolence from "./monopoly-on-ai-violence";
import nobodyKnowsHowToMakeAiBehave from "./nobody-knows-how-to-make-ai-behave";
import parliamentExpertsAgreeGovernmentMustActOnAiRisk from "./parliament-experts-agree-government-must-act-on-ai-risk";
import theMissingDominantStrategy from "./the-missing-dominant-strategy";
import theOtherAlignmentProblem from "./the-other-alignment-problem";
import theTechnologyIsTheIdeology from "./the-technology-is-the-ideology";
import whatCanBritainEvenDo from "./what-can-britain-even-do";
import youCantPauseAiWithoutChina from "./you-cant-pause-ai-without-china";

// The blog: a post a file, ./<slug>.tsx, listed here newest first.

export const BLOG: PostSection = {
  path: "/blog",
  backLink: "← All posts",
  moreHeading: "More from the blog",
  feedTitle: "PauseAI UK blog",
};

export const posts: BlogPost[] = [
  monopolyOnAiViolence,
  theTechnologyIsTheIdeology,
  theOtherAlignmentProblem,
  theMissingDominantStrategy,
  burnhamGlobalAiAgreementPause,
  crunchTimeIsNow,
  whatCanBritainEvenDo,
  parliamentExpertsAgreeGovernmentMustActOnAiRisk,
  youCantPauseAiWithoutChina,
  aiCompaniesKnewAndKeptQuiet,
  nobodyKnowsHowToMakeAiBehave,
  emailYourMp,
];

checkPostAuthors(posts);

export function findPost(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}
