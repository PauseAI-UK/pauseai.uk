import "server-only";

/**
 * Times the steps of something slow, and writes them to the server's log
 * as one line (on the live site, Netlify's log of the server function):
 * "Broadcast 92's writer: audience 410 ms · WhatsApp number 3 ms · … ·
 * total 420 ms". A step is timed from when it's handed over, so steps
 * going at once each have their own time, and the total is the longest.
 */
export function stopwatch(what: string) {
  const start = performance.now();
  const times: string[] = [];
  const since = (at: number) => `${Math.round(performance.now() - at)} ms`;
  return {
    /** `work`, timed as `step`, whether it works or not. */
    async time<T>(step: string, work: Promise<T>): Promise<T> {
      const at = performance.now();
      try {
        return await work;
      } finally {
        times.push(`${step} ${since(at)}`);
      }
    },
    /** Writes the steps' times, in the order they finished, and the total. */
    log(): void {
      console.info(`${what}: ${[...times, `total ${since(start)}`].join(" · ")}`);
    },
  };
}
