import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { groupPages } from "@/lib/content/group-pages";
import { groupNamed } from "@/lib/content/groups";
import GroupPage from "./GroupPage";

// The events sections are tested with GroupEvents; here they stand in.
vi.mock("@/components/events/GroupEvents", () => ({
  default: ({ groupName }: { groupName: string }) => <section data-testid="events">{groupName} events</section>,
}));

/** The badge over the hero photo: whatever follows the photo, beside the h1's column. */
describe("GroupPage", () => {
  it.each(Object.values(groupPages).map((content) => [content.name, content] as const))(
    "renders %s's page",
    async (name, content) => {
      const { container } = await render(<GroupPage content={content} />);
      await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent(groupNamed(name).words.title);
      await expect.element(page.getByTestId("events")).toHaveTextContent(`${name} events`);
      const hero = container.querySelector("main > section")!;
      for (const action of content.hero.actions) {
        const link = [...hero.querySelectorAll("a")].find((a) => a.textContent === action.label)!;
        expect(link.getAttribute("target")).toBe(action.newTab ? "_blank" : null);
      }
      expect(container.querySelector('[data-testid="hero-badge"]')?.textContent).toBe(content.hero.badge);
    },
  );

  it("tints a photo, and shows an illustration whole in its own colours", async () => {
    const picture = (container: Element) =>
      getComputedStyle(container.querySelector('main > section [style*="url("]')!);
    const photo = await render(<GroupPage content={groupPages.London} />);
    expect(picture(photo.container).backgroundImage).toMatch(/^linear-gradient.*url\(/);
    await photo.unmount();
    const illustration = await render(<GroupPage content={groupPages.Parents} />);
    const style = picture(illustration.container);
    expect(style.backgroundImage).toMatch(/^url\(/);
    expect(style.backgroundSize).toBe("cover");
    expect(style.backgroundPosition).toBe("100% 50%");
  });

  it("puts every section in the same order, with the same headings", async () => {
    const { container } = await render(<GroupPage content={groupPages.Leicester} />);
    const headings = [...container.querySelectorAll("main h2")].map((h) => h.textContent);
    expect(headings).toEqual(["What we're doing in Leicester", "What we've done", "Link up with the group"]);
    const order = [...container.querySelectorAll("main > section")].map(
      (s) => s.getAttribute("data-testid") ?? s.querySelector("h2")?.textContent,
    );
    expect(order).toEqual([
      undefined,
      "events",
      "What we're doing in Leicester",
      "What we've done",
      "Link up with the group",
    ]);
  });

  // Hero, events (a stand-in here, ending in cream past events), then each
  // band after them: no two neighbours alike.
  it.each([
    ["Leicester", ["white", "cream", "beige"]],
    ["Scotland", ["white", "beige"]],
  ] as const)("gives %s's bands after the events alternating colours", async (name, colours) => {
    const { container } = await render(<GroupPage content={groupPages[name]} />);
    // A plain band is see-through, onto the cream page.
    const named = { "rgba(0, 0, 0, 0)": "cream", "rgb(255, 255, 255)": "white", "rgb(245, 237, 228)": "beige" };
    const bands = [...container.querySelectorAll("main > section")].slice(2);
    expect(bands.map((band) => named[getComputedStyle(band).backgroundColor as keyof typeof named])).toEqual(colours);
  });

  it("ends with the contact sentence and its buttons, and nothing else", async () => {
    const { container } = await render(<GroupPage content={groupPages.Manchester} />);
    const { lede, actions } = groupPages.Manchester.contact;
    const contact = container.querySelector("main > section:last-child .container")!;
    // The heading and the sentence, then the buttons in the order given.
    expect([...contact.children].map((child) => child.textContent)).toEqual([
      `Link up with the group${lede}`,
      actions.map((action) => action.label).join(""),
    ]);
    const buttons = [...contact.lastElementChild!.querySelectorAll("a")];
    expect(buttons.map((a) => a.getAttribute("href"))).toEqual(actions.map((action) => action.href));
  });

  it("leaves out the sections and the badge it wasn't given", async () => {
    const { container } = await render(
      <GroupPage
        content={{
          name: "London",
          hero: { lede: "Hi", actions: [], photo: "/x.jpg" },
          activities: { items: [{ title: "T", text: "x", image: "/i.jpg" }] },
          contact: {
            lede: "l",
            actions: [
              { label: "A", href: "/a", variant: "primary", internal: true },
              { label: "B", href: "/b", variant: "ghost" },
            ],
          },
        }}
      />,
    );
    await expect.element(page.getByRole("link", { name: "A" })).toBeVisible();
    expect(container.querySelector('[data-testid="hero-badge"]')).toBeNull();
    await expect.element(page.getByText("l", { exact: true })).toBeVisible();
    expect(container.querySelector("article .inline-link")).toBeNull();
    await expect.element(page.getByRole("link", { name: "View event page" })).not.toBeInTheDocument();
    await expect.element(page.getByRole("heading", { name: "What we're doing in London" })).not.toBeInTheDocument();
  });
});
