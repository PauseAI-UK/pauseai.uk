import type { Metadata } from "next";
import type { GroupAction, GroupPageContent } from "@/components/groups/GroupPage";
import { groupNamed, type GroupName } from "./groups";
import { site } from "./site";

// What each group's page says, rendered by components/groups/GroupPage.tsx.
// A local group's name, path, map pin and header logo are in
// ./local-groups.ts; an affinity group's name, path and the words that carry
// its name are in ./groups.ts.
//
// Every contact section has a button for the WhatsApp community and one to
// email. A group with an address of its own leads with its email button; the
// rest lead with WhatsApp, then email the team. Manchester leads with what
// its organiser offers, a chat.

const WHATSAPP = { label: "Join the WhatsApp community", href: site.whatsappUrl, newTab: true } as const;
const EMAIL_THE_TEAM = { label: "Email the team", href: `mailto:${site.contactEmail}` } as const;
const WEST_OF_ENGLAND_LINKS = {
  label: "All our links",
  href: "https://linktr.ee/PauseAI_West_of_England",
  variant: "ghost",
  newTab: true,
} as const;
const MANCHESTER_CHAT = {
  label: "Book a 1-on-1 chat",
  href: "https://calendly.com/adr-skapars/pauseai-manchester-1-on-1",
  newTab: true,
} as const;
const CAMBRIDGE_EMAIL = "cambridge@pauseai.uk";

/** The contact buttons of a group with no address of its own. */
const WHATSAPP_THEN_TEAM: GroupAction[] = [
  { ...WHATSAPP, variant: "primary" },
  { ...EMAIL_THE_TEAM, variant: "ghost" },
];

