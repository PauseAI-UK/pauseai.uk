import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import StaffNav, { staffPageAt } from "./StaffNav";
import { navigation } from "@/tests/browser/navigation";

describe("StaffNav", () => {
  it("is just the title on the login page", async () => {
    await render(<StaffNav />);
    await expect.element(page.getByText(staffCopy.nav.title)).toBeVisible();
    await expect.element(page.getByRole("navigation")).not.toBeInTheDocument();
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
  });

  it("groups the pages by permission, marks the current one but keeps it a link, says who's logged in, and logs out with a POST", async () => {
    await render(<StaffNav email="jo@pauseai.uk" permissions={["admin"]} current="politicians" />);
    // The title is the way home, except at home.
    await expect.element(page.getByRole("link", { name: staffCopy.nav.title })).toHaveAttribute("href", "/staff");
    // The sidebar is for wider screens than the test's, so it's read from the DOM.
    const nav = document.querySelector("nav")!;
    expect(nav.querySelector(`a[href="/staff/me"]`)!.textContent).toBe("jo@pauseai.uk");
    // Home leads the list, a link like the rest.
    expect(nav.querySelector('a[href="/staff"][class*=page]')!.textContent).toBe(staffCopy.nav.home);
    const current = nav.querySelector('a[aria-current="page"]')!;
    expect(current.textContent).toBe(staffCopy.nav.politicians);
    expect(current.getAttribute("href")).toBe("/staff/politicians");
    expect(nav.querySelector('a[href="/staff/scheduled-jobs"]')!.textContent).toBe(staffCopy.nav.import);
    expect(nav.querySelector('a[href="/staff/accounts"]')!.textContent).toBe(staffCopy.nav.accounts);
    expect(nav.querySelector('a[href="/staff/politicians/addresses-to-fix"]')!.textContent).toBe(
      staffCopy.nav.mpEmails,
    );
    expect([...nav.querySelectorAll("h2")].map((h) => h.textContent).slice(0, 3)).toEqual(
      ["politicians", "events", "admin"].map((id) => staffCopy.nav.sections[id]),
    );
    // Without supporters, the Supporters section has no page to show, so it hides.
    expect(nav.querySelector('a[href="/staff/supporters"]')).toBeNull();
    expect(nav.querySelector('a[href="/staff/campaigns"]')).toBeNull();
    // On a phone, a dropdown instead: the current page, with the groups, the email and the way out under it once opened.
    const menu = page.getByRole("group");
    expect((menu.element() as HTMLDetailsElement).open).toBe(false);
    await menu.getByText(staffCopy.nav.politicians, { exact: true }).first().click();
    await expect
      .element(menu.getByRole("link", { name: staffCopy.nav.import }))
      .toHaveAttribute("href", "/staff/scheduled-jobs");
    await expect.element(menu.getByRole("link", { name: staffCopy.nav.import })).toBeVisible();
    await expect.element(menu.getByText("jo@pauseai.uk", { exact: false })).toBeVisible();
    const form = menu.getByRole("button", { name: staffCopy.nav.logout }).element().closest("form")!;
    expect(form.getAttribute("method")).toBe("post");
    expect(form.getAttribute("action")).toBe("/staff/api/logout");
    // The wider screen's sidebar has its own.
    expect(document.querySelectorAll('form[action="/staff/api/logout"]')).toHaveLength(2);
    // Pressed, it's marked for the line along the top till the login page comes; sent into a frame here, so this page stays.
    const frame = document.createElement("iframe");
    frame.name = "elsewhere";
    document.body.append(frame);
    form.target = "elsewhere";
    const logOut = menu.getByRole("button", { name: staffCopy.nav.logout });
    await logOut.click();
    await expect.element(logOut).toHaveAttribute("data-pending", "true");
    frame.remove();
  });

  it("shows the admin section with only Import to someone without the permission, and at home the title isn't a link", async () => {
    await render(<StaffNav email="jo@pauseai.uk" permissions={[]} current="home" />);
    await expect.element(page.getByRole("link", { name: staffCopy.nav.title })).not.toBeInTheDocument();
    const nav = document.querySelector("nav")!;
    expect(nav.querySelector('a[href="/staff/accounts"]')).toBeNull();
    expect(nav.querySelector('a[href="/staff/audit-log"]')).toBeNull();
    expect(nav.querySelector('a[href="/staff/scheduled-jobs"]')).not.toBeNull();
    expect(nav.querySelector("summary")!.textContent).toBe(staffCopy.nav.home);
  });

  it("links your address to your own page, marked when you're on it, there and in the phone's menu", async () => {
    const { rerender } = await render(<StaffNav email="jo@pauseai.uk" permissions={[]} current="home" />);
    const links = () => [...document.querySelectorAll('a[href="/staff/me"]')];
    expect(links().map((a) => [a.textContent, a.getAttribute("title"), a.getAttribute("aria-current")])).toEqual([
      ["jo@pauseai.uk", "jo@pauseai.uk", null],
      ["jo@pauseai.uk", "jo@pauseai.uk", null],
    ]);
    await rerender(<StaffNav email="jo@pauseai.uk" permissions={[]} current="me" />);
    expect(links()[0].getAttribute("aria-current")).toBe("page");
    expect(document.querySelector("summary")!.textContent).toBe(staffCopy.me.title);
  });

  it("shows the Supporters section, Campaigns in it, to someone with supporters", async () => {
    await render(<StaffNav email="jo@pauseai.uk" permissions={["supporters"]} current="campaigns" />);
    const nav = document.querySelector("nav")!;
    const supporters = [...nav.querySelectorAll("section")].find(
      (section) => section.querySelector("h2")?.textContent === staffCopy.nav.sections.supporters,
    )!;
    expect([...supporters.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
      "/staff/supporters",
      "/staff/campaigns",
      "/staff/broadcasts",
      "/staff/supporters/bounced-emails",
      "/staff/supporters/import",
    ]);
  });
});

