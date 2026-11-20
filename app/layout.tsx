import type { Metadata } from "next";
import { Lato } from "next/font/google";
import { preload } from "react-dom";
import "@/styles/tokens.css";
import "@/styles/base.css";
import CookieConsent from "@/components/layout/CookieConsent";
import ErrorReporter from "@/components/layout/ErrorReporter";
import FooterYear from "@/components/layout/FooterYear";
import JsonLd from "@/components/layout/JsonLd";
import TagManagerNoscript from "@/components/layout/TagManagerNoscript";
import { analyticsEnabled } from "@/lib/analytics.server";
import { site } from "@/lib/content/site";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PauseAI UK",
  url: site.url,
  logo: `${site.url}/favicon/web-app-manifest-512x512.png`,
  email: site.contactEmail,
  sameAs: [site.social.instagram, site.social.tiktok, site.social.x, site.social.facebook, site.social.youtube],
};

const lato = Lato({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-display",
  display: "swap",
});

// Inter, the text font, is declared in styles/tokens.css, in two files: the
// Latin one, which every page needs, and one of accented letters, which a
// browser fetches only for a page that has them.
const INTER_LATIN = "/fonts/inter-latin-wght-normal.woff2";

export const metadata: Metadata = {
  metadataBase: new URL("https://pauseai.uk"),
  title: {
    template: "%s | PauseAI UK",
    default: "PauseAI UK",
  },
  description: "Community-led action for safe and accountable AI across the UK.",
  openGraph: {
    title: "PauseAI UK",
    description: "Community-led action for safe and accountable AI across the UK.",
    images: [{ url: "/images/open-graph/open-graph-1200-630.jpg", width: 1200, height: 630 }],
    type: "website",
    url: "https://pauseai.uk/",
  },
  twitter: {
    card: "summary_large_image",
    title: "PauseAI UK",
    description: "Community-led action for safe and accountable AI across the UK.",
    images: ["/images/open-graph/open-graph-1600-840.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon.ico" },
    ],
    apple: { url: "/favicon/apple-touch-icon.png", sizes: "180x180" },
  },
  manifest: "/favicon/site.webmanifest",
  other: {
    "apple-mobile-web-app-title": "PauseAI UK",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Only the live site has analytics (lib/analytics.server.ts).
  const analytics = analyticsEnabled();
  // Fetched with the page rather than once the stylesheet has asked for it. A
  // font is always fetched without credentials, which `crossOrigin` matches.
  preload(INTER_LATIN, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <html lang="en" className={lato.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <TagManagerNoscript analytics={analytics} />
        <CookieConsent analytics={analytics}>
          <JsonLd data={organizationJsonLd} />
          {children}
        </CookieConsent>
        <FooterYear />
        <ErrorReporter />
      </body>
    </html>
  );
}
