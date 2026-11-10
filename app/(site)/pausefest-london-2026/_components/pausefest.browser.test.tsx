import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { march } from "@/lib/content/march";
import { pausefest, type FestDay } from "@/lib/content/pausefest";
import Going from "./Going";
import PauseFestHero from "./PauseFestHero";
import Programme from "./Programme";

describe("PauseFestHero", () => {
  it("names the festival, where and when", async () => {
    await render(<PauseFestHero />);
    await expect.element(page.getByRole("heading", { level: 1, name: "PauseFest" })).toBeVisible();
    await expect.element(page.getByText(/London 2026/)).toBeVisible();
    await expect.element(page.getByText(/20th – 23rd Nov/)).toBeVisible();
  });
});

describe("Programme", () => {
  it("lists every event in order, each with its day", async () => {
    await render(<Programme days={pausefest.days} />);
    const titles = page.getByRole("listitem").getByRole("heading", { level: 3 });
    expect(titles.elements().map((title) => title.textContent)).toEqual([
      "Sign-making",
      "March Against AI Extinction",
      "Flyering for the next march",
      "Conference in Parliament",
      "Fireside chat with Siliconversations",
    ]);
    const marchBand = page.getByRole("listitem").filter({ hasText: "March Against AI Extinction" });
    await expect.element(marchBand.getByText(/Sat 21 Nov/)).toBeVisible();
    await expect.element(marchBand.getByText(/12–3pm/)).toBeVisible();
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
      .getByRole("link", { name: "Apply" });
    await expect.element(conference).toHaveAttribute("href", "https://luma.com/pauseai-conf-nov26");
    await expect.element(conference).toHaveAttribute("target", "_blank");

    const signMaking = page
      .getByRole("listitem")
      .filter({ hasText: "Sign-making" })
      .getByRole("link", { name: "Register →" });
    await expect.element(signMaking).toHaveAttribute("href", "https://luma.com/5na05tdu");
    await expect.element(signMaking).toHaveAttribute("target", "_blank");
  });

  it("shows who's going to an event Luma could say about, and nothing for one it couldn't or whose guests aren't shown", async () => {
    const going = { count: 3, guests: [] };
    await render(
      <Programme
        days={pausefest.days}
        going={{
          "evt-1HKCXSHaJqGO3Bg": { count: 1113, guests: [{ name: "Jane Smith", avatar: null }] },
          "evt-uvhJhYEEPh6UM9Z": going,
          "evt-EZYMdCaJRsMDDoy": null,
          // The conference's, which it has no ID for.
          undefined: going,
        }}
      />,
    );
    const band = (title: string) => page.getByRole("listitem").filter({ hasText: title });
    await expect.element(band("March Against AI Extinction").getByText(/1,113 going/)).toBeVisible();
    await expect.element(band("Sign-making").getByText(/3 going/)).toBeVisible();
    expect(band("Conference in Parliament").getByText(/going/).elements()).toHaveLength(0);
    expect(band("Flyering for the next march").getByText(/going/).elements()).toHaveLength(0);
  });

  it("links a row to a page of ours in the same tab", async () => {
    const day: FestDay = {
      short: "Tue 1 Jan",
      events: [
        {
          title: "An example event",
          time: "1–2pm",
          place: "An example place",
          href: "/events",
          lumaId: "evt-example",
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

describe("Going", () => {
  const jane = { name: "Jane Smith", avatar: "/images/logos/PauseAI-Logo-Transparent.svg" };
  const sam = { name: "Sam Jones", avatar: null };

  it("shows each featured guest's photo, or their initial, and names the first two and how many others", async () => {
    const { container } = await render(
      <Going going={{ count: 1113, guests: [jane, sam, { name: "Alex Brown", avatar: null }] }} />,
    );
    const faces = [...container.querySelectorAll("li")];
    expect(faces).toHaveLength(3);
    expect(faces[0].querySelector("img")).not.toBeNull();
    expect(faces[1].textContent).toBe("S");
    await expect.element(page.getByText(/1,113 going/)).toBeVisible();
    await expect.element(page.getByText(/Jane Smith, Sam Jones and .*1,111 others/)).toBeVisible();
  });

  it("says one other in the singular", async () => {
    await render(<Going going={{ count: 2, guests: [jane] }} />);
    await expect.element(page.getByText(/Jane Smith and .*1 other$/)).toBeVisible();
  });

  it("names everyone when Luma features everyone going", async () => {
    await render(<Going going={{ count: 2, guests: [jane, sam] }} />);
    await expect.element(page.getByText(/Jane Smith and Sam Jones$/)).toBeVisible();
  });

  it("gives just the count when Luma features no one", async () => {
    const { container } = await render(<Going going={{ count: 0, guests: [] }} />);
    expect(container.querySelector("ul")).toBeNull();
    await expect.element(page.getByText(/0 going$/)).toBeVisible();
  });
});
