// OneOffThreadView in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import OneOffThreadView from "./OneOffThreadView";
import StaffPage from "../ui/StaffPage";
import { exampleForwardThread, exampleHiddenOneOff, exampleOneOffThread } from "./OneOffList.examples";

export const oneOffThreadViewGallery: Example[] = [
  {
    name: "OneOffThreadView",
    file: "app/(staff)/staff/_components/letters/OneOffThreadView.tsx",
    variants: [
      {
        label: "A thread of three: one unreadable, and an automatic reply folded to its first paragraph",
        render: () => (
          <StaffPage as="div">
            <OneOffThreadView thread={exampleOneOffThread} />
          </StaffPage>
        ),
      },
      {
        label:
          "A forward: the letter and the MP's answer it carries rebuilt before it, with the MP it's linked to beside it",
        render: () => (
          <StaffPage as="div">
            <OneOffThreadView thread={exampleForwardThread} />
          </StaffPage>
        ),
      },
      {
        label: "Hidden from staff without supporters",
        render: () => (
          <StaffPage as="div">
            <OneOffThreadView thread={{ ...exampleHiddenOneOff, messages_: null }} />
          </StaffPage>
        ),
      },
    ],
  },
];
