import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { march } from "@/lib/content/march";
import { pausefest, type FestDay } from "@/lib/content/pausefest";
import Lineup from "./Lineup";
import PauseFestHero from "./PauseFestHero";

describe("PauseFestHero", () => {
  it("names the festival and links to each day", async () => {
    await render(<PauseFestHero />);
    await expect.element(page.getByRole("heading", { level: 1, name: "PauseFest" })).toBeVisible();
    const days = page.getByRole("navigation", { name: "Days" }).getByRole("link");
    expect(days.all()).toHaveLength(4);
    await expect
      .element(page.getByRole("link", { name: /Mon 23 Nov.*Conference in Parliament · Fireside chat/ }))
      .toHaveAttribute("href", "#mon-23");
  });
});

describe("Lineup", () => {
  it("heads each day, with its events under it", async () => {
    await render(<Lineup days={pausefest.days} />);
    for (const day of ["Fri 20 Nov", "Sat 21 Nov", "Sun 22 Nov", "Mon 23 Nov"])
      await expect.element(page.getByRole("heading", { level: 2, name: day })).toBeVisible();
    const monday = page.getByRole("region", { name: "Mon 23 Nov" });
    expect(monday.getByRole("heading", { level: 3 }).all()).toHaveLength(2);
  });

  it("registers for the march on its own page, and for the rest on Luma in a new tab", async () => {
    await render(<Lineup days={pausefest.days} />);
    const saturday = page.getByRole("region", { name: "Sat 21 Nov" });
    const marchLink = saturday.getByRole("link", { name: "Register" });
    await expect.element(marchLink).toHaveAttribute("href", march.path);
    await expect.element(marchLink).not.toHaveAttribute("target");
    await expect
      .element(saturday.getByRole("link", { name: "Bus from Oxford →" }))
      .toHaveAttribute("href", "https://luma.com/2iot5awn");

    const friday = page.getByRole("region", { name: "Fri 20 Nov" }).getByRole("link", { name: "Register" });
    await expect.element(friday).toHaveAttribute("href", "https://luma.com/5na05tdu");
    await expect.element(friday).toHaveAttribute("target", "_blank");
  });

  it("marks the main event and its day as featured, and no other", async () => {
    await render(<Lineup days={pausefest.days} />);
    await expect.element(page.getByRole("region", { name: "Sat 21 Nov" })).toHaveAttribute("data-featured", "true");
    await expect.element(page.getByRole("region", { name: "Sun 22 Nov" })).not.toHaveAttribute("data-featured");
  });

  it("lays out a day of events without a featured one", async () => {
    const quiet: FestDay = {
      id: "example-day",
      weekday: "Tue",
      date: "1 Jan",
      events: [
        {
          title: "An example event",
          time: "1–2pm",
          place: "An example place",
          blurb: "An example line about the event.",
          href: "https://luma.com/example",
          image: "/images/march-nov-26/luma-cover.webp",
        },
      ],
    };
    await render(<Lineup days={[quiet]} />);
    await expect.element(page.getByRole("heading", { level: 3, name: "An example event" })).toBeVisible();
    await expect.element(page.getByRole("region", { name: "Tue 1 Jan" })).not.toHaveAttribute("data-featured");
  });
});
