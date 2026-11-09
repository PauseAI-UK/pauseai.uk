import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { longDay } from "@/lib/calendar-days";
import { staffCopy } from "@/lib/content/staff-interface";
import { MAX_SIGNUP_FILE_BYTES, type SignupPlan, type SignupUploadInput } from "@/lib/signup-upload";
import { exampleSignupPlan, exampleSignupUpload, exampleSignupUploadPeople } from "./SignupUpload.examples";
import SignupUploadForm from "./SignupUploadForm";
import SignupUploadPreview, { SignupPlanView, type SignupUploadActions } from "./SignupUploadPreview";
import SignupUploadResult, { SignupUploadsList } from "./SignupUploadResult";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
}));

const copy = staffCopy.signupUpload;
const words = copy.preview;
const EVENTS = [
  { id: "evt-1", name: "The march", startAt: new Date("2099-11-21T12:00:00Z"), url: "https://luma.com/the-march" },
];
const CSV = "Name,Email,March,Colour,Mailing list\nJo,jo@example.com,Y,red,Y\n";

const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;

/** Chooses a file as the input would. */
async function choose(file: File) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  const input = fileInput();
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

const csvFile = (text: string, name = "f.csv") => new File([text], name, { type: "text/csv" });

/** The form, with actions that answer with the example plan, and what they were asked. */
function showForm() {
  const preview = vi.fn(async (input: SignupUploadInput) => ({ ...exampleSignupPlan, input }));
  const finish = vi.fn(async () => ({ uploadId: 9 }));
  const view = render(<SignupUploadForm events={EVENTS} today="2026-10-31" actions={{ preview, finish }} />);
  return { view, preview, finish };
}

const note = () => page.getByRole("textbox", { name: copy.form.note }).fill("Camden");
/** Finds the march by typing in the event search, and picks it. */
async function event() {
  await page.getByRole("searchbox", { name: copy.form.findEvent }).fill("march");
  await page.getByRole("button", { name: /The march/ }).click();
}
const importButton = () => page.getByRole("button", { name: /^Import \d+ people/ });

