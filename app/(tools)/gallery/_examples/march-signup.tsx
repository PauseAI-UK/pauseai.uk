// The marches' pages, the next march's sign-up and a past march's record
// (app/(march)/demonstrations/_components/), each in the sub-site's frame,
// which gives it its type and colours.
import type { ReactNode } from "react";
import HeroFacts from "@/app/(march)/demonstrations/_components/HeroFacts";
import MarchOver from "@/app/(march)/demonstrations/_components/MarchOver";
import MarchSignupFrame from "@/app/(march)/demonstrations/_components/MarchSignupFrame";
import MarchSignups from "@/app/(march)/demonstrations/_components/MarchSignups";
import Marker from "@/app/(march)/demonstrations/_components/Marker";
import PastHero from "@/app/(march)/demonstrations/_components/PastHero";
import SignupCount from "@/app/(march)/demonstrations/_components/SignupCount";
import SignupCase from "@/app/(march)/demonstrations/_components/SignupCase";
import SignupDay from "@/app/(march)/demonstrations/_components/SignupDay";
import SignupDemand from "@/app/(march)/demonstrations/_components/SignupDemand";
import SignupGoing from "@/app/(march)/demonstrations/_components/SignupGoing";
import SignupHero from "@/app/(march)/demonstrations/_components/SignupHero";
import SignupPhotos from "@/app/(march)/demonstrations/_components/SignupPhotos";
import SignupRegistered from "@/app/(march)/demonstrations/_components/SignupRegistered";
import SignupTurnout from "@/app/(march)/demonstrations/_components/SignupTurnout";
import { march, novemberMarch } from "@/lib/content/march";
import type { Group } from "../_components/types";
import { ShareCardExample, SignupFormExample, SignupRegisterExample } from "./march-signup.client";

const inFrame = (children: ReactNode) => <MarchSignupFrame>{children}</MarchSignupFrame>;

