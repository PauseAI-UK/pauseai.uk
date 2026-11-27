import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { mailingsCopy } from "../mailings/copy";
import TextVersions, { type VersionSide } from "./TextVersions";
import { TextVersionsExample } from "./TextVersions.gallery.client";

const copy = broadcastsCopy.broadcastPages.textVersions;
const parts = mailingsCopy.mailingEditor;
const WHO = "registered for “PauseCon 2026”";

async function renderVersions(open: VersionSide, onRemove?: () => void, templates = 2) {
  const onOpen = vi.fn();
  await render(
    <TextVersions
      who={WHO}
      counts={{ only: 85, except: 327 }}
      open={open}
      onOpen={onOpen}
      templates={templates}
      onRemove={onRemove}
    >
      <p>Its words</p>
    </TextVersions>,
  );
  return onOpen;
}

const tab = (count: number) => page.getByRole("tab", { name: `${WHO} · ${count}` });
const close = () => page.getByRole("button", { name: copy.removeVariant });

describe("TextVersions", () => {
  it("has a tab for each version, with how many it goes to, and the open one's parts in a box under who it's for", async () => {
    const onRemove = vi.fn();
    const onOpen = await renderVersions("only", onRemove);
    await expect.element(tab(85)).toHaveAttribute("aria-selected", "true");
    await expect.element(tab(327)).toHaveAttribute("aria-selected", "false");
    await expect.element(page.getByText(parts.onlyForLabel(WHO))).toBeVisible();
    await expect.element(page.getByText("Its words")).toBeVisible();
    await expect.element(page.getByText(copy.templates(2))).toBeVisible();
    await tab(327).click();
    expect(onOpen).toHaveBeenCalledWith("except");
    await tab(85).click();
    expect(onOpen).toHaveBeenLastCalledWith("only");
    await close().click();
    expect(onRemove).toHaveBeenCalled();
  });

  it("boxes everyone else's version under all but those, and says when the two are one template", async () => {
    await renderVersions("except", () => {}, 1);
    await expect.element(tab(327)).toHaveAttribute("aria-selected", "true");
    await expect.element(page.getByText(parts.exceptLabel(WHO))).toBeVisible();
    await expect.element(page.getByText(copy.templates(1))).toBeVisible();
  });

  it("has no × without a way to make it for everyone", async () => {
    await renderVersions("only");
    await expect.element(page.getByText("Its words")).toBeVisible();
    expect(close().query()).toBeNull();
  });
});

describe("TextVersions' examples in the gallery", () => {
  it("opens each version's words by its tab, and logs the ×", async () => {
    await render(<TextVersionsExample templates={2} />);
    await expect.element(page.getByText("We meet at All Souls' Place at noon.")).toBeVisible();
    await page.getByRole("tab", { name: /94$/ }).click();
    await expect.element(page.getByText("Over 1,800 people are coming. Will you?")).toBeVisible();
    await close().click();
    await expect
      .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
      .toHaveTextContent("onRemove(event)");
  });
});
