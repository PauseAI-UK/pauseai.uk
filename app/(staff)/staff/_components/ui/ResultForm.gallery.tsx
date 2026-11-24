// ResultForm in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { FailedExample, GoneExample, TypedWrongExample } from "./ResultForm.gallery.client";
import StaffPage from "./StaffPage";

export const resultFormGallery: Example[] = [
  {
    name: "ResultForm",
    file: "app/(staff)/staff/_components/ui/ResultForm.tsx",
    variants: [
      {
        label: "Refused for a name of only spaces: said under the field, which is marked wrong",
        render: () => (
          <StaffPage as="div">
            <TypedWrongExample />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "Refusal",
    file: "app/(staff)/staff/_components/ui/ResultForm.tsx",
    variants: [
      {
        label: "Under the button of a form with no field, whose action threw or never arrived",
        render: () => (
          <StaffPage as="div">
            <FailedExample />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "RefusedTextInput",
    file: "app/(staff)/staff/_components/ui/ResultForm.tsx",
    variants: [
      {
        label: "A text box that's wrong, in a form refused for it",
        render: () => (
          <StaffPage as="div">
            <TypedWrongExample box />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "RefusedTextArea",
    file: "app/(staff)/staff/_components/ui/ResultForm.tsx",
    variants: [
      {
        label: "A text area that's wrong, in a form refused for it",
        render: () => (
          <StaffPage as="div">
            <TypedWrongExample />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "RefusalPlace",
    file: "app/(staff)/staff/_components/ui/ResultForm.tsx",
    variants: [
      {
        label: "Nothing till its button's pressed; then, that what the form is about has gone, said over it",
        render: () => (
          <StaffPage as="div">
            <GoneExample />
          </StaffPage>
        ),
      },
    ],
  },
];
