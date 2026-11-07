import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { longDay } from "@/lib/calendar-days";
import { staffCopy } from "@/lib/content/staff-interface";
import {
  MAX_SIGNUP_FILE_BYTES,
  SIGNUP_UPLOAD_STORAGE,
  type SignupPlan,
  type SignupUploadInput,
} from "@/lib/signup-upload";
import { exampleSignupPlan, exampleSignupUpload, exampleSignupUploadPeople } from "./SignupUpload.examples";
import SignupUploadForm from "./SignupUploadForm";
import SignupUploadPreview, { SignupPlanView } from "./SignupUploadPreview";
import SignupUploadResult, { SignupUploadsTable } from "./SignupUploadResult";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
}));

const copy = staffCopy.signupUpload;
const words = copy.preview;
const EVENTS = [{ id: "evt-1", name: "The march", startAt: "2099-11-21T12:00:00Z" }];
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
const showForm = () => render(<SignupUploadForm events={EVENTS} today="2026-10-31" />);
const stored = () => JSON.parse(sessionStorage.getItem(SIGNUP_UPLOAD_STORAGE)!) as SignupUploadInput;

beforeEach(() => {
  sessionStorage.clear();
  push.mockClear();
});
afterEach(() => sessionStorage.clear());

describe("SignupUploadForm", () => {
  it("says what it understands before there's a file, and nothing more", async () => {
    await showForm();
    await expect.element(page.getByText(copy.help.title)).toBeVisible();
    await expect.element(page.getByText(copy.help.fields.mailingList.label)).toBeVisible();
    await expect.element(page.getByText(copy.drop.title)).toBeVisible();
    expect(page.getByRole("button", { name: copy.form.preview }).elements()).toEqual([]);
  });

  it("shows what each column will do, and sends a file with no event to the preview", async () => {
    await showForm();
    await choose(csvFile(CSV));
    await expect.element(page.getByRole("button", { name: copy.form.preview })).toBeEnabled();
    await expect.element(page.getByText(copy.drop.read(1, 5))).toBeVisible();
    await expect.element(page.getByRole("cell", { name: copy.columns.ignored }).first()).toBeVisible();
    await expect.element(page.getByRole("cell", { name: "Colour" })).toBeVisible();
    await page.getByLabelText(copy.form.note).fill("Camden");
    await page.getByRole("button", { name: copy.form.preview }).click();
    expect(push).toHaveBeenCalledWith("/staff/supporters/upload/preview");
    expect(stored()).toEqual({
      csv: CSV,
      filename: "f.csv",
      eventId: null,
      eventColumn: null,
      signedOn: "2026-10-31",
      note: "Camden",
    });
  });

  it("takes the only column it could be for an event, marking it", async () => {
    await showForm();
    await choose(csvFile(CSV));
    await page.getByRole("combobox", { name: copy.form.event }).selectOptions("evt-1");
    await expect.element(page.getByRole("cell", { name: copy.columns.event, exact: true })).toBeVisible();
    await page.getByRole("button", { name: copy.form.preview }).click();
    expect(stored()).toMatchObject({ eventId: "evt-1", eventColumn: "March" });
  });

  it("waits for a column to be chosen when more than one could be, starting over with a new file", async () => {
    await showForm();
    await choose(csvFile("Name,Email,March,Stall\nJo,jo@example.com,Y,Y\n"));
    await page.getByRole("combobox", { name: copy.form.event }).selectOptions("evt-1");
    const button = page.getByRole("button", { name: copy.form.preview });
    await expect.element(button).toBeDisabled();
    await page.getByRole("combobox", { name: copy.form.eventColumn }).selectOptions("Stall");
    await expect.element(button).toBeEnabled();
    await button.click();
    expect(stored().eventColumn).toBe("Stall");
    await choose(csvFile("Name,Email,March,Stall\nJo,jo@example.com,Y,Y\n", "again.csv"));
    await expect.element(page.getByText("again.csv")).toBeVisible();
    await expect.element(button).toBeDisabled();
  });

  it("says when an event has no column to link it to", async () => {
    await showForm();
    await choose(csvFile("Name,Email\nJo,jo@example.com\n"));
    await page.getByRole("combobox", { name: copy.form.event }).selectOptions("evt-1");
    await expect.element(page.getByText(copy.form.noEventColumn)).toBeVisible();
    await expect.element(page.getByRole("button", { name: copy.form.preview })).toBeDisabled();
  });

  it("says why it can't read a file", async () => {
    await showForm();
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
    await showForm();
    await choose(new File(["PK"], "list.XLSX"));
    await expect.element(page.getByText(copy.drop.notCsv("list.XLSX"))).toBeVisible();
    await choose(csvFile("x".repeat(MAX_SIGNUP_FILE_BYTES + 1)));
    await expect.element(page.getByText(copy.drop.tooBig)).toBeVisible();
    await choose(csvFile(CSV));
    await expect.element(page.getByRole("button", { name: copy.form.preview })).toBeVisible();
    expect(page.getByText(copy.drop.tooBig).elements()).toEqual([]);
  });

  it("takes a file dropped on the box, lit while one's over it, and ignores a drop of nothing", async () => {
    await showForm();
    const box = document.querySelector("label")!;
    const plain = box.className;
    const transfer = new DataTransfer();
    box.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    await expect.poll(() => box.className).not.toBe(plain);
    box.dispatchEvent(new DragEvent("dragleave", { bubbles: true }));
    await expect.poll(() => box.className).toBe(plain);
    box.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    expect(page.getByText(copy.drop.another).elements()).toEqual([]);
    transfer.items.add(csvFile(CSV, "dropped.csv"));
    box.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    await expect.element(page.getByText("dropped.csv")).toBeVisible();
  });

  it("does nothing when choosing a file is cancelled", async () => {
    await showForm();
    fileInput().dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect.element(page.getByText(copy.drop.title)).toBeVisible();
  });

  it("sets the date from the calendar", async () => {
    await showForm();
    await choose(csvFile(CSV));
    await page.getByRole("button", { name: copy.form.signedOn }).click();
    await page.getByRole("button", { name: new RegExp(`^${longDay("2026-10-30")}`) }).click();
    await page.getByRole("button", { name: copy.form.preview }).click();
    expect(stored().signedOn).toBe("2026-10-30");
  });
});

