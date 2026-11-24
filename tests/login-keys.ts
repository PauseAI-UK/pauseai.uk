// A login key pair for tests, standing for the live site's
// (lib/accounts/live-login-key.ts): a test signs with the private half as
// GOOGLE_LOGIN_SIGNING_KEY, and mocks the public half in, with
// vi.mock("@/lib/accounts/live-login-key", () => import("@/tests/login-keys")).
import { generateKeyPairSync } from "node:crypto";

const pair = generateKeyPairSync("ed25519");

/** The private half, PKCS #8 in base64, as GOOGLE_LOGIN_SIGNING_KEY holds the live site's. */
export const TEST_LOGIN_SIGNING_KEY = pair.privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");

/** The public half, as lib/accounts/live-login-key.ts holds the live site's. */
export const LIVE_LOGIN_KEY = pair.publicKey.export({ type: "spki", format: "der" }).toString("base64");