describe("SignupUploadForm", () => {
  it("shows its four steps in order before a file, the event greyed out, and what stops the import", async () => {
    await showForm().view;
    const titles = page
      .getByRole("heading", { level: 2 })
      .all()
      .map((heading) => heading.element().textContent);
    expect(titles).toEqual([
      `1${copy.form.formsTitle}`,
      `2${copy.steps.file}`,
      copy.help.title,
      `3${copy.form.eventTitle}`,
      `4${copy.steps.check}`,
    ]);
    await expect.element(page.getByText(copy.help.short[0])).toBeVisible();
    await expect.element(page.getByText(words.needsFile)).toBeVisible();
    await expect.element(page.getByRole("combobox", { name: copy.form.eventColumn })).toBeDisabled();
    await expect.element(page.getByRole("searchbox", { name: copy.form.findEvent })).toBeDisabled();
    await expect.element(importButton()).toBeDisabled();
    await expect.element(page.getByText(words.blockers.file)).toBeVisible();
    await expect.element(page.getByText(words.blockers.note)).toBeVisible();
  });

  it("opens every column name in a section of its own, and closes it", async () => {
    await showForm().view;
    await page.getByRole("button", { name: copy.help.more }).click();
    await expect.element(page.getByRole("heading", { name: copy.help.more })).toBeVisible();
    await expect.element(page.getByText(copy.help.fields.postcode.values)).toBeVisible();
    await page.getByRole("button", { name: copy.help.less }).click();
    expect(page.getByRole("heading", { name: copy.help.more }).elements()).toEqual([]);
  });

  it("previews a file without a note, but imports only with one", async () => {
    const { view, preview, finish } = showForm();
    await view;
    await choose(csvFile(CSV));
    await expect.element(page.getByRole("heading", { name: /f\.csv/ })).toBeVisible();
    await expect.element(page.getByText(copy.drop.read(1, 5))).toBeVisible();
    await expect.element(page.getByRole("cell", { name: "Colour" })).toBeVisible();
    await expect.poll(() => preview.mock.calls.length).toBeGreaterThan(0);
    await expect.element(importButton()).toBeDisabled();
    expect(page.getByText(words.blockers.file).elements()).toEqual([]);
    await note();
    await expect.element(importButton()).toBeEnabled();
    expect(preview).toHaveBeenLastCalledWith({
      csv: CSV,
      filename: "f.csv",
      eventId: null,
      eventColumn: null,
      signedOn: "2026-10-31",
      note: "Camden",
    });
    await importButton().click();
    await expect.poll(() => push.mock.calls.at(-1)).toEqual(["/staff/supporters/import/previous/9"]);
    expect(finish).toHaveBeenCalled();
  });

  it("takes the column first, then the event, and lets the event go again", async () => {
    const { view, preview } = showForm();
    await view;
    await choose(csvFile("Name,Email,March,Stall\nJo,jo@example.com,Y,Y\n"));
    await note();
    await page.getByRole("combobox", { name: copy.form.eventColumn }).selectOptions("Stall");
    await expect.element(page.getByRole("cell", { name: copy.columns.event, exact: true })).toBeVisible();
    await expect.element(page.getByText(words.blockers.event)).toBeVisible();
    await expect.element(importButton()).toBeDisabled();
    await event();
    await expect.poll(() => preview.mock.lastCall?.[0]).toMatchObject({ eventId: "evt-1", eventColumn: "Stall" });
    await expect
      .element(page.getByRole("link", { name: /The march/ }))
      .toHaveAttribute("href", "https://luma.com/the-march");
    await expect.element(importButton()).toBeEnabled();
    await page.getByRole("button", { name: copy.form.removeEvent }).click();
    await expect.element(page.getByText(words.blockers.event)).toBeVisible();
    await page.getByRole("combobox", { name: copy.form.eventColumn }).selectOptions(copy.form.noColumn);
    await expect.poll(() => preview.mock.lastCall?.[0]).toMatchObject({ eventId: null, eventColumn: null });
    await page.getByRole("button", { name: copy.drop.another }).click();
    await expect.element(page.getByText(words.needsFile)).toBeVisible();
  });

  it("says when a file has no column to link an event to", async () => {
    await showForm().view;
    await choose(csvFile("Name,Email\nJo,jo@example.com\n"));
    await expect.element(page.getByText(copy.form.noEventColumn)).toBeVisible();
    await expect.element(page.getByRole("combobox", { name: copy.form.eventColumn })).toBeDisabled();
  });

  it("says why it can't read a file", async () => {
    await showForm().view;
    await choose(csvFile(""));
    await expect.element(page.getByText(copy.refused.empty)).toBeVisible();
    await choose(csvFile("Comment\nHello\n"));
    const both = `${copy.help.fields.name.label}, ${copy.help.fields.email.label}`;
    await expect.element(page.getByText(copy.refused.missing(both, "Comment"))).toBeVisible();
    await choose(csvFile("Name,Email,E-mail\na,b,c\n"));
    await expect
      .element(page.getByText(copy.refused.clash(copy.help.fields.email.label, "Email, E-mail")))
      .toBeVisible();
  });

  it("refuses a spreadsheet's own file and one too big, and the next good file clears it", async () => {
    await showForm().view;
    await choose(new File(["PK"], "list.XLSX"));
    await expect.element(page.getByText(copy.drop.notCsv("list.XLSX"))).toBeVisible();
    await choose(csvFile("x".repeat(MAX_SIGNUP_FILE_BYTES + 1)));
    await expect.element(page.getByText(copy.drop.tooBig)).toBeVisible();
    await choose(csvFile(CSV));
    await expect.element(page.getByRole("heading", { name: /f\.csv/ })).toBeVisible();
    expect(page.getByText(copy.drop.tooBig).elements()).toEqual([]);
  });

  it("takes a file dropped on the box, lit while one's over it, and ignores a drop of nothing", async () => {
    await showForm().view;
    const box = fileInput().closest("label")!;
    const plain = box.className;
    const transfer = new DataTransfer();
    box.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    await expect.poll(() => box.className).not.toBe(plain);
    box.dispatchEvent(new DragEvent("dragleave", { bubbles: true }));
    await expect.poll(() => box.className).toBe(plain);
    box.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    await expect.element(page.getByText(words.needsFile)).toBeVisible();
    transfer.items.add(csvFile(CSV, "dropped.csv"));
    box.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    await expect.element(page.getByRole("heading", { name: /dropped\.csv/ })).toBeVisible();
  });

  it("does nothing when choosing a file is cancelled", async () => {
    await showForm().view;
    fileInput().dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect.element(page.getByText(words.needsFile)).toBeVisible();
  });

  it("sets the date from the calendar", async () => {
    const { view, preview } = showForm();
    await view;
    await choose(csvFile(CSV));
    await page.getByRole("button", { name: copy.form.signedOn }).click();
    await page.getByRole("button", { name: new RegExp(`^${longDay("2026-10-30")}`) }).click();
    await expect.poll(() => preview.mock.lastCall?.[0].signedOn).toBe("2026-10-30");
  });
});

