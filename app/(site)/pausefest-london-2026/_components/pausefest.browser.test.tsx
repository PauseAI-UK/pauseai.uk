import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { march } from "@/lib/content/march";
import { pausefest, type FestDay } from "@/lib/content/pausefest";
import PauseFestHero from "./PauseFestHero";
import Programme from "./Programme";

describe("PauseFestHero", () => {
  it("names the festival, where and when", async () => {
    await render(<PauseFestHero />);
    await expect.element(page.getByRole("heading", { level: 1, name: "PauseFest" })).toBeVisible();
    await expect.element(page.getByText("London 2026")).toBeVisible();
    await expect.element(page.getByText(/20th – 23rd November/)).toBeVisible();
  });
});

describe("Programme", () => {
  it("lists every event in order, the main ones with their full date", async () => {
    await render(<Programme days={pausefest.days} />);
    const titles = page.getByRole("listitem").getByRole("heading", { level: 3 });
    expect(titles.elements().map((title) => title.textContent)).toEqual([
      "Sign-making",
      "March Against AI Extinction",
      "Flyering for the next march",
      "Conference in Parliament",
      "Fireside chat with Siliconversations",
    ]);
    await expect.element(page.getByText("Saturday 21 November, 12–3pm")).toBeVisible();
    await expect.element(page.getByText("Fri 20 Nov")).toBeVisible();
  });

  it("registers for the march on its own page, and for the rest on Luma in a new tab", async () => {
    await render(<Programme days={pausefest.days} />);
    const marchBand = page.getByRole("listitem").filter({ hasText: "March Against AI Extinction" });
    const marchLink = marchBand.getByRole("link", { name: "Register" });
    await expect.element(marchLink).toHaveAttribute("href", march.path);
    await expect.element(marchLink).not.toHaveAttribute("target");
    await expect
      .element(marchBand.getByRole("link", { name: "Bus from Oxford →" }))
      .toHaveAttribute("href", "https://luma.com/2iot5awn");

    const conference = page
      .getByRole("listitem")
      .filter({ hasText: "Conference in Parliament" })
      .getByRole("link", { name: "Register" });
    await expect.element(conference).toHaveAttribute("href", "https://luma.com/pauseai-conf-nov26");
    await expect.element(conference).toHaveAttribute("target", "_blank");

    const signMaking = page
      .getByRole("listitem")
      .filter({ hasText: "Sign-making" })
      .getByRole("link", { name: "Register →" });
    await expect.element(signMaking).toHaveAttribute("href", "https://luma.com/5na05tdu");
    await expect.element(signMaking).toHaveAttribute("target", "_blank");
  });

  it("links a row to a page of ours in the same tab", async () => {
    const day: FestDay = {
      short: "Tue 1 Jan",
      long: "Tuesday 1 January",
      events: [
        {
          title: "An example event",
          time: "1–2pm",
          place: "An example place",
          href: "/events",
          image: "/images/march-nov-26/luma-cover.webp",
        },
      ],
    };
    await render(<Programme days={[day]} />);
    const link = page.getByRole("link", { name: "Register →" });
    await expect.element(link).toHaveAttribute("href", "/events");
    await expect.element(link).not.toHaveAttribute("target");
  });
});
