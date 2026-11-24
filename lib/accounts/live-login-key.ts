/**
 * The public half of the live site's login key, Ed25519, SPKI in base64. A
 * deploy preview checks with it that a login the live site passed on is the
 * live site's (lib/accounts/google-login.server.ts). The private half is
 * GOOGLE_LOGIN_SIGNING_KEY, set only on the live site.
 */
export const LIVE_LOGIN_KEY = "MCowBQYDK2VwAyEAl6mwXjoCcJjMM2dMKoH029QZfC85rJTtFmrkEwkcURw=";
