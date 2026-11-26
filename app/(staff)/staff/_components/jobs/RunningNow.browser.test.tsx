import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import RunningNow from "./RunningNow";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh }),
}));

describe("RunningNow", () => {
  it("says a run is going, and asks for the page again every few seconds while it's shown", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      const shown = await render(<RunningNow>Running, started by Jo at 9:00.</RunningNow>);
      await expect.element(page.getByText("Running, started by Jo at 9:00.")).toBeVisible();
      refresh.mockClear();
      vi.advanceTimersByTime(9000);
      expect(refresh).toHaveBeenCalledTimes(3);
      await shown.unmount();
      vi.advanceTimersByTime(9000);
      expect(refresh).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
