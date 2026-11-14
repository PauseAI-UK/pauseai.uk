// PermissionTiles in the component gallery (app/(tools)/gallery/), in the staff interface: admin and accounts (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import PermissionTiles, { ContactLink } from "./PermissionTiles";
import StaffPage from "../ui/StaffPage";
import { exampleBlockedPermissions, exampleMemberDetails, exampleSupporterDetails } from "./SupportersTable.examples";

export const permissionTilesGallery: Example[] = [
  {
    name: "PermissionTiles",
    file: "app/(staff)/staff/_components/supporters/PermissionTiles.tsx",
    variants: [
      {
        label: "Will and won't email, by topic, and a phone number we may not use",
        render: () => (
          <StaffPage as="div">
            <PermissionTiles permissions={exampleSupporterDetails.permissions} />
          </StaffPage>
        ),
      },
      {
        label: "A member from CiviCRM, with No bulk emails set there, who follows the Luma calendar",
        render: () => (
          <StaffPage as="div">
            <PermissionTiles
              permissions={exampleMemberDetails.permissions.map((p) =>
                p.topic === "events"
                  ? { ...p, send: "yes", reason: "following", at: new Date("2026-10-23T09:00:00Z") }
                  : p,
              )}
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
