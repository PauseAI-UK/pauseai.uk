// ImportCard in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import ImportCard, { ImportCards } from "./ImportCard";
import ImportIcon from "./ImportIcon";
import StaffPage from "../ui/StaffPage";
import Tag from "@/components/ui/Tag";

export const importCardGallery: Example[] = [
  {
    name: "ImportCards",
    file: "app/(staff)/staff/_components/jobs/ImportCard.tsx",
    variants: [
      {
        label: "Two cards in the grid",
        render: () => (
          <StaffPage as="div">
            <ImportCards>
              <ImportCard
                title="An import"
                href="/staff/scheduled-jobs/signatories"
                icon={<ImportIcon source="parliament" />}
                tags={<Tag>Check only</Tag>}
                intro="What it copies, and from where."
              >
                <p>
                  <Tag tone="green">Done</Tag> 2026-10-15 02:00
                </p>
              </ImportCard>
              <ImportCard
                title="Another"
                href="/staff/scheduled-jobs/luma"
                icon={<ImportIcon source="luma" />}
                intro="Never run."
              >
                <p>Not imported yet.</p>
              </ImportCard>
            </ImportCards>
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "ImportCard",
    file: "app/(staff)/staff/_components/jobs/ImportCard.tsx",
    variants: [
      {
        label: "One card on its own",
        render: () => (
          <StaffPage as="div">
            <ImportCard
              title="An import"
              href="/staff/scheduled-jobs/luma"
              icon={<ImportIcon source="luma" />}
              intro="What it copies."
            >
              <p>Not imported yet.</p>
            </ImportCard>
          </StaffPage>
        ),
      },
    ],
  },
];
