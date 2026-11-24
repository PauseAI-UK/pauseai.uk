import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { CONSENTS } from "@/lib/supporters/contact-permissions";
import { optOutChoices } from "@/lib/supporters/opt-out-choices";
import { refused } from "@/lib/form-result";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { RefusalPlace } from "../ui/ResultForm";
import OptOutForm, { type RecordOptOut } from "./OptOutForm";
import { OptOutFormExample } from "./OptOutForm.gallery.client";
import { supportersCopy } from "./copy";

// The page's address, which the place a page says things at its top reads.
vi.mock("next/navigation", () => ({
  usePathname: () => "/staff/supporters/4",
  useSearchParams: () => new URLSearchParams(),
}));

/** A stand-in for the Server Action, answering each send in turn with one of `answers`. */
function recording(...answers: Awaited<ReturnType<RecordOptOut>>[]) {
  const action = vi.fn<RecordOptOut>();
  for (const answer of answers) action.mockResolvedValueOnce(answer);
  return action;
}

const words = supportersCopy.supporters.detail.permissions.recordOptOut;
const { ways, lists } = supportersCopy.supporters.filters;
const { luma, lumaOnly } = supportersCopy.supporters.detail.permissions;
/** The headings in the menu: the rows that aren't choices. */
const headings = (menu: Element) =>
  [...menu.querySelectorAll("li")].filter((li) => !li.querySelector("button")).map((li) => li.textContent);
const choices = optOutChoices([
  ...CONSENTS.map((c) => ({
    address: c.way === "email" ? "jane.smith@example.com" : "+447700900123",
    channel: c.way === "email" ? ("email" as const) : ("phone" as const),
    topic: c.topic,
    way: c.way,
    send: "yes" as const,
  })),
]);

/** Chooses every bulk email, and says how they told us. */
async function fillIn(how: string) {
  await page.getByRole("button", { name: `${words.what}: ${words.choose}` }).click();
  await page.getByRole("button", { name: `${words.bulk}, ${ways.email}` }).click();
  await page.getByRole("textbox", { name: words.how }).fill(how);
}

