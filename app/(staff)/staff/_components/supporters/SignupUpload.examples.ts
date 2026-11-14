import type { getSignupUpload, SignupUploadPerson, SignupUploadSummary } from "@/lib/supporters/signup-uploads.server";
import type { SignupPlan } from "@/lib/supporters/signup-csv";

const person = { phone: null, postcode: null, going: false, problem: null, notice: null };

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
  signature: "example",
  rows: [
    {
      ...person,
      line: 2,
      name: "Jane Smith",
      email: "jane.smith@example.com",
      postcode: "SE15",
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
      notice: "bulk",
    },
    {
      ...person,
      line: 4,
      name: "Ben Wood",
      email: "ben.wood@example.com",
      phone: "07700 900456",
      pile: "none",
      known: "mobile",
      newEntry: true,
      notice: "no-email",
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
  eventUrl: "https://luma.com/example",
  imported: 4,
  heldBack: 2,
  uploadedBy: "jo@pauseai.uk",
  uploadedAt: new Date("2026-11-01T10:00:00Z"),
};

/** An upload with someone in each case: Luma said each thing of one, one was going already, one said no. */
export const exampleSignupUploadPeople: NonNullable<Awaited<ReturnType<typeof getSignupUpload>>> = {
  ...exampleSignupUpload,
  lumaReading: false,
  people: (
    [
      { newEntry: true, known: null, luma: "added", supporterId: 1, phone: "07700 900123", postcode: "SE15" },
      { newEntry: true, known: "email", luma: "skipped", supporterId: 2, phone: null, postcode: null },
      { newEntry: false, known: "email", luma: "failed", supporterId: null, phone: null, postcode: null },
      { newEntry: true, known: "mobile", luma: "going", supporterId: 3, phone: null, postcode: "M1 1AE" },
      { newEntry: true, known: null, luma: null, supporterId: 4, phone: null, postcode: null },
    ] satisfies Omit<SignupUploadPerson, "entryId" | "name" | "email">[]
  ).map((person, i) => ({ ...person, entryId: i + 1, name: `Person ${i + 1}`, email: `person${i + 1}@example.com` })),
};