describe("SignupPlanView", () => {
  it("shows everyone, held back first, then one pile, with the download where it belongs", async () => {
    await render(<SignupPlanView plan={exampleSignupPlan} onImport={() => {}} />);
    await expect.element(page.getByText(words.summary.event("PauseAI London March", 1))).toBeVisible();
    await expect.element(page.getByText(words.summary.note("Flyering at Camden Town"))).toBeVisible();
    await expect.element(page.getByText(words.summary.ignored("WhatsApp, Needs check"))).toBeVisible();
    const lines = () =>
      page
        .getByRole("row")
        .all()
        .slice(1)
        .map((row) => row.element().textContent);
    expect(lines()[0]).toContain("Ruth Bell");
    expect(lines()[0]).toContain(words.problems["same-email"]);
    expect(lines()[1]).toContain(words.unread("Maybe", "March"));
    expect(lines()).toHaveLength(6);
    await expect.element(page.getByRole("link", { name: words.download })).toBeVisible();

    await page.getByRole("button", { name: `1 ${words.piles.none}` }).click();
    expect(lines()).toHaveLength(1);
    expect(page.getByRole("link", { name: words.download }).elements()).toEqual([]);
    await expect.element(page.getByText(words.explain.none)).toBeVisible();

    await page.getByRole("button", { name: `2 ${words.piles.held}` }).click();
    expect(lines()).toHaveLength(2);
    await expect.element(page.getByRole("link", { name: words.download })).toBeVisible();

    await page.getByRole("button", { name: `6 ${words.piles.all}` }).click();
    expect(lines()).toHaveLength(6);
  });

  it("has what it needs to say with no event, note, ignored columns or anyone held back", async () => {
    const plan: SignupPlan = {
      ...exampleSignupPlan,
      eventName: null,
      ignored: [],
      input: { ...exampleSignupPlan.input, note: "  " },
      rows: exampleSignupPlan.rows.filter((row) => row.pile === "none"),
    };
    await render(<SignupPlanView plan={plan} onImport={() => {}} />);
    await expect.element(page.getByText(words.summary.noEvent)).toBeVisible();
    expect(page.getByRole("link", { name: words.download }).elements()).toEqual([]);
    expect(page.getByText(words.summary.note("")).elements()).toEqual([]);
    expect(page.getByRole("button", { name: `0 ` }).elements()).toEqual([]);
  });

  it("imports when asked, and offers nothing when there's nothing to do", async () => {
    const onImport = vi.fn();
    const view = await render(<SignupPlanView plan={exampleSignupPlan} onImport={onImport} />);
    await page.getByRole("button", { name: words.importNow(3, 1) }).click();
    expect(onImport).toHaveBeenCalled();
    await view.rerender(
      <SignupPlanView
        plan={{ ...exampleSignupPlan, rows: exampleSignupPlan.rows.filter((row) => row.pile === "done") }}
        onImport={onImport}
      />,
    );
    await expect.element(page.getByText(words.nothing)).toBeVisible();
  });
});

