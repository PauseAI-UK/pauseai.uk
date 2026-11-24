import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { march, novemberMarch, novemberMarchFilm } from "@/lib/content/march";
import { m } from "./classes";
import HeroFilm from "./HeroFilm";
import MarchOver from "./MarchOver";
import MarchSignupFrame from "./MarchSignupFrame";
import MarchSignups from "./MarchSignups";
import PastHero from "./PastHero";
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
    await render(<SignupHero march={march} />);
    await expect.element(page.getByRole("heading", { level: 1, name: "March Against AI Extinction" })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Register now" })).toHaveAttribute("href", "#register");
    await expect.element(page.getByRole("link", { name: "See all details" })).toHaveAttribute("href", "#on-the-day");
    await expect.element(page.getByText(march.dateLong)).toBeVisible();
    // Its route isn't settled, so the hero shows none.
    expect(page.getByRole("img", { name: "to" }).query()).toBeNull();
    // Nothing around it says how many have registered, so it says nothing.
    expect(page.getByText(/already registered/).query()).toBeNull();
  });

  it("shows a march's route in the hero once it has one", async () => {
    await render(<SignupHero march={novemberMarch} />);
    await expect.element(page.getByText("Saturday 21st November, 2026")).toBeVisible();
    await expect.element(page.getByRole("img", { name: "to" })).toBeVisible();
    await expect.element(page.getByText(/All Souls' Place/)).toBeVisible();
  });

  it("has a past march's hero lead to the next march, with how many registered and their faces", async () => {
    const guests = ["Jane Smith", "Sam Jones", "Alex Brown", "Kim Lee"].map((name) => ({ name, avatar: null }));
    const { container } = await render(
      // The sign-up's count around it isn't the past march's, so the hero doesn't show it.
      <MarchSignups signups={99}>
        <PastHero march={novemberMarch} registered={1234} guests={guests} />
      </MarchSignups>,
    );
    await expect.element(page.getByRole("heading", { level: 1, name: "March Against AI Extinction" })).toBeVisible();
    await expect.element(page.getByText("What. A. Day.")).toBeVisible();
    // Said twice to be past: above its name, and beside its date.
    await expect.element(page.getByText("Past march")).toBeVisible();
    await expect.element(page.getByText("Took place")).toBeVisible();
    await expect.element(page.getByText("Saturday 21st November, 2026")).toBeVisible();
    await expect.element(page.getByRole("img", { name: "to" })).toBeVisible();
    // The next march's card, with its date and place, is the one link.
    const links = page.getByRole("link").all();
    expect(links).toHaveLength(1);
    await expect.element(links[0]).toHaveAttribute("href", march.path);
    expect(container.querySelector(`.${m("hero-next")}`)!.textContent).toContain(`${march.dateLong} · ${march.city}`);
    expect(page.getByText(/already registered/).query()).toBeNull();
    const going = container.querySelector(`.${m("hero-going")}`)!;
    expect(going.querySelector("strong")!.textContent).toBe("1,234");
    expect(going.querySelectorAll("li")).toHaveLength(3);
  });

  it("says nothing of how many registered for a past march when Luma can't say, and shows no faces", async () => {
    const { container } = await render(<PastHero march={novemberMarch} />);
    expect(container.querySelector(`.${m("hero-going")}`)).toBeNull();
    const faceless = await render(<PastHero march={novemberMarch} registered={1234} />);
    expect(faceless.container.querySelector(`.${m("hero-going")} ul`)).toBeNull();
  });

  it("stands the film straight and a little larger while it plays, and puts it back when it stops", async () => {
    await page.viewport(1280, 800);
    const { container } = await render(
      <MarchSignupFrame>
        <div style={{ width: 600, padding: 60 }}>
          <HeroFilm film={novemberMarchFilm} />
        </div>
      </MarchSignupFrame>,
    );
    const film = container.querySelector("video")!;
    const shape = () => getComputedStyle(film).transform;
    // Askew at rest: a rotation is neither none nor a plain scaling.
    const atRest = shape();
    expect(atRest).not.toBe("none");
    // The film itself isn't fetched in a test: its events are what say it plays, pauses and ends.
    film.dispatchEvent(new Event("play"));
    await expect.poll(() => film.className).toContain(m("hero-film-playing"));
    await expect.poll(shape).toBe("matrix(1.06, 0, 0, 1.06, 0, 0)");
    film.dispatchEvent(new Event("pause"));
    await expect.poll(() => film.className).not.toContain(m("hero-film-playing"));
    await expect.poll(shape).toBe(atRest);
    film.dispatchEvent(new Event("play"));
    await expect.poll(() => film.className).toContain(m("hero-film-playing"));
    film.dispatchEvent(new Event("ended"));
    await expect.poll(() => film.className).not.toContain(m("hero-film-playing"));
  });

  it("has a past march's film to play beside its words, over a photo of the day, loading nothing until it's played", async () => {
    await page.viewport(1280, 800);
    const { container } = await render(
      <MarchSignupFrame>
        <PastHero march={novemberMarch} />
      </MarchSignupFrame>,
    );
    const film = container.querySelector("video")!;
    expect(film.controls).toBe(true);
    expect(film.preload).toBe("none");
    expect(film.getAttribute("poster")).toBe(novemberMarchFilm.poster);
    expect(film.getAttribute("src")).toBe(novemberMarchFilm.src);
    expect(film.getAttribute("aria-label")).toBe(novemberMarchFilm.label);
    // The film is whole, in its own shape, to the right of the words.
    const frame = film.getBoundingClientRect();
    expect(frame.width / frame.height).toBeCloseTo(16 / 9, 1);
    const words = container.querySelector(`.${m("hero-words")}`)!.getBoundingClientRect();
    expect(frame.left).toBeGreaterThanOrEqual(words.right);
    // The photo is decorative, as tall as the hero, behind the film and out to the hero's right edge.
    const hero = container.querySelector("section")!.getBoundingClientRect();
    const photo = container.querySelector(`.${m("hero-backdrop")} img`)!;
    expect(photo.getAttribute("alt")).toBe("");
    const behind = photo.getBoundingClientRect();
    expect(Math.round(behind.height)).toBe(Math.round(hero.height));
    expect(Math.round(behind.right)).toBe(Math.round(hero.right));
    expect(behind.left).toBeLessThan(frame.left);
    expect(behind.left).toBeGreaterThan(hero.left);
  });

  it("says how many have registered under the buttons, with the first three faces", async () => {
    const guests = ["Jane Smith", "Sam Jones", "Alex Brown", "Kim Lee"].map((name) => ({ name, avatar: null }));
    const { container } = await render(
      <MarchSignups signups={1234}>
        <SignupHero march={march} guests={guests} />
      </MarchSignups>,
    );
    await expect.element(page.getByText("Join 1,234+ people already registered")).toBeVisible();
    expect(container.querySelectorAll(`.${m("hero-going")} li`)).toHaveLength(3);
  });

  it("shows no faces when Luma features no one", async () => {
    const { container } = await render(
      <MarchSignups signups={1234}>
        <SignupHero march={march} />
      </MarchSignups>,
    );
    await expect.element(page.getByText("Join 1,234+ people already registered")).toBeVisible();
    expect(container.querySelector(`.${m("hero-going")} ul`)).toBeNull();
  });

  it("marks the July incident's turn", async () => {
    await render(<SignupCase />);
    await expect.element(page.getByText("The agent had not been instructed to attack Hugging Face")).toBeVisible();
  });

  it("heads a past march's case in the past", async () => {
    await render(<SignupCase past />);
    expect(page.getByRole("heading", { name: /Why we.re marching/ }).query()).toBeNull();
    await expect.element(page.getByRole("heading", { level: 2, name: "Why we marched" })).toBeVisible();
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

  it("shows the turnouts, the next march's goal last and circled", async () => {
    const { container } = await render(<SignupTurnout />);
    const steps = page.getByRole("listitem").all();
    expect(steps).toHaveLength(4);
    await expect.element(steps[1]).toHaveTextContent("February 2026300Five times bigger");
    expect(steps[2].element().textContent).toMatch(/^21st November 2026/);
    expect(steps[3].element().textContent).toContain(march.dateWritten);
    expect(steps[3].element().textContent).toMatch(/Our goal this time$/);
    await expect.element(page.getByText(/this march will be no exception/)).toBeVisible();
    // The goal's figure alone is in a Marker's span.
    expect(container.querySelectorAll(`.${m("turnout-figure")} > span`)).toHaveLength(1);
    expect(steps[3].element().querySelector(`.${m("turnout-figure")} > span`)).not.toBeNull();
  });

  it("ends a past march's turnouts at its own, with no goal", async () => {
    const { container } = await render(<SignupTurnout past />);
    const steps = page.getByRole("listitem").all();
    expect(steps).toHaveLength(3);
    expect(steps[2].element().textContent).toMatch(/^21st November 2026/);
    expect(page.getByText(/this march will be no exception/).query()).toBeNull();
    expect(page.getByText("Our goal this time").query()).toBeNull();
    expect(container.querySelector(`.${m("turnout-figure")} > span`)).toBeNull();
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

  it("says when, and no route until it's settled, where See all details goes", async () => {
    const { container } = await render(<SignupDay march={march} />);
    expect(container.querySelector("#on-the-day")).not.toBeNull();
    await expect.element(page.getByText(march.dateLong)).toBeVisible();
    expect(page.getByText("From").query()).toBeNull();
    // The line saying the route is to come, after when.
    expect(container.querySelectorAll(`.${m("route")} p`)).toHaveLength(2);
    await expect
      .element(page.getByRole("link", { name: "hello@pauseai.uk" }))
      .toHaveAttribute("href", "mailto:hello@pauseai.uk");
  });

  it("maps the route's start and end", async () => {
    const { container } = await render(<SignupDay march={novemberMarch} />);
    // When, from and to, and nothing about a route to come.
    expect(container.querySelectorAll(`.${m("route")} p`)).toHaveLength(3);
    expect(container.querySelector("#on-the-day")).not.toBeNull();
    await expect
      .element(page.getByRole("link", { name: "All Souls' Place" }))
      .toHaveAttribute("href", expect.stringContaining("All%20Souls'%20Place%2C%20London%20W1B%203DA"));
    await expect.element(page.getByRole("link", { name: "Downing Street" })).toHaveAttribute("target", "_blank");
    await expect
      .element(page.getByRole("link", { name: "hello@pauseai.uk" }))
      .toHaveAttribute("href", "mailto:hello@pauseai.uk");
  });

  it("ends a past march's page with the way to the next march and to joining", async () => {
    await render(<MarchOver />);
    await expect.element(page.getByRole("heading", { level: 2 })).toBeVisible();
    const links = page.getByRole("link").all();
    expect(links).toHaveLength(2);
    await expect.element(links[0]).toHaveAttribute("href", march.path);
    await expect.element(links[1]).toHaveAttribute("href", "/#join");
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
