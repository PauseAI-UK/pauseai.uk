import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { m } from "./classes";
import MarchSignupFrame from "./MarchSignupFrame";
import MarchSignups from "./MarchSignups";
import SignupCase from "./SignupCase";
import SignupDay from "./SignupDay";
import SignupDemand from "./SignupDemand";
import SignupHero from "./SignupHero";
import SignupPhotos from "./SignupPhotos";
import SignupRegister from "./SignupRegister";
import SignupTurnout from "./SignupTurnout";

describe("m", () => {
  it("gives the stylesheet's own names for its classes", () => {
    expect(m("btn btn-light").split(" ")).toHaveLength(2);
    expect(m("btn")).toMatch(/btn/);
  });

  it("throws on a class the stylesheet hasn't got", () => {
    expect(() => m("no-such-class")).toThrow('march.module.css has no class "no-such-class"');
  });
});

describe("the sign-up's sections", () => {
  it("sets the headings in the site's heaviest weight, in the frame", async () => {
    await render(
      <MarchSignupFrame>
        <SignupCase />
      </MarchSignupFrame>,
    );
    const heading = page.getByRole("heading", { name: /Why we.re marching/ }).element();
    expect(getComputedStyle(heading).fontWeight).toBe("900");
    expect(heading.closest(`.${m("frame")}`)).not.toBeNull();
  });

  it("has the hero's buttons go to the form and the day's details", async () => {
    await render(<SignupHero />);
    await expect.element(page.getByRole("heading", { level: 1, name: "March Against AI Extinction" })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Register now" })).toHaveAttribute("href", "#register");
    await expect.element(page.getByRole("link", { name: "See all details" })).toHaveAttribute("href", "#on-the-day");
    await expect.element(page.getByRole("img", { name: "to" })).toBeVisible();
    // Nothing around it says how many have registered, so it says nothing.
    expect(page.getByText(/already registered/).query()).toBeNull();
  });

  it("says how many have registered under the buttons, with the first three faces", async () => {
    const guests = ["Jane Smith", "Sam Jones", "Alex Brown", "Kim Lee"].map((name) => ({ name, avatar: null }));
    const { container } = await render(
      <MarchSignups signups={1234}>
        <SignupHero guests={guests} />
      </MarchSignups>,
    );
    await expect.element(page.getByText("Join 1,234+ people already registered")).toBeVisible();
    expect(container.querySelectorAll(`.${m("hero-going")} li`)).toHaveLength(3);
  });

  it("shows no faces when Luma features no one", async () => {
    const { container } = await render(
      <MarchSignups signups={1234}>
        <SignupHero />
      </MarchSignups>,
    );
    await expect.element(page.getByText("Join 1,234+ people already registered")).toBeVisible();
    expect(container.querySelector(`.${m("hero-going")} ul`)).toBeNull();
  });

  it("marks the July incident's turn", async () => {
    await render(<SignupCase />);
    await expect.element(page.getByText("The agent had not been instructed to attack Hugging Face")).toBeVisible();
  });

  it("says what we want: a treaty, legislation, and the demand", async () => {
    await render(<SignupDemand />);
    await expect.element(page.getByRole("region", { name: "What we want" })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "See the full proposal" }))
      .toHaveAttribute("href", "https://pauseai.info/proposal");
    await expect.element(page.getByRole("heading", { name: "Frontier AI legislation" })).toBeVisible();
    await expect.element(page.getByText(/^We call on the Prime Minister/)).toBeVisible();
  });

  it("shows the turnouts, the goal last", async () => {
    await render(<SignupTurnout />);
    const steps = page.getByRole("listitem").all();
    expect(steps).toHaveLength(3);
    await expect.element(steps[2]).toHaveTextContent("21st November 20261,000Our goal this time");
  });

  it("hides the staircase's photos from screen readers, and links to the press", async () => {
    const { container } = await render(<SignupPhotos />);
    expect(container.querySelectorAll(`.${m("staircase-photo")}`)).toHaveLength(8);
    // The photos are hidden, so the images left are the press's logos.
    expect(page.getByRole("img").all()).toHaveLength(7);
    expect(page.getByRole("link").all()).toHaveLength(7);
    await expect.element(page.getByRole("img", { name: "WIRED" })).toBeVisible();
    await expect
      .element(page.getByRole("region", { name: /newspapers around the world cover our demonstrations/ }))
      .toBeVisible();
  });

  it("maps the route's start and end, where See all details goes", async () => {
    const { container } = await render(<SignupDay />);
    expect(container.querySelector("#on-the-day")).not.toBeNull();
    await expect
      .element(page.getByRole("link", { name: "All Souls' Place" }))
      .toHaveAttribute("href", expect.stringContaining("All%20Souls'%20Place%2C%20London%20W1B%203DA"));
    await expect.element(page.getByRole("link", { name: "Downing Street" })).toHaveAttribute("target", "_blank");
    await expect
      .element(page.getByRole("link", { name: "hello@pauseai.uk" }))
      .toHaveAttribute("href", "mailto:hello@pauseai.uk");
  });

  it("puts the form in the register band", async () => {
    await render(
      <MarchSignups signups={1234}>
        <SignupRegister register={async () => ({ ok: true })} />
      </MarchSignups>,
    );
    await expect.element(page.getByRole("heading", { name: "Register for the march" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Register" })).toBeVisible();
    await expect.element(page.getByText("1,234 registered so far")).toBeVisible();
    // What to expect, in its order.
    const expectations = page
      .getByRole("listitem")
      .all()
      .map((item) => item.element().textContent);
    expect(expectations[1]).toMatch(/big tent/);
    expect(expectations[2]).toMatch(/police/);
    expect(document.getElementById("register")).not.toBeNull();
  });
});
