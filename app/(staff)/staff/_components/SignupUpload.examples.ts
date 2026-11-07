import type { getSignupUpload, SignupUploadSummary } from "@/lib/server/signup-uploads";
import type { SignupPlan } from "@/lib/signup-upload";

const person = { phone: null, postcode: null, city: null, mailingList: false, going: false, problem: null };

/** A file with someone in every pile. */
export const exampleSignupPlan: SignupPlan = {
  input: {
    csv: "",
    filename: "flyering.csv",
    eventId: "evt-march",
    eventColumn: "March",
    signedOn: "2026-10-31",
    note: "Flyering at Camden Town",
  },
  eventName: "PauseAI London March",
  ignored: ["WhatsApp", "Needs check"],
  signature: "example",
  rows: [
    {
      ...person,
      line: 2,
      name: "Jane Smith",
      email: "jane.smith@example.com",
      postcode: "SE15",
      mailingList: true,
      going: true,
      pile: "register",
      known: null,
      newEntry: true,
    },
    {
      ...person,
      line: 3,
      name: "Tom Okafor",
      email: "tom.okafor@example.com",
      phone: "07700 900123",
      going: true,
      pile: "going",
      known: "email",
      newEntry: true,
    },
    {
      ...person,
      line: 4,
      name: "Ben Wood",
      email: "ben.wood@example.com",
      pile: "none",
      known: "mobile",
      newEntry: true,
    },
    {
      ...person,
      line: 5,
      name: "Leo Park",
      email: "leo.park@example.com",
      pile: "done",
      known: "email",
      newEntry: false,
    },
    {
      ...person,
      line: 6,
      name: "Ruth Bell",
      email: "bell.home@example.com",
      pile: "held",
      known: null,
      newEntry: false,
      problem: { kind: "same-email" },
    },
    {
      ...person,
      line: 7,
      name: "Sam Hughes",
      email: "sam.hughes@example.com",
      pile: "held",
      known: null,
      newEntry: false,
      problem: { kind: "unread-yes-no", value: "Maybe", column: "March" },
    },
  ],
};

/** An upload, as the list of them shows it. */
export const exampleSignupUpload: SignupUploadSummary = {
  id: 1,
  filename: "flyering.csv",
  signedOn: "2026-10-31",
  note: "Flyering at Camden Town",
  eventName: "PauseAI London March",
  imported: 4,
  heldBack: 2,
  uploadedBy: "jo@pauseai.uk",
  uploadedAt: "2026-11-01T10:00:00Z",
};

/** An upload with someone Luma said each thing of. */
export const exampleSignupUploadPeople: NonNullable<Awaited<ReturnType<typeof getSignupUpload>>> = {
  ...exampleSignupUpload,
  people: [
    { lumaStatus: "added", supporterId: 1, consent: true, phone: "07700 900123", postcode: "SE15" },
    { lumaStatus: "skipped", supporterId: 2, consent: false, phone: null, postcode: null },
    { lumaStatus: "failed", supporterId: null, consent: false, phone: null, postcode: null },
    { lumaStatus: null, supporterId: 3, consent: true, phone: null, postcode: "M1 1AE" },
  ].map((person, i) => ({ ...person, entryId: i + 1, name: `Person ${i + 1}`, email: `person${i + 1}@example.com` })),
} as NonNullable<Awaited<ReturnType<typeof getSignupUpload>>>;
