export const site = {
  url: "https://pauseai.uk",
  gaId: "G-DLLRWZCYD7",
  shopUrl: "https://pauseai-shop.fourthwall.com/en-gbp",
  openLetterPath: "/campaigns/dear-sir-demis-2025",
  contactEmail: "hello@pauseai.uk",
  pressEmail: "press@pauseai.uk",
  // Where MPs and peers email to sign the letter to the PM, as its PDF says.
  policyEmail: "policy@pauseai.uk",
  social: {
    instagram: "https://instagram.com/pauseai_uk",
    tiktok: "https://tiktok.com/@pauseai_uk",
    x: "https://x.com/pauseai_uk",
    facebook: "https://www.facebook.com/people/Pause-AI-UK/61587358827177/",
    youtube: "https://www.youtube.com/@PauseAI",
    luma: "https://luma.com/pauseai.uk",
    linktree: "https://linktr.ee/pauseai_uk",
  },
};

/**
 * The WhatsApp community's page (app/(site)/whatsapp), with where the
 * button for it is, such as `footer` or a group's page, as its utm_source,
 * which analytics records. No page holds the community's own link.
 */
export function whatsappJoinPath(from: string): string {
  return `/whatsapp?utm_source=${encodeURIComponent(from)}`;
}