describe("OptOutForm", () => {
  it("opens to choose what they opted out of, at which address or number, and how they told us", async () => {
    const record = recording({ ok: true, already: false });
    await render(<OptOutForm supporterId={4} choices={choices} record={record} />);
    await page.getByRole("button", { name: words.open }).click();
    // Nothing chosen to begin with, so nothing can be recorded yet.
    const what = page.getByRole("button", { name: `${words.what}: ${words.choose}` });
    await expect.element(page.getByRole("button", { name: words.record })).toBeDisabled();
    await what.click();
    // Under each way, email, texts and calls apart, which needn't say where, as there's one of each.
    const menu = page.getByRole("list");
    expect(headings(menu.element())).toEqual([ways.email, ways.text, ways.call]);
    await expect.element(menu.getByRole("button")).toHaveLength(7);
    // Each named as the lists are; events by email is Luma's own messages.
    expect([...menu.element().querySelectorAll("button")].map((button) => button.textContent)).toEqual([
      lists.updates,
      lists.volunteering,
      luma.name,
      words.bulk,
      lists.updates,
      lists.volunteering,
      lists.volunteering,
    ]);
    await page.getByRole("button", { name: `${words.bulk}, ${ways.email}` }).click();
    await expect
      .element(page.getByRole("button", { name: `${words.what}: ${words.bulk}, ${ways.email}` }))
      .toBeVisible();
    await page.getByRole("textbox", { name: words.how }).fill("Asked at the Leeds stall");
    await page.getByRole("button", { name: words.record }).click();
    await expect.element(page.getByRole("button", { name: words.open })).toBeVisible();
    expect(Object.fromEntries(record.mock.calls[0][0])).toEqual({
      supporterId: "4",
      choice: "email|bulk|jane.smith@example.com",
      how: "Asked at the Leeds stall",
    });
    await expect.element(page.getByText(words.already)).not.toBeInTheDocument();
  });

  it("says when they were opted out of it already, and Cancel closes it unsent", async () => {
    const record = recording({ ok: true, already: true });
    await render(<OptOutForm supporterId={4} choices={choices} record={record} opened />);
    await page.getByRole("button", { name: words.cancel }).click();
    expect(record).not.toHaveBeenCalled();
    await page.getByRole("button", { name: words.open }).click();
    await fillIn("Phoned");
    await page.getByRole("button", { name: words.record }).click();
    await expect.element(page.getByText(words.already)).toBeVisible();
  });

  it("stays open when it's refused or fails, saying why under how they told us, with what was typed", async () => {
    const record = recording(refused("blank"));
    // As the server throws: an error with a digest, which the server has kept, so the browser tells no one.
    record.mockRejectedValueOnce(Object.assign(new Error("The server threw"), { digest: "1" }));
    record.mockResolvedValueOnce({ ok: true, already: false });
    await render(<OptOutForm supporterId={4} choices={choices} record={record} opened />);
    await fillIn("Phoned");
    await page.getByRole("button", { name: words.record }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(words.refused.blank);
    await expect.element(page.getByRole("textbox", { name: words.how })).toHaveValue("Phoned");
    await page.getByRole("button", { name: words.record }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(staffVocabulary.notDone);
    await expect.element(page.getByRole("textbox", { name: words.how })).toHaveValue("Phoned");
    // Recorded, it closes, with nothing left to say.
    await page.getByRole("button", { name: words.record }).click();
    await expect.element(page.getByRole("button", { name: words.open })).toBeVisible();
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
    expect(record).toHaveBeenCalledTimes(3);
  });

  it("says at the top of the page that the supporter has gone", async () => {
    await render(
      <RefusalPlace>
        <OptOutForm supporterId={4} choices={choices} record={recording(refused("gone"))} opened />
      </RefusalPlace>,
    );
    await fillIn("Phoned");
    await page.getByRole("button", { name: words.record }).click();
    const alert = page.getByRole("alert");
    await expect.element(alert).toHaveTextContent(words.refused.gone);
    // Over the page, not in the form.
    expect(page.getByRole("form", { name: words.open }).element().contains(alert.element())).toBe(false);
  });

  it("says which address or number under a way they have more than one by", async () => {
    const both = optOutChoices([
      ...["jane.smith@example.com", "jane@work.example.com"].map((address) => ({
        address,
        channel: "email" as const,
        topic: "newsletter" as const,
        way: "email" as const,
        send: "yes" as const,
      })),
      { address: "+447700900123", channel: "phone", topic: "volunteering", way: "call", send: "yes" },
      // A number only inc. Luma reaches: events by text, named as that list is on their page.
      { address: "+447700900124", channel: "phone", topic: "events", way: "text", send: "yes" },
    ]);
    await render(<OptOutForm supporterId={4} choices={both} record={vi.fn()} opened />);
    await page.getByRole("button", { name: `${words.what}: ${words.choose}` }).click();
    expect(headings(page.getByRole("list").element())).toEqual([
      `${ways.email} · jane.smith@example.com`,
      `${ways.email} · jane@work.example.com`,
      ways.call,
      ways.text,
    ]);
    await expect.element(page.getByRole("button", { name: `${lumaOnly.name}, ${ways.text}` })).toBeVisible();
    await page.getByRole("button", { name: `${lists.updates}, ${ways.email} · jane@work.example.com` }).click();
    await expect
      .element(
        page.getByRole("button", { name: `${words.what}: ${lists.updates}, ${ways.email} · jane@work.example.com` }),
      )
      .toBeVisible();
  });

  it("shows nothing for a supporter with no address or number", async () => {
    const { container } = await render(<OptOutForm supporterId={4} choices={[]} record={vi.fn()} />);
    expect(container.textContent).toBe("");
  });
});

describe("OptOutForm's example in the gallery", () => {
  // Its Server Action is logged, not sent: pressing it adds its line to the event log.
  const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

  it("logs recording an opt-out", async () => {
    await render(<OptOutFormExample opened />);
    await page.getByRole("button", { name: `${words.what}: ${words.choose}` }).click();
    const newsletter = supportersCopy.supporters.filters.lists.updates;
    await page.getByRole("button", { name: `${newsletter}, ${ways.email}` }).click();
    await page.getByRole("textbox", { name: words.how }).fill("At the stall");
    await page.getByRole("button", { name: words.record }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent(
        'record({"supporterId":"1","choice":"email|newsletter|jane.smith@example.com","how":"At the stall"})',
      );
  });
});
