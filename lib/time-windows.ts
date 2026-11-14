import { staffVocabulary } from "./staff-vocabulary";
import { now } from "./now";

// The windows of time the dashboard shows, which the staff lists' date
// filters offer too: the last so many days, up to now.

/** The windows the dashboard can show, in days; the first is the default. */
export const DASHBOARD_WINDOWS = [7, 30, 90] as const;
export type DashboardWindow = (typeof DASHBOARD_WINDOWS)[number];

/** The window a URL asks for ("?days=30"), or the default. */
export function dashboardWindow(days: string | undefined): DashboardWindow {
  const found = DASHBOARD_WINDOWS.find((window) => String(window) === days);
  return found ?? DASHBOARD_WINDOWS[0];
}

/** A list's date filter from its URL ("?first=30"): those of the last so many days, as a window; otherwise off. */
export function listWindow(days: string): DashboardWindow | undefined {
  return DASHBOARD_WINDOWS.find((window) => String(window) === days);
}

/** A date filter's choices. */
export const WINDOW_OPTIONS = DASHBOARD_WINDOWS.map((days) => ({
  value: String(days),
  label: staffVocabulary.filters.lastDays(days),
}));

const DAY_MS = 24 * 60 * 60 * 1000;

/** The start of a window ending now. */
export function windowStart(days: number): Date {
  return new Date(now().getTime() - days * DAY_MS);
}
