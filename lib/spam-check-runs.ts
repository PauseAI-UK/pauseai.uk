// What the counting of a form's spam checks goes by (lib/server/spam-check-runs.ts).

/** The forms whose spam checks are counted. */
export type SpamCheckedForm = "letter";

/** How many refusals in a row, with none let through, before staff are emailed. */
export const REFUSALS_BEFORE_EMAIL = 5;
