// PermissionTiles in the component gallery (app/(tools)/gallery/), in the staff interface: admin and accounts (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import PermissionTiles, { ContactLink, ListHelp } from "./PermissionTiles";
import type { ContactPermission } from "@/lib/supporters/contact-permissions";
import StaffPage from "../ui/StaffPage";
import { exampleBlockedPermissions, exampleMemberDetails, exampleSupporterDetails } from "./SupportersTable.examples";

/** The member's address on our Luma calendar: events by email a yes, and Luma's own messages going to it. */
const following: ContactPermission = {
  ...exampleMemberDetails.permissions[1],
  send: "yes",
  reason: "following",
  at: new Date("2026-10-23T09:00:00Z"),
};

export const permissionTilesGallery: Example[] = [
  {
    name: "PermissionTiles",
    file: "app/(staff)/staff/_components/supporters/PermissionTiles.tsx",
    variants: [
      {
        label: "Will and won't email, by topic, and a phone number we may not use",
        render: () => (
          <StaffPage as="div">
            <PermissionTiles permissions={exampleSupporterDetails.permissions} luma={exampleSupporterDetails.luma} />
          </StaffPage>
        ),
      },
      {
        label: "A member from CiviCRM, with No bulk emails set there, who follows the Luma calendar",
        render: () => (
          <StaffPage as="div">
            <PermissionTiles
              permissions={exampleMemberDetails.permissions.map((p) => (p.topic === "events" ? following : p))}
              luma={[following]}
            />
          </StaffPage>
        ),
      },
      {
        label: "A volunteer's phone number",
        render: () => (
          <StaffPage as="div">
            <PermissionTiles permissions={exampleMemberDetails.permissions.slice(3)} />
          </StaffPage>
        ),
      },
      {
        label: "A blocked address",
        render: () => (
          <StaffPage as="div">
            <PermissionTiles permissions={exampleBlockedPermissions} />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "ListHelp",
    file: "app/(staff)/staff/_components/supporters/PermissionTiles.tsx",
    variants: [
      {
        label: "The ? beside a list in the Consent menu and a broadcast's",
        render: () => (
          <StaffPage as="div">
            <ListHelp list="updates-luma" />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "ContactLink",
    file: "app/(staff)/staff/_components/supporters/PermissionTiles.tsx",
    variants: [
      {
        label: "An address to email, a number to text on WhatsApp, and one to call",
        render: () => (
          <StaffPage as="div">
            <p>
              <ContactLink address="jane.smith@example.com" way="email" />
            </p>
            <p>
              <ContactLink address="+447700900123" way="text" />
            </p>
            <p>
              <ContactLink address="+447700900123" way="call" />
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
