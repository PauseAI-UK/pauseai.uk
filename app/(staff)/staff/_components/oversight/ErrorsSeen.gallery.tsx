// ErrorsSeen in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import ErrorsSeen from "./ErrorsSeen";
import { exampleErrorDone, exampleErrorsSeen } from "./ErrorsSeen.examples";
import StaffPage from "../ui/StaffPage";

export const errorsSeenGallery: Example[] = [
  {
    name: "ErrorsSeen",
    file: "app/(staff)/staff/_components/oversight/ErrorsSeen.tsx",
    variants: [
      {
        label: "To do: a page's error, a problem, and two from browsers",
        render: () => (
          <StaffPage as="div">
            <ErrorsSeen done={false} errors={exampleErrorsSeen} total={4} pages={1} page={1} pageSize={100} />
          </StaffPage>
        ),
      },
      {
        label: "Nothing has gone wrong",
        render: () => (
          <StaffPage as="div">
            <ErrorsSeen done={false} errors={[]} total={0} pages={1} page={1} pageSize={100} />
          </StaffPage>
        ),
      },
      {
        label: "Done: who marked each, and when",
        render: () => (
          <StaffPage as="div">
            <ErrorsSeen done errors={[exampleErrorDone]} total={1} pages={1} page={1} pageSize={100} />
          </StaffPage>
        ),
      },
    ],
  },
];
