import Link from "next/link";
import ProsePage, { ProseMeta } from "@/components/ui/ProsePage";

// The privacy policy for PauseAI UK (Safe AI Alliance Ltd).
export default function PrivacyPolicy() {
  return (
    <ProsePage>
      <h1>Privacy Policy</h1>
      <ProseMeta>Last updated: 13 November 2026</ProseMeta>

      <p>
        PauseAI UK is part of the global PauseAI movement and is run in the UK by <strong>Safe AI Alliance Ltd</strong>,
        a private company limited by guarantee registered in England and Wales (company number 17137345), registered
        office 128 City Road, London EC1V 2NX.
      </p>
      <p>
        We decide how your data is used (we&apos;re its &ldquo;data controller&rdquo;), even where a provider below
        stores or sends it for us. If you join PauseAI, your membership is held by <strong>Stichting PauseAI</strong>{" "}
        (the global PauseAI foundation, based in the Netherlands), under{" "}
        <a className="inline-link" href="https://pauseai.info/privacy" target="_blank" rel="noreferrer">
          their privacy policy
        </a>
        . If you have any questions about your data, email us at{" "}
        <a className="inline-link" href="mailto:hello@pauseai.uk">
          hello@pauseai.uk
        </a>
        .
      </p>

      {/* The facts behind the sections below are in docs/data-protection.md. */}

      <h2>Donation data</h2>
      <p>
        Donations are processed by <strong>Stripe</strong>. We receive your name, email, amount, and the date, but never
        your card or bank details. We use this to send you a receipt, keep financial records, and thank you (legal
        basis: our agreement with you, our legal obligation to keep records, and our legitimate interest). If you say
        yes to our wall of thanks, our donate page shows the name you gave and the date you donated (legal basis: your
        explicit consent). To come off, email{" "}
        <a className="inline-link" href="mailto:hello@pauseai.uk">
          hello@pauseai.uk
        </a>
        .
      </p>

      <h2>Website analytics</h2>
      <p>
        This site uses <strong>Google Analytics</strong>. It sets cookies that collect the pages you visit, your
        approximate location, and your device and browser type (legal basis: legitimate interest). You can opt out at
        any time using the &ldquo;Cookie settings&rdquo; link in the footer.
      </p>

      <h2>Email your MP</h2>
      <p>
        When you write to your MP through this site, we keep your name, email address, postal address and postcode,
        which campaign and MP you wrote to, the letter you sent, and whether you ticked the box to hear about events and
        ways to help. We send your letter under an address made for you, so your MP&apos;s office never sees your own
        email address, and pass replies both ways. We keep every message. If you copy{" "}
        <a className="inline-link" href="mailto:policy@pauseai.uk">
          policy@pauseai.uk
        </a>{" "}
        into an email to a politician, or forward us one, we keep that too (legal basis: legitimate interest in running
        the campaign, and your consent if you ticked the box).
      </p>

      <h2>Signing up</h2>
      <p>
        When you sign up to a march on this site, or on a paper form when we&apos;re out leafleting, we keep your name
        and email, and your phone number, city and postcode if you gave them. We register you on Luma for the event, and
        keep you updated on our campaigns if you said yes (legal basis: legitimate interest in running the event, and
        your consent).
      </p>

      <h2>Events and Luma</h2>
      <p>
        Our events run on Luma. When you register for or host one of our events, or follow our calendar, Luma gives us
        your name, email address, which events you registered for, and (where an event asked for them) your phone number
        and postcode. If you unsubscribe from the calendar&apos;s emails, Luma tells us, so we never email that address
        about events.
      </p>

      <h2>Supporters and political opinions</h2>
      <p>
        We bring your letters, sign-ups and event registrations together into one record, and work out roughly where you
        are from your postcode or city, to invite you to things near you. If you joined PauseAI, live in the UK, and
        agreed to share your details with PauseAI UK, Stichting PauseAI shares your membership with us too. Taking part
        in a PauseAI campaign shows a political opinion, which is special category data. We hold it as a not-for-profit
        body with a political aim (UK GDPR Article 9(2)(d)), and we don&apos;t disclose it outside PauseAI UK without
        your consent. Only staff with permission can see these records.
      </p>

      <h2>How we contact you</h2>
      <p>
        We only email you when you opted in - either to our newsletter, messages about events or you said you’d like to
        volunteer. Every email has a link at the bottom to unsubscribe or change the emails you get. Or check your
        settings now on the{" "}
        <Link className="inline-link" href="/contact-preferences">
          contact preferences page
        </Link>
        .
      </p>
      <p>
        We only text you on WhatsApp when you opted in to texts. To stop, reply STOP to any of them, or change the texts
        you get on the{" "}
        <Link className="inline-link" href="/contact-preferences">
          contact preferences page
        </Link>
        .
      </p>
      <p>
        Before each email or text goes, we check your address or number against Stichting PauseAI’s records, so if
        you’ve asked PauseAI not to email or text you, we won’t. When you unsubscribe from us, we tell Stichting
        PauseAI. If you stop all bulk email, their emails stop too.
      </p>
      <p>If you reply to one of our emails or texts, we keep your reply.</p>

      <h2>Who processes this data for us</h2>
      <ul>
        <li>Stripe: donations.</li>
        <li>Luma: events and registrations.</li>
        <li>Postmark: sending and receiving email.</li>
        <li>Meta (WhatsApp): sending and receiving texts.</li>
        <li>Google (Gmail): sending and receiving email, including your letters to your MP.</li>
        <li>Netlify: hosting the site and its database.</li>
        <li>Cloudflare: backups, and Turnstile, the anti-spam check.</li>
        <li>postcodes.io: looking up postcodes; it keeps nothing.</li>
        <li>Airtable: our records of MPs and of members.</li>
      </ul>
      <p>
        We do not sell your personal data. Where a provider is outside the UK, the transfer is protected by UK adequacy
        regulations or the UK International Data Transfer Agreement.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep donation records for 6 years, as UK law requires, and everything else until you ask us to erase it. Our
        backups delete it within 90 days after that. After erasure we keep only that you asked us to stop contacting
        you, or that an email to you bounced, so we never contact you again.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask for a copy of your data, or to correct or erase it, or object to how we use it: email{" "}
        <a className="inline-link" href="mailto:hello@pauseai.uk">
          hello@pauseai.uk
        </a>{" "}
        from the address we hold for you. We reply within a month. You can also complain to the{" "}
        <a className="inline-link" href="https://ico.org.uk/" target="_blank" rel="noreferrer">
          ICO
        </a>
        .
      </p>

      <h2>Cookies</h2>
      <p>
        ⁂ Google Analytics and Google Ads set cookies, which you can turn off with &ldquo;Cookie settings&rdquo; in the
        footer, and your browser remembers that choice. When you donate, you go to Stripe&apos;s own site, which sets
        its own cookies there. The join form we show from pauseai.info may set its own cookies too. While you write to
        your MP, your browser keeps your draft until you close the tab.
      </p>

      <p>When we change this policy, we change the date at the top.</p>
    </ProsePage>
  );
}
