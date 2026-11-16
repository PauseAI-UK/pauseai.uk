import type { getSignupUpload, SignupUploadPerson, SignupUploadSummary } from "@/lib/supporters/signup-uploads.server";
import type { SignupPlan } from "@/lib/supporters/signup-csv";

const person = { phone: null, postcode: null, going: false, problem: null, notice: null };

/** A file with someone in every pile. */
export const exampleSignupPlan: SignupPlan = {
  input: {
    kind: "paper",
    csv: "",
    filename: "flyering.csv",
    eventId: "evt-march",
    eventColumn: "March",
    signedOn: "2026-10-31",
    note: "Flyering at Camden Town",
    town: "",
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
  kind: "paper",
  town: null,
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

/** A local WhatsApp group's file: a new member, one with no profile name we know by their number, one already uploaded, and one held back. */
export const exampleWhatsappPlan: SignupPlan = {
  input: {
    kind: "whatsapp",
    csv: "",
    filename: "oxford-group.csv",
    eventId: null,
    eventColumn: null,
    signedOn: "2026-11-16",
    note: "PauseAI UK Oxford",
    town: "Oxford",
  },
  eventName: null,
  signature: "example",
  rows: [
    { ...person, line: 2, name: "Jane 🌻", email: "", phone: "+447700900123", pile: "none", known: null, newEntry: true },
    { ...person, line: 3, name: "", email: "", phone: "+33612345678", pile: "none", known: "mobile", newEntry: true },
    { ...person, line: 4, name: "Tom", email: "", phone: "+447700900456", pile: "done", known: null, newEntry: false },
    {
      ...person,
      line: 5,
      name: "Ruth",
      email: "",
      phone: "+447700900789",
      pile: "held",
      known: null,
      newEntry: false,
      problem: { kind: "erased" },
    },
  ],
};

/** A local WhatsApp group's upload: one new member, and one we knew by their number. */
export const exampleWhatsappUpload: NonNullable<Awaited<ReturnType<typeof getSignupUpload>>> = {
  ...exampleSignupUpload,
  id: 2,
  kind: "whatsapp",
  town: "Oxford",
  filename: "oxford-group.csv",
  signedOn: "2026-11-16",
  note: "PauseAI UK Oxford",
  eventName: null,
  eventUrl: null,
  imported: 2,
  heldBack: 1,
  lumaReading: false,
  people: [
    { entryId: 1, name: "Jane 🌻", email: null, phone: "+447700900123", postcode: null, newEntry: true, known: null, luma: null, supporterId: 5 },
    { entryId: 2, name: "", email: null, phone: "+33612345678", postcode: null, newEntry: true, known: "mobile", luma: null, supporterId: 6 },
  ],
};