describe("SignupUploadPreview", () => {
  const input = exampleSignupPlan.input;
  const store = () => sessionStorage.setItem(SIGNUP_UPLOAD_STORAGE, JSON.stringify(input));
  const button = () => page.getByRole("button", { name: words.importNow(3, 1) });

  it("says there's no file, without asking the server", async () => {
    const preview = vi.fn();
    await render(<SignupUploadPreview preview={preview} finish={vi.fn()} />);
    await expect.element(page.getByRole("link", { name: words.start })).toBeVisible();
    expect(document.body.textContent).toContain(words.none);
    expect(preview).not.toHaveBeenCalled();
  });

  it("says it's working, then shows what the server says, and imports it", async () => {
    store();
    const finish = vi.fn(async () => ({ uploadId: 7 }));
    let answer!: (plan: SignupPlan) => void;
    const preview = vi.fn(() => new Promise<SignupPlan>((resolve) => (answer = resolve)));
    await render(<SignupUploadPreview preview={preview} finish={finish} />);
    await expect.element(page.getByText(words.loading)).toBeVisible();
    expect(preview).toHaveBeenCalledWith(input);
    answer(exampleSignupPlan);
    await button().click();
    await expect.poll(() => push.mock.calls).toEqual([["/staff/supporters/upload/7"]]);
    expect(finish).toHaveBeenCalledWith(input, exampleSignupPlan.signature);
    expect(sessionStorage.getItem(SIGNUP_UPLOAD_STORAGE)).toBeNull();
  });

  it("shows what would happen now, if things changed", async () => {
    store();
    const changed = { ...exampleSignupPlan, rows: exampleSignupPlan.rows.slice(1) };
    await render(<SignupUploadPreview preview={async () => exampleSignupPlan} finish={async () => ({ changed })} />);
    await button().click();
    await expect.element(page.getByText(words.changed)).toBeVisible();
    await expect.element(page.getByRole("button", { name: words.importNow(2, 0) })).toBeVisible();
  });

  it("says when the file can't go in, on previewing or importing", async () => {
    store();
    const refused = { ok: false, reason: "bad-choice" } as const;
    const view = await render(<SignupUploadPreview preview={async () => refused} finish={vi.fn()} />);
    await expect.element(page.getByText(copy.refused.badChoice)).toBeVisible();
    await view.unmount();
    await render(<SignupUploadPreview preview={async () => exampleSignupPlan} finish={async () => refused} />);
    await button().click();
    await expect.element(page.getByText(copy.refused.badChoice)).toBeVisible();
  });

  it("says when it fails, on previewing or importing", async () => {
    store();
    const down = async () => {
      throw new Error("down");
    };
    const view = await render(<SignupUploadPreview preview={down} finish={vi.fn()} />);
    await expect.element(page.getByText(words.failed)).toBeVisible();
    await view.unmount();
    await render(<SignupUploadPreview preview={async () => exampleSignupPlan} finish={down} />);
    await button().click();
    await expect.element(page.getByText(words.failed)).toBeVisible();
  });

  it("doesn't take an answer that comes after it's gone", async () => {
    store();
    for (const preview of [
      () => new Promise<SignupPlan>((resolve) => setTimeout(() => resolve(exampleSignupPlan), 20)),
      () => new Promise<SignupPlan>((_, reject) => setTimeout(() => reject(new Error("down")), 20)),
    ]) {
      const view = await render(<SignupUploadPreview preview={preview} finish={vi.fn()} />);
      await view.unmount();
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    expect(page.getByText(words.failed).elements()).toEqual([]);
  });
});

describe("SignupUploadResult", () => {
  it("shows what became of each person, a link for those with a supporter", async () => {
    await render(<SignupUploadResult upload={exampleSignupUploadPeople} />);
    await expect.element(page.getByText(copy.result.summary(4, 2))).toBeVisible();
    await expect.element(page.getByText(copy.result.note("Flyering at Camden Town"))).toBeVisible();
    await expect.element(page.getByText(copy.result.event("PauseAI London March"))).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Person 1" })).toHaveAttribute("href", "/staff/supporters/1");
    expect(page.getByRole("link", { name: "Person 3" }).elements()).toEqual([]);
    for (const said of [
      copy.result.luma.added,
      copy.result.luma.skipped,
      copy.result.luma.failed,
      copy.result.noLuma,
    ]) {
      await expect.element(page.getByText(said)).toBeVisible();
    }
  });

  it("says so when everyone's gone, with no event or note", async () => {
    await render(<SignupUploadResult upload={{ ...exampleSignupUpload, eventName: null, note: null, people: [] }} />);
    await expect.element(page.getByText(copy.result.none)).toBeVisible();
  });
});

describe("SignupUploadsTable", () => {
  it("lists each upload, linked", async () => {
    await render(<SignupUploadsTable uploads={[exampleSignupUpload]} />);
    await expect
      .element(page.getByRole("link", { name: "flyering.csv" }))
      .toHaveAttribute("href", "/staff/supporters/upload/1");
  });

  it("is nothing before the first", async () => {
    const view = await render(<SignupUploadsTable uploads={[]} />);
    expect(view.container.textContent).toBe("");
  });
});