describe("SignupPlanView", () => {
  it("shows everyone, held back first, then one pile, with the download where it belongs", async () => {
    await render(<SignupPlanView plan={exampleSignupPlan} />);
    await expect.element(page.getByText(words.summary.event("PauseAI London March", 1))).toBeVisible();
    await expect.element(page.getByText(words.summary.held(2))).toBeVisible();
    const lines = () =>
      page
        .getByRole("row")
        .all()
        .slice(1)
        .map((row) => row.element().textContent);
    // Everyone, those held back first, as they're what needs doing.
    expect(lines()).toHaveLength(6);
    expect(lines()[0]).toContain("Ruth Bell");
    expect(lines()[0]).toContain(words.happens.notImported);
    expect(lines()[0]).toContain(words.problems["same-email"]);
    expect(lines()[1]).toContain(words.unread("Maybe", "March"));
    const said = words.happens;
    expect(lines()[2]).toContain(`${said.register}${said.mailing}`);
    expect(lines()[3]).toContain(`${said.known.email}${said.going}`);
    expect(lines()[3]).toContain("07700 900123");
    expect(lines()[4]).toContain(`${said.known.mobile}${said.mailing}${said.phone}`);
    expect(lines()[5]).toContain(said.alreadyImported);
  });

  it("has what it needs to say with no event, note or anyone held back", async () => {
    const plan: SignupPlan = {
      ...exampleSignupPlan,
      eventName: null,
      input: { ...exampleSignupPlan.input, note: "  " },
      rows: exampleSignupPlan.rows.filter((row) => row.pile === "none"),
    };
    await render(<SignupPlanView plan={plan} />);
    expect(page.getByText(/registered for/).elements()).toEqual([]);
    expect(page.getByText(/won't be imported/).elements()).toEqual([]);
  });
});

describe("SignupUploadPreview", () => {
  const input = exampleSignupPlan.input;
  const button = () => page.getByRole("button", { name: words.importNow(3, 1) });
  const show = (actions: Partial<SignupUploadActions>, of: typeof input | null = input, blockers: string[] = []) =>
    render(
      <SignupUploadPreview
        input={of}
        blockers={blockers}
        preview={actions.preview ?? (async () => exampleSignupPlan)}
        finish={actions.finish ?? vi.fn()}
      />,
    );

  it("says a file is needed, with nothing to import, before there's one", async () => {
    const preview = vi.fn();
    await show({ preview }, null, [words.blockers.file]);
    await expect.element(page.getByText(words.needsFile)).toBeVisible();
    await expect.element(page.getByRole("button", { name: words.importOnly(0) })).toBeDisabled();
    await expect.element(page.getByText(words.blockers.file)).toBeVisible();
    expect(preview).not.toHaveBeenCalled();
  });

  it("shows nothing to import, with no button, when a file has nothing new", async () => {
    const done = { ...exampleSignupPlan, rows: exampleSignupPlan.rows.filter((row) => row.pile === "done") };
    await show({ preview: async () => done });
    await expect.element(page.getByText(words.nothing)).toBeVisible();
    expect(page.getByRole("button", { name: /^Import \d+ people/ }).elements()).toEqual([]);
  });

  it("says it's working, then shows what the server says, and imports it", async () => {
    let answer!: (plan: SignupPlan) => void;
    const preview = vi.fn(() => new Promise<SignupPlan>((resolve) => (answer = resolve)));
    const finish = vi.fn(async () => ({ uploadId: 7 }));
    await show({ preview, finish });
    await expect.element(page.getByRole("status")).toHaveTextContent(words.loading);
    await expect.poll(() => preview.mock.calls.length).toBe(1);
    answer(exampleSignupPlan);
    await button().click();
    await expect.poll(() => push.mock.calls.at(-1)).toEqual(["/staff/supporters/import/previous/7"]);
    expect(finish).toHaveBeenCalledWith(input, exampleSignupPlan.signature);
  });

  it("keeps the last preview, but not to import, while a change is worked out", async () => {
    const view = await show({});
    await expect.element(button()).toBeEnabled();
    await view.rerender(
      <SignupUploadPreview
        input={{ ...input, note: "Changed" }}
        blockers={[]}
        preview={async () => exampleSignupPlan}
        finish={vi.fn()}
      />,
    );
    await expect.element(page.getByRole("status")).toHaveTextContent(words.loading);
    await expect.element(button()).toBeDisabled();
    await expect.element(button()).toBeEnabled();
  });

  it("shows what would happen now, if things changed", async () => {
    const changed = { ...exampleSignupPlan, rows: exampleSignupPlan.rows.slice(1) };
    await show({ finish: async () => ({ changed }) });
    await button().click();
    await expect.element(page.getByText(words.changed)).toBeVisible();
    await expect.element(page.getByRole("button", { name: words.importNow(2, 0) })).toBeVisible();
  });

  it("says when the file can't go in, on previewing or importing", async () => {
    const refused = { ok: false, reason: "bad-choice" } as const;
    const view = await show({ preview: async () => refused });
    await expect.element(page.getByText(copy.refused.badChoice)).toBeVisible();
    await view.unmount();
    await show({ finish: async () => refused });
    await button().click();
    await expect.element(page.getByText(copy.refused.badChoice)).toBeVisible();
  });

  it("says when it fails, on previewing or importing", async () => {
    const down = async () => {
      throw new Error("down");
    };
    const view = await show({ preview: down });
    await expect.element(page.getByText(words.failed)).toBeVisible();
    await view.unmount();
    await show({ finish: down });
    await button().click();
    await expect.element(page.getByText(words.failed)).toBeVisible();
  });

  it("doesn't take an answer that comes after it's gone", async () => {
    for (const preview of [
      () => new Promise<SignupPlan>((resolve) => setTimeout(() => resolve(exampleSignupPlan), 500)),
      () => new Promise<SignupPlan>((_, reject) => setTimeout(() => reject(new Error("down")), 500)),
    ]) {
      const view = await show({ preview });
      await new Promise((resolve) => setTimeout(resolve, 450));
      await view.unmount();
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    expect(page.getByText(words.failed).elements()).toEqual([]);
  });
});

describe("SignupUploadResult", () => {
  it("shows what became of each person, a link for those with a supporter", async () => {
    await render(<SignupUploadResult upload={exampleSignupUploadPeople} />);
    await expect.element(page.getByText(copy.result.summary(4, 2))).toBeVisible();
    await expect.element(page.getByText(copy.result.note("Flyering at Camden Town"))).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: /PauseAI London March/ }))
      .toHaveAttribute("href", "https://luma.com/example");
    await expect.element(page.getByRole("link", { name: "Person 1" })).toHaveAttribute("href", "/staff/supporters/1");
    expect(page.getByRole("link", { name: "Person 3" }).elements()).toEqual([]);
    for (const said of [
      copy.result.luma.added,
      copy.result.luma.skipped,
      copy.result.luma.failed,
      copy.preview.happens.going,
    ]) {
      await expect.element(page.getByText(said)).toBeVisible();
    }
    expect(page.getByText(copy.preview.happens.mailing, { exact: true }).elements()).toHaveLength(4);
    expect(page.getByText(copy.preview.happens.phone, { exact: true }).elements()).toHaveLength(1);
  });

  it("says nothing of Luma for an import with no event", async () => {
    const [person] = exampleSignupUploadPeople.people;
    await render(
      <SignupUploadResult
        upload={{ ...exampleSignupUpload, eventName: null, people: [{ ...person, lumaStatus: null }] }}
      />,
    );
    await expect.element(page.getByText(copy.preview.happens.mailing, { exact: true })).toBeVisible();
    expect(page.getByText(copy.preview.happens.going).elements()).toEqual([]);
  });

  it("titles the page with the file's name", () => {
    expect(copy.result.title("flyering.csv")).toContain("flyering.csv");
  });

  it("says so when everyone's gone, with no event or note", async () => {
    await render(<SignupUploadResult upload={{ ...exampleSignupUpload, eventName: null, note: null, people: [] }} />);
    await expect.element(page.getByText(copy.result.none)).toBeVisible();
  });
});

