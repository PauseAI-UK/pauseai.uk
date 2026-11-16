import { expect, it, vi } from "vitest";
import { stopwatch } from "./stopwatch.server";

it("logs each step's time as it finished, failed or not, then the total, on one line", async () => {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const watch = stopwatch("Broadcast 92's writer");
  const slow = new Promise((resolve) => setTimeout(() => resolve("slow"), 30));
  const [first, second] = await Promise.all([watch.time("slow", slow), watch.time("quick", Promise.resolve(1))]);
  expect([first, second]).toEqual(["slow", 1]);
  await expect(watch.time("broken", Promise.reject(new Error("no")))).rejects.toThrow("no");
  watch.log();
  expect(info).toHaveBeenCalledOnce();
  const line = info.mock.calls[0][0] as string;
  expect(line).toMatch(/^Broadcast 92's writer: quick \d+ ms · slow \d+ ms · broken \d+ ms · total \d+ ms$/);
  expect(Number(/slow (\d+)/.exec(line)![1])).toBeGreaterThanOrEqual(25);
});