export const marchSignup: Group = {
  id: "march-signup",
  title: "The marches' pages",
  examples: [
    {
      name: "MarchSignupFrame",
      file: "app/(march)/demonstrations/_components/MarchSignupFrame.tsx",
      variants: [
        {
          label: "The sub-site's frame: its background and type",
          render: () => inFrame(<p>An example paragraph.</p>),
        },
      ],
    },
    {
      name: "SignupHero",
      file: "app/(march)/demonstrations/_components/SignupHero.tsx",
      variants: [
        {
          label: "The sign-up page's first screen, with how many have registered",
          render: () =>
            inFrame(
              <MarchSignups signups={1234}>
                <SignupHero march={march} />
              </MarchSignups>,
            ),
        },
        { label: "When Luma can't say how many", render: () => inFrame(<SignupHero march={march} />) },
      ],
    },
    {
      name: "PastHero",
      file: "app/(march)/demonstrations/_components/PastHero.tsx",
      variants: [
        {
          label: "A past march's first screen: what we said of the day, its film, and how many registered",
          render: () => inFrame(<PastHero march={novemberMarch} registered={1234} />),
        },
      ],
    },
    {
      name: "HeroFacts",
      file: "app/(march)/demonstrations/_components/HeroFacts.tsx",
      variants: [
        {
          label: "A march's when and where, with its route",
          render: () =>
            inFrame(
              <div style={{ padding: 24, background: "var(--text)", color: "var(--white)" }}>
                <HeroFacts march={novemberMarch} />
              </div>,
            ),
        },
      ],
    },
    {
      name: "SignupRegistered",
      file: "app/(march)/demonstrations/_components/SignupRegistered.tsx",
      variants: [
        {
          label: "How many registered for a past march, as under its hero's button",
          render: () =>
            inFrame(
              <div style={{ padding: 24, background: "var(--text)", color: "var(--white)" }}>
                <SignupRegistered count={1234} />
              </div>,
            ),
        },
      ],
    },
    {
      name: "SignupGoing",
      file: "app/(march)/demonstrations/_components/SignupGoing.tsx",
      variants: [
        {
          label: "How many have registered, as under the hero's buttons",
          render: () =>
            inFrame(
              <div style={{ padding: 24, background: "var(--text)", color: "var(--white)" }}>
                <MarchSignups signups={1234}>
                  <SignupGoing />
                </MarchSignups>
              </div>,
            ),
        },
      ],
    },
    {
      name: "Marker",
      file: "app/(march)/demonstrations/_components/Marker.tsx",
      variants: [
        {
          label: "Words underlined in marker pen",
          render: () =>
            inFrame(
              <p style={{ padding: 24 }}>
                An example sentence, <Marker type="underline">with its key words marked</Marker>.
              </p>,
            ),
        },
        {
          label: "A figure circled",
          render: () =>
            inFrame(
              <p style={{ padding: 32, fontSize: 44 }}>
                <Marker type="circle">1,000</Marker>
              </p>,
            ),
        },
      ],
    },
    {
      name: "SignupCase",
      file: "app/(march)/demonstrations/_components/SignupCase.tsx",
      variants: [
        { label: "Why we're marching", render: () => inFrame(<SignupCase />) },
        { label: "On a past march's page", render: () => inFrame(<SignupCase past />) },
      ],
    },
    {
      name: "SignupDemand",
      file: "app/(march)/demonstrations/_components/SignupDemand.tsx",
      variants: [{ label: "What we want", render: () => inFrame(<SignupDemand />) }],
    },
    {
      name: "SignupTurnout",
      file: "app/(march)/demonstrations/_components/SignupTurnout.tsx",
      variants: [
        { label: "The turnouts, the goal circled", render: () => inFrame(<SignupTurnout />) },
        { label: "On a past march's page, ending at its own turnout", render: () => inFrame(<SignupTurnout past />) },
      ],
    },
    {
      name: "SignupPhotos",
      file: "app/(march)/demonstrations/_components/SignupPhotos.tsx",
      variants: [{ label: "The photo staircase, and the press", render: () => inFrame(<SignupPhotos />) }],
    },
    {
      name: "SignupDay",
      file: "app/(march)/demonstrations/_components/SignupDay.tsx",
      variants: [
        { label: "On the day, before the route is settled", render: () => inFrame(<SignupDay march={march} />) },
        { label: "With the route", render: () => inFrame(<SignupDay march={novemberMarch} />) },
      ],
    },
    {
      name: "SignupRegister",
      file: "app/(march)/demonstrations/_components/SignupRegister.tsx",
      variants: [{ label: "The register band, with the form", render: () => <SignupRegisterExample /> }],
    },
    {
      name: "SignupForm",
      file: "app/(march)/demonstrations/_components/SignupForm.tsx",
      variants: [{ label: "The form, whose action logs what it's sent", render: () => <SignupFormExample /> }],
    },
    {
      name: "SignupCount",
      file: "app/(march)/demonstrations/_components/SignupCount.tsx",
      variants: [
        {
          label: "How many have registered, as in the form's corner",
          render: () => inFrame(<SignupCount count={1234} />),
        },
      ],
    },
    {
      name: "MarchSignups",
      file: "app/(march)/demonstrations/_components/MarchSignups.tsx",
      variants: [
        {
          label: "The count for the hero and the form, the register band in it",
          render: () => <SignupRegisterExample />,
        },
      ],
    },
    {
      name: "SignupFlow",
      file: "app/(march)/demonstrations/_components/SignupFlow.tsx",
      variants: [
        { label: "The cards, starting with the form, in the register band", render: () => <SignupRegisterExample /> },
      ],
    },
    {
      name: "ShareCard",
      file: "app/(march)/demonstrations/_components/ShareCard.tsx",
      variants: [{ label: "The share card, after registering", render: () => <ShareCardExample /> }],
    },
    {
      name: "MarchOver",
      file: "app/(march)/demonstrations/_components/MarchOver.tsx",
      variants: [{ label: "A past march's last band, where the form was", render: () => inFrame(<MarchOver />) }],
    },
  ],
};
