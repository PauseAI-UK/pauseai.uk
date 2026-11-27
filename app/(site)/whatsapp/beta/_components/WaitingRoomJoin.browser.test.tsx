import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import type { TurnstileApi } from "@/components/ui/Turnstile";
import { spamCheckCopy } from "@/lib/content/spam-check";
import { waitingRoomJoinCopy as copy } from "@/lib/content/whatsapp";
import type { ChatLinkResult } from "@/lib/broadcasts/waiting-room";
import WaitingRoomJoin from "./WaitingRoomJoin";

const LINK = "https://wa.me/447700900000?text=Hi%20(parents)";

/** A stand-in for Turnstile's script that hands over `token` at once. */
function fakeTurnstile(token: string) {
  (window as Window & { turnstile?: TurnstileApi }).turnstile = {
    render: (_element, options) => {
      setTimeout(() => (options.callback as (token: string) => void)(token));
      return "fake";
    },
    remove: () => {},
  };
}

afterEach(() => {
  delete (window as Window & { turnstile?: TurnstileApi }).turnstile;
  window.history.replaceState(null, "", "/");
});

describe("WaitingRoomJoin", () => {
  it("asks for the link once the spam check passes, with the page's utm_source, and shows the button to message us", async () => {
    fakeTurnstile("token-1");
    window.history.replaceState(null, "", "/whatsapp/beta?utm_source=parents");
    const ask = vi.fn(async (): Promise<ChatLinkResult> => ({ ok: true, link: LINK }));
    await render(<WaitingRoomJoin turnstileSiteKey="site" ask={ask} />);
    await expect.element(page.getByRole("link", { name: copy.button })).toHaveAttribute("href", LINK);
    expect(ask).toHaveBeenCalledWith("token-1", "parents");
    await expect.element(page.getByText(copy.opens)).toBeVisible();
  });

  it("asks at once without Turnstile, and says why there's no link: the spam check, closed, or the server unreachable", async () => {
    const answers: (ChatLinkResult | Error)[] = [{ ok: false, reason: "spam-failed" }];
    const ask = vi.fn(async (): Promise<ChatLinkResult> => {
      const answer = answers.shift()!;
      if (answer instanceof Error) throw answer;
      return answer;
    });
    await render(<WaitingRoomJoin ask={ask} />);
    await expect.element(page.getByRole("alert")).toHaveTextContent(spamCheckCopy.refused["spam-failed"]);
    expect(ask).toHaveBeenCalledWith("", "");

    answers.push({ ok: false, reason: "closed" });
    await render(<WaitingRoomJoin ask={ask} key="2" />);
    await expect.element(page.getByText(copy.closed)).toBeVisible();

    answers.push(new Error("offline"));
    await render(<WaitingRoomJoin ask={ask} key="3" />);
    await expect.element(page.getByText(copy.failed)).toBeVisible();
  });

  it("asks nothing with an empty token, as Turnstile gives when its check expires", async () => {
    fakeTurnstile("");
    const ask = vi.fn();
    await render(<WaitingRoomJoin turnstileSiteKey="site" ask={ask} />);
    await expect.element(page.getByText(copy.check)).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(ask).not.toHaveBeenCalled();
  });

  it("waits for Turnstile's token before asking", async () => {
    // No script: Turnstile never gives a token.
    vi.spyOn(document.head, "append").mockImplementation(() => {});
    const ask = vi.fn();
    await render(<WaitingRoomJoin turnstileSiteKey="site" ask={ask} />);
    await expect.element(page.getByText(copy.check)).toBeVisible();
    expect(ask).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
