// Whether the staff navigation's sidebar is folded: remembered in a cookie
// for the staff pages alone, which the staff layout reads, so the server
// draws a folded sidebar folded, with no script to fold it after.

/** The cookie's name, and the attribute the staff layout sets from it. */
export const NAV_FOLD_KEY = "staff-nav";

/** The cookie that remembers the sidebar folded, for a year; or, unfolded, ends it. */
export const navFoldCookie = (folded: boolean) =>
  `${NAV_FOLD_KEY}=folded; path=/staff; max-age=${folded ? 60 * 60 * 24 * 365 : 0}; samesite=lax`;
