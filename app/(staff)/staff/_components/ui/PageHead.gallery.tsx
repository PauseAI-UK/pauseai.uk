// PageHead in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { Button, ButtonLink } from "@/components/ui/Button";
import NavIcon from "../shell/NavIcon";
import PageHead from "./PageHead";
import StaffPage from "./StaffPage";
import Tag from "@/components/ui/Tag";

export const pageHeadGallery: Example[] = [
  {
    name: "PageHead",
    file: "app/(staff)/staff/_components/ui/PageHead.tsx",
    variants: [
      {
        label: "A page the navigation leads to: its title, what it is, and its main button at the right",
        render: () => (
          <StaffPage as="div">
            <PageHead
              intro="Emails PauseAI sends to many notable people at once"
              action={
                <ButtonLink variant="primary" fit href="#">
                  New mailing
                </ButtonLink>
              }
            >
              Mailings
            </PageHead>
            <p>The page itself, after the space that belongs to the head.</p>
          </StaffPage>
        ),
      },
      {
        label: "The title alone, with a quiet button to the page beside it",
        render: () => (
          <StaffPage as="div">
            <PageHead
              action={
                <ButtonLink variant="ghost" fit href="#">
                  See past imports
                </ButtonLink>
              }
            >
              Import sign-ups
            </PageHead>
          </StaffPage>
        ),
      },
      {
        label: "A lesser thing's page: tags by its title, and its facts in a line, one that's nothing left out",
        render: () => (
          <StaffPage as="div">
            <PageHead
              tags={
                <>
                  <Tag tone="green">Sent</Tag>
                  <Tag>Test politician</Tag>
                </>
              }
              facts={[
                <a key="to" href="#">
                  Jane Example MP
                </a>,
                "Example North",
                null,
                "Example Party",
              ]}
            >
              Letter from Sam Sample to Jane Example MP
            </PageHead>
          </StaffPage>
        ),
      },
      {
        label: "A job's: its icon leading the title, what it does, and its button",
        render: () => (
          <StaffPage as="div">
            <PageHead
              lead={<NavIcon id="import" />}
              tags={<Tag>Every 5 minutes</Tag>}
              intro="Reads our calendar, and everyone who has registered for each event, then adds any who are new as supporters."
              action={
                <Button variant="primary" size="small">
                  Import now
                </Button>
              }
            >
              Events and guests
            </PageHead>
          </StaffPage>
        ),
      },
    ],
  },
];