export const groupPages: Record<GroupName, GroupPageContent> = {
  Scotland: {
    name: "Scotland",
    hero: {
      lede: "Bringing AI safety conversations to Scotland with public events, panels, and community organising.",
      actions: [
        { label: "View event calendar", href: site.social.luma, variant: "primary", newTab: true },
        { ...WHATSAPP, variant: "ghost" },
        {
          label: "March against data centres, Edinburgh, Sat 14th Nov",
          href: "https://luma.com/mpan6y4o",
          variant: "ghost",
          newTab: true,
        },
        {
          label: "Citizens Assembly on AI, Glasgow, Sun 8th Nov",
          href: "https://assemble.qomon.org/en/action/39a4d41f-glasgow-assembly-on-ai/",
          variant: "ghost",
          newTab: true,
        },
      ],
      photo: "/images/local-groups/scotland/GlasgowUniUnion.jpg",
    },
    activities: {
      gridStyle: { gridTemplateColumns: "1fr" },
      items: [
        {
          title: "AI Risk – A Conversation We All Need to Have",
          text: "A public discussion unpacking the risks and responsibilities around advanced AI systems, featuring local voices and hands-on conversation.",
          image: "/images/local-groups/scotland/GlasgowUniUnion.jpg",
          href: "https://luma.com/5bmd6rx8",
          style: { maxWidth: 480 },
        },
      ],
    },
    contact: {
      lede: "Join the WhatsApp community to connect with local organisers and hear about UK-wide events and campaigns.",
      actions: WHATSAPP_THEN_TEAM,
    },
  },

  Manchester: {
    name: "Manchester",
    hero: {
      lede: "Building a local network in the North West to campaign for AI safety, host discussions, and support national actions.",
      actions: [
        { ...WHATSAPP, variant: "primary" },
        {
          label: "Follow us on Instagram",
          href: "https://www.instagram.com/pauseai.manchester",
          variant: "ghost",
          newTab: true,
        },
        {
          label: "Follow us on Facebook",
          href: "https://www.facebook.com/profile.php?id=61577650457496",
          variant: "ghost",
          newTab: true,
        },
        { ...MANCHESTER_CHAT, variant: "ghost" },
      ],
      photo: "/images/local-groups/manchester/manchester_public.jpg",
      photoStyle: {
        backgroundSize: "cover, 110% auto",
        backgroundPosition: "center, center 22%",
        backgroundRepeat: "no-repeat",
      },
      badge: "Make your voice heard",
    },
    activities: {
      items: [
        {
          title: "PauseAI Manchester Film Night",
          text: "A screening of an AI x-risk video with popcorn and vegan snacks, followed by group conversation about how we respond to advanced AI.",
          image: "/images/local-groups/manchester/movie_night.jpg",
          href: "https://luma.com/p8saolij",
        },
        {
          title: "PauseAI x EA: Discussion Group",
          text: "A friendly intro discussion on political solutions to existential risk from AI — covering whether pausing development and political action are effective strategies for reducing AI risk.",
          image: "/images/local-groups/manchester/discussion_group.jpg",
          imagePosition: "center 42%",
          href: "https://luma.com/5dv44ate",
        },
        {
          title: "PauseAI Manchester Coworking",
          text: "Casual coworking sessions where members come together to work on outreach, write to MPs, plan campaigns, and chat about AI safety over coffee.",
          image: "/images/local-groups/manchester/coworking_event.jpg",
        },
      ],
    },
    contact: {
      lede: "Join the WhatsApp community to connect with local organisers and hear about UK-wide events and campaigns. Want to learn more? Book a 1-on-1 chat.",
      actions: [
        { ...MANCHESTER_CHAT, variant: "primary" },
        { label: "Email us", href: "mailto:Adr.Skapars@gmail.com", variant: "ghost" },
        { ...WHATSAPP, variant: "ghost" },
      ],
    },
  },

  "West of England": {
    name: "West of England",
    hero: {
      lede: "A new group bringing AI safety conversations and action to Bristol and the wider West of England.",
      actions: [{ ...WHATSAPP, variant: "primary" }, WEST_OF_ENGLAND_LINKS],
      photo: "/images/local-groups/west-of-england/bristol-launch.jpg",
      photoStyle: {
        backgroundSize: "cover, cover",
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat",
      },
      badge: "Just getting started",
    },
    contact: {
      lede: "Join the UK-wide WhatsApp to connect with organisers and hear about national events and campaigns.",
      actions: [...WHATSAPP_THEN_TEAM, WEST_OF_ENGLAND_LINKS],
    },
  },

  Leicester: {
    name: "Leicester",
    hero: {
      lede: "Building a local network to campaign for AI safety, host discussions, and support national actions.",
      actions: [
        { label: "Email leicester@pauseai.info", href: "mailto:leicester@pauseai.info", variant: "primary" },
        { label: "Follow us on Instagram", href: "https://www.instagram.com/pauseai_leicester/", variant: "ghost" },
        { label: "Join our Discord", href: "https://discord.com", variant: "ghost" },
        { label: "Join the WhatsApp community", href: "/#get-involved", variant: "ghost", internal: true },
      ],
      photo: "/images/local-groups/leicester/london-2025-protest.jpg",
      badge: "Join in on protests!",
    },
    features: {
      heading: "What we're doing in Leicester",
      lede: "Want to help? We're looking for organisers, hosts, and partners to kickstart regular meetups.",
      items: [
        { title: "Attend events", text: "Check out our Instagram or Discord for more info on events." },
        { title: "Join the talk", text: "Contact us on Instagram or Discord to find out how you can help." },
      ],
    },
    activities: {
      gridStyle: { gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" },
      items: [
        {
          title: "PauseAI Leicester Launch",
          text: "The launch event for the Leicester group, bringing together students and locals to discuss AI safety.",
          image: "/images/local-groups/leicester/SirBobBurgessBuilding.jpg",
        },
        {
          title: "Film Night: The AI Doc",
          text: "We watched The AI Doc together in the cosy cinema room with popcorn and discussion.",
          image: "/images/local-groups/leicester/the-ai-doc-poster.jpg",
        },
      ],
    },
    contact: {
      lede: "Get in touch if you can host an event, promote a meetup, or want to collaborate on outreach.",
      actions: [
        { label: "Email Leicester", href: "mailto:leicester@pauseai.info", variant: "primary" },
        { ...WHATSAPP, variant: "ghost" },
      ],
    },
  },

  Cambridge: {
    name: "Cambridge",
    hero: {
      lede: "Conversations on AI risk in Cambridge, grounded in collaboration between students, researchers, and local residents.",
      actions: [
        { ...WHATSAPP, variant: "primary" },
        { label: `Email ${CAMBRIDGE_EMAIL}`, href: `mailto:${CAMBRIDGE_EMAIL}`, variant: "ghost" },
      ],
      photo: "/images/local-groups/cambridge/hero.webp",
      illustration: true,
    },
    contact: {
      lede: "Email us to attend the next meet, or to host an event in Cambridge.",
      actions: [
        { label: "Email Cambridge", href: `mailto:${CAMBRIDGE_EMAIL}`, variant: "primary" },
        { ...WHATSAPP, variant: "ghost" },
      ],
    },
  },

  Oxford: {
    name: "Oxford",
    hero: {
      lede: "University-driven conversations on AI risk, grounded in collaboration between students, researchers, and local residents.",
      actions: [
        { label: "Email oxford@pauseai.info", href: "mailto:oxford@pauseai.info", variant: "primary" },
        { label: "Join national chat", href: "/#get-involved", variant: "ghost", internal: true },
      ],
      photo: "/images/local-groups/oxford/PauseAI Oxford.jpg",
      badge: "Academic & community bridge",
    },
    activities: {
      gridStyle: { gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" },
      items: [
        {
          title: "PauseAI Oxford Launch: Why AI will cause human extinction",
          text: "The inaugural PauseAI Oxford event, exploring existential risk from advanced AI systems.",
          image: "/images/local-groups/oxford/ReubenCollege.jpg",
          href: "https://luma.com/5li0gx6b",
        },
        {
          title: "How to Pause AI Development – Talk + social",
          text: "A talk on practical strategies for slowing unsafe AI development, followed by drinks and discussion.",
          image: "/images/local-groups/oxford/ReubenBar.jpg",
          href: "https://luma.com/lqnts0io",
        },
      ],
    },
    contact: {
      lede: "Email us to join the mailing list, attend the next meet, or host an event on campus.",
      actions: [
        { label: "Email Oxford", href: "mailto:oxford@pauseai.info", variant: "primary" },
        { ...WHATSAPP, variant: "ghost" },
      ],
    },
  },

  London: {
    name: "London",
    hero: {
      lede: "We gather researchers, students, campaigners, and neighbours to push for safer AI development through public action and dialogue.",
      actions: [
        { ...WHATSAPP, variant: "primary" },
        { ...EMAIL_THE_TEAM, variant: "ghost" },
      ],
      photo: "/images/book-launch-2025/G1kOF_EXMAA7yfX.jpeg",
      badge: "Central meetups & actions",
    },
    contact: {
      lede: "We meet regularly in central London for talks, workshops, and campaign planning. New to the movement? Start by joining the WhatsApp community, then drop us an email if you'd like to host or speak at an event.",
      actions: WHATSAPP_THEN_TEAM,
    },
  },

  Parents: {
    name: "Parents",
    hero: {
      lede: "We're parents and carers worried about the world our children will grow up in. Together we campaign to stop the race to superintelligent AI until it can be shown to be safe.",
      actions: [
        { ...WHATSAPP, variant: "primary" },
        { ...EMAIL_THE_TEAM, variant: "ghost" },
      ],
      photo: "/images/groups/parents-hero.webp",
      illustration: true,
      badge: "Make your voice heard",
    },
    contact: {
      lede: "Join the WhatsApp community to meet other parents and carers, or email us to find out more.",
      actions: WHATSAPP_THEN_TEAM,
    },
  },

  Teachers: {
    name: "Teachers",
    hero: {
      lede: "We're teachers, lecturers and school staff watching AI change classrooms faster than anyone can keep up. We campaign to stop the race to superintelligent AI until it can be shown to be safe.",
      actions: [
        { ...WHATSAPP, variant: "primary" },
        { ...EMAIL_THE_TEAM, variant: "ghost" },
      ],
      photo: "/images/groups/teachers-hero.webp",
      illustration: true,
      badge: "Make your voice heard",
    },
    contact: {
      lede: "Join the WhatsApp community to meet other teachers and school staff, or email us to find out more.",
      actions: WHATSAPP_THEN_TEAM,
    },
  },
};

/** Page metadata, which follows the same pattern for every group. */
export function groupMetadata(name: GroupName, description: string): Metadata {
  const { href, words } = groupNamed(name);
  return {
    title: words.label,
    openGraph: {
      title: words.title,
      description,
      images: [{ url: "/images/open-graph/open-graph-1200-630.jpg", width: 1200, height: 630 }],
      url: `https://pauseai.uk${href}`,
    },
    twitter: {
      title: words.title,
      description,
      images: ["/images/open-graph/open-graph-1080-1080.jpg"],
    },
    alternates: { canonical: href },
  };
}
