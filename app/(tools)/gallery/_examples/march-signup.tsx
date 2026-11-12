// The march sign-up, the march's page (app/(march)/protests/march-against-ai-extinction-nov-26/_components/),
// each in the sub-site's frame, which gives it its type and colours.
import type { ReactNode } from "react";
import MarchSignupFrame from "@/app/(march)/protests/march-against-ai-extinction-nov-26/_components/MarchSignupFrame";
import MarchSignups from "@/app/(march)/protests/march-against-ai-extinction-nov-26/_components/MarchSignups";
import Marker from "@/app/(march)/protests/march-against-ai-extinction-nov-26/_components/Marker";
import SignupCount from "@/app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupCount";
import SignupCase from "@/app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupCase";
import SignupDay from "@/app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupDay";
import SignupDemand from "@/app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupDemand";
import SignupGoing from "@/app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupGoing";
import SignupHero from "@/app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupHero";
import SignupPhotos from "@/app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupPhotos";
import SignupTurnout from "@/app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupTurnout";
import type { Group } from "../_components/types";
import { ShareCardExample, SignupFormExample, SignupRegisterExample } from "./march-signup.client";

const inFrame = (children: ReactNode) => <MarchSignupFrame>{children}</MarchSignupFrame>;

export const marchSignup: Group = {
  id: "march-signup",
  title: "The march sign-up",
  examples: [
    {
      name: "MarchSignupFrame",
      file: "app/(march)/protests/march-against-ai-extinction-nov-26/_components/MarchSignupFrame.tsx",
      variants: [
        {
          label: "The sub-site's frame: its background and type",
          render: () => inFrame(<p>An example paragraph.</p>),
        },
      ],
    },
    {
      name: "SignupHero",
      file: "app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupHero.tsx",
      variants: [
        {
          label: "The sign-up page's first screen, with how many have registered",
          render: () =>
            inFrame(
              <MarchSignups signups={1234}>
                <SignupHero />
              </MarchSignups>,
            ),
        },
        { label: "When Luma can't say how many", render: () => inFrame(<SignupHero />) },
      ],
    },
    {
      name: "SignupGoing",
      file: "app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupGoing.tsx",
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
      file: "app/(march)/protests/march-against-ai-extinction-nov-26/_components/Marker.tsx",
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
      file: "app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupCase.tsx",
      variants: [{ label: "Why we're marching", render: () => inFrame(<SignupCase />) }],
    },
    {
      name: "SignupDemand",
      file: "app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupDemand.tsx",
      variants: [{ label: "What we want", render: () => inFrame(<SignupDemand />) }],
    },
    {
      name: "SignupTurnout",
      file: "app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupTurnout.tsx",
      variants: [{ label: "The turnouts, the goal circled", render: () => inFrame(<SignupTurnout />) }],
    },
    {
      name: "SignupPhotos",
      file: "app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupPhotos.tsx",
      variants: [{ label: "The photo staircase, and the press", render: () => inFrame(<SignupPhotos />) }],
    },
    {
      name: "SignupDay",
      file: "app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupDay.tsx",
      variants: [{ label: "On the day", render: () => inFrame(<SignupDay />) }],
    },
    {
      name: "SignupRegister",
      file: "app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupRegister.tsx",
      variants: [{ label: "The register band, with the form", render: () => <SignupRegisterExample /> }],
    },
    {
      name: "SignupForm",
      file: "app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupForm.tsx",
      variants: [{ label: "The form, whose action logs what it's sent", render: () => <SignupFormExample /> }],
    },
    {
      name: "SignupCount",
      file: "app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupCount.tsx",
      variants: [
        {
          label: "How many have registered, as in the form's corner",
          render: () => inFrame(<SignupCount count={1234} />),
        },
      ],
    },
    {
      name: "MarchSignups",
      file: "app/(march)/protests/march-against-ai-extinction-nov-26/_components/MarchSignups.tsx",
      variants: [
        {
          label: "The count for the hero and the form, the register band in it",
          render: () => <SignupRegisterExample />,
        },
      ],
    },
    {
      name: "SignupFlow",
      file: "app/(march)/protests/march-against-ai-extinction-nov-26/_components/SignupFlow.tsx",
      variants: [
        { label: "The cards, starting with the form, in the register band", render: () => <SignupRegisterExample /> },
      ],
    },
    {
      name: "ShareCard",
      file: "app/(march)/protests/march-against-ai-extinction-nov-26/_components/ShareCard.tsx",
      variants: [{ label: "The share card, after registering", render: () => <ShareCardExample /> }],
    },
  ],
};