describe("StaffNav on a phone", () => {
  it("keeps the page's name beside the title, on two lines there when there's no room for it on one", async () => {
    // In a box of a width, as the bar is in the page's margins.
    const nav = (width: number) => (
      <div style={{ width }}>
        <StaffNav email="jo@pauseai.uk" permissions={[]} current="mpEmails" />
      </div>
    );
    const title = () => document.querySelector("nav a[href='/staff']")!.getBoundingClientRect();
    const name = () => document.querySelector("summary")!.getBoundingClientRect();
    await page.viewport(414, 896);
    const { rerender } = await render(nav(380));
    expect(document.querySelector("summary")!.textContent).toBe(staffCopy.nav.mpEmails);
    const oneLine = name().height;
    expect(name().left).toBeGreaterThan(title().right);
    // Too narrow for the name beside the title: it wraps where it is, not under the title.
    await rerender(nav(270));
    expect(name().height).toBeGreaterThan(oneLine);
    expect(name().left).toBeGreaterThanOrEqual(title().right);
    expect(name().top).toBeLessThan(title().bottom);
    expect(Math.round(name().right)).toBeLessThanOrEqual(Math.round(title().left) + 270);
  });
});

describe("StaffNav in the signed-in pages' layout", () => {
  it("marks the page the URL is, or is under, and closes the phone's menu when the page changes", async () => {
    navigation.pathname = "/staff/letters/supporter/3";
    const nav = () => <StaffNav email="jo@pauseai.uk" permissions={["supporters"]} />;
    const { rerender } = await render(nav());
    const current = () => document.querySelector('nav a[aria-current="page"]')?.textContent;
    expect(current()).toBe(staffCopy.nav.supporters);
    const menu = () => page.getByRole("group").element() as HTMLDetailsElement;
    await page.getByRole("group").getByText(staffCopy.nav.supporters, { exact: true }).first().click();
    expect(menu().open).toBe(true);
    navigation.pathname = "/staff/letters/7";
    await rerender(nav());
    expect(current()).toBe(staffCopy.nav.campaigns);
    expect(menu().open).toBe(false);
  });

  it("marks home at /staff and your own page at yours", async () => {
    expect(staffPageAt("/staff")).toBe("home");
    expect(staffPageAt("/staff/me")).toBe("me");
    expect(staffPageAt("/staff/politicians/addresses-to-fix")).toBe("mpEmails");
    expect(staffPageAt("/staff/login")).toBeUndefined();
  });
});