describe("SignupUploadsList", () => {
  it("lists each upload under its month or year, by its note or else its file, with this year's date short", async () => {
    await render(
      <SignupUploadsList
        now="2026-11-07T12:00:00Z"
        uploads={[
          exampleSignupUpload,
          { ...exampleSignupUpload, id: 2, signedOn: "2025-06-14", note: null, eventName: null },
        ]}
      />,
    );
    await expect.element(page.getByRole("heading", { name: "October 2026" })).toBeVisible();
    await expect.element(page.getByRole("heading", { name: "2025" })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "Flyering at Camden Town" }))
      .toHaveAttribute("href", "/staff/supporters/import/previous/1");
    await expect.element(page.getByText("31 Oct", { exact: true })).toBeVisible();
    await expect.element(page.getByText("14 Jun 2025")).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: /PauseAI London March/ }))
      .toHaveAttribute("href", "https://luma.com/example");
    await expect
      .element(page.getByRole("link", { name: "flyering.csv" }))
      .toHaveAttribute("href", "/staff/supporters/import/previous/2");
  });

  it("says there are none before the first", async () => {
    await render(<SignupUploadsList now="2026-11-07T12:00:00Z" uploads={[]} />);
    await expect.element(page.getByText(copy.uploads.none)).toBeVisible();
  });
});
